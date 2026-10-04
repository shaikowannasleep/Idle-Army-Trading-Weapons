import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Assets } from '../core/assets';
import { clamp, easeOutBack, rand } from '../core/math';
import { ARMORY_X, ARMORY_Z, COUNTERS, PAD_Z, WALL_HALF, WALL_Z } from './layout';
import { WEAPONS, displayMesh, type WeaponId, type WeaponKit } from './Weapons';

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const ringTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () =>
    (t ??= canvasTex(256, (g, s) => {
      g.strokeStyle = 'white';
      g.lineWidth = 14;
      g.beginPath();
      g.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
      g.stroke();
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.0)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.18)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }));
})();

// ---------------------------------------------------------------------------------------------

interface Bag {
  base: THREE.Matrix4;
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  rv: THREE.Vector3;
  state: 0 | 1 | 2; // intact, flying, gone
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);

/** Sandbag wall: instanced bags that get blown off from the top as the wall loses HP. */
export class Barricade {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private bags: Bag[] = [];
  private flying = 0;
  private shakeT = 0;

  constructor() {
    const geo = new RoundedBoxGeometry(0.6, 0.27, 0.38, 2, 0.1);
    const mat = new THREE.MeshStandardMaterial({ color: '#cdb98a', roughness: 0.95 });
    const perLayer = Math.floor((WALL_HALF * 2) / 0.58);
    const layers = 3;
    this.mesh = new THREE.InstancedMesh(geo, mat, perLayer * layers);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    const col = new THREE.Color();
    const e = new THREE.Euler();
    let i = 0;
    for (let l = 0; l < layers; l++) {
      const n = perLayer - (l % 2);
      for (let k = 0; k < n; k++) {
        const x = -WALL_HALF + 0.3 + k * 0.58 + (l % 2) * 0.29;
        const p = new THREE.Vector3(x, 0.13 + l * 0.24, WALL_Z + rand(-0.03, 0.03));
        e.set(0, rand(-0.08, 0.08), rand(-0.04, 0.04));
        const base = new THREE.Matrix4().compose(p, _q.setFromEuler(e), _one);
        this.bags.push({ base, p: p.clone(), v: new THREE.Vector3(), r: e.clone(), rv: new THREE.Vector3(), state: 0 });
        this.mesh.setMatrixAt(i, base);
        col.setHSL(0.11, 0.3, rand(0.5, 0.62));
        this.mesh.setColorAt(i, col);
        i++;
      }
    }
    this.mesh.count = i;
    this.group.add(this.mesh);

    // timber posts at both ends + a few spikes for silhouette (one merged draw call)
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 });
    const parts: THREE.BufferGeometry[] = [];
    for (const x of [-WALL_HALF - 0.2, WALL_HALF + 0.2]) parts.push(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 8).translate(x, 0.6, WALL_Z));
    for (let k = 0; k < 7; k++) {
      const g = new THREE.ConeGeometry(0.07, 0.9, 6);
      g.rotateX(-0.7);
      g.translate(-5.4 + k * 1.8, 0.35, WALL_Z - 0.55);
      parts.push(g);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(parts), wood));
    shadowed(this.group);
    // static geometry: compute matrices once (instance matrices are animated separately)
    this.group.updateMatrixWorld(true);
    this.group.traverse((o) => (o.matrixAutoUpdate = false));
  }

  get total(): number {
    return this.bags.length;
  }

  /** Called when HP changes; flings bags until the intact count matches the HP ratio. */
  setRatio(frac: number, impactX = 0): void {
    const want = Math.ceil(clamp(frac, 0, 1) * this.bags.length);
    let intact = this.bags.filter((b) => b.state === 0).length;
    // remove top layers first, closest to the impact
    const order = this.bags
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.state === 0)
      .sort((a, b) => b.b.p.y - a.b.p.y || Math.abs(a.b.p.x - impactX) - Math.abs(b.b.p.x - impactX));
    for (const { b } of order) {
      if (intact <= want) break;
      b.state = 1;
      b.v.set((b.p.x - impactX) * rand(0.4, 0.9) + rand(-1.5, 1.5), rand(4, 8), rand(2, 5));
      b.rv.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
      this.flying++;
      intact--;
    }
    this.shakeT = 0.25;
  }

  restore(): void {
    for (let i = 0; i < this.bags.length; i++) {
      const b = this.bags[i];
      b.state = 0;
      b.base.decompose(b.p, _q, new THREE.Vector3());
      this.mesh.setMatrixAt(i, b.base);
    }
    this.flying = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    if (this.flying === 0 && this.shakeT <= 0) return;
    this.shakeT = Math.max(0, this.shakeT - dt);
    const jolt = this.shakeT * 0.25;
    this.flying = 0;
    for (let i = 0; i < this.bags.length; i++) {
      const b = this.bags[i];
      if (b.state === 0) {
        if (jolt > 0) {
          _m.copy(b.base);
          _m.elements[12] += rand(-jolt, jolt);
          _m.elements[14] += rand(-jolt, jolt);
          this.mesh.setMatrixAt(i, _m);
        } else this.mesh.setMatrixAt(i, b.base);
      } else if (b.state === 1) {
        this.flying++;
        b.v.y -= 18 * dt;
        b.p.addScaledVector(b.v, dt);
        b.r.x += b.rv.x * dt;
        b.r.y += b.rv.y * dt;
        b.r.z += b.rv.z * dt;
        if (b.p.y < -0.5) {
          b.state = 2;
          _m.makeScale(0, 0, 0);
        } else _m.compose(b.p, _q.setFromEuler(b.r), _one);
        this.mesh.setMatrixAt(i, _m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------

/** Wooden sales counter (procedural, vertex-coloured, single draw call + emissive screen). */
export function makeCounter(alongZ: boolean): THREE.Group {
  const g = new THREE.Group();
  const tint = (geo: THREE.BufferGeometry, hex: string, y: number, x = 0, z = 0) => {
    const ng = geo.index ? geo.toNonIndexed() : geo;
    ng.translate(x, y, z);
    const c = new THREE.Color(hex);
    const n = ng.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(col, i * 3);
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ng.deleteAttribute('uv');
    return ng;
  };
  const body = mergeGeometries([
    tint(new RoundedBoxGeometry(2.3, 0.85, 0.75, 2, 0.06), '#4d3220', 0.43),
    tint(new RoundedBoxGeometry(2.55, 0.1, 0.95, 2, 0.04), '#9a6a3c', 0.9),
    tint(new THREE.BoxGeometry(2.32, 0.12, 0.77), '#2f6b4a', 0.66),
    tint(new RoundedBoxGeometry(0.42, 0.26, 0.34, 2, 0.04), '#30353d', 1.08, 0.75),
  ]);
  const mesh = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: '#59ff9a' }));
  screen.position.set(0.75, 1.17, 0.17);
  screen.rotation.x = -0.4;
  g.add(mesh, screen);
  if (alongZ) g.rotation.y = Math.PI / 2;
  return shadowed(g);
}

/** Glowing ground ring (serve spot, crate halo). */
export class GroundRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  pulse = 0;
  constructor(radius: number, color: THREE.ColorRepresentation) {
    this.mat = new THREE.MeshBasicMaterial({ map: ringTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 5;
  }
  setColor(c: THREE.ColorRepresentation): void {
    this.mat.color.set(c);
  }
  update(time: number, intensity = 1): void {
    const s = 1 + Math.sin(time * 4 + this.pulse) * 0.05;
    this.mesh.scale.set(s, 1, s);
    this.mat.opacity = (0.65 + 0.35 * Math.sin(time * 4 + this.pulse)) * intensity;
  }
}

// ---------------------------------------------------------------------------------------------

export type PadKind = 'unlock' | 'upgrade' | 'expand' | 'fortify';

/** Idle-style pay pad: stand on it and coins drain into it until it is paid. */
export class Pad {
  readonly group = new THREE.Group();
  readonly ring: GroundRing;
  private fill: THREE.Mesh;
  private frameMat: THREE.MeshBasicMaterial;
  private fillMat: THREE.MeshBasicMaterial;
  cost = 0;
  gems = 0;
  paid = 0;
  active = false;
  /** 0..1 appear animation */
  private appear = 0;
  occupied = false;
  drainAcc = 0;
  label = '';
  sub = '';
  icon = '';
  denied = 0;

  constructor(
    readonly id: string,
    readonly kind: PadKind,
    readonly weapon: WeaponId | null,
    readonly at: THREE.Vector3,
    readonly size = 1.35,
  ) {
    const ringColor =
      kind === 'expand'
        ? '#5ee7ff'
        : kind === 'fortify'
          ? '#ffd34d'
          : weapon
            ? WEAPONS.find((w) => w.id === weapon)?.color ?? '#4dff88'
            : '#4dff88';
    this.ring = new GroundRing(size * 0.78, ringColor);
    this.ring.mesh.position.set(0, 0.02, 0);

    const tex = canvasTex(256, (g, s) => {
      const r = 46;
      const m = 14;
      g.beginPath();
      g.roundRect(m, m, s - 2 * m, s - 2 * m, r);
      g.fillStyle = 'rgba(10,20,25,0.45)';
      g.fill();
      g.lineWidth = 14;
      g.strokeStyle = 'white';
      g.setLineDash([34, 18]);
      g.stroke();
    });
    this.frameMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), this.frameMat);
    frame.renderOrder = 4;
    this.fillMat = new THREE.MeshBasicMaterial({ color: '#4dff88', transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    // fill grows from the near edge toward the far edge
    const fg = new THREE.PlaneGeometry(size * 0.84, size * 0.84).rotateX(-Math.PI / 2).translate(0, 0, -size * 0.42);
    this.fill = new THREE.Mesh(fg, this.fillMat);
    this.fill.position.set(0, 0.01, size * 0.42);
    this.fill.renderOrder = 5;
    this.group.add(frame, this.fill, this.ring.mesh);
    this.group.position.copy(at).setY(0.03);
    this.group.visible = false;
  }

  show(cost: number, gems: number, label: string, sub: string, icon: string): void {
    // same offer already on the ground: keep the partial payment, just refresh the price
    if (this.active && this.label === label && this.sub === sub) {
      this.cost = cost;
      this.gems = gems;
      return;
    }
    this.cost = cost;
    this.gems = gems;
    this.paid = 0;
    this.label = label;
    this.sub = sub;
    this.icon = icon;
    if (!this.active) this.appear = 0;
    this.active = true;
    this.ring.mesh.visible = true;
    this.group.visible = true;
  }

  hide(): void {
    this.active = false;
    this.ring.mesh.visible = false;
    this.group.visible = false;
    this.occupied = false;
  }

  get progress(): number {
    return this.cost > 0 ? this.paid / this.cost : 1;
  }

  contains(p: THREE.Vector3): boolean {
    const h = this.size * 0.55;
    return Math.abs(p.x - this.at.x) < h && Math.abs(p.z - this.at.z) < h;
  }

  update(dt: number, time: number): void {
    if (!this.active) return;
    this.appear = Math.min(1, this.appear + dt * 3);
    const s = easeOutBack(this.appear) * (this.occupied ? 1.08 : 1 + Math.sin(time * 3) * 0.02);
    this.group.scale.set(s, 1, s);
    this.ring.update(time, this.occupied ? 1.4 : 0.95);
    this.fill.visible = this.progress > 0.001;
    this.fill.scale.set(1, 1, Math.max(0.001, this.progress));
    this.denied = Math.max(0, this.denied - dt);
    this.fillMat.color.set(this.denied > 0 ? '#ff5a4d' : '#4dff88');
    this.frameMat.color.setScalar(this.occupied ? 1 : 0.85);
  }
}

// ---------------------------------------------------------------------------------------------

interface CrateSlot {
  weapon: WeaponId;
  crate: THREE.Object3D;
  locked: THREE.Object3D;
  display: THREE.Object3D | null;
  halo: GroundRing;
  unlocked: boolean;
  pop: number;
}

/** Weapon storage in front of the tent: one crate per weapon, a locked box until purchased. */
export class Armory {
  readonly group = new THREE.Group();
  readonly slots: CrateSlot[] = [];

  constructor(assets: Assets, kit: WeaponKit) {
    WEAPONS.forEach((w, i) => {
      const pos = new THREE.Vector3(ARMORY_X[i], 0, ARMORY_Z);
      let crate: THREE.Object3D;
      let display: THREE.Object3D | null = null;
      if (w.id === 'pistol') crate = assets.models.machine2.scene.clone();
      else if (w.id === 'rifle') crate = assets.models.machine4.scene.clone();
      else {
        crate = assets.models.slot2.scene.clone();
        display = displayMesh(kit, w.id);
        const holder = new THREE.Group();
        holder.add(display);
        holder.position.y = 1.55;
        crate.add(holder);
        display = holder;
      }
      crate.scale.setScalar(1.15);
      crate.position.copy(pos);
      crate.rotation.y = -0.25;
      const locked = skClone(assets.models.chest.scene);
      locked.position.copy(pos);
      locked.scale.setScalar(1.05);
      locked.rotation.y = 0.3;
      const halo = new GroundRing(0.95, w.color);
      halo.mesh.position.set(pos.x, 0.04, pos.z);
      halo.pulse = i;
      this.group.add(shadowed(crate), shadowed(locked), halo.mesh);
      this.slots.push({ weapon: w.id, crate, locked, display, halo, unlocked: false, pop: 1 });
    });
  }

  crateTop(id: WeaponId, out: THREE.Vector3): THREE.Vector3 {
    const i = WEAPONS.findIndex((w) => w.id === id);
    return out.set(ARMORY_X[i], 1.5, ARMORY_Z);
  }

  setUnlocked(id: WeaponId, v: boolean, animate = true): void {
    const s = this.slots.find((x) => x.weapon === id)!;
    s.unlocked = v;
    s.crate.visible = v;
    s.locked.visible = !v;
    s.halo.mesh.visible = v;
    s.pop = animate ? 0 : 1;
  }

  padPos(id: WeaponId): THREE.Vector3 {
    const i = WEAPONS.findIndex((w) => w.id === id);
    return new THREE.Vector3(ARMORY_X[i], 0, PAD_Z);
  }

  update(dt: number, time: number): void {
    for (const s of this.slots) {
      if (s.unlocked) {
        s.pop = Math.min(1, s.pop + dt * 2.5);
        s.crate.scale.setScalar(1.15 * easeOutBack(s.pop));
        s.halo.update(time, 0.7);
        if (s.display) {
          s.display.rotation.y = time * 1.6;
          s.display.position.y = 1.55 + Math.sin(time * 2.2) * 0.08;
        }
      } else {
        s.locked.rotation.y = 0.3 + Math.sin(time * 1.5) * 0.05;
      }
    }
  }
}

/** Serve spot ring behind each counter. */
export class Counters {
  readonly group = new THREE.Group();
  readonly rings: GroundRing[] = [];
  readonly meshes: THREE.Group[] = [];
  private pop: number[] = [1, 1];

  constructor() {
    COUNTERS.forEach((c, i) => {
      const m = makeCounter(i === 1);
      m.position.copy(c.counter);
      this.group.add(m);
      this.meshes.push(m);
      const r = new GroundRing(0.85, '#ffffff');
      r.mesh.position.set(c.serveSpot.x, 0.05, c.serveSpot.z);
      this.group.add(r.mesh);
      this.rings.push(r);
    });
  }

  setEnabled(i: number, v: boolean, animate = false): void {
    this.meshes[i].visible = v;
    this.rings[i].mesh.visible = v;
    this.pop[i] = animate ? 0 : 1;
  }

  update(dt: number, time: number, active: boolean[]): void {
    this.meshes.forEach((m, i) => {
      if (this.pop[i] < 1) {
        this.pop[i] = Math.min(1, this.pop[i] + dt * 2.5);
        m.scale.setScalar(easeOutBack(this.pop[i]));
      }
      this.rings[i].setColor(active[i] ? '#5dff8f' : '#ffffff');
      this.rings[i].update(time, active[i] ? 1 : 0.6);
    });
  }
}

