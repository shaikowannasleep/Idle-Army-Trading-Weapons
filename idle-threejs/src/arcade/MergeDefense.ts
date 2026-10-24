import * as THREE from 'three';
import { Unit } from '../game/Actors';
import { WEAPONS } from '../game/Weapons';
import { Barricade } from '../game/Props';
import { WALL_HALF, WALL_Z } from '../game/layout';
import { clamp, formatNum, rand } from '../core/math';
import { Mode, Label3D, groundPoint, groundTex, mulberry32, type Ctx } from './Mode';
import { ICON, h } from './ArcadeHud';
import { Brute } from './Brute';
import type { Crowd } from './Crowd';

const WAVES = 10;
const SLOT_X = [-4.2, -1.4, 1.4, 4.2];
const SLOT_Z = [-5.5, -3.1];
const SPAWN_Z = -36;
/** Troopers only shoot zombies that have shambled into view (else they die off-screen at the spawn). */
const FIRE_Z = -21;
const FRONT_Z = WALL_Z - 0.7;
const MAX_LV = WEAPONS.length;
/** Damage per second of one trooper at each merge level: doubles per merge. */
const DPS = (lv: number) => 18 * 2 ** (lv - 1);
// multiplied over the zombie skin: plain rotters stay natural, elites glow toxic
const TINT = new THREE.Color('#f2f2e6');
const ELITE = new THREE.Color('#d9a0ff');
const HIT_WHITE = new THREE.Color(3, 3, 3);

interface Slot {
  pos: THREE.Vector3;
  lv: number;
  unit: Unit;
  label: Label3D;
  pad: THREE.Object3D;
  fireT: number;
  pop: number;
}

interface Foe {
  x: number;
  z: number;
  hp: number;
  max: number;
  elite: boolean;
  phase: number;
  flash: number;
  atWall: boolean;
}

/** "Infinite Defender" style: summon troopers, merge pairs up the weapon ladder, hold the wall for 10 waves. */
export class MergeDefense extends Mode {
  readonly id = 'merge';
  readonly title = 'MERGE DEFENSE';
  private slots: Slot[] = [];
  private wall = new Barricade();
  private walkers: Crowd;
  private biters: Crowd;
  private brute: Brute;
  private foes: Foe[] = [];
  private dying: { x: number; z: number; t: number; elite: boolean }[] = [];
  private coins = 0;
  private summons = 0;
  private wave = 0;
  private spawnLeft = 0;
  private spawnT = 0;
  private breakT = 0;
  private wallHp = 100;
  private wallMax = 100;
  private kills = 0;
  private best = 1;
  private merges = 0;
  private endT = -1;
  private drag = -1;
  private dragPos = new THREE.Vector3();
  private btn: HTMLButtonElement | null = null;
  private botT = 0;
  private rng = mulberry32(3);
  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();

  constructor(ctx: Ctx) {
    super(ctx, { sky: '#2b3a4f', fog: [34, 72], hemi: ['#dfe9ff', '#3b4a3a', 1.6], sun: { color: '#ffe2b8', intensity: 2.8, pos: [-10, 22, 6], box: 22 } }, 120);
    this.buildField();
    this.walkers = this.crowd({ clip: 'Move', frames: 12, skin: ctx.skins.zombie }, 160);
    this.biters = this.crowd({ clip: 'Attack_1', frames: 10, skin: ctx.skins.zombie }, 160);
    this.brute = new Brute(ctx.assets.models.boss);
    this.brute.onSlam = (at) => {
      this.fx.explosion(at, 1.4, 1, 0.5, 0.2);
      this.fx.shake(0.8);
      this.ctx.audio.boom(1.3);
      this.hitWall(this.wallMax * 0.12, at.x);
    };
    this.scene.add(this.wall.group, this.brute.root);
    const padSrc = ctx.assets.models.slot2.scene;
    const box = new THREE.Box3().setFromObject(padSrc);
    const size = box.getSize(new THREE.Vector3());
    for (const z of SLOT_Z)
      for (const x of SLOT_X) {
        const pad = padSrc.clone();
        pad.scale.multiply(new THREE.Vector3(1.3 / size.x, 0.3 / size.y, 1.3 / size.z));
        pad.position.set(x, 0, z);
        pad.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).receiveShadow = true) : 0));
        const unit = new Unit(ctx.assets.models.customer, ctx.kit);
        unit.setSkin(ctx.skins.soldier);
        unit.root.visible = false;
        unit.root.position.set(x, 0.3, z);
        unit.yaw = unit.targetYaw = Math.PI;
        const label = new Label3D(192, 72, 1.1);
        label.sprite.position.set(x, 2.35, z);
        label.sprite.visible = false;
        this.scene.add(pad, unit.root, label.sprite);
        this.slots.push({ pos: new THREE.Vector3(x, 0.3, z), lv: 0, unit, label, pad, fireT: 0, pop: 0 });
      }
  }

  private buildField(): void {
    const tex = groundTex('#5d6b4a', ['rgba(110,85,50,0.55)', 'rgba(30,45,20,0.6)', 'rgba(150,160,90,0.4)'], ['rgba(30,40,20,0.45)', 'rgba(170,190,120,0.3)', 'rgba(90,70,45,0.4)'], [6, 9], 9);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 90), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -20;
    ground.receiveShadow = true;
    // the kill zone: a rutted dirt road the horde walks down
    const dirt = groundTex('#8a6a4a', ['rgba(60,42,28,0.22)', 'rgba(160,130,95,0.2)', 'rgba(100,80,55,0.2)'], ['rgba(50,35,22,0.3)', 'rgba(190,165,130,0.22)', 'rgba(120,120,115,0.3)'], [1, 2], 21);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WALL_HALF * 2 + 1, 46), new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, WALL_Z - 23);
    road.receiveShadow = true;
    // defenders' deck behind the wall: wooden planks
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const prng = mulberry32(5);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(28, ${32 + prng() * 10}%, ${30 + prng() * 8}%)`;
      g.fillRect(0, i * 32, 256, 32);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, i * 32, 256, 3);
      const cut = prng() * 256;
      g.fillRect(cut, i * 32, 3, 32);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(${prng() < 0.5 ? '0,0,0' : '255,220,170'},0.08)`;
        g.fillRect(prng() * 256, i * 32 + 4 + prng() * 26, 20 + prng() * 60, 1.5);
      }
    }
    const planks = new THREE.CanvasTexture(c);
    planks.colorSpace = THREE.SRGBColorSpace;
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
    planks.repeat.set(2, 1.5);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(WALL_HALF * 2 + 1.5, 0.2, 6.2), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.85 }));
    deck.position.set(0, 0.1, -4.2);
    deck.receiveShadow = true;
    for (const o of [ground, road, deck]) {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
      this.scene.add(o);
    }
    // flanks from the Test00 map props: palisade stakes, clutter, forest
    const rng = mulberry32(9);
    const items: [string, number, number, number, number][] = [];
    const pick = (l: string[]) => l[Math.floor(rng() * l.length)];
    for (let z = WALL_Z - 1; z > SPAWN_Z - 8; z -= 1.6)
      for (const side of [-1, 1]) {
        items.push(['fence', side * (WALL_HALF + 1.1), z, Math.PI / 2 + (rng() - 0.5) * 0.1, 1.15]);
        if (rng() < 0.6) items.push([pick(['grass', 'grass', 'rock', 'stump', 'stump_mush', 'log_cut', 'stake']), side * (WALL_HALF + 2.2 + rng() * 3), z, rng() * 6.3, 0.7 + rng() * 0.5]);
        if (rng() < 0.45) items.push([pick(['tree_a', 'tree_b', 'tree_pair', 'tree_bush']), side * (WALL_HALF + 6 + rng() * 8), z, rng() * 6.3, 0.5 + rng() * 0.25]);
      }
    for (const side of [-1, 1]) {
      items.push(['tent', side * (WALL_HALF + 5), -4, side * 0.6, 0.75], ['campfire', side * (WALL_HALF + 3), -1.5, 0, 0.9]);
      for (let z = 2; z > -12; z -= 2.5) items.push([pick(['tree_a', 'tree_b', 'tree_bush']), side * (WALL_HALF + 9 + rng() * 5), z, rng() * 6.3, 0.55]);
    }
    this.props(items);
  }

  // ------------------------------------------------------------------------------------------
  start(level: number): void {
    this.level = level;
    this.outcome = 'play';
    this.t = 0;
    this.fx.clear();
    this.foes.length = 0;
    this.dying.length = 0;
    this.coins = 60;
    this.summons = 0;
    this.wave = 0;
    this.spawnLeft = 0;
    this.breakT = 2.5;
    this.wallHp = this.wallMax = 100;
    this.kills = 0;
    this.best = 1;
    this.merges = 0;
    this.endT = -1;
    this.drag = -1;
    this.botT = 0;
    this.rng = mulberry32(300 + level);
    this.wall.restore();
    this.brute.hide();
    for (const s of this.slots) this.setLv(s, 0);
    const hud = this.ctx.hud;
    hud.begin(this.title, [
      ['coins', 'coin'],
      ['wave', ICON.flag],
      ['wall', ICON.heart],
    ], 'zombie');
    const b = h('arc-summon stroke', '', 'button') as HTMLButtonElement;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => this.summon());
    hud.modeLayer.append(b);
    this.btn = b;
    hud.banner(`LEVEL ${level}`, 'Summon troops · merge pairs · hold the wall', '#ffd34d', 1500);
    this.tutStep = level === 1 ? 0 : -1;
    this.tutT = 0;
  }

  private get cost(): number {
    return 20 + this.summons * 8;
  }
  private get hpScale(): number {
    return 1 + (this.level - 1) * 0.3;
  }

  private setLv(s: Slot, lv: number): void {
    s.lv = lv;
    s.unit.root.visible = lv > 0;
    s.label.sprite.visible = lv > 0;
    if (!lv) return;
    const w = WEAPONS[lv - 1];
    s.unit.arm(w);
    s.unit.play(w.aim, 0);
    s.unit.root.scale.setScalar(0.95 * w.troop + (lv - 1) * 0.06);
    s.label.set(`Lv${lv}`, w.color);
    s.pop = 0;
  }

  summon(): boolean {
    const empty = this.slots.filter((s) => s.lv === 0);
    if (this.outcome !== 'play' || this.coins < this.cost || !empty.length) {
      if (this.btn) this.btn.classList.add('deny');
      setTimeout(() => this.btn?.classList.remove('deny'), 250);
      this.track(false);
      return false;
    }
    this.coins -= this.cost;
    this.summons++;
    const s = empty[Math.floor(this.rng() * empty.length)];
    this.setLv(s, 1);
    this.fx.ground.pillar(s.pos, 0.6, 3, '#7fd0ff', 0.6);
    this.fx.poof(this._a.copy(s.pos).setY(0.6), 0.6, 0.85, 1, 0.8);
    this.ctx.audio.play('receive', 0.7);
    this.ctx.hud.bump('coins');
    this.track(true);
    return true;
  }

  private merge(from: Slot, to: Slot): void {
    const lv = to.lv + 1;
    this.setLv(from, 0);
    this.setLv(to, lv);
    this.merges++;
    this.fx.ground.pillar(to.pos, 0.8, 4, WEAPONS[lv - 1].color, 0.8);
    this.fx.ground.ring(to.pos, 2, '#ffffff', 0.5);
    const c = new THREE.Color(WEAPONS[lv - 1].color);
    for (let i = 0; i < 16; i++) this.fx.sparkle(this._a.set(to.pos.x + rand(-0.6, 0.6), rand(0.4, 2.4), to.pos.z + rand(-0.6, 0.6)), c.r, c.g, c.b);
    this.ctx.audio.chime(lv + 1);
    if (lv > this.best) {
      this.best = lv;
      this.ctx.hud.banner(`${WEAPONS[lv - 1].name.toUpperCase()}!`, `Tier ${lv} trooper unlocked`, WEAPONS[lv - 1].color, 1100);
      this.ctx.hud.flash(0.3, 220);
    }
    this.track(true);
  }

  // ---- drag & merge ----
  private slotAt(x: number, y: number, r: number): number {
    if (!groundPoint(x, y, this.ctx.engine.camera, this._a, 0.3)) return -1;
    let best = -1;
    let bd = r;
    this.slots.forEach((s, i) => {
      const d = Math.hypot(s.pos.x - this._a.x, s.pos.z - this._a.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  pointerDown(x: number, y: number): void {
    const i = this.slotAt(x, y, 1.4);
    if (i < 0 || !this.slots[i].lv || this.outcome !== 'play') return;
    this.drag = i;
    this.dragPos.copy(this.slots[i].pos);
    this.ctx.audio.play('click', 0.6);
  }
  pointerMove(x: number, y: number): void {
    if (this.drag < 0) return;
    if (groundPoint(x, y, this.ctx.engine.camera, this._a, 0.3)) this.dragPos.set(clamp(this._a.x, -6, 6), 0.9, clamp(this._a.z, -7, -1.5));
  }
  pointerUp(x: number, y: number): void {
    if (this.drag < 0) return;
    const from = this.slots[this.drag];
    const j = this.slotAt(x, y, 1.6);
    this.drag = -1;
    from.unit.root.position.copy(from.pos);
    if (j < 0 || this.slots[j] === from) return;
    this.dropOn(from, this.slots[j]);
  }
  private dropOn(from: Slot, to: Slot): void {
    if (to.lv === from.lv && to.lv < MAX_LV) this.merge(from, to);
    else {
      const a = from.lv;
      this.setLv(from, to.lv);
      this.setLv(to, a);
      this.ctx.audio.whoosh(false);
    }
  }

  // ------------------------------------------------------------------------------------------
  update(dt: number): void {
    this.t += dt;
    const hud = this.ctx.hud;
    if (this.bot && this.outcome === 'play') this.botPlay(dt);
    if (this.outcome === 'play') this.waves(dt);
    this.updateFoes(dt);
    this.updateTroops(dt);
    this.brute.update(dt, this.outcome === 'play' ? this._a.set(clamp(this.brute.root.position.x, -4, 4), 0, WALL_Z - 4) : null); // slams from the road, never covers the troop board
    this.wall.update(dt);
    if (this.brute.alive) hud.bossBar(this.brute.hp / this.brute.maxHp, `SIEGE LORD · WAVE ${this.wave}`);
    else hud.bossBar(null);
    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) this.finish(true);
    }
    if (this.wallHp <= 0 && this.outcome === 'play') {
      this.ctx.audio.play('death');
      this.fx.shake(0.8);
      this.finish(false);
    }

    this.tutorial(dt);

    hud.stat('coins', formatNum(this.coins));
    hud.stat('wave', `${Math.max(1, this.wave)}/${WAVES}`);
    hud.stat('wall', `${Math.max(0, Math.ceil((this.wallHp / this.wallMax) * 100))}%`);
    hud.progress(this.wave / WAVES, this.breakT > 0 && this.wave < WAVES ? `WAVE ${this.wave + 1} INCOMING` : `WAVE ${this.wave}`);
    hud.danger(this.wallHp < this.wallMax * 0.3 ? 0.6 : 0);
    if (this.btn) {
      const full = this.slots.every((s) => s.lv > 0);
      const txt = full ? 'MERGE!' : `SUMMON <span><img src="${(hud.root.querySelector('.arc-pill.coins img') as HTMLImageElement | null)?.src ?? ''}" alt="">${this.cost}</span>`;
      if (this.btn.dataset.t !== txt) {
        this.btn.dataset.t = txt;
        this.btn.innerHTML = txt;
      }
      this.btn.classList.toggle('off', full || this.coins < this.cost);
    }

    this.fx.update(dt);
    this.camPos.set(0, 16.5, 7.5);
    this.camLook.set(0, 0, -11.5);
    this.followSun(0, -12);
    this.applyCamera(this.fovFor(50));
  }

  private waves(dt: number): void {
    if (this.breakT > 0) {
      this.breakT -= dt;
      if (this.breakT <= 0) {
        this.wave++;
        this.spawnLeft = 10 + this.wave * 4 + this.level;
        this.spawnT = 0;
        const boss = this.wave === 5 || this.wave === WAVES;
        this.ctx.hud.banner(boss ? `WAVE ${this.wave} · BOSS` : `WAVE ${this.wave}`, '', boss ? '#ff5a4d' : '#ffffff', 900);
        this.ctx.audio.play('tip');
        if (boss) {
          this.brute.attackGap = 2.6;
          this.brute.leapLen = 3;
          this.brute.spawn(new THREE.Vector3(0, 0, SPAWN_Z + 6), 0, 1.25 + (this.wave === WAVES ? 0.25 : 0), (this.wave === WAVES ? 2600 : 900) * this.hpScale, '#ffd7c8');
          this.ctx.audio.roar(1, 1.2);
        }
      }
      return;
    }
    if (this.spawnLeft > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        // zombies arrive in packs so the road always reads as a horde
        this.spawnT = Math.max(1.1, 2.4 - this.wave * 0.13);
        const cx = (this.rng() * 2 - 1) * (WALL_HALF - 2);
        for (let n = Math.min(this.spawnLeft, 3 + Math.floor(this.rng() * 3)); n > 0; n--) {
          this.spawnLeft--;
          const elite = this.wave >= 3 && this.rng() < 0.12;
          const hp = 24 * 1.28 ** (this.wave - 1) * this.hpScale * (elite ? 4 : 1);
          const x = THREE.MathUtils.clamp(cx + (this.rng() * 2 - 1) * 2.2, -(WALL_HALF - 0.8), WALL_HALF - 0.8);
          this.foes.push({ x, z: SPAWN_Z - this.rng() * 3, hp, max: hp, elite, phase: this.rng() * 2, flash: 0, atWall: false });
        }
      }
      return;
    }
    if (this.foes.length === 0 && !this.brute.alive && this.brute.state !== 'dying') {
      if (this.wave >= WAVES) {
        if (this.endT < 0) this.endT = 0.8;
      } else {
        this.breakT = 2.5;
        this.coins += 10 + this.wave * 4;
        this.ctx.hud.bump('coins');
      }
    }
  }

  private hitWall(n: number, x: number): void {
    const before = this.wallHp;
    this.wallHp = Math.max(0, this.wallHp - n);
    // fling bags in 5% steps so chip damage still reads
    if (Math.floor(before / 5) !== Math.floor(this.wallHp / 5)) this.wall.setRatio(this.wallHp / this.wallMax, x);
  }

  private updateFoes(dt: number): void {
    const play = this.outcome === 'play';
    const wk = this.walkers;
    const bt = this.biters;
    wk.begin();
    bt.begin();
    this.blobs.begin();
    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      if (play && !f.atWall) {
        f.z += (f.elite ? 1 : 1.3) * dt;
        if (f.z >= FRONT_Z - (f.elite ? 0.3 : 0)) f.atWall = true;
      } else if (play) this.hitWall((f.elite ? 3 : 1.2) * dt * this.hpScale, f.x);
      f.flash = Math.max(0, f.flash - dt * 7);
      const col = f.flash > 0.4 ? HIT_WHITE : f.elite ? ELITE : TINT;
      (f.atWall ? bt : wk).add(f.x, 0, f.z, 0, f.elite ? 1.35 : 1, this.t * (f.atWall ? 1 : 1.2) + f.phase, col);
      this.blobs.add(this._a.set(f.x, 0, f.z), f.elite ? 0.6 : 0.42);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      const k = d.t / 0.5;
      if (k >= 1) {
        this.dying[i] = this.dying[this.dying.length - 1];
        this.dying.pop();
        continue;
      }
      wk.add(d.x, Math.sin(k * Math.PI) * 0.5, d.z - k * 1.4, 0, (d.elite ? 1.35 : 1) * (1 - k * 0.6), 0, d.elite ? ELITE : TINT, -k * 1.6);
    }
    wk.end();
    bt.end();
    for (const s of this.slots) if (s.lv) this.blobs.add(s.unit.root.position, 0.5);
    if (this.brute.alive) this.blobs.add(this._a.set(this.brute.root.position.x, 0, this.brute.root.position.z), 1.8);
    this.blobs.end();
  }

  private kill(i: number): void {
    const f = this.foes[i];
    this.foes[i] = this.foes[this.foes.length - 1];
    this.foes.pop();
    this.dying.push({ x: f.x, z: f.z, t: 0, elite: f.elite });
    this.fx.splat(this._a.set(f.x, 0.8, f.z), 0.45, 1, 0.2, f.elite ? 1.4 : 0.9);
    this.kills++;
    const gain = (f.elite ? 18 : 5) + this.wave * 2;
    this.coins += gain;
    if (f.elite || this.kills % 3 === 0) {
      const s = this.ctx.hud.project(this._a.set(f.x, 1.6, f.z), this.ctx.engine.camera);
      this.ctx.hud.float(s.x, s.y, `+${gain}`, 'coin', 40, 600);
    }
    if (this.kills % 2 === 0) this.ctx.audio.play('coin', 0.2, 1.3);
  }

  private damageFoe(i: number, n: number): void {
    const f = this.foes[i];
    f.hp -= n;
    f.flash = 1;
    if (f.hp <= 0) this.kill(i);
  }

  private updateTroops(dt: number): void {
    const b = this.brute;
    let fired = false;
    for (let si = 0; si < this.slots.length; si++) {
      const s = this.slots[si];
      if (!s.lv) continue;
      const u = s.unit;
      if (si === this.drag) {
        u.root.position.lerp(this.dragPos, 0.5);
        u.updateAnim(dt);
        continue;
      }
      s.pop = Math.min(1, s.pop + dt * 3);
      const w = WEAPONS[s.lv - 1];
      u.root.scale.setScalar((0.95 * w.troop + (s.lv - 1) * 0.06) * (1 + Math.sin(s.pop * Math.PI) * 0.25));
      // target: closest foe to the wall, else the boss
      let ti = -1;
      let tz = FIRE_Z;
      for (let i = 0; i < this.foes.length; i++) {
        const f = this.foes[i];
        if (f.z > tz) {
          tz = f.z;
          ti = i;
        }
      }
      // the boss is the priority once it is closer to the wall than the lead minion
      const bossT = b.alive && b.state !== 'spawn' && b.root.position.z > FIRE_Z - 3 && (ti < 0 || b.root.position.z + 3 > tz);
      if (ti < 0 && !bossT) {
        u.play(w.aim, 0.25);
        u.targetYaw = Math.PI;
        u.updateAnim(dt, true);
        continue;
      }
      const tx = bossT ? b.root.position.x : this.foes[ti].x;
      const tzz = bossT ? b.root.position.z : this.foes[ti].z;
      u.targetYaw = Math.atan2(tx - s.pos.x, tzz - s.pos.z);
      u.play(w.anim, 0.12);
      u.updateAnim(dt);
      s.fireT -= dt;
      if (s.fireT > 0 || this.outcome !== 'play') continue;
      s.fireT = 1 / w.rate;
      const dmg = DPS(s.lv) / w.rate;
      u.muzzle(this._a);
      this._b.set(tx + rand(-0.15, 0.15), bossT ? 2 * b.scale : 0.9, tzz);
      if (w.splash) {
        // rocket: smoke trail + area blast
        for (let k = 1; k <= 6; k++) this.fx.trail(this._b.clone().lerp(this._a, k / 7));
        this.fx.explosion(this._b, 0.9, 1, 0.55, 0.2);
        this.ctx.audio.boom(0.5);
        for (let i = this.foes.length - 1; i >= 0; i--) if (Math.hypot(this.foes[i].x - tx, this.foes[i].z - tzz) < w.splash) this.damageFoe(i, dmg);
        if (!bossT && b.alive && Math.hypot(b.root.position.x - tx, b.root.position.z - tzz) < w.splash + 1.5) b.damage(dmg * 0.5);
      } else {
        for (let p = 0; p < Math.min(3, w.pellets); p++) this.fx.tracers.add(this._a, this._b, 0.07, w.tracerWidth * 1.4, w.tracer[0] * 2, w.tracer[1] * 2, w.tracer[2] * 2);
        this.fx.muzzle(this._a, 1, 0.8, 0.4, 0.8);
        if (!bossT) {
          this.fx.hit(this._b, 1, 0.8, 0.4, 2);
          this.damageFoe(ti, dmg);
        }
        fired = true;
      }
      if (bossT && b.damage(dmg)) {
        this.fx.explosion(b.centre(this._b), 3, 1, 0.6, 0.25);
        this.fx.shake(1);
        this.ctx.audio.boom(2);
        this.ctx.hud.flash(0.5, 350);
        this.coins += 150;
        this.ctx.hud.banner('BOSS DOWN!', '+150 coins', '#ffd34d', 1200);
      }
    }
    if (fired) this.ctx.audio.play('gun', 0.15, 1.1);
  }

  private findPair(): [Slot, Slot] | null {
    for (let i = 0; i < this.slots.length; i++)
      for (let j = i + 1; j < this.slots.length; j++) {
        const a = this.slots[i];
        const c = this.slots[j];
        if (a.lv && a.lv === c.lv && a.lv < MAX_LV) return [a, c];
      }
    return null;
  }

  /** Merge whenever possible, summon whenever affordable. */
  private botPlay(dt: number): void {
    this.botT -= dt;
    if (this.botT > 0) return;
    this.botT = 0.4;
    const pair = this.findPair();
    // merge the lower-ranked slot into the front row so the strongest troopers stay up front
    if (pair) this.dropOn(pair[1], pair[0]);
    else if (this.coins >= this.cost) this.summon();
  }

  endStats(): [string, string][] {
    return [
      ['Waves held', `${this.outcome === 'win' ? WAVES : Math.max(0, this.wave - 1)}/${WAVES}`],
      ['Enemies down', formatNum(this.kills)],
      ['Best trooper', WEAPONS[this.best - 1].name],
    ];
  }

  state(): Record<string, unknown> {
    return {
      mode: this.id,
      level: this.level,
      outcome: this.outcome,
      t: +this.t.toFixed(2),
      wave: this.wave,
      coins: this.coins,
      wall: Math.ceil(this.wallHp),
      foes: this.foes.length,
      slots: this.slots.map((s) => s.lv),
      kills: this.kills,
      boss: this.brute.alive ? Math.round(this.brute.hp) : -1,
      drawn: this.walkers.drawn + this.biters.drawn,
    };
  }

  cheat(kind: 'win' | 'lose'): void {
    if (kind === 'lose') {
      this.wallHp = 0;
      return;
    }
    this.wave = WAVES;
    this.spawnLeft = 0;
    this.breakT = 0;
    this.foes.length = 0;
    this.brute.hide();
    this.endT = 0.5;
  }

  /** Level-1 coach marks: summon → summon again → drag twin onto twin → what merging buys. */
  private tutorial(dt: number): void {
    const hud = this.ctx.hud;
    if (this.tutStep < 0 || this.bot || this.outcome !== 'play') {
      if (this.tutStep >= 0) hud.spot(null);
      this.tutStep = -1;
      return;
    }
    this.tutT += dt;
    const pair = this.findPair();
    if (this.merges > 0) {
      if (this.tutStep < 3) {
        this.tutStep = 3;
        this.tutT = 0;
      }
      if (this.tutT > 3) {
        this.tutStep = -1;
        hud.spot(null);
        return;
      }
      const s = this.slots.find((o) => o.lv >= 2);
      if (s) this.spotWorld(this._a.copy(s.pos).setY(0.8), 1, 'MERGED! HIGHER LEVEL = BIGGER GUN\nKeep summoning & merging to hold the wall');
      return;
    }
    if (pair) {
      const a = this.ctx.hud.project(this._a.copy(pair[0].pos).setY(0.8), this.ctx.engine.camera);
      const b = this.ctx.hud.project(this._a.copy(pair[1].pos).setY(0.8), this.ctx.engine.camera);
      hud.spot({ x: a.x, y: a.y, r: 46, text: 'DRAG A TROOP ONTO ITS TWIN\nto MERGE into a stronger one', drag: [b.x - a.x, b.y - a.y] });
      return;
    }
    if (!this.btn) return;
    const r = this.btn.getBoundingClientRect();
    const root = hud.root.getBoundingClientRect();
    hud.spot({ x: r.left + r.width / 2 - root.left, y: r.top + r.height / 2 - root.top, r: r.width / 2 + 10, text: this.summons ? 'SUMMON ONE MORE' : 'TAP SUMMON\nto deploy a soldier' });
  }

  /** Trailer hooks. */
  setSlots(lvs: number[]): void {
    lvs.forEach((lv, i) => this.setLv(this.slots[i], lv));
  }
  addCoins(n: number): void {
    this.coins += n;
  }
  mergeAt(from: number, to: number): void {
    this.dropOn(this.slots[from], this.slots[to]);
  }
  slotScreen(i: number): { x: number; y: number } {
    return this.ctx.hud.project(this._a.copy(this.slots[i].pos).setY(1), this.ctx.engine.camera);
  }
  exit(): void {
    this.btn = null;
  }
}
