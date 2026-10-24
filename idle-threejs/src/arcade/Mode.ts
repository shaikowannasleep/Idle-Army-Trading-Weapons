import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Assets } from '../core/assets';
import type { Audio } from '../core/Audio';
import type { WeaponKit } from '../game/Weapons';
import { Fx } from '../vfx/Fx';
import { BlobShadows } from '../vfx/BlobShadows';
import type { ArcadeHud } from './ArcadeHud';
import { Crowd, type CrowdSpec } from './Crowd';
import { PlayableAdsFlowManager } from '../tracking/PlayableAdsFlowManager';

export interface Ctx {
  engine: Engine;
  assets: Assets;
  audio: Audio;
  hud: ArcadeHud;
  kit: WeaponKit;
  skins: { soldier: THREE.Material; civA: THREE.Material; civB: THREE.Material; zombie: THREE.Material };
  env: THREE.Texture;
}

export interface StageLook {
  sky: string;
  fog: [number, number];
  hemi: [string, string, number];
  sun: { color: string; intensity: number; pos: [number, number, number]; box: number };
}

export type Outcome = 'play' | 'win' | 'lose';

/** One self-contained mini game: its own scene, camera rig, HUD wiring and debug hooks. */
export abstract class Mode {
  readonly scene = new THREE.Scene();
  readonly fx: Fx;
  readonly blobs: BlobShadows;
  abstract readonly id: string;
  abstract readonly title: string;
  level = 1;
  outcome: Outcome = 'play';
  t = 0;
  /** Autoplay for tests and the trailer. */
  bot = false;
  /** Level-1 tutorial step (-1 = off). */
  protected tutStep = -1;
  protected tutT = 0;

  /** Spotlight a world point with radius `r` (world units) for the tutorial overlay. */
  protected spotWorld(p: THREE.Vector3, r: number, text: string, drag?: [number, number]): void {
    const hud = this.ctx.hud;
    const cam = this.ctx.engine.camera;
    const c = hud.project(p, cam);
    const e = hud.project(p.clone().setX(p.x + r), cam);
    hud.spot({ x: c.x, y: c.y, r: Math.max(44, Math.hypot(e.x - c.x, e.y - c.y)), text, drag });
  }
  /** Deterministic overrides for the trailer (no randomness in damage numbers etc.). */
  protected sun!: THREE.DirectionalLight;
  protected camPos = new THREE.Vector3();
  protected camLook = new THREE.Vector3();
  private shakeSeed = Math.random() * 100;
  onEnd: (win: boolean) => void = () => {};

  constructor(protected ctx: Ctx, look: StageLook, blobCap = 64) {
    const s = this.scene;
    s.background = new THREE.Color(look.sky);
    s.fog = new THREE.Fog(look.sky, look.fog[0], look.fog[1]);
    s.environment = ctx.env;
    s.environmentIntensity = 0.4;
    s.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
    const sun = new THREE.DirectionalLight(look.sun.color, look.sun.intensity);
    sun.position.set(...look.sun.pos);
    sun.castShadow = true;
    const b = look.sun.box;
    Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 80 });
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    s.add(sun, sun.target);
    this.sun = sun;
    this.fx = new Fx(s, ctx.assets.textures.smoke, ctx.assets.textures.shock);
    this.blobs = new BlobShadows(blobCap);
    s.add(this.blobs.mesh);
  }

  protected crowd(spec: CrowdSpec, cap: number): Crowd {
    const c = new Crowd(this.ctx.assets.models.customer, this.ctx.kit, spec, cap);
    this.scene.add(c.group);
    return c;
  }

  /** Scatter props cut from the Test00 map (tools/map-props.py): one instanced draw per prop type per 24 m chunk, so off-screen chunks are culled. */
  protected props(items: [name: string, x: number, z: number, yaw: number, scale: number][], shadows = true): void {
    const src = this.ctx.assets.models.props.scene;
    const by = new Map<string, typeof items>();
    for (const it of items) {
      const key = `${it[0]}|${Math.round(it[1] / 24)}|${Math.round(it[2] / 24)}`;
      by.set(key, [...(by.get(key) ?? []), it]);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of by) {
      const mesh = src.getObjectByName(name.split('|')[0]) as THREE.Mesh;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
      list.forEach(([, x, z, yaw, sc], i) => im.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromAxisAngle(up, yaw), s.setScalar(sc))));
      im.castShadow = shadows;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
  }

  /** Keep the shadow frustum centred on the action. */
  protected followSun(x: number, z: number): void {
    const off = this.sun.position.clone().sub(this.sun.target.position);
    this.sun.target.position.set(x, 0, z);
    this.sun.position.copy(this.sun.target.position).add(off);
  }

  /** Apply camPos/camLook with trauma shake to the shared camera. */
  protected applyCamera(fov: number): void {
    const cam = this.ctx.engine.camera;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const tr = this.fx.trauma * this.fx.trauma;
    const k = this.t * 37 + this.shakeSeed;
    cam.position.set(this.camPos.x + Math.sin(k * 1.7) * tr * 0.6, this.camPos.y + Math.sin(k * 2.3) * tr * 0.4, this.camPos.z + Math.cos(k * 1.9) * tr * 0.6);
    cam.lookAt(this.camLook);
  }

  protected track(success = true): void {
    PlayableAdsFlowManager.instance.trackClick(success, success ? 1 : 0);
  }

  protected finish(win: boolean): void {
    if (this.outcome !== 'play') return;
    this.outcome = win ? 'win' : 'lose';
    this.onEnd(win);
  }

  /** Portrait-first: wider fov on narrow screens so the play field always fits. */
  protected fovFor(base: number): number {
    const a = this.ctx.engine.camera.aspect;
    return a < 0.6 ? base * (0.6 / a) ** 0.55 : a > 1 ? base * 0.85 : base;
  }

  abstract start(level: number): void;
  abstract update(dt: number): void;
  abstract endStats(): [string, string][];
  abstract state(): Record<string, unknown>;
  /** Test hook: force an outcome path. */
  abstract cheat(kind: 'win' | 'lose'): void;
  pointerDown(_x: number, _y: number): void {}
  pointerMove(_x: number, _y: number): void {}
  pointerUp(_x: number, _y: number): void {}
  /** Clean up DOM listeners etc. when leaving the mode. */
  exit(): void {}
}

/** Pointer ray onto the y=0 ground plane. */
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function groundPoint(x: number, y: number, cam: THREE.Camera, out: THREE.Vector3, height = 0): THREE.Vector3 | null {
  _ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  _ray.setFromCamera(_ndc, cam);
  _plane.constant = -height;
  return _ray.ray.intersectPlane(_plane, out);
}

/** Text billboard on a canvas texture (gate numbers, HP labels): redraws only when the text changes. */
export class Label3D {
  readonly sprite: THREE.Sprite;
  private ctx2d: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private text = '';
  private color = '';

  constructor(w = 256, h = 96, scale = 2) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    this.ctx2d = c.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthWrite: false, fog: false }));
    this.sprite.scale.set(scale, (scale * h) / w, 1);
    this.sprite.renderOrder = 20;
  }

  set(text: string, color = '#ffffff'): void {
    if (text === this.text && color === this.color) return;
    this.text = text;
    this.color = color;
    const g = this.ctx2d;
    const { width: w, height: hh } = g.canvas;
    g.clearRect(0, 0, w, hh);
    g.font = `900 ${Math.floor(hh * 0.78)}px 'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = hh * 0.14;
    g.strokeStyle = '#10161b';
    g.strokeText(text, w / 2, hh / 2 + 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, hh / 2 + 2);
    this.tex.needsUpdate = true;
  }
}

/** Seeded PRNG so a level's layout is identical on every run (tests, trailer). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seamless canvas ground: soft colour patches + blade/pebble specks, so big planes don't read as plastic. */
export function groundTex(base: string, patches: string[], specks: string[], repeat: [number, number], seed = 1, size = 512): THREE.CanvasTexture {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // every mark is drawn at its 3x3 wrap offsets so the tile has no seams
  const wrap = (fn: (x: number, y: number) => void, x: number, y: number) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy);
  };
  for (let i = 0; i < 70; i++) {
    const col = patches[i % patches.length];
    const r = size * (0.05 + rng() * 0.12);
    wrap((x, y) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }, rng() * size, rng() * size);
  }
  for (let i = 0; i < size * 7; i++) {
    g.fillStyle = specks[i % specks.length];
    const w = 1 + rng() * 2;
    wrap((x, y) => g.fillRect(x, y, w, w * (1 + rng() * 2)), rng() * size, rng() * size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}
