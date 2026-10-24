import * as THREE from 'three';
import { Staff } from '../game/Actors';
import { clamp, damp, formatNum, rand } from '../core/math';
import { Mode, groundTex, mulberry32, type Ctx } from './Mode';
import { ICON, type Card } from './ArcadeHud';
import { Brute } from './Brute';
import type { Crowd } from './Crowd';
import { weaponPortraits, type WeaponId } from '../game/Weapons';

const ARENA = 38;
const CAP = 380;
/** How far from the hero the gun battery marks targets. */
const REACH = 11;
const CELL = 1.6;
const GRID = Math.ceil((ARENA * 2) / CELL) + 2;
// multiplied over the zombie skin: rotter, frozen, toxic, burning
const TIERS = [new THREE.Color('#ffffff'), new THREE.Color('#a8d4ff'), new THREE.Color('#e2a6ff'), new THREE.Color('#ff9a70')];
const HIT_WHITE = new THREE.Color(3, 3, 3);
const ROCKET_C = new THREE.Color(3, 1.4, 0.4);

type Skill = 'bolt' | 'blades' | 'nova' | 'rockets' | 'might' | 'haste' | 'swift' | 'magnet' | 'vitality';
const CARD: Record<Skill, { icon: string; title: string; desc: (l: number) => string; max: number }> = {
  bolt: { icon: ICON.bolt, title: 'Gun', desc: (l) => `+1 bullet per volley (${l + 1})`, max: 5 },
  blades: { icon: ICON.blade, title: 'Orbit Blades', desc: (l) => (l ? `+1 blade, faster spin` : 'Blades circle you'), max: 5 },
  nova: { icon: ICON.nova, title: 'Frost Nova', desc: (l) => (l ? `Bigger, more often` : 'Pulse wipes nearby foes'), max: 5 },
  rockets: { icon: ICON.rocket, title: 'Rocket Pod', desc: (l) => (l ? `+1 rocket` : 'Homing explosive rockets'), max: 5 },
  might: { icon: ICON.sword, title: 'Might', desc: () => '+30% damage', max: 5 },
  haste: { icon: ICON.clock, title: 'Haste', desc: () => '-15% cooldowns', max: 5 },
  swift: { icon: ICON.boot, title: 'Swift', desc: () => '+12% move speed', max: 3 },
  magnet: { icon: ICON.magnet, title: 'Magnet', desc: () => '+60% pickup range', max: 3 },
  vitality: { icon: ICON.heart, title: 'Vitality', desc: () => '+30 max HP, full heal', max: 3 },
};

type Gun = 'rifle' | 'shotgun' | 'minigun';
/**
 * Starting guns (picked 1-of-3 each run). The hero holds nothing: the gun is an off-screen battery that marks glowing
 * circles on the nearest foes and shells them from outside the screen. `pellets` = circles per volley (the 'bolt'
 * skill adds more), `r` = blast radius, `charge` = circle-to-impact time, `fly` = visible flight of the round,
 * `from` = direction the battery fires from (x, z; off-screen), `scatter` = circle spread around the target.
 */
const GUNS: Record<Gun, { name: string; desc: string; cd: number; pellets: number; scatter: number; r: number; charge: number; fly: number; dmg: number; size: number; from: [number, number]; color: THREE.Color }> = {
  rifle: { name: 'Sniper Battery', desc: 'Precise rounds from off-screen', cd: 0.5, pellets: 1, scatter: 0, r: 1.2, charge: 0.35, fly: 0.12, dmg: 3, size: 0.7, from: [-1, 0.6], color: new THREE.Color(0.6, 2.2, 3) },
  shotgun: { name: 'Meteor Rain', desc: 'Fiery meteors blast wide circles', cd: 1, pellets: 4, scatter: 2.4, r: 1.35, charge: 0.7, fly: 0.35, dmg: 2.6, size: 1.6, from: [0.5, -1], color: new THREE.Color(3, 1.3, 0.3) },
  minigun: { name: 'Gunship', desc: 'Endless rain of lead', cd: 0.14, pellets: 1, scatter: 1.2, r: 0.85, charge: 0.22, fly: 0.1, dmg: 0.8, size: 0.5, from: [1, 0.4], color: new THREE.Color(3, 2.6, 0.7) },
};
const GUN_IDS = Object.keys(GUNS) as Gun[];

interface Strike {
  x: number;
  z: number;
  t: number;
  boss: boolean;
}

interface Shot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  rocket: boolean;
  target: number;
}

/** "Survivor.io" arena: one hero, a joystick, an ever-growing swarm and a stack of auto-weapons. */
export class HordeSurvivor extends Mode {
  readonly id = 'horde';
  readonly title = 'HORDE SURVIVOR';
  private hero: Staff;
  private brute: Brute;
  private crowdM: Crowd;
  // enemies as parallel arrays: hundreds alive, no per-frame allocation
  private ex = new Float32Array(CAP);
  private ez = new Float32Array(CAP);
  private ehp = new Float32Array(CAP);
  private emax = new Float32Array(CAP);
  private etier = new Uint8Array(CAP);
  private eflash = new Float32Array(CAP);
  private ebladeCd = new Float32Array(CAP);
  private edie = new Float32Array(CAP);
  private eyaw = new Float32Array(CAP);
  private alive = new Uint8Array(CAP);
  private head = new Int32Array(GRID * GRID).fill(-1);
  private next = new Int32Array(CAP);
  private gems: { x: number; z: number; v: number; pull: boolean }[] = [];
  private gemMesh: THREE.InstancedMesh;
  private shotMesh: THREE.InstancedMesh;
  private bladeMesh: THREE.InstancedMesh;
  private shots: Shot[] = [];
  private gun: Gun = 'rifle';
  private strikes: Strike[] = [];
  private zoneMesh: THREE.InstancedMesh;
  private zoneFill: THREE.InstancedMesh;
  private reachRing: THREE.Mesh;
  private gunArt: Record<string, string> = {};
  private skills: Record<Skill, number> = { bolt: 1, blades: 0, nova: 0, rockets: 0, might: 0, haste: 0, swift: 0, magnet: 0, vitality: 0 };
  private hx = 0;
  private hz = 0;
  private hp = 100;
  private maxHp = 100;
  private iframe = 0;
  private xp = 0;
  private lvl = 1;
  private kills = 0;
  private duration = 75;
  private spawnAcc = 0;
  private boltT = 0;
  private novaT = 0;
  private rocketT = 0;
  private bladeA = 0;
  private paused = false;
  private pendingLevels = 0;
  private bossOn = false;
  private endT = -1;
  private god = false;
  private dmgMul = 1;
  private joyBase: { x: number; y: number } | null = null;
  private joyX = 0;
  private joyY = 0;
  private rng = mulberry32(1);
  private _a = new THREE.Vector3();
  private _m = new THREE.Matrix4();
  private _q = new THREE.Quaternion();
  private _s = new THREE.Vector3();
  private _d = new THREE.Vector3();
  private _c = new THREE.Color();
  private _e = new THREE.Euler();

  constructor(ctx: Ctx) {
    super(ctx, { sky: '#8fa3a6', fog: [26, 60], hemi: ['#e4ece6', '#4f6a33', 1.6], sun: { color: '#fff4dc', intensity: 2.6, pos: [-9, 22, 12], box: 20 } }, 260);
    this.buildArena();
    this.crowdM = this.crowd({ clip: 'Move', frames: 12, skin: ctx.skins.zombie }, CAP);
    this.hero = new Staff(ctx.assets.models.staff, '#ffd34d');
    this.hero.root.scale.setScalar(1.25);
    this.brute = new Brute(ctx.assets.models.boss);
    this.brute.onSlam = (at) => {
      this.fx.explosion(at, 1.5, 1, 0.45, 0.2);
      this.fx.shake(0.7);
      this.ctx.audio.boom(1.2);
      if (Math.hypot(at.x - this.hx, at.z - this.hz) < 3.4) this.hurt(28);
    };
    this.brute.onDead = () => (this.endT = 1);
    const gemMat = new THREE.MeshStandardMaterial({ color: '#4dfcff', emissive: '#1aa8ff', emissiveIntensity: 1.2, roughness: 0.2 });
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), gemMat, 600);
    this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 128);
    this.shotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(128 * 3), 3);
    const bladeGeo = new THREE.ConeGeometry(0.22, 1.1, 4).rotateZ(-Math.PI / 2);
    this.bladeMesh = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: '#d8f4ff', emissive: '#58c8ff', emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.2 }), 8);
    for (const m of [this.gemMesh, this.shotMesh, this.bladeMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
    }
    this.scene.add(this.hero.root, this.brute.root, this.gemMesh, this.shotMesh, this.bladeMesh);
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    const glow = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.zoneMesh = new THREE.InstancedMesh(ringGeo, glow(), 96);
    const fillMat = glow();
    fillMat.opacity = 0.35;
    this.zoneFill = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), fillMat, 96);
    for (const m of [this.zoneMesh, this.zoneFill]) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(96 * 3), 3);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 4;
    }
    // the gun's reach, shown as a faint glowing ring around the hero
    this.reachRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), glow());
    (this.reachRing.material as THREE.MeshBasicMaterial).opacity = 0.35;
    this.scene.add(this.zoneMesh, this.zoneFill, this.reachRing);
  }

  private gunArtFor(g: Gun): string {
    if (!this.gunArt[g]) this.gunArt = weaponPortraits(this.ctx.kit, GUN_IDS as WeaponId[], this.ctx.env);
    return this.gunArt[g];
  }

  /** Run opener: pick 1 of 3 guns; the level banner follows the pick. */
  private pickGun(): void {
    this.paused = true;
    const cards: Card[] = GUN_IDS.map((g) => ({ id: g, icon: ICON.bolt, art: this.gunArtFor(g), title: GUNS[g].name, desc: GUNS[g].desc }));
    this.ctx.hud.cards(cards, (c) => {
      this.arm(c.id as Gun);
      this.paused = false;
      this.track(true);
      this.ctx.audio.play('receive');
      this.ctx.hud.banner(`LEVEL ${this.level}`, `Survive ${this.duration}s, then slay the boss`, '#9cff6a', 1500);
      this.ctx.hud.hint('DRAG ANYWHERE TO MOVE');
    }, 'CHOOSE YOUR GUN');
  }

  private arm(g: Gun): void {
    this.gun = g;
    (this.reachRing.material as THREE.MeshBasicMaterial).color.copy(GUNS[g].color).multiplyScalar(0.5);
  }

  private buildArena(): void {
    const tex = groundTex('#56803a', ['rgba(110,85,50,0.4)', 'rgba(35,70,25,0.4)', 'rgba(140,160,70,0.3)'], ['rgba(40,90,20,0.45)', 'rgba(190,230,120,0.3)', 'rgba(80,60,40,0.4)'], [12, 12], 77);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 40, ARENA * 2 + 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.updateMatrix();
    ground.matrixAutoUpdate = false;
    this.scene.add(ground);
    // forest clearing from the Test00 map props, seeded so every run looks the same
    const rng = mulberry32(77);
    const items: [string, number, number, number, number][] = [];
    const pick = (l: string[]) => l[Math.floor(rng() * l.length)];
    const spot = (clear: number) => {
      let x = 0;
      let z = 0;
      do {
        x = (rng() * 2 - 1) * (ARENA + 8);
        z = (rng() * 2 - 1) * (ARENA + 8);
      } while (Math.hypot(x, z) < clear);
      return [x, z] as const;
    };
    // tall trees only ring the arena (the top-down camera would see nothing through a canopy); low bushes inside
    for (let i = 0; i < 90; i++) {
      const t = rng() * 4;
      const e = (rng() * 2 - 1) * (ARENA + 8);
      const d = (ARENA + 2 + rng() * 8) * (t < 2 ? -1 : 1);
      items.push([pick(['tree_a', 'tree_b', 'tree_pair']), t % 2 < 1 ? e : d, t % 2 < 1 ? d : e, rng() * 6.3, 0.55 + rng() * 0.3]);
    }
    for (let i = 0; i < 14; i++) items.push(['tree_bush', ...spot(9), rng() * 6.3, 0.4]);
    for (let i = 0; i < 160; i++) items.push([pick(['grass', 'grass', 'grass', 'rock', 'stump', 'stump_mush', 'log', 'log_cut', 'stake']), ...spot(4), rng() * 6.3, 0.5 + rng() * 0.4]);
    for (let i = 0; i < 6; i++) items.push([pick(['tent', 'campfire', 'fence', 'fence']), ...spot(10), rng() * 6.3, 0.8]);
    this.props(items);
  }

  // ------------------------------------------------------------------------------------------
  start(level: number): void {
    this.level = level;
    this.outcome = 'play';
    this.t = 0;
    this.fx.clear();
    this.alive.fill(0);
    this.edie.fill(0);
    this.head.fill(-1);
    this.gems.length = 0;
    this.shots.length = 0;
    this.strikes.length = 0;
    this.tutStep = level === 1 ? 0 : -1;
    this.tutT = 0;
    this.skills = { bolt: 1, blades: 0, nova: 0, rockets: 0, might: 0, haste: 0, swift: 0, magnet: 0, vitality: 0 };
    this.hx = this.hz = 0;
    this.hp = this.maxHp = 100;
    this.iframe = 0;
    this.xp = 0;
    this.lvl = 1;
    this.kills = 0;
    this.duration = Math.min(90, 55 + level * 10);
    this.spawnAcc = 0;
    this.boltT = this.novaT = this.rocketT = 0;
    this.paused = false;
    this.pendingLevels = 0;
    this.bossOn = false;
    this.endT = -1;
    this.god = false;
    this.dmgMul = 1;
    this.joyBase = null;
    this.joyX = this.joyY = 0;
    this.rng = mulberry32(500 + level);
    this.brute.hide();
    this.hero.root.position.set(0, 0, 0);
    this.hero.play('Idle', 0);
    const hud = this.ctx.hud;
    hud.begin(this.title, [
      ['hp', ICON.heart],
      ['kills', ICON.skull],
      ['time', ICON.clock],
    ], 'zombie');
    this.arm('rifle');
    this.pickGun();
  }

  pointerDown(x: number, y: number): void {
    if (this.paused) return;
    this.joyBase = { x, y };
    this.joyX = this.joyY = 0;
    this.ctx.hud.joystick(this.joyBase);
    this.track(true);
  }
  pointerMove(x: number, y: number): void {
    if (!this.joyBase) return;
    const dx = x - this.joyBase.x;
    const dy = y - this.joyBase.y;
    const d = Math.hypot(dx, dy);
    const k = d > 60 ? 60 / d : 1;
    this.joyX = (dx * k) / 60;
    this.joyY = (dy * k) / 60;
    this.ctx.hud.joystick(this.joyBase, this.joyX * 40, this.joyY * 40);
  }
  pointerUp(): void {
    this.joyBase = null;
    this.joyX = this.joyY = 0;
    this.ctx.hud.joystick(null);
  }

  private get dmg(): number {
    return (1 + this.skills.might * 0.3) * this.dmgMul;
  }
  private get cdMul(): number {
    return Math.pow(0.85, this.skills.haste);
  }

  update(dt: number): void {
    const hud = this.ctx.hud;
    if (this.paused) {
      if ((this.bot || this.god) && hud.cardsOpen) (hud.root.querySelector('.arc-card') as HTMLElement | null)?.click();
      this.render(0);
      return;
    }
    dt *= this.tutorial(dt);
    this.t += dt;
    if (this.t > 4 || this.tutStep >= 0) hud.hint(null);

    // ---- hero ----
    let mx = this.joyX;
    let mz = this.joyY;
    if (this.bot) [mx, mz] = this.botMove();
    const mlen = Math.hypot(mx, mz);
    const speed = 6 * (1 + this.skills.swift * 0.12);
    if (this.outcome === 'play' && mlen > 0.05) {
      this.hx = clamp(this.hx + (mx / Math.max(1, mlen)) * speed * dt, -ARENA, ARENA);
      this.hz = clamp(this.hz + (mz / Math.max(1, mlen)) * speed * dt, -ARENA, ARENA);
      this.hero.targetYaw = Math.atan2(mx, mz);
      this.hero.play('Move 1', 0.15);
    } else if (this.outcome === 'play') this.hero.play('Idle', 0.2);
    this.hero.root.position.set(this.hx, 0, this.hz);
    this.hero.updateAnim(dt);
    this.iframe -= dt;

    if (this.outcome === 'play') {
      this.spawn(dt);
      this.weapons(dt);
    }
    this.moveEnemies(dt);
    this.updateShots(dt);
    this.updateGems(dt);
    this.brute.update(dt, this.outcome === 'play' ? this._a.set(this.hx, 0, this.hz) : null);

    if (!this.bossOn && this.t >= this.duration && this.outcome === 'play') this.enterBoss();
    if (this.brute.alive) hud.bossBar(this.brute.hp / this.brute.maxHp, `BONE KING Lv.${this.level}`);
    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) this.finish(true);
    }
    if (this.hp <= 0 && this.outcome === 'play') {
      this.hero.play('Stun', 0.1, false);
      this.ctx.audio.play('death');
      this.finish(false);
    }
    if (this.pendingLevels > 0 && this.outcome === 'play' && !hud.cardsOpen) this.levelUp();

    hud.stat('hp', `${Math.max(0, Math.ceil(this.hp))}`);
    hud.stat('kills', formatNum(this.kills));
    const left = Math.max(0, Math.ceil(this.duration - this.t));
    hud.stat('time', this.bossOn ? 'BOSS' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    hud.progress(this.xp / this.need, `LV ${this.lvl}`);
    hud.danger(this.hp < this.maxHp * 0.3 ? 0.7 : 0);
    this.render(dt);
  }

  /** Level-1 coach marks: move → the gun's glowing circles → gems. Returns the time scale. */
  private tutorial(dt: number): number {
    const hud = this.ctx.hud;
    if (this.tutStep < 0 || this.bot || this.god || this.outcome !== 'play' || hud.cardsOpen) {
      if (this.tutStep >= 0 && !hud.cardsOpen) {
        hud.spot(null);
        this.tutStep = -1;
      } else hud.spot(null);
      return 1;
    }
    this.tutT += dt;
    if (this.tutStep === 0) {
      if (Math.hypot(this.joyX, this.joyY) > 0.3 || this.tutT > 6) {
        this.tutStep = 1;
        this.tutT = 0;
      }
      this.spotWorld(this._a.set(this.hx, 1, this.hz), 1.6, 'DRAG ANYWHERE TO MOVE', [70, -50]);
      return 1;
    }
    if (this.tutStep === 1) {
      const st = this.strikes[0];
      if (!st) {
        hud.spot(null);
        return 1;
      }
      if (this.tutT > 2.2) {
        this.tutStep = 2;
        this.tutT = 0;
      }
      this.spotWorld(this._a.set(st.x, 0.5, st.z), GUNS[this.gun].r + 0.6, 'YOUR GUN FIRES FROM OFF-SCREEN\ninto the glowing circles: lure zombies in!');
      return 0.3;
    }
    const g = this.gems[0];
    if (!g || this.xp > 0 || this.lvl > 1 || this.tutT > 5) {
      if (this.xp > 0 || this.lvl > 1 || this.tutT > 5) this.tutStep = -1;
      hud.spot(null);
      return 1;
    }
    this.spotWorld(this._a.set(g.x, 0.4, g.z), 0.9, 'WALK OVER GEMS TO LEVEL UP\nand pick new skills');
    return 0.5;
  }

  private render(dt: number): void {
    this.drawEnemies(dt);
    this.fx.update(dt);
    this.camPos.set(this.hx, 17, this.hz + 10.5);
    this.camLook.set(this.hx, 0, this.hz - 0.5);
    this.followSun(this.hx, this.hz);
    this.applyCamera(this.fovFor(44));
  }

  private get need(): number {
    return 3 + Math.floor(this.lvl * 2.5);
  }
  private get aliveCount(): number {
    let n = 0;
    for (let i = 0; i < CAP; i++) n += this.alive[i];
    return n;
  }

  private spawn(dt: number): void {
    const p = this.t / this.duration;
    const rate = (1.2 + p * p * 14 + this.level * 0.6) * (this.bossOn ? 0.25 : 1);
    this.spawnAcc += rate * dt;
    const cap = Math.min(CAP, 110 + this.level * 30 + p * 160);
    // occasional surge ring for the "wall of enemies" moments
    const surge = !this.bossOn && Math.floor(this.t / 15) !== Math.floor((this.t - dt) / 15) && this.t > 5;
    let n = Math.min(Math.floor(this.spawnAcc) + (surge ? 16 + this.level * 8 : 0), Math.max(0, cap - this.aliveCount));
    this.spawnAcc -= Math.floor(this.spawnAcc);
    if (surge) this.ctx.hud.banner('SWARM!', '', '#ff7a4d', 900);
    for (let i = 0; i < CAP && n > 0; i++) {
      if (this.alive[i] || this.edie[i] > 0) continue;
      const a = this.rng() * Math.PI * 2;
      const r = surge ? 13 : 15 + this.rng() * 5;
      this.ex[i] = clamp(this.hx + Math.cos(a) * r, -ARENA - 4, ARENA + 4);
      this.ez[i] = clamp(this.hz + Math.sin(a) * r, -ARENA - 4, ARENA + 4);
      const tier = Math.min(3, Math.floor(this.rng() * (1 + p * 2.6 + this.level * 0.3)));
      this.etier[i] = tier;
      this.ehp[i] = this.emax[i] = (2 + tier * 4) * (1 + p * 1.5) * (1 + (this.level - 1) * 0.35);
      this.eflash[i] = 0;
      this.ebladeCd[i] = 0;
      this.alive[i] = 1;
      n--;
    }
  }

  private buildGrid(): void {
    this.head.fill(-1);
    for (let i = 0; i < CAP; i++) {
      if (!this.alive[i]) continue;
      const c = this.cell(this.ex[i], this.ez[i]);
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }
  private cell(x: number, z: number): number {
    const cx = clamp(Math.floor((x + ARENA + CELL) / CELL), 0, GRID - 1);
    const cz = clamp(Math.floor((z + ARENA + CELL) / CELL), 0, GRID - 1);
    return cz * GRID + cx;
  }
  /** Visit enemies within r of (x,z). */
  private near(x: number, z: number, r: number, fn: (i: number, d: number) => void): void {
    const c0x = clamp(Math.floor((x - r + ARENA + CELL) / CELL), 0, GRID - 1);
    const c1x = clamp(Math.floor((x + r + ARENA + CELL) / CELL), 0, GRID - 1);
    const c0z = clamp(Math.floor((z - r + ARENA + CELL) / CELL), 0, GRID - 1);
    const c1z = clamp(Math.floor((z + r + ARENA + CELL) / CELL), 0, GRID - 1);
    for (let cz = c0z; cz <= c1z; cz++)
      for (let cx = c0x; cx <= c1x; cx++)
        for (let i = this.head[cz * GRID + cx]; i >= 0; i = this.next[i]) {
          if (!this.alive[i]) continue;
          const d = Math.hypot(this.ex[i] - x, this.ez[i] - z);
          if (d <= r) fn(i, d);
        }
  }

  private moveEnemies(dt: number): void {
    this.buildGrid();
    const play = this.outcome === 'play';
    let touching = 0;
    for (let i = 0; i < CAP; i++) {
      if (!this.alive[i]) continue;
      let dx = this.hx - this.ex[i];
      let dz = this.hz - this.ez[i];
      const d = Math.hypot(dx, dz) || 1;
      const sp = (1.9 + this.etier[i] * 0.35) * (play ? 1 : -0.3);
      dx /= d;
      dz /= d;
      // separation: push away from up to 4 neighbours in the same cell
      let sx = 0;
      let sz = 0;
      let k = 0;
      for (let j = this.head[this.cell(this.ex[i], this.ez[i])]; j >= 0 && k < 4; j = this.next[j]) {
        if (j === i) continue;
        const ox = this.ex[i] - this.ex[j];
        const oz = this.ez[i] - this.ez[j];
        const od = ox * ox + oz * oz;
        if (od < 0.64 && od > 1e-6) {
          const q = 1 / Math.sqrt(od);
          sx += ox * q;
          sz += oz * q;
          k++;
        }
      }
      this.ex[i] += (dx * sp + sx * 1.6) * dt;
      this.ez[i] += (dz * sp + sz * 1.6) * dt;
      this.eyaw[i] = Math.atan2(dx, dz);
      if (d < 0.85 && play) {
        touching++;
        this.ex[i] -= dx * 0.4;
        this.ez[i] -= dz * 0.4;
      }
    }
    if (touching && this.iframe <= 0) this.hurt(Math.min(14, 4 + touching * 1.5) * (1 + this.level * 0.08));
  }

  private hurt(n: number): void {
    if (this.god || this.iframe > 0 || this.outcome !== 'play') return;
    this.hp -= n;
    this.iframe = 0.45;
    this.ctx.hud.flash(0.25, 160, '#ff2a2a');
    this.fx.shake(0.18);
    const s = this.ctx.hud.project(this._a.set(this.hx, 2.2, this.hz), this.ctx.engine.camera);
    this.ctx.hud.float(s.x, s.y, `-${Math.round(n)}`, 'lose', 50, 600);
  }

  private damageEnemy(i: number, n: number, showNum = false): void {
    if (!this.alive[i]) return;
    this.ehp[i] -= n;
    this.eflash[i] = 1;
    if (showNum) {
      const s = this.ctx.hud.project(this._a.set(this.ex[i], 1.8, this.ez[i]), this.ctx.engine.camera);
      this.ctx.hud.float(s.x + rand(-12, 12), s.y, formatNum(Math.round(n * 10)), '', 40, 500);
    }
    if (this.ehp[i] > 0) return;
    this.alive[i] = 0;
    this.edie[i] = 0.001;
    this.kills++;
    if (this.gems.length < 600) this.gems.push({ x: this.ex[i], z: this.ez[i], v: 1 + this.etier[i], pull: false });
    this.fx.splat(this._a.set(this.ex[i], 0.8, this.ez[i]), 0.45, 1, 0.2, this.etier[i] ? 1.2 : 0.8);
  }

  private nearest(x: number, z: number, r: number): number {
    let best = -1;
    let bd = r;
    this.near(x, z, r, (i, d) => {
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private weapons(dt: number): void {
    const S = this.skills;
    // gun battery: mark glowing circles on the nearest foes; rounds come in from off-screen (strikes())
    this.boltT -= dt;
    if (this.boltT <= 0) {
      const G = GUNS[this.gun];
      this.boltT = G.cd * this.cdMul;
      const bx = this.brute.alive && this.brute.state !== 'spawn' && Math.hypot(this.brute.root.position.x - this.hx, this.brute.root.position.z - this.hz) < REACH + 1;
      const n = G.pellets + S.bolt - 1;
      // rifle/minigun spread circles over distinct nearest foes; meteors cluster around the first
      const picked: number[] = [];
      for (let k = 0; k < n; k++) {
        let ax: number;
        let az: number;
        if (bx) {
          ax = this.brute.root.position.x + (k ? rand(-1.5, 1.5) : 0);
          az = this.brute.root.position.z + (k ? rand(-1.5, 1.5) : 0);
        } else {
          const tgt = this.gun === 'shotgun' && k ? (picked[0] ?? -1) : this.nearestFree(picked);
          if (tgt < 0) break;
          picked.push(tgt);
          const sc = this.gun === 'shotgun' && k ? G.scatter : G.scatter * 0.3;
          ax = this.ex[tgt] + rand(-sc, sc);
          az = this.ez[tgt] + rand(-sc, sc);
        }
        if (this.strikes.length < 96) this.strikes.push({ x: ax, z: az, t: G.charge * (1 + k * 0.12), boss: bx });
      }
      if (picked.length || bx) this.ctx.audio.play('click', 0.12, 1.6);
    }
    this.strikesUpdate(dt);
    // orbit blades
    if (S.blades) {
      this.bladeA += dt * (3 + S.blades * 0.5);
      const n = S.blades + 1;
      for (let k = 0; k < n; k++) {
        const a = this.bladeA + (k / n) * Math.PI * 2;
        const bx = this.hx + Math.cos(a) * 2.4;
        const bz = this.hz + Math.sin(a) * 2.4;
        this.near(bx, bz, 0.8, (i) => {
          if (this.ebladeCd[i] > this.t) return;
          this.ebladeCd[i] = this.t + 0.4;
          this.damageEnemy(i, 3 * this.dmg);
        });
        if (this.brute.alive && Math.hypot(this.brute.root.position.x - bx, this.brute.root.position.z - bz) < 1.6 * this.brute.scale) this.hitBoss(6 * this.dmg * dt);
      }
    }
    // nova pulse
    if (S.nova) {
      this.novaT -= dt;
      if (this.novaT <= 0) {
        this.novaT = Math.max(1.4, 3.6 - S.nova * 0.4) * this.cdMul;
        const r = 3.6 + S.nova * 0.9;
        this._a.set(this.hx, 0, this.hz);
        this.fx.ground.ring(this._a, r, '#7fe8ff', 0.5, 0.5);
        this.fx.ground.ring(this._a, r * 0.7, '#ffffff', 0.35, 0.3);
        this.near(this.hx, this.hz, r, (i) => this.damageEnemy(i, 4 * this.dmg));
        if (this.brute.alive && Math.hypot(this.brute.root.position.x - this.hx, this.brute.root.position.z - this.hz) < r + 1) this.hitBoss(12 * this.dmg);
        this.ctx.audio.whoosh(true);
      }
    }
    // rocket pod
    if (S.rockets) {
      this.rocketT -= dt;
      if (this.rocketT <= 0) {
        this.rocketT = 2.2 * this.cdMul;
        for (let k = 0; k < S.rockets; k++) {
          const a = this.rng() * Math.PI * 2;
          this.shots.push({ x: this.hx, z: this.hz, vx: Math.cos(a) * 6, vz: Math.sin(a) * 6, life: 2.2, rocket: true, target: this.brute.alive ? -1 : this.nearest(this.hx + Math.cos(a) * 6, this.hz + Math.sin(a) * 6, 12) });
        }
      }
    }
  }

  /** Nearest foe within REACH that no circle of this volley already covers. */
  private nearestFree(taken: number[]): number {
    let best = -1;
    let bd = REACH;
    this.near(this.hx, this.hz, REACH, (i, d) => {
      if (d < bd && !taken.includes(i)) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Counts circles down; on impact the round lands, blasting every foe inside the circle. */
  private strikesUpdate(dt: number): void {
    const G = GUNS[this.gun];
    let hitSound = false;
    for (let k = this.strikes.length - 1; k >= 0; k--) {
      const st = this.strikes[k];
      st.t -= dt;
      if (st.t > 0) continue;
      this.strikes[k] = this.strikes[this.strikes.length - 1];
      this.strikes.pop();
      const p = this._a.set(st.x, 0.5, st.z);
      if (this.gun === 'shotgun') {
        this.fx.explosion(p, 0.75, 1, 0.5, 0.15);
        this.fx.ground.ring(p, G.r * 1.6, '#ff8a3d', 0.4);
      } else {
        this.fx.hit(p, G.color.r / 3, G.color.g / 3, G.color.b / 3, this.gun === 'rifle' ? 6 : 2);
        this.fx.dust(p, 0.4, 3);
      }
      this.near(st.x, st.z, G.r, (i) => this.damageEnemy(i, G.dmg * this.dmg, this.rng() < 0.25));
      if (this.brute.alive && Math.hypot(this.brute.root.position.x - st.x, this.brute.root.position.z - st.z) < G.r + 1.3 * this.brute.scale) this.hitBoss(G.dmg * 1.2 * this.dmg);
      hitSound = true;
    }
    if (hitSound) {
      if (this.gun === 'shotgun') this.ctx.audio.boom(0.35);
      else this.ctx.audio.play('gun', this.gun === 'minigun' ? 0.07 : 0.18, this.gun === 'rifle' ? 1.6 : 1.3);
    }
  }

  private hitBoss(n: number): void {
    if (this.brute.damage(n)) {
      this.fx.explosion(this.brute.centre(this._a), 3, 1, 0.6, 0.25);
      this.fx.shake(1);
      this.ctx.audio.boom(2);
      this.ctx.hud.flash(0.6, 400);
      this.ctx.hud.banner('VICTORY!', 'The Bone King falls', '#ffd34d', 1400);
    }
  }

  private updateShots(dt: number): void {
    const m = this.shotMesh;
    let c = 0;
    const col = m.instanceColor!.array as Float32Array;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k];
      s.life -= dt;
      if (s.rocket && s.target >= 0 && this.alive[s.target]) {
        // home in: steer velocity toward the target
        const dx = this.ex[s.target] - s.x;
        const dz = this.ez[s.target] - s.z;
        const d = Math.hypot(dx, dz) || 1;
        s.vx += ((dx / d) * 16 - s.vx) * damp(4, dt);
        s.vz += ((dz / d) * 16 - s.vz) * damp(4, dt);
      } else if (s.rocket && this.brute.alive) {
        const dx = this.brute.root.position.x - s.x;
        const dz = this.brute.root.position.z - s.z;
        const d = Math.hypot(dx, dz) || 1;
        s.vx += ((dx / d) * 16 - s.vx) * damp(4, dt);
        s.vz += ((dz / d) * 16 - s.vz) * damp(4, dt);
      } else if (s.rocket && this.rng() < 0.1) s.target = this.nearest(s.x, s.z, 10);
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      let hit = -1;
      if (s.life > 0) {
        if (s.target !== CAP)
          this.near(s.x, s.z, s.rocket ? 0.7 : 0.55, (i) => {
            if (hit < 0) hit = i;
          });
        if (hit < 0 && this.brute.alive && Math.hypot(this.brute.root.position.x - s.x, this.brute.root.position.z - s.z) < 1.3 * this.brute.scale) hit = CAP;
      }
      if (hit >= 0 || s.life <= 0) {
        if (s.rocket) {
          this._a.set(s.x, 0.6, s.z);
          this.fx.explosion(this._a, 0.7, 1, 0.55, 0.2);
          this.near(s.x, s.z, 2.4, (i) => this.damageEnemy(i, 7 * this.dmg));
          if (hit === CAP) this.hitBoss(14 * this.dmg);
          this.ctx.audio.boom(0.4);
        } else if (hit === CAP) this.hitBoss(GUNS[this.gun].dmg * 1.2 * this.dmg);
        else if (hit >= 0) {
          this.fx.hit(this._a.set(s.x, 1, s.z), 1, 0.8, 0.4, 1);
          this.damageEnemy(hit, GUNS[this.gun].dmg * this.dmg, this.rng() < 0.25);
        }
        this.shots[k] = this.shots[this.shots.length - 1];
        this.shots.pop();
        continue;
      }
      if (c >= 128) continue;
      this._q.setFromEuler(this._e.set(0, Math.atan2(s.vx, s.vz), 0));
      this._m.compose(this._a.set(s.x, 1.1, s.z), this._q, this._s.set(s.rocket ? 1.4 : 0.8 * GUNS[this.gun].size, 0.8 * GUNS[this.gun].size, s.rocket ? 1.6 : 2.6));
      m.setMatrixAt(c, this._m);
      (s.rocket ? ROCKET_C : GUNS[this.gun].color).toArray(col, c * 3);
      c++;
      if (s.rocket && this.rng() < 0.5) this.fx.trail(this._a.set(s.x, 1.1, s.z));
    }
    // battery rounds: fly in from off-screen along the gun's direction and land on their circle
    const G = GUNS[this.gun];
    const fl = this._s.set(G.from[0], 1.2, G.from[1]).normalize();
    const zc = this.zoneMesh.instanceColor!.array as Float32Array;
    const fc = this.zoneFill.instanceColor!.array as Float32Array;
    let zn = 0;
    for (const st of this.strikes) {
      const total = G.charge;
      const k = clamp(1 - st.t / total, 0, 1);
      const pulse = 1 + Math.sin(this.t * 20) * 0.04;
      this._q.identity();
      this._m.compose(this._a.set(st.x, 0.05, st.z), this._q, this._d.setScalar(G.r * pulse));
      this.zoneMesh.setMatrixAt(zn, this._m);
      this._m.compose(this._a.set(st.x, 0.04, st.z), this._q, this._d.setScalar(G.r * Math.max(0.05, k)));
      this.zoneFill.setMatrixAt(zn, this._m);
      this._c.copy(G.color).multiplyScalar(0.45 + k * 0.35).toArray(zc, zn * 3);
      this._c.copy(G.color).multiplyScalar(0.25).toArray(fc, zn * 3);
      zn++;
      if (st.t < G.fly && c < 128) {
        const d = (st.t / G.fly) * 26;
        this._a.set(st.x + fl.x * d, 0.6 + fl.y * d, st.z + fl.z * d);
        this._q.setFromUnitVectors(this._d.set(0, 0, 1), fl);
        this._m.compose(this._a, this._q, this._d.set(G.size, G.size, G.size * (this.gun === 'shotgun' ? 2.2 : 6)));
        m.setMatrixAt(c, this._m);
        G.color.toArray(col, c * 3);
        c++;
        if (this.gun === 'shotgun') this.fx.trail(this._a);
      }
    }
    this.zoneMesh.count = this.zoneFill.count = zn;
    for (const z of [this.zoneMesh, this.zoneFill]) {
      z.instanceMatrix.needsUpdate = true;
      z.instanceColor!.needsUpdate = true;
    }
    this.reachRing.position.set(this.hx, 0.03, this.hz);
    this.reachRing.scale.setScalar(REACH);
    m.count = c;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;

    // blades
    const n = this.skills.blades ? this.skills.blades + 1 : 0;
    for (let k = 0; k < n; k++) {
      const a = this.bladeA + (k / n) * Math.PI * 2;
      this._q.setFromEuler(this._e.set(0, -a, 0));
      this._m.compose(this._a.set(this.hx + Math.cos(a) * 2.4, 1, this.hz + Math.sin(a) * 2.4), this._q, this._s.setScalar(1));
      this.bladeMesh.setMatrixAt(k, this._m);
    }
    this.bladeMesh.count = n;
    this.bladeMesh.instanceMatrix.needsUpdate = true;
  }

  private updateGems(dt: number): void {
    const R = 2.2 * (1 + this.skills.magnet * 0.6);
    const m = this.gemMesh;
    let c = 0;
    for (let k = this.gems.length - 1; k >= 0; k--) {
      const g = this.gems[k];
      const dx = this.hx - g.x;
      const dz = this.hz - g.z;
      const d = Math.hypot(dx, dz);
      if (d < R && this.outcome === 'play') g.pull = true;
      if (g.pull) {
        const sp = Math.max(9, 22 - d * 2) * dt;
        g.x += (dx / (d || 1)) * Math.min(sp, d);
        g.z += (dz / (d || 1)) * Math.min(sp, d);
        if (d < 0.5) {
          this.xp += g.v;
          this.gems[k] = this.gems[this.gems.length - 1];
          this.gems.pop();
          if ((this.kills & 3) === 0) this.ctx.audio.play('coin', 0.25, 1.4);
          while (this.xp >= this.need) {
            this.xp -= this.need;
            this.lvl++;
            this.pendingLevels++;
          }
          continue;
        }
      }
      this._q.setFromEuler(this._e.set(0, this.t * 3 + k, 0));
      this._m.compose(this._a.set(g.x, 0.45 + Math.sin(this.t * 4 + k) * 0.1, g.z), this._q, this._s.setScalar(0.7 + g.v * 0.15));
      m.setMatrixAt(c++, this._m);
    }
    m.count = c;
    m.instanceMatrix.needsUpdate = true;
  }

  private drawEnemies(dt: number): void {
    const cr = this.crowdM;
    cr.begin();
    this.blobs.begin();
    this.blobs.add(this._a.set(this.hx, 0, this.hz), 0.8);
    for (let i = 0; i < CAP; i++) {
      if (this.alive[i]) {
        this.eflash[i] = Math.max(0, this.eflash[i] - dt * 7);
        const tier = this.etier[i];
        cr.add(this.ex[i], 0, this.ez[i], this.eyaw[i], 1 + tier * 0.12, this.t * 1.3 + i * 0.37, this.eflash[i] > 0.4 ? HIT_WHITE : TIERS[tier]);
        if (Math.abs(this.ex[i] - this.hx) < 14 && Math.abs(this.ez[i] - this.hz) < 14) this.blobs.add(this._a.set(this.ex[i], 0, this.ez[i]), 0.45);
      } else if (this.edie[i] > 0) {
        this.edie[i] += dt;
        const k = this.edie[i] / 0.45;
        if (k >= 1) this.edie[i] = 0;
        else cr.add(this.ex[i], Math.sin(k * Math.PI) * 0.4, this.ez[i], this.eyaw[i], 1 - k * 0.7, i * 0.37, TIERS[this.etier[i]], -k * 1.5);
      }
    }
    cr.end();
    if (this.brute.alive) this.blobs.add(this._a.set(this.brute.root.position.x, 0, this.brute.root.position.z), 1.6 * this.brute.scale);
    this.blobs.end();
  }

  private enterBoss(): void {
    this.bossOn = true;
    const a = this.rng() * Math.PI * 2;
    const at = new THREE.Vector3(clamp(this.hx + Math.cos(a) * 9, -ARENA, ARENA), 0, clamp(this.hz + Math.sin(a) * 9, -ARENA, ARENA));
    this.brute.attackGap = Math.max(1.3, 2.4 - this.level * 0.15);
    this.brute.spawn(at, 0, 1.1 + Math.min(0.4, this.level * 0.05), 220 + this.level * 160, '#c9e8ff');
    this.ctx.audio.roar(1, 1.3);
    this.fx.shake(0.6);
    this.ctx.hud.banner('BOSS!', 'The Bone King awakens', '#ff5a4d', 1300);
    this.ctx.hud.flash(0.35, 300, '#ff3020');
  }

  private levelUp(): void {
    this.pendingLevels--;
    const open = (Object.keys(CARD) as Skill[]).some((k) => this.skills[k] < CARD[k].max);
    if (!open) {
      // fully built: level-ups just heal
      this.hp = Math.min(this.maxHp, this.hp + 25);
      return;
    }
    this.paused = true;
    this.pointerUp();
    this.ctx.audio.chime(4);
    this.fx.ground.pillar(this._a.set(this.hx, 0, this.hz), 1.2, 4, '#ffd34d', 0.8);
    const pool = (Object.keys(CARD) as Skill[]).filter((k) => this.skills[k] < CARD[k].max);
    // weapons first while the kit is thin so every run shows off the big effects
    const weapons = pool.filter((k) => ['blades', 'nova', 'rockets'].includes(k) && this.skills[k] === 0);
    const pick: Skill[] = [];
    if (weapons.length && this.lvl <= 4) pick.push(weapons[Math.floor(this.rng() * weapons.length)]);
    while (pick.length < 3 && pick.length < pool.length) {
      const k = pool[Math.floor(this.rng() * pool.length)];
      if (!pick.includes(k)) pick.push(k);
    }
    // the bolt card upgrades whichever gun is held
    const cards: Card[] = pick.map((k) => ({ id: k, icon: CARD[k].icon, art: k === 'bolt' ? this.gunArtFor(this.gun) : undefined, title: k === 'bolt' ? GUNS[this.gun].name : CARD[k].title, desc: CARD[k].desc(this.skills[k]), level: this.skills[k] + 1 }));
    this.ctx.hud.cards(cards, (c) => {
      const k = c.id as Skill;
      this.skills[k]++;
      if (k === 'vitality') this.hp = this.maxHp += 30;
      this.paused = false;
      this.track(true);
      this.ctx.audio.play('receive');
    });
  }

  /** Kite: flee the local crowd, drift toward gems, stay near the middle. */
  private botMove(): [number, number] {
    let fx = 0;
    let fz = 0;
    this.near(this.hx, this.hz, 6, (i, d) => {
      const w = 1 / Math.max(0.3, d * d);
      fx += (this.hx - this.ex[i]) * w;
      fz += (this.hz - this.ez[i]) * w;
    });
    if (this.brute.alive) {
      const bx = this.hx - this.brute.root.position.x;
      const bz = this.hz - this.brute.root.position.z;
      const d = Math.hypot(bx, bz);
      if (d < 6) {
        fx += (bx / d) * 2;
        fz += (bz / d) * 2;
      }
    }
    const g = this.gems.find((q) => Math.abs(q.x - this.hx) < 6 && Math.abs(q.z - this.hz) < 6);
    if (g) {
      fx += (g.x - this.hx) * 0.08;
      fz += (g.z - this.hz) * 0.08;
    }
    fx -= this.hx * 0.02;
    fz -= this.hz * 0.02;
    // circle-strafe so the swarm trails behind instead of boxing the hero in
    fx += Math.cos(this.t * 0.5) * 0.3;
    fz += Math.sin(this.t * 0.5) * 0.3;
    return [fx, fz];
  }

  endStats(): [string, string][] {
    return [
      ['Survived', `${Math.floor(this.t)}s`],
      ['Enemies slain', formatNum(this.kills)],
      ['Hero level', String(this.lvl)],
    ];
  }

  state(): Record<string, unknown> {
    return {
      mode: this.id,
      level: this.level,
      outcome: this.outcome,
      t: +this.t.toFixed(2),
      hp: Math.ceil(this.hp),
      lvl: this.lvl,
      kills: this.kills,
      alive: this.aliveCount,
      gems: this.gems.length,
      gun: this.gun,
      skills: { ...this.skills },
      paused: this.paused,
      boss: this.brute.alive ? Math.round(this.brute.hp) : this.bossOn ? 0 : -1,
      hero: [+this.hx.toFixed(1), +this.hz.toFixed(1)],
      drawn: this.crowdM.drawn,
    };
  }

  cheat(kind: 'win' | 'lose'): void {
    // resolve any open card pick (gun / level-up) so the cheat plays out immediately
    if (this.paused) (this.ctx.hud.root.querySelector('.arc-cards.on .arc-card') as HTMLElement | null)?.click();
    if (kind === 'lose') {
      this.god = false;
      this.iframe = 0;
      this.hp = 0;
      return;
    }
    this.god = true;
    this.dmgMul = 25;
    this.t = Math.max(this.t, this.duration);
  }

  /** Trailer hooks. */
  grant(skill: Skill, n = 1): void {
    this.skills[skill] = Math.min(CARD[skill].max, this.skills[skill] + n);
  }
  setGod(on: boolean): void {
    this.god = on;
  }
  surge(n: number, r = 9): void {
    let left = n;
    for (let i = 0; i < CAP && left > 0; i++) {
      if (this.alive[i] || this.edie[i] > 0) continue;
      const a = (left / n) * Math.PI * 2;
      this.ex[i] = this.hx + Math.cos(a) * (r + this.rng() * 3);
      this.ez[i] = this.hz + Math.sin(a) * (r + this.rng() * 3);
      this.etier[i] = Math.floor(this.rng() * 3);
      this.ehp[i] = this.emax[i] = 3;
      this.alive[i] = 1;
      left--;
    }
  }
}
