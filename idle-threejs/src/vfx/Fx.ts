import * as THREE from 'three';
import { Particles, Tile, makeFxAtlas } from './Particles';
import { rand } from '../core/math';

const TRACER_VERT = /* glsl */ `
attribute vec3 iStart;
attribute vec3 iEnd;
attribute vec4 iColor;
attribute float iWidth;
varying vec2 vP;
varying vec4 vColor;
void main() {
  vec4 a = modelViewMatrix * vec4(iStart, 1.0);
  vec4 b = modelViewMatrix * vec4(iEnd, 1.0);
  vec2 d = b.xy - a.xy;
  float len = max(length(d), 1e-4);
  vec2 dir = d / len;
  vec2 perp = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, position.x);
  p.xy += perp * position.y * iWidth;
  gl_Position = projectionMatrix * p;
  vP = position.xy;
  vColor = iColor;
}`;
const TRACER_FRAG = /* glsl */ `
varying vec2 vP;
varying vec4 vColor;
void main() {
  float across = 1.0 - abs(vP.y) * 2.0;
  float a = across * across * smoothstep(0.0, 0.6, vP.x);
  gl_FragColor = vec4(vColor.rgb * (1.0 + across * 1.5), a * vColor.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Instanced camera-facing streaks for bullets (head travels muzzle -> target, tail follows). */
class Tracers {
  readonly mesh: THREE.Mesh;
  private n = 0;
  private a: Float32Array;
  private b: Float32Array;
  private t: Float32Array; // [elapsed, duration]
  private c: Float32Array;
  private w: Float32Array;
  private aS: THREE.InstancedBufferAttribute;
  private aE: THREE.InstancedBufferAttribute;
  private aC: THREE.InstancedBufferAttribute;
  private aW: THREE.InstancedBufferAttribute;
  private geo = new THREE.InstancedBufferGeometry();

  constructor(private cap: number) {
    this.a = new Float32Array(cap * 3);
    this.b = new Float32Array(cap * 3);
    this.t = new Float32Array(cap * 2);
    this.c = new Float32Array(cap * 4);
    this.w = new Float32Array(cap);
    const pos = new Float32Array([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0]);
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (s: number) => new THREE.InstancedBufferAttribute(new Float32Array(cap * s), s).setUsage(THREE.DynamicDrawUsage);
    this.aS = mk(3);
    this.aE = mk(3);
    this.aC = mk(4);
    this.aW = mk(1);
    this.geo.setAttribute('iStart', this.aS);
    this.geo.setAttribute('iEnd', this.aE);
    this.geo.setAttribute('iColor', this.aC);
    this.geo.setAttribute('iWidth', this.aW);
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: TRACER_VERT,
        fragmentShader: TRACER_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
  }

  add(from: THREE.Vector3, to: THREE.Vector3, dur: number, width: number, r: number, g: number, b: number): void {
    let i = this.n;
    if (i >= this.cap) i = 0;
    else this.n++;
    this.a.set([from.x, from.y, from.z], i * 3);
    this.b.set([to.x, to.y, to.z], i * 3);
    this.t[i * 2] = 0;
    this.t[i * 2 + 1] = dur;
    this.c.set([r, g, b, 1], i * 4);
    this.w[i] = width;
  }

  clear(): void {
    this.n = 0;
    this.geo.instanceCount = 0;
  }

  update(dt: number): void {
    const S = this.aS.array as Float32Array;
    const E = this.aE.array as Float32Array;
    const C = this.aC.array as Float32Array;
    const W = this.aW.array as Float32Array;
    let i = 0;
    while (i < this.n) {
      const el = (this.t[i * 2] += dt);
      const k = el / this.t[i * 2 + 1];
      if (k >= 1.35) {
        const j = --this.n;
        if (i !== j) {
          this.a.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.b.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.t.copyWithin(i * 2, j * 2, j * 2 + 2);
          this.c.copyWithin(i * 4, j * 4, j * 4 + 4);
          this.w[i] = this.w[j];
        }
        continue;
      }
      const head = Math.min(1, k);
      const tail = Math.max(0, k - 0.35);
      for (let q = 0; q < 3; q++) {
        const a = this.a[i * 3 + q];
        const d = this.b[i * 3 + q] - a;
        S[i * 3 + q] = a + d * tail;
        E[i * 3 + q] = a + d * head;
      }
      C[i * 4] = this.c[i * 4];
      C[i * 4 + 1] = this.c[i * 4 + 1];
      C[i * 4 + 2] = this.c[i * 4 + 2];
      C[i * 4 + 3] = k > 1 ? 1 - (k - 1) / 0.35 : 1;
      W[i] = this.w[i];
      i++;
    }
    this.geo.instanceCount = this.n;
    if (this.n) {
      for (const [attr, s] of [
        [this.aS, 3],
        [this.aE, 3],
        [this.aC, 4],
        [this.aW, 1],
      ] as const) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, this.n * s);
        attr.needsUpdate = true;
      }
    }
  }
}

interface Timed {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  from: number;
  to: number;
  active: boolean;
}

/** Ground shockwave rings & vertical energy pillars (small mesh pools, per-instance material). */
class GroundFx {
  readonly group = new THREE.Group();
  private rings: Timed[] = [];
  private pillars: Timed[] = [];

  constructor(atlas: THREE.Texture) {
    const ringTex = atlas.clone();
    ringTex.repeat.set(0.5, 0.5);
    ringTex.offset.set(0, 0); // Ring tile = bottom-left
    ringTex.needsUpdate = true;
    const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      );
      m.visible = false;
      m.renderOrder = 9;
      this.group.add(m);
      this.rings.push({ mesh: m, t: 0, dur: 1, from: 0, to: 1, active: false });
    }
    // vertical gradient for pillars
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.92, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0.6)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 128);
    const pTex = new THREE.CanvasTexture(c);
    const pGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        pGeo,
        new THREE.MeshBasicMaterial({
          map: pTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      m.visible = false;
      m.renderOrder = 9;
      this.group.add(m);
      this.pillars.push({ mesh: m, t: 0, dur: 1, from: 0, to: 1, active: false });
    }
  }

  ring(pos: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, dur = 0.6, startR = 0.2): void {
    const r = this.rings.find((x) => !x.active) ?? this.rings[0];
    r.active = true;
    r.t = 0;
    r.dur = dur;
    r.from = startR * 2;
    r.to = radius * 2;
    r.mesh.position.set(pos.x, pos.y + 0.06, pos.z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    r.mesh.visible = true;
  }

  pillar(pos: THREE.Vector3, radius: number, height: number, color: THREE.ColorRepresentation, dur = 1.2): void {
    const p = this.pillars.find((x) => !x.active) ?? this.pillars[0];
    p.active = true;
    p.t = 0;
    p.dur = dur;
    p.from = radius;
    p.to = height;
    p.mesh.position.copy(pos);
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    p.mesh.visible = true;
  }

  clear(): void {
    for (const x of [...this.rings, ...this.pillars]) {
      x.active = false;
      x.mesh.visible = false;
    }
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const s = r.from + (r.to - r.from) * e;
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (1 - k);
    }
    for (const p of this.pillars) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const grow = Math.min(1, k * 5);
      const rr = p.from * (1 - 0.6 * k) * (0.4 + 0.6 * grow);
      p.mesh.scale.set(rr, p.to * grow, rr);
      p.mesh.rotation.y += dt * 3;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }
}

const _v = new THREE.Vector3();

/** High-level effect vocabulary used by gameplay. */
export class Fx {
  readonly add: Particles;
  readonly smoke: Particles;
  readonly tracers = new Tracers(160);
  readonly ground: GroundFx;
  /** Camera shake "trauma" in [0,1]; offset ~ trauma^2. */
  trauma = 0;

  constructor(scene: THREE.Scene, smokeTex: THREE.Texture) {
    const atlas = makeFxAtlas();
    this.add = new Particles(900, atlas, THREE.AdditiveBlending, 12);
    this.smoke = new Particles(260, smokeTex, THREE.NormalBlending, 8);
    this.ground = new GroundFx(atlas);
    scene.add(this.smoke.mesh, this.add.mesh, this.tracers.mesh, this.ground.group);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  clear(): void {
    this.add.clear();
    this.smoke.clear();
    this.tracers.clear();
    this.ground.clear();
    this.trauma = 0;
  }

  update(dt: number): void {
    this.add.update(dt);
    this.smoke.update(dt);
    this.tracers.update(dt);
    this.ground.update(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  muzzle(p: THREE.Vector3, r = 1, g = 0.75, b = 0.35, scale = 1): void {
    this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.07, size: 0.75 * scale, sizeEnd: 0.3 * scale, r, g, b, tile: Tile.Flare });
    this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.1, size: 0.9 * scale, sizeEnd: 0.4, r, g: g * 0.8, b: b * 0.6, a: 0.7, tile: Tile.Glow });
  }

  hit(p: THREE.Vector3, r = 1, g = 0.8, b = 0.4, n = 3): void {
    for (let i = 0; i < n; i++) {
      this.add.emit({
        x: p.x,
        y: p.y,
        z: p.z,
        vx: rand(-4, 4),
        vy: rand(1, 5),
        vz: rand(-1, 4),
        life: rand(0.18, 0.35),
        size: rand(0.14, 0.24),
        sizeEnd: 0.02,
        r,
        g,
        b,
        gravity: 12,
        drag: 2,
        tile: Tile.Spark,
      });
    }
    this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.12, size: 0.8, sizeEnd: 1.2, r, g: g * 0.7, b: b * 0.5, a: 0.55, tile: Tile.Glow });
  }

  explosion(p: THREE.Vector3, size = 1, r = 1, g = 0.55, b = 0.2): void {
    this.add.emit({ x: p.x, y: p.y + 0.3, z: p.z, life: 0.3, size: 3.2 * size, sizeEnd: 5 * size, r: 1, g: 0.9, b: 0.7, tile: Tile.Glow });
    this.add.emit({ x: p.x, y: p.y + 0.3, z: p.z, life: 0.22, size: 4.2 * size, sizeEnd: 1.2 * size, r, g, b, tile: Tile.Flare });
    for (let i = 0; i < 18 * size; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(3, 9) * size;
      this.add.emit({
        x: p.x,
        y: p.y + 0.4,
        z: p.z,
        vx: Math.cos(a) * s,
        vy: rand(2, 9) * size,
        vz: Math.sin(a) * s,
        life: rand(0.35, 0.8),
        size: rand(0.12, 0.3) * size,
        sizeEnd: 0.02,
        r: 1,
        g: rand(0.5, 0.85),
        b: 0.25,
        gravity: 14,
        drag: 1.5,
        tile: Tile.Spark,
      });
    }
    for (let i = 0; i < 8 * size; i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.emit({
        x: p.x + Math.cos(a) * 0.4,
        y: p.y + rand(0.2, 1),
        z: p.z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * rand(1, 3) * size,
        vy: rand(0.8, 2.5),
        vz: Math.sin(a) * rand(1, 3) * size,
        life: rand(0.9, 1.6),
        size: rand(1.2, 2) * size,
        sizeEnd: rand(2.6, 3.6) * size,
        r: 0.32,
        g: 0.3,
        b: 0.3,
        a: 0.75,
        drag: 2.2,
        spin: rand(-1, 1),
        tile: Math.floor(Math.random() * 4),
      });
    }
    this.ground.ring(p, 3.2 * size, 0xffa040, 0.5);
  }

  /** Smoke puff + sparkles used for unit transformation / spawning. */
  poof(p: THREE.Vector3, r = 1, g = 1, b = 1, size = 1): void {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      this.smoke.emit({
        x: p.x + Math.cos(a) * 0.3,
        y: p.y + rand(0.2, 1.1),
        z: p.z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * 1.8 * size,
        vy: rand(0.4, 1.4),
        vz: Math.sin(a) * 1.8 * size,
        life: rand(0.6, 0.9),
        size: 0.7 * size,
        sizeEnd: 1.5 * size,
        r: 0.95,
        g: 0.95,
        b: 0.95,
        a: 0.85,
        drag: 3.5,
        tile: Math.floor(Math.random() * 4),
      });
    }
    for (let i = 0; i < 10; i++) {
      this.add.emit({
        x: p.x + rand(-0.5, 0.5),
        y: p.y + rand(0.3, 1.6),
        z: p.z + rand(-0.5, 0.5),
        vy: rand(1, 3),
        life: rand(0.5, 0.9),
        size: rand(0.2, 0.4),
        sizeEnd: 0,
        r,
        g,
        b,
        spin: 3,
        tile: Tile.Flare,
      });
    }
    this.ground.ring(p, 1.4 * size, new THREE.Color(r, g, b), 0.45);
  }

  dust(p: THREE.Vector3, size = 1, n = 10): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(1.5, 4) * size;
      this.smoke.emit({
        x: p.x + Math.cos(a) * 0.6 * size,
        y: p.y + 0.15,
        z: p.z + Math.sin(a) * 0.6 * size,
        vx: Math.cos(a) * s,
        vy: rand(0.3, 1.2),
        vz: Math.sin(a) * s,
        life: rand(0.7, 1.2),
        size: 0.9 * size,
        sizeEnd: 2.2 * size,
        r: 0.55,
        g: 0.47,
        b: 0.38,
        a: 0.7,
        drag: 3,
        tile: Math.floor(Math.random() * 4),
      });
    }
  }

  sparkle(p: THREE.Vector3, r: number, g: number, b: number): void {
    this.add.emit({
      x: p.x + rand(-0.25, 0.25),
      y: p.y + rand(0, 0.5),
      z: p.z + rand(-0.25, 0.25),
      vy: rand(0.6, 1.4),
      life: rand(0.5, 0.8),
      size: rand(0.15, 0.3),
      sizeEnd: 0,
      r,
      g,
      b,
      spin: 4,
      tile: Tile.Flare,
    });
  }

  /** Rising embers around a point (boss aura). */
  ember(p: THREE.Vector3, radius: number, r: number, g: number, b: number): void {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * radius;
    _v.set(p.x + Math.cos(a) * d, p.y + rand(0, 0.6), p.z + Math.sin(a) * d);
    this.add.emit({
      x: _v.x,
      y: _v.y,
      z: _v.z,
      vx: rand(-0.3, 0.3),
      vy: rand(1.2, 3),
      vz: rand(-0.3, 0.3),
      life: rand(0.8, 1.4),
      size: rand(0.12, 0.3),
      sizeEnd: 0,
      r,
      g,
      b,
      tile: Tile.Spark,
    });
  }

  trail(p: THREE.Vector3): void {
    this.smoke.emit({
      x: p.x,
      y: p.y,
      z: p.z,
      vy: 0.4,
      life: 0.6,
      size: 0.35,
      sizeEnd: 0.9,
      r: 0.8,
      g: 0.78,
      b: 0.75,
      a: 0.6,
      drag: 1,
      tile: Math.floor(Math.random() * 4),
    });
    this.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.08, size: 0.5, sizeEnd: 0.2, r: 1, g: 0.6, b: 0.2, tile: Tile.Glow });
  }
}
