import * as THREE from 'three';

/** Atlas cells (2x2) of the procedural FX texture. */
export const enum Tile {
  Glow = 0,
  Spark = 1,
  Ring = 2,
  Flare = 3,
}

/** Builds a 2x2 atlas of soft glow / hot spark / ring / 4-point flare on a canvas (no image decode). */
export function makeFxAtlas(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d')!;
  const cell = (i: number, draw: (cx: number, cy: number) => void) => {
    const cx = (i % 2) * S + S / 2;
    const cy = Math.floor(i / 2) * S + S / 2;
    g.save();
    draw(cx, cy);
    g.restore();
  };
  // Glow
  cell(Tile.Glow, (x, y) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - S / 2, y - S / 2, S, S);
  });
  // Spark: hot core
  cell(Tile.Spark, (x, y) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - S / 2, y - S / 2, S, S);
  });
  // Ring
  cell(Tile.Ring, (x, y) => {
    const gr = g.createRadialGradient(x, y, S * 0.28, x, y, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    gr.addColorStop(0.8, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - S / 2, y - S / 2, S, S);
  });
  // Flare: soft core + cross streaks
  cell(Tile.Flare, (x, y) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, S * 0.22);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - S / 2, y - S / 2, S, S);
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [
      [S * 0.96, 5],
      [5, S * 0.96],
    ]) {
      const lg = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h) / 2);
      lg.addColorStop(0, 'rgba(255,255,255,0.95)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(x - w / 2, y - h / 2, w, h);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  return t;
}

const VERT = /* glsl */ `
attribute vec3 iOffset;
attribute vec4 iColor;
attribute vec3 iParams; // size, rotation, tile
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(iOffset, 1.0);
  float c = cos(iParams.y), s = sin(iParams.y);
  vec2 p = position.xy;
  mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y) * iParams.x;
  gl_Position = projectionMatrix * mv;
  float t = iParams.z;
  vec2 cell = vec2(mod(t, 2.0), 1.0 - floor(t / 2.0));
  vUv = (uv + cell) * 0.5;
  vColor = iColor;
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 tex = texture2D(map, vUv);
  gl_FragColor = vec4(vColor.rgb * tex.rgb, tex.a * vColor.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface EmitOpts {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  rot?: number;
  spin?: number;
  drag?: number;
  gravity?: number;
  tile?: number;
}

/**
 * Pooled GPU-instanced billboard particles. One draw call per system, zero allocations per frame
 * (struct-of-arrays state, swap-remove on death, partial attribute uploads).
 */
export class Particles {
  readonly mesh: THREE.Mesh;
  private n = 0;
  private readonly cap: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array; // [t, maxLife]
  private size: Float32Array; // [start, end]
  private col: Float32Array; // r g b a
  private rot: Float32Array; // [rot, spin]
  private phys: Float32Array; // [drag, gravity]
  private tile: Float32Array;
  private aOffset: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aParams: THREE.InstancedBufferAttribute;
  private geo: THREE.InstancedBufferGeometry;

  constructor(cap: number, map: THREE.Texture, blending: THREE.Blending, renderOrder = 10) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap * 2);
    this.size = new Float32Array(cap * 2);
    this.col = new Float32Array(cap * 4);
    this.rot = new Float32Array(cap * 2);
    this.phys = new Float32Array(cap * 2);
    this.tile = new Float32Array(cap);

    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aOffset = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aParams = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iOffset', this.aOffset);
    this.geo.setAttribute('iColor', this.aColor);
    this.geo.setAttribute('iParams', this.aParams);
    this.geo.instanceCount = 0;

    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  emit(o: EmitOpts): void {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap); // recycle a random live one
    else this.n++;
    const i3 = i * 3;
    this.pos[i3] = o.x;
    this.pos[i3 + 1] = o.y;
    this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx ?? 0;
    this.vel[i3 + 1] = o.vy ?? 0;
    this.vel[i3 + 2] = o.vz ?? 0;
    this.life[i * 2] = 0;
    this.life[i * 2 + 1] = o.life;
    this.size[i * 2] = o.size;
    this.size[i * 2 + 1] = o.sizeEnd ?? o.size;
    const i4 = i * 4;
    this.col[i4] = o.r ?? 1;
    this.col[i4 + 1] = o.g ?? 1;
    this.col[i4 + 2] = o.b ?? 1;
    this.col[i4 + 3] = o.a ?? 1;
    this.rot[i * 2] = o.rot ?? Math.random() * 6.283;
    this.rot[i * 2 + 1] = o.spin ?? 0;
    this.phys[i * 2] = o.drag ?? 0;
    this.phys[i * 2 + 1] = o.gravity ?? 0;
    this.tile[i] = o.tile ?? 0;
  }

  clear(): void {
    this.n = 0;
    this.geo.instanceCount = 0;
  }

  update(dt: number): void {
    const off = this.aOffset.array as Float32Array;
    const colA = this.aColor.array as Float32Array;
    const par = this.aParams.array as Float32Array;
    let i = 0;
    while (i < this.n) {
      const lt = (this.life[i * 2] += dt);
      const ml = this.life[i * 2 + 1];
      if (lt >= ml) {
        this.swap(i, --this.n);
        continue;
      }
      const i3 = i * 3;
      const drag = Math.max(0, 1 - this.phys[i * 2] * dt);
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - this.phys[i * 2 + 1] * dt;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.rot[i * 2] += this.rot[i * 2 + 1] * dt;
      const k = lt / ml;
      // fast fade-in, smooth fade-out
      const fade = Math.min(1, k * 12) * (1 - k * k);
      off[i3] = this.pos[i3];
      off[i3 + 1] = this.pos[i3 + 1];
      off[i3 + 2] = this.pos[i3 + 2];
      const i4 = i * 4;
      colA[i4] = this.col[i4];
      colA[i4 + 1] = this.col[i4 + 1];
      colA[i4 + 2] = this.col[i4 + 2];
      colA[i4 + 3] = this.col[i4 + 3] * fade;
      par[i3] = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * k;
      par[i3 + 1] = this.rot[i * 2];
      par[i3 + 2] = this.tile[i];
      i++;
    }
    this.geo.instanceCount = this.n;
    if (this.n > 0) {
      for (const [a, sz] of [
        [this.aOffset, 3],
        [this.aColor, 4],
        [this.aParams, 3],
      ] as const) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, this.n * sz);
        a.needsUpdate = true;
      }
    }
  }

  private swap(a: number, b: number): void {
    if (a === b) return;
    const cp = (arr: Float32Array, s: number) => {
      for (let k = 0; k < s; k++) arr[a * s + k] = arr[b * s + k];
    };
    cp(this.pos, 3);
    cp(this.vel, 3);
    cp(this.life, 2);
    cp(this.size, 2);
    cp(this.col, 4);
    cp(this.rot, 2);
    cp(this.phys, 2);
    this.tile[a] = this.tile[b];
  }
}
