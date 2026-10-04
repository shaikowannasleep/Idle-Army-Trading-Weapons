import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bezier, clamp, easeInCubic, rand } from '../core/math';
import { LOOT_BLOCKERS, LOOT_ZONE } from './layout';
import type { Fx } from '../vfx/Fx';

export type LootKind = 'coin' | 'gem' | 'chest';
type Mode = 'air' | 'ground' | 'fly';

export const AUTO_COLLECT_TIME = 10;

interface Item {
  kind: LootKind;
  mode: Mode;
  p: THREE.Vector3;
  v: THREE.Vector3;
  t: number;
  age: number;
  value: number;
  spin: number;
  scale: number;
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  target: () => THREE.Vector3;
  dur: number;
  onArrive: ((it: Item) => void) | null;
  chest?: THREE.Object3D;
  bounces: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/**
 * All collectible / flying pickups. Coins and gems render through one InstancedMesh each;
 * equipment chests are a tiny pool of model clones.
 */
export class Loot {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private free: Item[] = [];
  private coins: THREE.InstancedMesh;
  private gems: THREE.InstancedMesh;
  private chestPool: THREE.Object3D[] = [];
  /** Called when a ground item is collected (magnet or timeout) and has reached the bag. */
  onCollect: (kind: LootKind, value: number) => void = () => {};
  bagTarget: () => THREE.Vector3 = () => _v;

  constructor(
    coin: GLTF,
    chest: GLTF,
    private fx: Fx,
  ) {
    // Coin: strip the spin rig, stand it upright.
    let coinGeo: THREE.BufferGeometry | null = null;
    let coinMat: THREE.Material | null = null;
    coin.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !coinGeo) {
        coinGeo = m.geometry.clone();
        coinMat = (m.material as THREE.MeshStandardMaterial).clone();
      }
    });
    const cg = coinGeo! as THREE.BufferGeometry;
    cg.deleteAttribute('skinIndex');
    cg.deleteAttribute('skinWeight');
    cg.computeBoundingBox();
    const c = cg.boundingBox!.getCenter(new THREE.Vector3());
    cg.translate(-c.x, -c.y, -c.z);
    const size = cg.boundingBox!.getSize(new THREE.Vector3());
    // thinnest axis becomes Z so the face points at the camera when standing
    if (size.y < size.x && size.y < size.z) cg.rotateX(Math.PI / 2);
    else if (size.x < size.y && size.x < size.z) cg.rotateY(Math.PI / 2);
    cg.scale(0.62, 0.62, 0.62);
    const cm = coinMat! as THREE.MeshStandardMaterial;
    cm.metalness = 0.65;
    cm.roughness = 0.32;
    cm.emissive = new THREE.Color('#5a3a00');
    this.coins = new THREE.InstancedMesh(cg, cm, 220);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.count = 0;
    this.coins.frustumCulled = false;

    const gg = new THREE.OctahedronGeometry(0.2, 0);
    gg.scale(1, 1.45, 1);
    const gm = new THREE.MeshStandardMaterial({
      color: '#53e8ff',
      emissive: '#1fa8ff',
      emissiveIntensity: 0.9,
      metalness: 0.2,
      roughness: 0.15,
      flatShading: true,
    });
    this.gems = new THREE.InstancedMesh(gg, gm, 60);
    this.gems.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gems.count = 0;
    this.gems.frustumCulled = false;
    this.group.add(this.coins, this.gems);

    for (let i = 0; i < 5; i++) {
      const ch = skClone(chest.scene);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.frustumCulled = false;
      });
      ch.visible = false;
      this.group.add(ch);
      this.chestPool.push(ch);
    }
  }

  private alloc(): Item {
    return (
      this.free.pop() ?? {
        kind: 'coin',
        mode: 'air',
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        t: 0,
        age: 0,
        value: 0,
        spin: 0,
        scale: 1,
        from: new THREE.Vector3(),
        ctrl: new THREE.Vector3(),
        target: () => _v,
        dur: 0.7,
        onArrive: null,
        bounces: 0,
      }
    );
  }

  /** Random landing point inside the loot zone that avoids the fallen logs. */
  private landingPoint(out: THREE.Vector3): THREE.Vector3 {
    for (let tries = 0; tries < 12; tries++) {
      out.set(rand(LOOT_ZONE.x0, LOOT_ZONE.x1), 0, rand(LOOT_ZONE.z0, LOOT_ZONE.z1));
      if (!LOOT_BLOCKERS.some((b) => out.x > b.x0 && out.x < b.x1 && out.z > b.z0 && out.z < b.z1)) return out;
    }
    return out.set(rand(3, 5), 0, rand(-1.5, 0));
  }

  /** Ballistic burst from the boss that lands inside the loot zone. */
  burst(origin: THREE.Vector3, kind: LootKind, value: number): void {
    if (kind === 'chest' && !this.chestPool.some((c) => !c.visible)) kind = 'gem';
    const it = this.alloc();
    it.kind = kind;
    it.mode = 'air';
    it.value = value;
    it.age = 0;
    it.t = 0;
    it.bounces = 0;
    it.spin = rand(0, 6.28);
    it.scale = kind === 'chest' ? 0.8 : 1;
    it.p.copy(origin);
    this.landingPoint(_v);
    // solve flight time so the arc lands on target
    const T = rand(0.9, 1.3);
    const g = 16;
    it.v.set((_v.x - origin.x) / T, (0 - origin.y + 0.5 * g * T * T) / T, (_v.z - origin.z) / T);
    if (kind === 'chest') {
      const ch = this.chestPool.find((c) => !c.visible)!;
      ch.visible = true;
      ch.scale.setScalar(it.scale);
      it.chest = ch;
    }
    this.items.push(it);
  }

  /** Something flying from `from` to a (possibly moving) target, e.g. sale coins to the HUD. */
  fly(kind: LootKind, from: THREE.Vector3, target: () => THREE.Vector3, dur: number, onArrive: ((it: Item) => void) | null, value = 0, lift = 2.5): void {
    const it = this.alloc();
    it.kind = kind === 'chest' ? 'gem' : kind;
    it.mode = 'fly';
    it.value = value;
    it.t = 0;
    it.age = 0;
    it.dur = dur;
    it.spin = rand(0, 6.28);
    it.scale = 1;
    it.from.copy(from);
    it.ctrl.set(from.x + rand(-1.2, 1.2), from.y + lift, from.z + rand(-1, 0.5));
    it.target = target;
    it.onArrive = onArrive;
    it.chest = undefined;
    it.p.copy(from);
    this.items.push(it);
  }

  private startCollect(it: Item): void {
    it.mode = 'fly';
    it.t = 0;
    it.dur = it.kind === 'chest' ? 0.85 : rand(0.55, 0.8);
    it.from.copy(it.p);
    it.ctrl.set(it.p.x, it.p.y + 3.5, it.p.z + 1.5);
    it.target = this.bagTarget;
    it.onArrive = (x) => this.onCollect(x.kind, x.value);
  }

  /** Magnet-collect everything near `p` within `radius`. */
  magnet(p: THREE.Vector3, radius: number): number {
    let n = 0;
    for (const it of this.items) {
      if (it.mode !== 'ground') continue;
      const dx = it.p.x - p.x;
      const dz = it.p.z - p.z;
      if (dx * dx + dz * dz < radius * radius) {
        this.startCollect(it);
        n++;
      }
    }
    return n;
  }

  get groundCount(): number {
    let n = 0;
    for (const it of this.items) if (it.mode !== 'fly') n++;
    return n;
  }

  /** Position of the oldest item on the ground (for tutorial hints). */
  firstGround(out: THREE.Vector3): boolean {
    for (const it of this.items)
      if (it.mode === 'ground') {
        out.copy(it.p);
        return true;
      }
    return false;
  }

  clear(): void {
    for (const it of this.items) {
      if (it.chest) it.chest.visible = false;
      this.free.push(it);
    }
    this.items.length = 0;
    this.coins.count = 0;
    this.gems.count = 0;
  }

  update(dt: number, time: number): void {
    let nc = 0;
    let ng = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      it.spin += dt * (it.mode === 'fly' ? 14 : 2.6);
      let y = 0;
      let s = it.scale;
      if (it.mode === 'air') {
        it.v.y -= 16 * dt;
        it.p.addScaledVector(it.v, dt);
        if (it.p.y <= 0.28 && it.v.y < 0) {
          it.p.y = 0.28;
          if (it.bounces++ < 1 && it.kind !== 'chest') {
            it.v.multiplyScalar(0.35);
            it.v.y = Math.abs(it.v.y) + 2;
          } else {
            it.mode = 'ground';
            it.age = 0;
            this.fx.dust(it.p, 0.3, 2);
          }
        }
        y = it.p.y;
      } else if (it.mode === 'ground') {
        y = 0.32 + Math.sin(time * 3 + it.spin) * 0.07;
        if (it.kind === 'gem' && Math.random() < dt * 3) this.fx.sparkle(it.p, 0.4, 0.9, 1);
        if (it.kind === 'chest' && Math.random() < dt * 5) this.fx.sparkle(it.p, 1, 0.85, 0.3);
        if (it.age >= AUTO_COLLECT_TIME) this.startCollect(it);
        // last 3 seconds: blink-pulse to warn it is about to auto-collect
        if (it.age > AUTO_COLLECT_TIME - 3) s *= 1 + 0.12 * Math.sin(it.age * 18);
      } else {
        it.t += dt / it.dur;
        const k = clamp(it.t, 0, 1);
        bezier(it.p, it.from, it.ctrl, it.target(), easeInCubic(k) * 0.6 + k * 0.4);
        y = it.p.y;
        s *= 1 - 0.45 * k;
        if (it.t >= 1) {
          it.onArrive?.(it);
          if (it.chest) it.chest.visible = false;
          it.chest = undefined;
          this.items.splice(i, 1);
          this.free.push(it);
          continue;
        }
      }
      if (it.kind === 'chest' && it.chest) {
        it.chest.position.set(it.p.x, it.mode === 'ground' ? 0 : y - 0.28, it.p.z);
        it.chest.rotation.y = it.mode === 'ground' ? 0.4 : it.spin;
        it.chest.scale.setScalar(s);
        continue;
      }
      _e.set(it.kind === 'gem' ? 0 : 0.15, it.spin, 0);
      _q.setFromEuler(_e);
      _s.setScalar(s);
      _v.set(it.p.x, y, it.p.z);
      _m.compose(_v, _q, _s);
      if (it.kind === 'gem') {
        if (ng < 60) this.gems.setMatrixAt(ng++, _m);
      } else if (nc < 220) this.coins.setMatrixAt(nc++, _m);
    }
    this.coins.count = nc;
    this.gems.count = ng;
    if (nc) this.coins.instanceMatrix.needsUpdate = true;
    if (ng) this.gems.instanceMatrix.needsUpdate = true;
  }
}
