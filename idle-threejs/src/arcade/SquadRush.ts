import * as THREE from 'three';
import { Staff } from '../game/Actors';
import { clamp, damp, formatNum, rand } from '../core/math';
import { Mode, Label3D, groundTex, mulberry32, type Ctx } from './Mode';
import { ICON } from './ArcadeHud';
import { Brute } from './Brute';
import type { Crowd } from './Crowd';

const ROAD = 4.2;
const SPEED = 5.5;
const RANGE = 21;
const FIRE_RATE = 2.4;
/** Soldiers drawn; the counter keeps going beyond it (a bigger blob overflows the road). */
const MAX_DRAW = 48;
/** Squad packing step (phyllotaxis radius per sqrt(index)). */
const PACK = 0.36;
const ROAD_LEN = 600;
const RED = new THREE.Color('#ff6a5a');
const BRUTE_RED = new THREE.Color('#b8332c');
const GOO = new THREE.Color(1, 0.25, 0.15);
const HIT_WHITE = new THREE.Color(3, 3, 3);

interface Enemy {
  x: number;
  z: number;
  hp: number;
  big: boolean;
  phase: number;
  alive: boolean;
  dieT: number;
  flash: number;
}

interface Gate {
  pair: number;
  z: number;
  x0: number;
  x1: number;
  value: number;
  mult: number;
  hits: number;
  passed: boolean;
  fade: number;
  group: THREE.Group;
  panel: THREE.MeshBasicMaterial;
  label: Label3D;
}

type BoostKind = 'gun' | 'bomb' | 'rapid';
const BOOST: Record<BoostKind, { label: string; color: string; sub: string }> = {
  gun: { label: 'GUN UP', color: '#4dd2ff', sub: 'Harder-hitting rounds' },
  bomb: { label: 'BOMB', color: '#ff5a3d', sub: 'Airstrike on the horde' },
  rapid: { label: 'RAPID', color: '#ffd34d', sub: 'Fire rate x2.5 for 6s' },
};
/** Round damage and tracer colour per gun level (GUN UP booster). */
const GUN_LV = [
  { dmg: 1, c: [2.4, 1.6, 0.5], w: 0.08 },
  { dmg: 1.6, c: [0.6, 2, 3], w: 0.1 },
  { dmg: 2.3, c: [2.4, 0.7, 3], w: 0.12 },
  { dmg: 3, c: [3, 0.6, 0.4], w: 0.14 },
];

interface Booster {
  kind: BoostKind;
  x: number;
  z: number;
  taken: boolean;
  group: THREE.Group;
  crate: THREE.Mesh;
}

interface Capsule {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  reward: number;
  broken: boolean;
  group: THREE.Group;
  label: Label3D;
  hero: Staff;
  heroT: number;
}

/** "Last War" lane runner: steer the squad through number gates, free captives, crush the horde, kill the boss. */
export class SquadRush extends Mode {
  readonly id = 'rush';
  readonly title = 'SQUAD RUSH';
  private runCrowd: Crowd;
  private fireCrowd: Crowd;
  private enemyCrowd: Crowd;
  private brute: Brute;
  private heroes: Staff[] = [];
  private dyn = new THREE.Group();
  private enemies: Enemy[] = [];
  private gates: Gate[] = [];
  private caps: Capsule[] = [];
  private boosts: Booster[] = [];
  private shotT = new Float32Array(MAX_DRAW).map(() => Math.random());
  private gunLv = 0;
  private rapidT = 0;
  private countLabel = new Label3D(256, 96, 1.6);
  private offs: { x: number; z: number }[] = [];
  private dispX = new Float32Array(MAX_DRAW);
  private dispZ = new Float32Array(MAX_DRAW);
  private pop = new Float32Array(MAX_DRAW);
  private drawnN = 0;
  n = 2;
  private sx = 0;
  private sz = 0;
  private targetX = 0;
  private stopZ = -200;
  private bossPhase = false;
  private rateMult = 1;
  private kills = 0;
  private freed = 0;
  private peak = 0;
  private dragX = 0;
  private dragFrom = 0;
  private dragging = false;
  private dmgAcc = 0;
  private dmgT = 0;
  private introT = 0;
  private endT = -1;
  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private crateGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  private ringGeo = new THREE.RingGeometry(1.05, 1.3, 32).rotateX(-Math.PI / 2);

  constructor(ctx: Ctx) {
    super(ctx, { sky: '#9fb9a8', fog: [32, 78], hemi: ['#fff1dc', '#4d5c36', 1.9], sun: { color: '#fff1d6', intensity: 2.6, pos: [-8, 20, 10], box: 18 } }, 220);
    this.buildRoad();
    this.runCrowd = this.crowd({ clip: 'Move', frames: 12, skin: ctx.skins.soldier, weapon: 'rifle' }, MAX_DRAW);
    this.fireCrowd = this.crowd({ clip: 'Attack_3', frames: 10, skin: ctx.skins.soldier, weapon: 'rifle' }, MAX_DRAW);
    this.enemyCrowd = this.crowd({ clip: 'Move', frames: 12, skin: ctx.skins.civA }, 700);
    this.brute = new Brute(ctx.assets.models.boss);
    this.brute.onSlam = (at) => this.slam(at);
    this.brute.onDead = () => (this.endT = 1.2);
    for (let i = 0; i < 3; i++) {
      const s = new Staff(ctx.assets.models.staff, '#7fd0ff');
      s.root.visible = false;
      this.heroes.push(s);
      this.scene.add(s.root);
    }
    this.scene.add(this.brute.root, this.dyn, this.countLabel.sprite);
    // phyllotaxis packing: dense, round, stable as the count grows
    for (let i = 0; i < MAX_DRAW; i++) {
      const r = PACK * Math.sqrt(i);
      const a = i * 2.39996;
      this.offs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8 });
    }
  }

  private buildRoad(): void {
    // asphalt: grain, cracks, worn edge lines and lane dashes -> strong motion cue as it scrolls
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#5d5f63';
    g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + Math.random() * 0.06})`;
      g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 512, 14 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * 3, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(20,20,20,0.55)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      let x = Math.random() * 256;
      let y = Math.random() * 512;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (Math.random() - 0.5) * 30), (y += Math.random() * 18));
      g.stroke();
    }
    g.fillStyle = '#e9e4cf';
    for (const x of [14, 238]) g.fillRect(x - 3, 0, 6, 512);
    g.fillStyle = '#f2d35a';
    for (const y of [40, 296]) g.fillRect(125, y, 6, 150);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, ROAD_LEN / 14);
    tex.anisotropy = 8;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2 + 0.6, ROAD_LEN), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -ROAD_LEN / 2 + 30);
    road.receiveShadow = true;
    const grass = groundTex('#5e7a3a', ['rgba(120,90,50,0.55)', 'rgba(40,70,25,0.6)', 'rgba(150,170,80,0.4)'], ['rgba(30,60,20,0.5)', 'rgba(170,200,110,0.35)', 'rgba(90,70,45,0.4)'], [20, (ROAD_LEN + 100) / 10], 31);
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(200, ROAD_LEN + 100), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, -0.02, -ROAD_LEN / 2 + 30);
    dirt.receiveShadow = true;
    for (const o of [road, dirt]) {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
      this.scene.add(o);
    }
    // roadside from the Test00 map props: fence line, clutter, then forest
    const rng = mulberry32(4242);
    const items: [string, number, number, number, number][] = [];
    const clutter = ['stump', 'stump_mush', 'grass', 'grass', 'rock', 'log', 'log_cut', 'stake'];
    const trees = ['tree_a', 'tree_b', 'tree_pair', 'tree_bush'];
    for (let z = 30; z > 30 - ROAD_LEN; z -= 2) {
      for (const side of [-1, 1]) {
        items.push(['fence', side * (ROAD + 0.75), z, Math.PI / 2 + (rng() - 0.5) * 0.08, 1.2]);
        if (rng() < 0.55) items.push([clutter[Math.floor(rng() * clutter.length)], side * (ROAD + 2 + rng() * 3.5), z + rng() * 2, rng() * 6.3, 0.7 + rng() * 0.5]);
        if (rng() < 0.5) items.push([trees[Math.floor(rng() * trees.length)], side * (ROAD + 6 + rng() * 9), z + rng() * 2, rng() * 6.3, 0.45 + rng() * 0.25]);
      }
      if (rng() < 0.04) items.push([rng() < 0.5 ? 'tent' : 'campfire', (rng() < 0.5 ? -1 : 1) * (ROAD + 7), z, rng() * 6.3, 0.7]);
    }
    this.props(items);
  }

  // ------------------------------------------------------------------------------------------
  start(level: number): void {
    this.level = level;
    this.outcome = 'play';
    this.t = 0;
    this.fx.clear();
    for (const gt of this.gates) gt.label.sprite.material.map?.dispose();
    for (const cp of this.caps) cp.label.sprite.material.map?.dispose();
    this.dyn.clear();
    this.enemies.length = 0;
    this.gates.length = 0;
    this.caps.length = 0;
    for (const b of this.boosts) (b.group.children[1] as THREE.Sprite).material.map?.dispose();
    this.boosts.length = 0;
    this.gunLv = 0;
    this.rapidT = 0;
    this.n = 2;
    this.sx = this.targetX = 0;
    this.sz = 0;
    this.bossPhase = false;
    this.rateMult = 1;
    this.kills = this.freed = 0;
    this.peak = this.n;
    this.drawnN = 0;
    this.introT = 1.2;
    this.endT = -1;
    this.brute.hide();
    for (const h of this.heroes) h.root.visible = false;
    this.generate(level);
    this.tutStep = level === 1 ? 0 : -1;
    this.tutT = 0;

    const hud = this.ctx.hud;
    hud.begin(this.title, [
      ['army', ICON.army],
      ['kills', ICON.skull],
    ]);
    hud.banner(`LEVEL ${level}`, 'Shoot the gates to raise them!', '#7fd0ff', 1500);
    hud.hint('DRAG TO STEER');
  }

  private generate(level: number): void {
    const rng = mulberry32(1000 + level * 7919);
    const ri = (a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
    const segs = Math.min(10, 6 + level);
    let z = -22;
    let pair = 0;
    const brng = mulberry32(77 + level * 131);
    let pickup = 0;
    for (let s = 0; s < segs; s++) {
      const kind = s % 3 === 0 ? 'gates' : s % 3 === 1 ? 'horde' : rng() < 0.55 ? 'capsule' : 'gates';
      if (kind === 'gates') {
        const goodLeft = rng() < 0.5;
        const both = s >= 3 && rng() < 0.35;
        const good = both ? -ri(2, 5) : rng() < 0.35 && s > 0 ? 0 : ri(3, 6) + level;
        const bad = -(ri(4, 8) + level * 2 + s);
        const mult = !both && good === 0 ? 2 : 0;
        this.addGate(pair, z, goodLeft ? -ROAD : 0, goodLeft ? 0 : ROAD, mult ? 0 : good, mult);
        this.addGate(pair, z, goodLeft ? 0 : -ROAD, goodLeft ? ROAD : 0, bad, 0);
        pair++;
        // a small picket behind the gates
        this.addHorde(z - 9, 2 + (level >> 1) + (s >> 1), level, rng);
      } else if (kind === 'horde') {
        this.addHorde(z, Math.min(30, 4 + level * 2 + s), level, rng);
      } else {
        const side = rng() < 0.5 ? -1 : 1;
        const hp = 24 + level * 12 + s * 4;
        this.addCapsule(side * 2.25, z, hp, 4 + level);
        this.addHorde(z - 6, 4 + level, level, rng, -side);
      }
      if (kind !== 'gates') {
        const k: BoostKind = pickup === 0 ? 'gun' : (['bomb', 'rapid', 'gun'] as const)[Math.floor(brng() * 3)];
        this.addBooster(k, (brng() - 0.5) * 5, z + 9);
        pickup++;
      }
      z -= 24;
    }
    this.stopZ = z + 6;
  }

  private addGate(pair: number, z: number, x0: number, x1: number, value: number, mult: number): void {
    const group = new THREE.Group();
    const w = x1 - x0;
    const panel = new THREE.MeshBasicMaterial({ color: '#3d8bff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 1.5), panel);
    p.position.set(0, 0.95, 0);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.5, metalness: 0.3 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.18, 0.22), frameMat);
    top.position.y = 1.78;
    group.add(p, top);
    for (const sx of [-w / 2 + 0.12, w / 2 - 0.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.24), frameMat);
      post.position.set(sx, 0.9, 0);
      post.castShadow = true;
      group.add(post);
    }
    const label = new Label3D(256, 96, 2.4);
    label.sprite.position.set(0, 1.05, 0.15);
    group.add(label.sprite);
    group.position.set((x0 + x1) / 2, 0, z);
    this.dyn.add(group);
    const g: Gate = { pair, z, x0, x1, value, mult, hits: 0, passed: false, fade: 1, group, panel, label };
    this.paintGate(g);
    this.gates.push(g);
  }

  private paintGate(g: Gate): void {
    if (g.mult) {
      g.panel.color.set('#ffb21f');
      g.label.set(`x${g.mult}`, '#fff6cf');
      return;
    }
    const good = g.value >= 0;
    g.panel.color.set(good ? '#3d8bff' : '#ff3b3b');
    g.label.set(`${good ? '+' : ''}${g.value}`, good ? '#e6f3ff' : '#ffe1e1');
  }

  private addHorde(z: number, count: number, level: number, rng: () => number, side = 0): void {
    const cols = side ? 4 : 8;
    const x0 = side ? (side < 0 ? -3.6 : 0.6) : -3.6;
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const big = level >= 2 && rng() < 0.08;
      this.enemies.push({
        x: x0 + c * (side ? 0.95 : 1.02) + (rng() - 0.5) * 0.3,
        z: z - r * 0.95 + (rng() - 0.5) * 0.3,
        hp: big ? 6 + level : 1 + Math.floor(level / 3),
        big,
        phase: rng() * 2,
        alive: true,
        dieT: 0,
        flash: 0,
      });
    }
  }

  private addBooster(kind: BoostKind, x: number, z: number): void {
    const B = BOOST[kind];
    const group = new THREE.Group();
    const crate = new THREE.Mesh(this.crateGeo, new THREE.MeshStandardMaterial({ color: B.color, emissive: B.color, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.3 }));
    crate.position.y = 1;
    crate.castShadow = true;
    const label = new Label3D(256, 96, 2.2);
    label.set(B.label, B.color);
    label.sprite.position.set(0, 2.2, 0);
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: B.color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.04;
    group.add(crate, label.sprite, ring);
    group.position.set(x, 0, z);
    this.dyn.add(group);
    this.boosts.push({ kind, x, z, taken: false, group, crate });
  }

  private updateBoosters(dt: number): void {
    for (const b of this.boosts) {
      if (b.taken) {
        b.group.scale.multiplyScalar(Math.max(0, 1 - dt * 8));
        continue;
      }
      b.crate.rotation.y += dt * 2.2;
      b.crate.position.y = 1 + Math.sin(this.t * 4 + b.z) * 0.15;
      b.group.children[2].scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);
      if (this.outcome !== 'play' || this.sz > b.z + 0.5 || this.sz < b.z - 1.5) continue;
      if (Math.abs(this.sx - b.x) > this.radius + 0.9) continue;
      b.taken = true;
      this.applyBoost(b);
    }
  }

  private applyBoost(b: Booster): void {
    const B = BOOST[b.kind];
    const c = new THREE.Color(B.color);
    this.fx.ground.ring(this._a.set(b.x, 0, b.z), 3.5, B.color, 0.5);
    for (let i = 0; i < 20; i++) this.fx.sparkle(this._a.set(b.x + rand(-1, 1), rand(0.4, 2.4), b.z), c.r, c.g, c.b);
    this.ctx.audio.chime(4);
    this.ctx.audio.play('receive');
    if (b.kind === 'gun') {
      this.gunLv = Math.min(GUN_LV.length - 1, this.gunLv + 1);
      this.ctx.hud.banner(`GUN UP! Lv${this.gunLv + 1}`, `Damage x${GUN_LV[this.gunLv].dmg}`, B.color, 1100);
    } else if (b.kind === 'rapid') {
      this.rapidT = 6;
      this.ctx.hud.banner('RAPID FIRE!', B.sub, B.color, 1100);
    } else this.airstrike();
  }

  /** BOMB: three shells land on the nearest pack ahead and flatten everything in the blast. */
  private airstrike(): void {
    let tx = this.sx;
    let tz = this.sz - 12;
    let bd = 1e9;
    for (const e of this.enemies) {
      const d = this.sz - e.z;
      if (e.alive && d > 2 && d < 26 && d < bd) {
        bd = d;
        tx = e.x;
        tz = e.z - 1.5;
      }
    }
    this.ctx.hud.banner('AIRSTRIKE!', BOOST.bomb.sub, BOOST.bomb.color, 1100);
    for (const [ox, oz] of [[0, 0], [-2.2, -2], [2.2, -2]]) {
      const p = this._b.set(tx + ox, 0.6, tz + oz);
      this.fx.tracers.add(this._a.set(p.x + 6, 22, p.z + 4), p, 0.18, 0.35, 3, 1.2, 0.4);
      this.fx.explosion(p, 2.2, 1, 0.5, 0.2);
      this.fx.ground.ring(p, 4.5, '#ff7a3d', 0.55);
      for (const e of this.enemies) if (e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 3.2) this.hitEnemy(e, 12 + this.level * 2);
    }
    this.fx.shake(0.8);
    this.ctx.audio.boom(1.6);
    this.ctx.hud.flash(0.3, 250, '#ffb070');
  }

  private addCapsule(x: number, z: number, hp: number, reward: number): void {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#2f7de1', roughness: 0.35, metalness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.45, 24), metal);
    base.position.y = 0.22;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 24), metal);
    cap.position.y = 2.75;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(1.02, 1.02, 2.3, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    );
    glass.position.y = 1.55;
    glass.renderOrder = 5;
    base.castShadow = cap.castShadow = true;
    group.add(base, cap, glass);
    const label = new Label3D(256, 96, 2.6);
    label.sprite.position.set(0, 1.6, 1.2);
    group.add(label.sprite);
    group.position.set(x, 0, z);
    this.dyn.add(group);
    const hero = this.heroes[this.caps.length % this.heroes.length];
    hero.root.visible = true;
    hero.root.position.set(x, 0.45, z);
    hero.root.scale.setScalar(1.15);
    hero.yaw = hero.targetYaw = 0;
    hero.play('Stun', 0);
    const c: Capsule = { x, z, hp, maxHp: hp, reward, broken: false, group, label, hero, heroT: -1 };
    label.set(formatNum(hp), '#ffffff');
    this.caps.push(c);
  }

  // ------------------------------------------------------------------------------------------
  pointerDown(x: number): void {
    this.dragging = true;
    this.dragX = x;
    this.dragFrom = this.targetX;
    this.track(true);
  }
  pointerMove(x: number): void {
    if (!this.dragging) return;
    this.targetX = clamp(this.dragFrom + ((x - this.dragX) / Math.min(window.innerWidth, 600)) * 11, -ROAD + 0.6, ROAD - 0.6);
    if (this.tutStep === 0 && Math.abs(x - this.dragX) > 30) this.tutStep = 1;
  }
  pointerUp(): void {
    this.dragging = false;
  }

  private get radius(): number {
    return PACK * Math.sqrt(Math.min(this.n, MAX_DRAW)) + 0.35;
  }

  update(dt: number): void {
    dt *= this.tutorial(dt);
    this.t += dt;
    const hud = this.ctx.hud;
    if (this.bot && this.outcome === 'play') this.botSteer();
    if (this.t > 3.5 || this.tutStep >= 0) hud.hint(null);

    // ---- squad motion ----
    const lim = ROAD - Math.min(this.radius, ROAD - 0.6);
    const tx = clamp(this.targetX, -lim, lim);
    this.sx += (tx - this.sx) * damp(10, dt);
    if (this.introT > 0) this.introT -= dt;
    else if (!this.bossPhase && this.outcome === 'play') {
      this.sz -= SPEED * dt;
      if (Math.random() < dt * 6) this.fx.dust(this._a.set(this.sx + rand(-1, 1) * this.radius, 0, this.sz + this.radius), 0.5, 2);
      if (this.sz <= this.stopZ) this.enterBoss();
    }

    if (this.outcome === 'play') {
      this.passGates();
      this.fire(dt);
    }
    this.updateEnemies(dt);
    this.updateCapsules(dt);
    this.updateBoosters(dt);
    this.brute.update(dt, this.outcome === 'play' ? this._a.set(this.sx, 0, this.sz) : null);
    if (this.brute.alive) hud.bossBar(this.brute.hp / this.brute.maxHp, `WARLORD Lv.${this.level}`);
    else if (!this.bossPhase) hud.bossBar(null);
    else hud.bossBar(0, `WARLORD Lv.${this.level}`);

    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) this.finish(true);
    }
    if (this.n <= 0 && this.outcome === 'play') {
      this.ctx.audio.play('death');
      this.fx.shake(0.5);
      this.finish(false);
    }

    this.drawSquad(dt);
    this.peak = Math.max(this.peak, this.n);
    hud.stat('army', formatNum(this.n));
    hud.stat('kills', formatNum(this.kills));
    hud.progress(clamp(this.sz / this.stopZ, 0, 1), this.bossPhase ? 'BOSS!' : `${Math.round(clamp(this.sz / this.stopZ, 0, 1) * 100)}%`);
    hud.danger(this.brute.alive && this.n < 8 ? 0.5 : 0);
    this.dmgT -= dt;
    if (this.dmgAcc > 0 && this.dmgT <= 0 && this.brute.alive) {
      this.dmgT = 0.18;
      const s = hud.project(this.brute.centre(this._b), this.ctx.engine.camera);
      hud.float(s.x + rand(-30, 30), s.y, formatNum(this.dmgAcc), 'crit', 55, 650);
      this.dmgAcc = 0;
    }

    this.fx.update(dt);
    const bp = this.bossPhase ? 1 : 0;
    this.camPos.set(this.sx * 0.4, 14 + bp * 2.5, this.sz + 11.5 + bp * 2.5);
    this.camLook.set(this.sx * 0.35, 0, this.sz - 8 - bp);
    this.followSun(0, this.sz - 6);
    this.applyCamera(this.fovFor(46));
  }

  /** Level-1 coach marks: steer → blue gate → booster → capsule. Returns the time scale (slow-mo while one is up). */
  private tutorial(dt: number): number {
    const hud = this.ctx.hud;
    if (this.tutStep < 0 || this.bot || this.outcome !== 'play') {
      if (this.tutStep >= 0) hud.spot(null);
      this.tutStep = -1;
      return 1;
    }
    this.tutT += dt;
    const ahead = (z: number, d: number) => z < this.sz && this.sz - z < d;
    if (this.tutStep === 0) {
      if (this.tutT > 3.5) this.tutStep = 1;
      this.spotWorld(this._a.set(this.sx, 0.8, this.sz), this.radius + 0.6, 'DRAG LEFT & RIGHT\nto steer your squad', [90, 0]);
      return 1;
    }
    if (this.tutStep === 1) {
      const g = this.gates.find((o) => !o.passed && (o.value > 0 || o.mult) && ahead(o.z, 13));
      if (!g) {
        if (this.gates.some((o) => o.pair === 0 && o.passed)) this.tutStep = 2;
        hud.spot(null);
        return 1;
      }
      this.spotWorld(this._a.set(g.group.position.x, 1, g.z), 2.2, 'RUN THROUGH THE BLUE GATE\nShoot it to raise the number!');
      return 0.35;
    }
    if (this.tutStep === 2) {
      const b = this.boosts.find((o) => !o.taken && ahead(o.z, 12));
      if (!b) {
        if (this.boosts.some((o) => o.taken || o.z > this.sz)) this.tutStep = 3;
        hud.spot(null);
        return 1;
      }
      this.spotWorld(this._a.set(b.x, 1, b.z), 1.4, `GRAB THE ${BOOST[b.kind].label} BOOSTER!\n${BOOST[b.kind].sub}`);
      return 0.35;
    }
    const c = this.caps.find((o) => !o.broken && ahead(o.z, 15));
    if (!c) {
      if (this.caps.some((o) => o.broken || o.z > this.sz)) this.tutStep = -1;
      hud.spot(null);
      return 1;
    }
    this.spotWorld(this._a.set(c.x, 1.4, c.z), 1.6, 'SHOOT THE CAPSULE\nto free a hero: +fire rate');
    return 0.5;
  }

  private enterBoss(): void {
    this.bossPhase = true;
    this.sz = this.stopZ;
    const hp = 160 + 130 * this.level;
    this.brute.attackGap = Math.max(1.2, 2.4 - this.level * 0.15);
    this.brute.spawn(new THREE.Vector3(0, 0, this.stopZ - 17), 0, 1 + Math.min(0.5, this.level * 0.05), hp, '#ffd0c8');
    this.ctx.audio.roar(1, 1.3);
    this.fx.shake(0.6);
    this.ctx.hud.banner('BOSS!', 'Hold the line!', '#ff5a4d', 1300);
    this.ctx.hud.flash(0.35, 300, '#ff3020');
  }

  private slam(at: THREE.Vector3): void {
    this.fx.explosion(at, 1.6, 1, 0.5, 0.2);
    this.fx.ground.ring(at, 4.5, '#ff6a3d', 0.6);
    this.fx.shake(0.7);
    this.ctx.audio.boom(1.2);
    const d = Math.hypot(at.x - this.sx, at.z - this.sz);
    if (d < this.radius + 3) {
      const k = Math.min(this.n, 3 + this.level * 2);
      this.n -= k;
      const s = this.ctx.hud.project(this._a.set(this.sx, 1.5, this.sz), this.ctx.engine.camera);
      this.ctx.hud.float(s.x, s.y, `-${k}`, 'lose', 70, 900);
    }
  }

  private passGates(): void {
    for (const g of this.gates) {
      if (g.passed || this.sz > g.z) continue;
      for (const o of this.gates) if (o.pair === g.pair) o.passed = true;
      const hit = this.gates.find((o) => o.pair === g.pair && this.sx >= o.x0 && this.sx < o.x1) ?? g;
      const before = this.n;
      this.n = hit.mult ? this.n * hit.mult : Math.max(0, this.n + hit.value);
      const gained = this.n - before;
      const col = gained >= 0 ? (hit.mult ? '#ffd34d' : '#7fd0ff') : '#ff5a4d';
      const s = this.ctx.hud.project(this._a.set(hit.group.position.x, 1.6, g.z), this.ctx.engine.camera);
      this.ctx.hud.float(s.x, s.y, hit.mult ? `x${hit.mult}!` : `${gained >= 0 ? '+' : ''}${gained}`, gained >= 0 ? 'crit' : 'lose', 90, 1000);
      this.ctx.hud.bump('army');
      const c = new THREE.Color(col);
      this.fx.ground.ring(this._a.set(hit.group.position.x, 0, g.z), 3, col, 0.5);
      for (let i = 0; i < 18; i++) this.fx.sparkle(this._a.set(hit.group.position.x + rand(-1.5, 1.5), rand(0.3, 1.8), g.z), c.r, c.g, c.b);
      if (gained > 0) {
        this.ctx.audio.chime(hit.mult ? 4 : 2);
        // new recruits pop in at the gate
        for (let i = Math.min(before, MAX_DRAW); i < Math.min(this.n, MAX_DRAW); i++) {
          this.dispX[i] = this.sx + rand(-1, 1);
          this.dispZ[i] = this.sz - 1.5;
          this.pop[i] = 0;
        }
      } else if (gained < 0) {
        this.ctx.audio.play('death', 0.6);
        this.fx.shake(0.25);
      }
    }
  }

  /** Every soldier has its own cadence and fires a straight round up its own column (no homing). */
  private fire(dt: number): void {
    if (this.introT > 0) return;
    const drawn = Math.min(this.n, MAX_DRAW);
    if (!drawn) return;
    this.rapidT -= dt;
    const rate = dt * FIRE_RATE * this.rateMult * (this.rapidT > 0 ? 2.5 : 1);
    const G = GUN_LV[this.gunLv];
    // soldiers past MAX_DRAW aren't drawn; their firepower rides on the drawn ones' rounds
    const dmg = (this.n / drawn) * G.dmg;
    let sparks = 0;
    let soundT = false;
    for (let i = 0; i < drawn; i++) {
      this.shotT[i] -= rate;
      if (this.shotT[i] > 0) continue;
      this.shotT[i] += 1;
      const x = this.dispX[i];
      const z0 = this.dispZ[i] - 0.4;
      let bestZ = z0 - RANGE;
      let hitKind = 0;
      let hitIdx = -1;
      for (let k = 0; k < this.enemies.length; k++) {
        const e = this.enemies[k];
        if (!e.alive || e.z >= z0 || e.z <= bestZ) continue;
        if (Math.abs(e.x - x) < (e.big ? 0.8 : 0.55)) {
          bestZ = e.z;
          hitKind = 1;
          hitIdx = k;
        }
      }
      for (let k = 0; k < this.gates.length; k++) {
        const g = this.gates[k];
        if (g.passed || g.mult || g.z >= z0 || g.z <= bestZ || x < g.x0 || x >= g.x1) continue;
        bestZ = g.z;
        hitKind = 2;
        hitIdx = k;
      }
      for (let k = 0; k < this.caps.length; k++) {
        const c = this.caps[k];
        if (c.broken || c.z >= z0 || c.z <= bestZ || Math.abs(c.x - x) > 1.1) continue;
        bestZ = c.z + 1;
        hitKind = 3;
        hitIdx = k;
      }
      const b = this.brute;
      if (b.alive && b.state !== 'spawn' && b.root.position.z < z0 && b.root.position.z > bestZ && Math.abs(b.root.position.x - x) < 1.6 * b.scale) {
        bestZ = b.root.position.z + 0.8;
        hitKind = 4;
      }
      let hy = 0.95;
      if (hitKind === 1) this.hitEnemy(this.enemies[hitIdx], dmg);
      else if (hitKind === 2) {
        const g = this.gates[hitIdx];
        // one tick per round (not damage): gate growth must not snowball with army size or gun level
        if (++g.hits % 3 === 0) {
          g.value++;
          this.paintGate(g);
        }
        hy = 1.1;
      } else if (hitKind === 3) {
        this.hitCapsule(this.caps[hitIdx], dmg);
        hy = 1.5;
      } else if (hitKind === 4) {
        hy = 1.6 * b.scale;
        this.dmgAcc += dmg;
        b.damage(dmg);
        if (b.hp <= 0) this.killBoss();
      }
      this._a.set(x, 0.95, z0);
      this.fx.muzzle(this._a, 1, 0.75, 0.35, 0.4);
      this._b.set(x, hy, bestZ);
      this.fx.tracers.add(this._a, this._b, 0.13, G.w, G.c[0], G.c[1], G.c[2]);
      if (hitKind && sparks++ < 6) this.fx.hit(this._b, 1, 0.75, 0.35, 2);
      soundT = true;
    }
    if (soundT) this.ctx.audio.play('gun', 0.22, 1.25);
  }

  private hitEnemy(e: Enemy, dmg: number): void {
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.alive = false;
    e.dieT = 0.001;
    this.kills++;
    this.fx.splat(this._a.set(e.x, 0.8, e.z), GOO.r, GOO.g, GOO.b, e.big ? 1.4 : 0.8);
  }

  private hitCapsule(c: Capsule, dmg: number): void {
    c.hp -= dmg;
    c.label.set(formatNum(Math.max(0, c.hp)), '#ffffff');
    if (c.hp > 0) return;
    c.broken = true;
    c.label.sprite.visible = false;
    c.group.children[2].visible = false; // glass
    this.fx.explosion(this._a.set(c.x, 1.4, c.z), 1.2, 0.5, 0.9, 1);
    for (let i = 0; i < 24; i++) this.fx.sparkle(this._a.set(c.x + rand(-1, 1), rand(0.4, 2.6), c.z + rand(-1, 1)), 0.6, 0.95, 1);
    this.ctx.audio.chime(5);
    this.ctx.audio.play('receive');
    this.fx.shake(0.3);
    this.n += c.reward;
    this.freed++;
    this.rateMult *= 1.25;
    c.heroT = 0;
    c.hero.play('Combo', 0.1, false);
    this.ctx.hud.banner('HERO FREED!', `+${c.reward} soldiers · fire rate +25%`, '#7fd0ff', 1200);
    this.ctx.hud.bump('army');
  }

  private killBoss(): void {
    this.fx.explosion(this.brute.centre(this._a), 3, 1, 0.6, 0.25);
    this.fx.shake(1);
    this.ctx.audio.boom(2);
    this.ctx.hud.flash(0.6, 400);
    this.ctx.hud.banner('VICTORY!', 'The warlord falls', '#ffd34d', 1400);
    this.kills += 1;
  }

  private updateEnemies(dt: number): void {
    const ec = this.enemyCrowd;
    ec.begin();
    const R = this.radius;
    const t = this.t;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) {
        if (e.dieT <= 0) continue;
        e.dieT += dt;
        if (e.dieT > 0.55) {
          e.dieT = 0;
          continue;
        }
        const k = e.dieT / 0.55;
        ec.add(e.x, Math.sin(k * Math.PI) * 0.6, e.z - k * 1.2, 0, (e.big ? 1.5 : 1) * (1 - k * 0.6), e.phase, e.big ? BRUTE_RED : RED, -k * 1.6);
        continue;
      }
      const dz = this.sz - e.z;
      // only the visible stretch of road is simulated
      if (dz > 34 || dz < -12) {
        if (dz < -12) e.alive = false;
        continue;
      }
      let yaw = 0;
      if (dz < 24 && this.outcome === 'play' && this.introT <= 0) {
        const dx = this.sx - e.x;
        const d = Math.hypot(dx, dz) || 1;
        const sp = (e.big ? 1.7 : 2.4) * dt;
        e.x += (dx / d) * sp;
        e.z += (dz / d) * sp;
        yaw = Math.atan2(dx, dz);
        if (d < R + (e.big ? 0.6 : 0.3)) {
          const loss = e.big ? 3 : 1;
          this.n = Math.max(0, this.n - loss);
          e.alive = false;
          e.dieT = 0.001;
          this.fx.poof(this._a.set(e.x, 0.6, e.z), 1, 0.4, 0.35, 0.6);
          this.ctx.audio.play('death', 0.35, 1.2);
          continue;
        }
      }
      e.flash = Math.max(0, e.flash - dt * 6);
      ec.add(e.x, 0, e.z, yaw, e.big ? 1.5 : 1, t * (yaw ? 1.3 : 0.4) + e.phase, e.flash > 0.5 ? HIT_WHITE : e.big ? BRUTE_RED : RED);
    }
    ec.end();
  }

  private updateCapsules(dt: number): void {
    for (const c of this.caps) {
      const h = c.hero;
      if (!h.root.visible) continue;
      if (c.heroT < 0) {
        h.updateAnim(dt, true);
        if (c.z > this.sz + 14) h.root.visible = false;
        continue;
      }
      // freed hero sprints to the front of the squad
      c.heroT += dt;
      const slot = this.caps.indexOf(c) % 2 ? 1 : -1;
      const tx = this.sx + slot * (this.radius + 0.7);
      const tz = this.sz - 0.6;
      const p = h.root.position;
      p.y = Math.max(0, p.y - dt * 2);
      p.x += (tx - p.x) * damp(5, dt);
      p.z += (tz - p.z) * damp(5, dt);
      h.targetYaw = Math.PI;
      if (c.heroT > 0.6) h.play(this.bossPhase || this.introT > 0 ? 'Attack' : 'Move 1', 0.2);
      h.updateAnim(dt);
    }
  }

  private drawSquad(dt: number): void {
    const drawn = Math.min(this.n, MAX_DRAW);
    const crowd = this.bossPhase || this.introT > 0 ? this.fireCrowd : this.runCrowd;
    const other = crowd === this.fireCrowd ? this.runCrowd : this.fireCrowd;
    other.begin();
    other.end();
    crowd.begin();
    this.blobs.begin();
    const k = damp(9, dt);
    for (let i = 0; i < drawn; i++) {
      if (i >= this.drawnN && this.pop[i] === 1) {
        this.dispX[i] = this.sx + this.offs[i].x;
        this.dispZ[i] = this.sz + this.offs[i].z + 0.8;
        this.pop[i] = 0;
      }
      const tx = this.sx + this.offs[i].x;
      const tz = this.sz + this.offs[i].z;
      this.dispX[i] += (tx - this.dispX[i]) * k;
      this.dispZ[i] += (tz - this.dispZ[i]) * k;
      this.pop[i] = Math.min(1, this.pop[i] + dt * 3);
      const s = 0.95 + Math.sin(this.pop[i] * Math.PI) * 0.35;
      crowd.add(this.dispX[i], 0, this.dispZ[i], Math.PI, s, this.t * 1.4 + i * 0.137);
      if (i < 120) this.blobs.add(this._a.set(this.dispX[i], 0, this.dispZ[i]), 0.42);
    }
    // soldiers lost: mark their slots so they pop back in if refilled
    for (let i = drawn; i < this.drawnN; i++) this.pop[i] = 1;
    this.drawnN = drawn;
    crowd.end();
    for (const e of this.enemies) if (e.alive && e.z > this.sz - 26 && e.z < this.sz + 6) this.blobs.add(this._a.set(e.x, 0, e.z), e.big ? 0.65 : 0.42);
    this.blobs.end();
    this.countLabel.set(formatNum(this.n), '#e6f3ff');
    this.countLabel.sprite.position.set(this.sx, 2.2 + this.radius * 0.25, this.sz - 0.2);
    this.countLabel.sprite.visible = this.n > 0;
  }

  /** Picks the better gate, then capsules, then dodges the horde edge. */
  private botSteer(): void {
    let best: Gate | null = null;
    let bestN = -1;
    for (const g of this.gates) {
      if (g.passed || g.z > this.sz || g.z < this.sz - 30) continue;
      const after = g.mult ? this.n * g.mult : this.n + g.value;
      if (after > bestN) {
        bestN = after;
        best = g;
      }
    }
    if (best) {
      this.targetX = (best.x0 + best.x1) / 2;
      return;
    }
    const bo = this.boosts.find((b) => !b.taken && b.z < this.sz && b.z > this.sz - 14);
    if (bo) {
      this.targetX = bo.x;
      return;
    }
    const cap = this.caps.find((c) => !c.broken && c.z < this.sz && c.z > this.sz - 26);
    this.targetX = cap ? cap.x : this.brute.alive ? this.brute.root.position.x : 0;
  }

  endStats(): [string, string][] {
    return [
      ['Peak army', formatNum(this.peak)],
      ['Enemies crushed', formatNum(this.kills)],
      ['Heroes freed', String(this.freed)],
    ];
  }

  state(): Record<string, unknown> {
    return {
      mode: this.id,
      level: this.level,
      outcome: this.outcome,
      t: +this.t.toFixed(2),
      n: this.n,
      z: +this.sz.toFixed(1),
      stopZ: this.stopZ,
      kills: this.kills,
      freed: this.freed,
      gunLv: this.gunLv + 1,
      boosts: this.boosts.filter((b) => b.taken).length,
      boss: this.brute.alive ? Math.round(this.brute.hp) : this.bossPhase ? 0 : -1,
      gates: this.gates.length,
      enemies: this.enemies.filter((e) => e.alive).length,
      drawn: this.runCrowd.drawn + this.fireCrowd.drawn,
    };
  }

  cheat(kind: 'win' | 'lose'): void {
    if (kind === 'lose') {
      this.n = 0;
      return;
    }
    this.n = Math.max(this.n, 60);
    for (const e of this.enemies) e.alive = false;
    this.sz = this.stopZ;
    this.introT = 0;
    if (!this.bossPhase) this.enterBoss();
  }

  /** Trailer hooks. */
  setArmy(n: number): void {
    this.n = n;
  }
  get pos(): THREE.Vector3 {
    return this._b.set(this.sx, 0, this.sz);
  }
}
