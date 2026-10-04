import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Assets } from '../core/assets';
import type { Audio } from '../core/Audio';
import type { Input } from '../core/Input';
import type { Hud } from '../ui/Hud';
import { COIN_IMG, iconHtml } from '../ui/Hud';
import { Fx } from '../vfx/Fx';
import { BlobShadows } from '../vfx/BlobShadows';
import { World } from '../world/World';
import { Boss, bossAttackInterval, bossWallDamage } from './Boss';
import { Staff, Unit } from './Actors';
import { Loot, type LootKind } from './Loot';
import { Armory, Barricade, Counters, Pad } from './Props';
import { Pathfinder } from './Pathfinder';
import { WEAPONS, WEAPON_BY_ID, buildWeaponKit, displayMesh, proceduralMaterial, rocketProjectile, type WeaponDef, type WeaponId, type WeaponKit } from './Weapons';
import {
  ARMORY_Z,
  BOSS_HOME,
  COUNTERS,
  CUSTOMER_ENTRY,
  EXPAND_PAD,
  FORTIFY_PAD,
  FRAME_POINTS,
  LOOT_BLOCKERS,
  PLAY_BOUNDS,
  RALLY,
  SLOTS,
  WALL_HALF,
  WALL_Z,
} from './layout';
import { bezier, clamp, damp, easeOutCubic, formatNum, lerp, rand } from '../core/math';
import { PlayableAdsFlowManager } from '../tracking/PlayableAdsFlowManager';
import { PlayableAdsSDK, PlayableEvent } from '../tracking/PlayableAdsSDK';

type Phase = 'intro' | 'play' | 'collapse' | 'end';

const SERVE_TIME = 0.8;
const MAX_UNITS = 26;
const MAX_WEAPON_LEVEL = 5;
const APEX_TIME = 78;
const INTRO_TIME = 2.8;
const NATURAL_EVOLVE = [22, 40, 56, 70];
const FIRST_SPAWN_DELAY = 0.3;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

interface Rocket {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dmg: number;
  active: boolean;
}

interface Delivery {
  mesh: THREE.Object3D;
  weapon: WeaponId;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  unit: Unit | null;
}

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export class Game {
  private fx: Fx;
  private world: World;
  private kit: WeaponKit;
  private boss: Boss;
  private player: Staff;
  private assistant: Staff;
  private units: Unit[] = [];
  private loot: Loot;
  private barricade = new Barricade();
  private blobs = new BlobShadows(40);
  private armory: Armory;
  private counters = new Counters();
  private pads: Pad[] = [];
  private rockets: Rocket[] = [];
  private deliveries: Delivery[] = [];
  private skins: { civA: THREE.Material; civB: THREE.Material; soldier: THREE.Material };

  // ---- run state ----
  private phase: Phase = 'intro';
  private t = 0;
  private phaseT = 0;
  private timeScale = 1;
  private slowmo = 0;
  coins = 0;
  gems = 0;
  private totalCoins = 0;
  private bossesKilled = 0;
  private bossLevel = 1;
  private pendingEvolve = 0;
  private wallHp = 100;
  private wallMax = 100;
  private unlocked = new Set<WeaponId>();
  private wLevel: Record<WeaponId, number> = { pistol: 1, rifle: 1, shotgun: 1, minigun: 1, rocket: 1 };
  private dmgMult = 1;
  private rateMult = 1;
  private expanded = false;
  private fortifyCount = 0;
  private spawnTimer = 0;
  private naturalIdx = 0;
  private apex = false;
  private queues: Unit[][] = [[], []];
  private serveProgress = [0, 0];
  private dmgAcc = 0;
  private dmgTimer = 0;
  private dmgCrit = false;
  private padSoundT = 0;
  private padCoinT = 0;
  private toastCd = 0;
  private respawnT = -1;
  private tutorial = 0;
  private idleT = 0;
  private warnOn = false;
  private lastPadId = '';

  // ---- camera ----
  private camTarget = new THREE.Vector3();
  private camDir = new THREE.Vector3(0, -0.8, -0.6).normalize();
  private camDist = 30;
  private camLook = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private hudTargets = { coin: new THREE.Vector3(), gem: new THREE.Vector3(), bag: new THREE.Vector3() };
  private hudAnchors = { coin: { x: 0, y: 0 }, gem: { x: 0, y: 0 }, bag: { x: 0, y: 0 } };
  private readonly pathfinder: Pathfinder;
  private currentTutorialTarget: THREE.Vector3 | null = null;

  constructor(
    private engine: Engine,
    assets: Assets,
    private audio: Audio,
    private hud: Hud,
    private input: Input,
  ) {
    const scene = engine.scene;
    this.world = new World(scene, engine.renderer, assets);
    this.fx = new Fx(scene, assets.textures.smoke);
    this.kit = buildWeaponKit(assets.models.customer);

    const bodyMat = (assets.models.customer.scene.getObjectByName('Body_01_blackjacket') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const civA = bodyMat.clone();
    civA.map = assets.textures.skinCivA;
    const soldier = bodyMat.clone();
    soldier.map = assets.textures.skinSoldier;
    this.skins = { civA, civB: bodyMat, soldier };

    this.boss = new Boss(assets.models.boss);
    scene.add(this.boss.root);
    this.player = new Staff(assets.models.staff);
    this.assistant = new Staff(assets.models.staff, '#9fc8ff');
    scene.add(this.player.root, this.assistant.root);
    for (let i = 0; i < MAX_UNITS; i++) {
      const u = new Unit(assets.models.customer, this.kit);
      u.root.visible = false;
      this.units.push(u);
    }

    this.loot = new Loot(assets.models.coin, assets.models.chest, this.fx);
    this.loot.bagTarget = () => this.hudTargets.bag;
    this.loot.onCollect = (k, v) => this.collect(k, v);
    this.armory = new Armory(assets, this.kit);
    scene.add(this.loot.group, this.barricade.group, this.armory.group, this.counters.group, this.blobs.mesh);

    for (const w of WEAPONS) {
      const p = new Pad(`w:${w.id}`, 'upgrade', w.id, this.armory.padPos(w.id));
      this.pads.push(p);
      // two pooled delivery meshes per weapon
      for (let i = 0; i < 2; i++) {
        const m = displayMesh(this.kit, w.id);
        const g = new THREE.Group();
        g.add(m);
        g.visible = false;
        scene.add(g);
        this.deliveries.push({ mesh: g, weapon: w.id, from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1, unit: null });
      }
    }
    this.pads.push(new Pad('expand', 'expand', null, EXPAND_PAD, 1.5));
    this.pads.push(new Pad('fortify', 'fortify', null, FORTIFY_PAD));
    for (const p of this.pads) scene.add(p.group);

    const rg = rocketProjectile();
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(rg, proceduralMaterial);
      mesh.visible = false;
      scene.add(mesh);
      this.rockets.push({ mesh, from: new THREE.Vector3(), ctrl: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dmg: 0, active: false });
    }

    this.pathfinder = new Pathfinder();

    // Give Input the camera so it can unproject tap coordinates.
    input.camera = engine.camera;

    input.onTapGround = (pos) => {
      this.handleTapGround(pos);
    };

    hud.onLabelClick = (id) => {
      this.handleLabelClick(id);
    };

    hud.onHandClick = () => {
      this.handleHandClick();
    };

    input.onDown = () => {
      this.idleT = 0;
      void this.audio.unlock().then(() => this.audio.startMusic());
    };
    input.onUp = (isDrag) => PlayableAdsFlowManager.instance.trackClick(isDrag, isDrag ? 1 : 0);
    hud.onRetry = () => {
      this.audio.play('click');
      PlayableAdsFlowManager.instance.trackClick(true, 1);
      this.reset();
    };
    hud.onContinue = () => {
      this.audio.play('click');
      PlayableAdsFlowManager.instance.trackClick(true, 1);
      if (PlayableAdsFlowManager.instance.isEnded) PlayableAdsSDK.instance.openStore();
      else PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
    };
    hud.onMute = (m) => this.audio.setMuted(m);
    engine.onResize = (w, h) => this.layoutCamera(w, h);
    this.layoutCamera(window.innerWidth, window.innerHeight);
  }

  /** Hooks for the automated play-test harness (tools/perf.mjs). */
  debugApi(): Record<string, unknown> {
    return {
      teleport: (x: number, z: number) => this.player.root.position.set(x, 0, z),
      forceLose: () => this.collapse(),
      state: () => ({
        t: +this.t.toFixed(1),
        phase: this.phase,
        coins: Math.floor(this.coins),
        gems: this.gems,
        bossLevel: this.bossLevel,
        bossesKilled: this.bossesKilled,
        wall: +(this.wallHp / this.wallMax).toFixed(2),
        unlocked: [...this.unlocked],
        soldiers: this.units.filter((u) => u.state === 'fight').length,
        expanded: this.expanded,
      }),
    };
  }

  /** Make every pooled object visible once and compile shaders up-front (no hitch on first use). */
  async warmup(): Promise<void> {
    const hidden: THREE.Object3D[] = [];
    this.engine.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const u0 = this.units[0];
    this.engine.scene.add(u0.root);
    u0.root.visible = true;
    for (const w of WEAPONS) u0.arm(w); // compile every weapon skin variant
    u0.model.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    await this.engine.renderer.compileAsync(this.engine.scene, this.engine.camera);
    this.engine.renderer.render(this.engine.scene, this.engine.camera);
    for (const o of hidden) o.visible = false;
    // every texture is on the GPU now: drop the decoded CPU-side ImageBitmaps (~25 MB)
    this.engine.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      const img = m?.map?.image as ImageBitmap | undefined;
      if (img && typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
    });
    u0.arm(null);
    this.despawn(u0);
  }

  // =============================================================================================
  // Run lifecycle

  reset(): void {
    this.hud.hideEnd();
    this.fx.clear();
    this.loot.clear();
    this.phase = 'intro';
    this.t = 0;
    this.phaseT = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.coins = 0;
    this.gems = 0;
    this.totalCoins = 0;
    this.bossesKilled = 0;
    this.bossLevel = 1;
    this.pendingEvolve = 0;
    this.wallMax = 100;
    this.wallHp = 100;
    this.unlocked.clear();
    this.unlocked.add('pistol');
    for (const w of WEAPONS) this.wLevel[w.id] = 1;
    this.dmgMult = 1;
    this.rateMult = 1;
    this.expanded = false;
    this.fortifyCount = 0;
    this.spawnTimer = FIRST_SPAWN_DELAY;
    this.naturalIdx = 0;
    this.apex = false;
    this.queues = [[], []];
    this.serveProgress = [0, 0];
    this.respawnT = -1;
    this.tutorial = 0;
    this.idleT = 0;
    this.warnOn = false;
    this.hud.warn(false);
    this.hud.setDanger(0);
    this.hud.hint(null);
    this.hud.handAt(null);
    this.input.reset();
    this.input.enabled = true;
    this.obstacleCache = null;

    for (const u of this.units) {
      u.root.rotation.x = 0;
      u.stop();
      this.despawn(u);
    }
    for (const r of this.rockets) {
      r.active = false;
      r.mesh.visible = false;
    }
    for (const d of this.deliveries) {
      d.t = -1;
      d.mesh.visible = false;
    }
    for (const w of WEAPONS) this.armory.setUnlocked(w.id, w.id === 'pistol', false);
    this.counters.setEnabled(0, true);
    this.counters.setEnabled(1, false);
    this.barricade.restore();
    for (const p of this.pads) p.hide();
    this.refreshPads();

    this.player.root.position.set(-0.4, 0, 2.6);
    this.player.yaw = this.player.targetYaw = 0;
    this.player.play('Idle', 0);
    this.assistant.root.visible = false;

    this.boss.apex = false;
    this.boss.spawn(1);
    this.audio.roar(0.8, 1.2);
    this.fx.dust(BOSS_HOME, 2.2, 16);
    this.fx.shake(0.35);
    this.hud.banner('DEFEND THE CAMP!', 'Arm customers · Slay the boss', '#ffd34d', 1500);
    PlayableAdsFlowManager.instance.startLevel(0, 99999, true);
  }

  // =============================================================================================
  // Camera

  private layoutCamera(w: number, h: number): void {
    this.hud.resize(w, h);
    const cam = this.engine.camera;
    const portrait = h > w;
    cam.fov = portrait ? 44 : 36;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const topLimit = portrait ? 0.7 : 0.74;
    const target = new THREE.Vector3(0.1, 0, -2.4);
    let dist = 30;
    for (let iter = 0; iter < 3; iter++) {
      let lo = 8;
      let hi = 90;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (this.fits(target, mid, topLimit)) hi = mid;
        else lo = mid;
      }
      dist = hi;
      // recentre vertically inside the usable band
      const [minY, maxY] = this.projectedYRange(target, dist);
      const want = (topLimit + -0.9) / 2;
      const off = (minY + maxY) / 2 - want;
      target.z -= off * dist * 0.35;
    }
    this.camTarget.copy(target);
    this.camDist = dist;
    requestAnimationFrame(() => this.cacheAnchors());
  }

  private placeCam(target: THREE.Vector3, dist: number): void {
    const cam = this.engine.camera;
    cam.position.copy(target).addScaledVector(this.camDir, -dist);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  }

  private fits(target: THREE.Vector3, dist: number, top: number): boolean {
    this.placeCam(target, dist);
    for (const p of FRAME_POINTS) {
      _a.copy(p).project(this.engine.camera);
      if (Math.abs(_a.x) > 0.96 || _a.y > top || _a.y < -0.9) return false;
    }
    return true;
  }

  private projectedYRange(target: THREE.Vector3, dist: number): [number, number] {
    this.placeCam(target, dist);
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of FRAME_POINTS) {
      _a.copy(p).project(this.engine.camera);
      lo = Math.min(lo, _a.y);
      hi = Math.max(hi, _a.y);
    }
    return [lo, hi];
  }

  private cacheAnchors(): void {
    this.hudAnchors.coin = this.hud.anchor('coin');
    this.hudAnchors.gem = this.hud.anchor('gem');
    this.hudAnchors.bag = this.hud.anchor('bag');
  }

  private updateCamera(dt: number): void {
    const cam = this.engine.camera;
    let target = this.camTarget;
    let dist = this.camDist;
    if (this.phase === 'intro') {
      // dolly from a boss close-up out to the gameplay framing
      const k = easeOutCubic(clamp((this.phaseT - 0.6) / (INTRO_TIME - 0.6), 0, 1));
      _b.copy(BOSS_HOME).setY(1.5).lerp(this.camTarget, k);
      target = _b;
      dist = lerp(this.camDist * 0.45, this.camDist, k);
    } else if (this.phase === 'collapse' || this.phase === 'end') {
      const k = easeOutCubic(clamp(this.phaseT / 1.6, 0, 1));
      _b.copy(this.camTarget).lerp(_c.set(0, 1.5, WALL_Z - 1), k * 0.6);
      target = _b;
      dist = lerp(this.camDist, this.camDist * 0.62, k);
    }
    this.camLook.lerp(target, this.phase === 'play' ? damp(6, dt) : 1);
    this.camPos.copy(this.camLook).addScaledVector(this.camDir, -dist);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    // trauma shake
    const tr = this.fx.trauma * this.fx.trauma;
    if (tr > 0) {
      const now = performance.now() * 0.001;
      cam.position.x += Math.sin(now * 53.1) * tr * 0.55;
      cam.position.y += Math.sin(now * 61.7 + 1.3) * tr * 0.45;
      cam.rotation.z += Math.sin(now * 47.3 + 2.1) * tr * 0.03;
    }
    cam.updateMatrixWorld();
    for (const k of ['coin', 'gem', 'bag'] as const) {
      const a = this.hudAnchors[k];
      _a.set((a.x / this.hud.w) * 2 - 1, -(a.y / this.hud.h) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
      this.hudTargets[k].copy(cam.position).addScaledVector(_a, 6);
    }
  }

  // =============================================================================================
  // Main update

  update(rawDt: number): void {
    // Tap-to-move: advance destination tracking every frame.
    this.input.tick(this.player.root.position, 0.4);

    this.slowmo = Math.max(0, this.slowmo - rawDt);
    const targetScale = this.phase === 'collapse' ? 0.3 : this.slowmo > 0 ? 0.35 : 1;
    this.timeScale = lerp(this.timeScale, targetScale, damp(10, rawDt));
    const dt = rawDt * this.timeScale;
    this.phaseT += rawDt;
    const time = performance.now() * 0.001;

    if (this.phase === 'intro' && this.phaseT >= INTRO_TIME) {
      this.phase = 'play';
      this.phaseT = 0;
    }
    if (this.phase === 'intro' || this.phase === 'play') {
      this.t += dt;
      this.director(dt);
      this.updatePlayer(dt);
      this.updateCustomers(dt);
      this.updateServing(dt);
      this.updatePads(dt);
      this.updateTutorial(rawDt);
    }
    if (this.phase === 'collapse' && this.phaseT > 2.6) this.finish();

    this.updateSoldiers(dt);
    this.updateBoss(dt);
    this.updateRockets(dt);
    this.updateDeliveries(dt);
    this.loot.update(dt, time);
    this.barricade.update(dt);
    this.armory.update(dt, time);
    this.counters.update(dt, time, [this.serveActive(0), this.expanded]);
    for (const p of this.pads) p.update(dt, time);
    this.player.updateAnim(dt);
    if (this.assistant.root.visible) this.assistant.updateAnim(dt);
    this.blobs.begin();
    this.blobs.add(this.player.root.position, 0.55);
    if (this.assistant.root.visible) this.blobs.add(this.assistant.root.position, 0.55);
    for (const u of this.units) if (u.root.visible) this.blobs.add(u.root.position, 0.42 * u.root.scale.x);
    this.blobs.end();
    this.fx.update(dt);
    this.updateCamera(rawDt);
    this.updateHud(rawDt);
  }

  // =============================================================================================
  // Director: scripted ~90 s arc that ends with the boss overwhelming the camp.

  private director(dt: number): void {
    if (this.naturalIdx < NATURAL_EVOLVE.length && this.t >= NATURAL_EVOLVE[this.naturalIdx]) {
      this.naturalIdx++;
      this.evolveBoss('The boss grows stronger over time!');
    }
    if (!this.warnOn && this.t > 60) {
      this.warnOn = true;
      this.hud.warn(true);
    }
    if (!this.apex && this.t >= APEX_TIME) this.triggerApex();
    if (this.t > 102 && this.wallHp > 0) this.damageWall(this.wallMax, 0);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.expanded ? 0.9 : 1.4;
      this.spawnCustomer();
    }
  }

  private wallFloor(): number {
    if (this.apex) return 0;
    // the wall cannot crumble before the final act, but it visibly erodes toward it
    return this.wallMax * clamp(1 - (this.t - 10) / 95, 0.3, 1);
  }

  private triggerApex(): void {
    this.apex = true;
    this.bossLevel += 2;
    if (this.boss.alive) {
      this.boss.setApex();
      this.boss.evolve(this.bossLevel, 1);
    } else this.pendingEvolve += 2;
    this.boss.attackTimer = 1.2;
    _a.copy(this.boss.root.position);
    this.fx.ground.pillar(_a, 4.5, 26, '#ff2a14', 2.2);
    this.fx.ground.ring(_a, 12, '#ff3a1a', 1.1);
    this.fx.shake(0.9);
    this.audio.roar(1.4, 1.8);
    this.audio.boom(1.6);
    this.hud.flash(0.5, 500, '#ff2a14');
    this.hud.banner('FINAL EVOLUTION!', 'The boss is unstoppable…', '#ff4d3d', 2000);
    for (const p of this.pads) if (p.active) p.cost = Math.round(p.cost * 4);
  }

  private evolveBoss(reason: string): void {
    this.bossLevel++;
    if (this.boss.alive) {
      this.boss.evolve(this.bossLevel);
      this.evolveFx();
    } else this.pendingEvolve++;
    this.hud.banner('BOSS EVOLVED!', `Lv.${this.bossLevel} · ${reason}`, '#ff6a4d', 1200);
  }

  private evolveFx(): void {
    _a.copy(this.boss.root.position);
    const hot = this.bossLevel >= 6;
    this.fx.ground.pillar(_a, 3.2, 18, hot ? '#ff3a1a' : '#b45cff', 1.4);
    this.fx.ground.ring(_a, 8, hot ? '#ff5a2a' : '#c47dff', 0.8);
    for (let i = 0; i < 30; i++) this.fx.ember(_a, 3, hot ? 1 : 0.75, hot ? 0.35 : 0.4, hot ? 0.15 : 1);
    this.fx.shake(0.4);
    this.audio.roar(0.9 + Math.min(0.5, this.bossLevel * 0.04), 1.1);
    this.hud.flash(0.18, 300, hot ? '#ff3a1a' : '#b45cff');
  }

  // =============================================================================================
  // Player & Navigation

  private obstacleCache: Box[] | null = null;

  private obstacles(): Box[] {
    if (this.obstacleCache) return this.obstacleCache;
    const b: Box[] = [
      { x0: -4.2, x1: -1.8, z0: 3.5, z1: 4.3 }, // counter desk 1
      { x0: 3.2, x1: 8.7, z0: 0.4, z1: 5.9 }, // main tent
      ...LOOT_BLOCKERS.map((l) => ({ x0: l.x0 + 0.25, x1: l.x1 - 0.25, z0: l.z0 + 0.25, z1: l.z1 - 0.25 })),
    ];
    for (const s of this.armory.slots) {
      const x = (s.crate.visible ? s.crate : s.locked).position.x;
      b.push({ x0: x - 0.45, x1: x + 0.45, z0: ARMORY_Z - 0.45, z1: ARMORY_Z + 0.45 });
    }
    if (this.expanded) b.push({ x0: -6.9, x1: -5.9, z0: 0.9, z1: 3.5 });
    this.obstacleCache = b;
    return b;
  }

  private navigateTo(targetPos: THREE.Vector3): void {
    const start = this.player.root.position;
    const clampedTarget = targetPos.clone();
    clampedTarget.x = clamp(clampedTarget.x, PLAY_BOUNDS.x0 + 0.3, PLAY_BOUNDS.x1 - 0.3);
    clampedTarget.z = clamp(clampedTarget.z, PLAY_BOUNDS.z0 + 0.3, PLAY_BOUNDS.z1 - 0.3);
    const path = this.pathfinder.findPath(start, clampedTarget, this.obstacles());
    this.input.setWaypoints(path);
  }

  private handleTapGround(pos: THREE.Vector3): void {
    let target = pos;
    // Snap to interaction zones if tapped close to them
    if (Math.hypot(pos.x - COUNTERS[0].serveSpot.x, pos.z - COUNTERS[0].serveSpot.z) < 1.4) {
      target = COUNTERS[0].serveSpot.clone();
    } else if (this.expanded && Math.hypot(pos.x - COUNTERS[1].serveSpot.x, pos.z - COUNTERS[1].serveSpot.z) < 1.4) {
      target = COUNTERS[1].serveSpot.clone();
    } else if (Math.hypot(pos.x - EXPAND_PAD.x, pos.z - EXPAND_PAD.z) < 1.4) {
      target = EXPAND_PAD.clone();
    } else if (Math.hypot(pos.x - FORTIFY_PAD.x, pos.z - FORTIFY_PAD.z) < 1.4) {
      target = FORTIFY_PAD.clone();
    } else {
      for (const p of this.pads) {
        if (p.active && Math.hypot(pos.x - p.at.x, pos.z - p.at.z) < 1.4) {
          target = p.at.clone();
          break;
        }
      }
    }
    this.navigateTo(target);
  }

  private handleLabelClick(id: string): void {
    if (id === 'c:0') {
      this.navigateTo(COUNTERS[0].serveSpot);
    } else if (id === 'c:1') {
      this.navigateTo(COUNTERS[1].serveSpot);
    } else if (id === 'expand') {
      this.navigateTo(EXPAND_PAD);
    } else if (id === 'fortify') {
      this.navigateTo(FORTIFY_PAD);
    } else if (id.startsWith('w:')) {
      const pad = this.pads.find((p) => p.id === id);
      if (pad) this.navigateTo(pad.at);
    }
  }

  private handleHandClick(): void {
    if (this.currentTutorialTarget) {
      this.navigateTo(this.currentTutorialTarget);
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const mv = this.input.move;
    const moving = this.input.active && Math.hypot(mv.x, mv.y) > 0.05;
    if (moving) {
      this.idleT = 0;
      const sp = p.speed * Math.min(1, Math.hypot(mv.x, mv.y) * 1.15);
      p.root.position.x += mv.x * sp * dt;
      p.root.position.z += mv.y * sp * dt;
      p.targetYaw = Math.atan2(mv.x, mv.y);
      const r = 0.38;
      for (const b of this.obstacles()) {
        const pos = p.root.position;
        if (pos.x > b.x0 - r && pos.x < b.x1 + r && pos.z > b.z0 - r && pos.z < b.z1 + r) {
          const pushes = [b.x0 - r - pos.x, b.x1 + r - pos.x, b.z0 - r - pos.z, b.z1 + r - pos.z];
          let best = 0;
          for (let i = 1; i < 4; i++) if (Math.abs(pushes[i]) < Math.abs(pushes[best])) best = i;
          // resolve, then slide toward the nearer corner so walking into a crate steers around it
          const slide = sp * dt * 0.85;
          if (best < 2) {
            pos.x += pushes[best];
            pos.z += Math.sign(pos.z - (b.z0 + b.z1) / 2 || 1) * slide * Math.abs(mv.x);
          } else {
            pos.z += pushes[best];
            pos.x += Math.sign(pos.x - (b.x0 + b.x1) / 2 || 1) * slide * Math.abs(mv.y);
          }
        }
      }
      p.root.position.x = clamp(p.root.position.x, PLAY_BOUNDS.x0, PLAY_BOUNDS.x1);
      p.root.position.z = clamp(p.root.position.z, PLAY_BOUNDS.z0, PLAY_BOUNDS.z1);
      p.play('Move 1', 0.12, true, 1.25);
      // footstep dust
      if (Math.random() < dt * 6) this.fx.dust(p.root.position, 0.25, 1);
    } else {
      this.idleT += dt;
      const serving = this.serveActive(0) && this.queues[0][0]?.state === 'counter';
      if (serving) {
        p.targetYaw = 0; // face the customer
        p.play('Manufacture', 0.15, true, 1.4);
      } else p.play('Idle', 0.2);
    }
    // loot magnet
    const got = this.loot.magnet(p.root.position, 1.7);
    if (got) this.audio.play('tip', 0.7, rand(0.95, 1.1));
  }

  private serveActive(i: number): boolean {
    if (i === 1) return this.expanded;
    const s = COUNTERS[0].serveSpot;
    const p = this.player.root.position;
    return Math.hypot(p.x - s.x, p.z - s.z) < 1.0 && (this.phase === 'play' || this.phase === 'intro');
  }

  // =============================================================================================
  // Customers & serving

  private freeSlot(): number {
    const used = new Set<number>();
    for (const u of this.units) if (u.state === 'toFront' || u.state === 'fight') used.add(u.slot);
    // fill front row first, centre-out
    const order = [4, 3, 5, 2, 6, 1, 7, 0, 8, 13, 12, 14, 11, 15, 10, 16, 9, 17];
    for (const i of order) if (!used.has(i)) return i;
    return -1;
  }

  private spawnCustomer(): void {
    let soldiers = 0;
    let customers = 0;
    for (const u of this.units) {
      if (u.state === 'toFront' || u.state === 'fight' || u.state === 'serving') soldiers++;
      else if (u.state !== 'gone' && u.state !== 'dying') customers++;
    }
    if (soldiers + customers >= SLOTS.length + 2) return;
    const counter = this.expanded && this.queues[1].length < this.queues[0].length ? 1 : 0;
    const q = this.queues[counter];
    if (q.length >= 1 + COUNTERS[counter].queue.length) return;
    const u = this.units.find((x) => x.state === 'gone');
    if (!u) return;
    u.state = 'enter';
    u.counter = counter;
    u.slot = -1;
    u.serveT = 0;
    u.setSkin(Math.random() < 0.5 ? this.skins.civA : this.skins.civB);
    u.arm(null);
    u.scaleBase = rand(0.94, 1.04);
    u.root.scale.setScalar(u.scaleBase);
    u.root.visible = true;
    this.engine.scene.add(u.root);
    u.root.position.copy(CUSTOMER_ENTRY);
    if (counter === 1) u.root.position.set(-15, 0, 3.6);
    u.speed = 3.6;
    u.play('Move', 0);
    q.push(u);
    this.walkQueue(counter);
  }

  private despawn(u: Unit): void {
    u.state = 'gone';
    u.root.visible = false;
    u.root.removeFromParent();
  }

  private queueSpot(counter: number, idx: number): THREE.Vector3 {
    const c = COUNTERS[counter];
    return idx === 0 ? c.customerSpot : c.queue[Math.min(idx - 1, c.queue.length - 1)];
  }

  private walkQueue(counter: number): void {
    this.queues[counter].forEach((u, i) => {
      const spot = this.queueSpot(counter, i);
      if (u.queueIndex !== i || u.state === 'enter') {
        u.queueIndex = i;
        u.walkTo([spot]);
        u.state = i === 0 ? 'counter' : 'queue';
      }
    });
  }

  private updateCustomers(dt: number): void {
    for (const u of this.units) {
      if (u.state !== 'enter' && u.state !== 'queue' && u.state !== 'counter') continue;
      u.updateMove(dt);
      if (u.moving) u.play('Move', 0.15, true, u.speed / 3.2);
      else {
        u.play('Idle', 0.2);
        // face the counter
        const c = COUNTERS[u.counter];
        u.targetYaw = Math.atan2(c.counter.x - u.root.position.x, c.counter.z - u.root.position.z);
      }
      u.updateAnim(dt, !u.moving);
    }
  }

  private updateServing(dt: number): void {
    for (let ci = 0; ci < 2; ci++) {
      const u = this.queues[ci][0];
      const ready = u && u.state === 'counter' && !u.moving;
      const active = this.serveActive(ci);
      if (ready && active) {
        this.serveProgress[ci] += dt / (SERVE_TIME * (ci === 1 ? 1.3 : 1));
        if (ci === 1) this.assistant.play('Manufacture', 0.15, true, 1.4);
        if (this.serveProgress[ci] >= 1) {
          this.serveProgress[ci] = 0;
          this.sell(ci, u);
        }
      } else {
        this.serveProgress[ci] = Math.max(0, this.serveProgress[ci] - dt * 2);
        if (ci === 1 && this.assistant.root.visible) this.assistant.play('Idle', 0.2);
      }
    }
  }

  private pickWeapon(): WeaponDef {
    const list = WEAPONS.filter((w) => this.unlocked.has(w.id));
    const newest = list[list.length - 1];
    if (list.length === 1 || Math.random() < 0.5) return newest;
    return list[Math.floor(Math.random() * (list.length - 1))];
  }

  private sell(ci: number, u: Unit): void {
    this.queues[ci].shift();
    this.walkQueue(ci);
    const w = this.pickWeapon();
    u.state = 'serving';
    u.wantWeapon = w.id;
    this.audio.play('order', 0.8);
    // weapon flies from its crate into the customer's hands
    const d = this.deliveries.find((x) => x.weapon === w.id && x.t < 0) ?? this.deliveries.find((x) => x.weapon === w.id)!;
    this.armory.crateTop(w.id, d.from);
    d.to.copy(u.root.position).setY(1.1);
    d.t = 0;
    d.unit = u;
    d.mesh.visible = true;
    this.audio.whoosh(true);
    if (this.tutorial === 0) this.tutorial = 1;
  }

  private updateDeliveries(dt: number): void {
    for (const d of this.deliveries) {
      if (d.t < 0) continue;
      d.t += dt / 0.42;
      _c.set((d.from.x + d.to.x) / 2, Math.max(d.from.y, d.to.y) + 2.2, (d.from.z + d.to.z) / 2);
      bezier(_a, d.from, _c, d.to, Math.min(1, d.t));
      d.mesh.position.copy(_a);
      d.mesh.rotation.y += dt * 14;
      if (Math.random() < 0.6) this.fx.sparkle(_a, 1, 0.9, 0.5);
      if (d.t >= 1) {
        d.t = -1;
        d.mesh.visible = false;
        if (d.unit && d.unit.state === 'serving') this.transform(d.unit, WEAPON_BY_ID[d.weapon]);
        d.unit = null;
      }
    }
  }

  private transform(u: Unit, w: WeaponDef): void {
    u.setSkin(this.skins.soldier);
    u.arm(w);
    u.scaleBase = w.troop * rand(0.97, 1.03);
    u.popT = 0;
    _a.copy(u.root.position);
    const col = new THREE.Color(w.color);
    this.fx.poof(_a, col.r, col.g, col.b, 1);
    this.fx.shake(0.06);
    // payment
    const price = Math.round(w.price * (1 + (this.wLevel[w.id] - 1) * 0.25));
    const n = Math.min(6, Math.max(2, Math.ceil(price / 6)));
    _a.y = 1.4;
    for (let i = 0; i < n; i++) {
      const share = i === n - 1 ? price - Math.floor(price / n) * (n - 1) : Math.floor(price / n);
      this.loot.fly('coin', _a, () => this.hudTargets.coin, rand(0.55, 0.8), () => this.addCoins(share), share, 2.2);
    }
    const s = this.hud.project(_a.setY(2.2), this.engine.camera);
    this.hud.float(s.x, s.y, `+${price}`, 'money', 70, 900);
    this.audio.play('receive', 0.8);

    // march to the front
    const slot = this.freeSlot();
    u.slot = slot;
    u.state = 'toFront';
    u.speed = 4.6;
    const target = slot >= 0 ? SLOTS[slot] : _b.set(rand(-4, 4), 0, -4.4);
    const exit = u.counter === 0 ? new THREE.Vector3(-4.7, 0, 4.7) : new THREE.Vector3(-7.4, 0, 0.0);
    u.walkTo([exit, RALLY, new THREE.Vector3(target.x, 0, -4.3), target]);
  }

  private addCoins(v: number): void {
    this.coins += v;
    this.totalCoins += v;
    this.hud.bump('coin');
    this.audio.play('coin', 0.45, rand(0.95, 1.15));
  }

  private collect(kind: LootKind, value: number): void {
    this.hud.bump('bag');
    if (this.tutorial === 2) this.tutorial = 3;
    if (kind === 'coin') {
      this.addCoins(value);
    } else if (kind === 'gem') {
      this.gems += value;
      this.hud.bump('gem');
      this.audio.play('receive', 0.7, 1.3);
    } else {
      // equipment: permanent army buff
      this.audio.chime(4);
      const roll = Math.random();
      if (roll < 0.45) {
        this.dmgMult *= 1.25;
        this.hud.banner('EQUIPMENT!', 'Army damage +25%', '#ffd34d', 1100);
      } else if (roll < 0.8) {
        this.rateMult *= 1.2;
        this.hud.banner('EQUIPMENT!', 'Fire rate +20%', '#ffd34d', 1100);
      } else {
        this.wallHp = Math.min(this.wallMax, this.wallHp + this.wallMax * 0.3);
        this.barricade.restore();
        this.barricade.setRatio(this.wallHp / this.wallMax);
        this.hud.banner('EQUIPMENT!', 'Wall repaired +30%', '#ffd34d', 1100);
      }
    }
  }

  // =============================================================================================
  // Soldiers

  private updateSoldiers(dt: number): void {
    const bossOk = this.boss.targetable;
    for (const u of this.units) {
      if (u.state === 'serving') {
        u.play('Idle', 0.2);
        u.updateAnim(dt);
        continue;
      }
      if (u.state === 'dying') {
        u.dieT += dt;
        u.dieVel.y -= 20 * dt;
        u.root.position.addScaledVector(u.dieVel, dt);
        if (u.root.position.y < 0) {
          u.root.position.y = 0;
          u.dieVel.set(0, 0, 0);
        }
        u.root.rotation.x += dt * 9;
        u.root.scale.setScalar(u.scaleBase * Math.max(0.01, 1 - Math.max(0, u.dieT - 0.6) * 2.5));
        if (u.dieT > 1) {
          _a.copy(u.root.position);
          this.fx.poof(_a, 0.8, 0.8, 0.8, 0.7);
          u.root.rotation.x = 0;
          this.despawn(u);
        }
        u.updateAnim(dt);
        continue;
      }
      if (u.state !== 'toFront' && u.state !== 'fight') continue;
      // transformation pop
      if (u.popT < 1) {
        u.popT = Math.min(1, u.popT + dt * 3.5);
        const k = u.popT;
        u.root.scale.setScalar(u.scaleBase * (1 + Math.sin(k * Math.PI) * 0.35));
      }
      if (u.state === 'toFront') {
        if (u.updateMove(dt)) {
          u.state = 'fight';
          u.fireTimer = rand(0, 0.4);
        }
        u.play('Move', 0.15, true, 1.45);
        u.updateAnim(dt);
        continue;
      }
      // fighting
      _a.copy(this.boss.root.position);
      u.targetYaw = Math.atan2(_a.x - u.root.position.x, _a.z - u.root.position.z);
      if (bossOk) {
        const w = u.weapon;
        u.play(w.anim, 0.15, true, w.id === 'pistol' ? 1.2 : w.id === 'minigun' ? 2.2 : 1.1);
        u.fireTimer -= dt;
        if (u.fireTimer <= 0) {
          u.fireTimer += (1 / (w.rate * this.rateMult)) * rand(0.85, 1.15);
          if (u.fireTimer < 0) u.fireTimer = 0.05;
          this.shoot(u);
        }
      } else u.play(u.weapon.aim, 0.25);
      u.updateAnim(dt, true);
    }
  }

  private shoot(u: Unit): void {
    const w = u.weapon;
    const muzzle = u.muzzle(_a);
    const col = w.tracer;
    this.fx.muzzle(muzzle, col[0], col[1], col[2], w.id === 'minigun' || w.id === 'shotgun' ? 1.2 : 0.9);
    const lvl = 1 + (this.wLevel[w.id] - 1) * 0.4;
    if (w.id === 'rocket') {
      const r = this.rockets.find((x) => !x.active);
      if (!r) return;
      r.active = true;
      r.t = 0;
      r.from.copy(muzzle);
      this.boss.hitPoint(r.to);
      r.ctrl.set((r.from.x + r.to.x) / 2, Math.max(r.from.y, r.to.y) + 2.5, (r.from.z + r.to.z) / 2);
      r.dmg = w.dmg * lvl * this.dmgMult;
      r.mesh.visible = true;
      r.mesh.position.copy(muzzle);
      this.audio.whoosh(true);
      return;
    }
    this.audio.play('gun', w.id === 'shotgun' ? 0.55 : 0.32, w.id === 'pistol' ? 1.15 : w.id === 'minigun' ? 1.35 : w.id === 'shotgun' ? 0.75 : 1);
    let total = 0;
    let crit = false;
    for (let i = 0; i < w.pellets; i++) {
      this.boss.hitPoint(_b);
      if (w.pellets > 1) _b.x += rand(-0.6, 0.6);
      this.fx.tracers.add(muzzle, _b, 0.09, w.tracerWidth * 1.4, col[0] * 2, col[1] * 2, col[2] * 2);
      if (i < 2) this.fx.hit(_b, 1, 0.75, 0.4, 2);
      const isCrit = Math.random() < 0.1;
      crit ||= isCrit;
      total += w.dmg * lvl * this.dmgMult * (isCrit ? 2 : 1);
    }
    this.hitBoss(total, crit, _b);
  }

  private hitBoss(amount: number, crit: boolean, at: THREE.Vector3): void {
    if (!this.boss.targetable) return;
    this.dmgAcc += amount;
    this.dmgCrit ||= crit;
    if (this.dmgTimer <= 0) {
      this.dmgTimer = 0.2;
      const s = this.hud.project(at, this.engine.camera);
      this.hud.float(s.x + rand(-20, 20), s.y, formatNum(this.dmgAcc), this.dmgCrit ? 'crit' : '', 55, 650);
      this.dmgAcc = 0;
      this.dmgCrit = false;
    }
    if (this.boss.damage(amount)) this.killBoss();
  }

  private updateRockets(dt: number): void {
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.t += dt / 0.55;
      const k = Math.min(1, r.t);
      bezier(_a, r.from, r.ctrl, r.to, k);
      bezier(_b, r.from, r.ctrl, r.to, Math.min(1, k + 0.05));
      r.mesh.position.copy(_a);
      r.mesh.lookAt(_b);
      this.fx.trail(_a);
      if (r.t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        this.fx.explosion(r.to, 0.6);
        this.fx.shake(0.12);
        this.audio.boom(0.6);
        this.hitBoss(r.dmg, false, r.to);
      }
    }
  }

  private killSoldiers(n: number, impactX: number): number {
    const alive = this.units.filter((u) => u.state === 'fight' || u.state === 'toFront');
    alive.sort((a, b) => a.root.position.z - b.root.position.z || Math.abs(a.root.position.x - impactX) - Math.abs(b.root.position.x - impactX));
    let k = 0;
    for (const u of alive.slice(0, n)) {
      u.state = 'dying';
      u.dieT = 0;
      u.stop();
      u.dieVel.set((u.root.position.x - impactX) * 0.8 + rand(-1.5, 1.5), rand(6, 9), rand(3, 6));
      u.play('Idle', 0.1);
      k++;
    }
    if (k) this.audio.play('death', 0.8);
    return k;
  }

  // =============================================================================================
  // Boss

  private bossName(): string {
    if (this.apex) return 'APEX WORLD EATER';
    const L = this.bossLevel;
    return L <= 3 ? 'VOID SCORPION' : L <= 6 ? 'DREAD SCORPION' : L <= 9 ? 'ABYSS TYRANT' : 'WORLD EATER';
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    b.update(dt);
    // aura
    const heat = b.root.visible ? b.heat : 0;
    const hot = this.bossLevel >= 6 || this.apex;
    this.world.bossLight.intensity = lerp(this.world.bossLight.intensity, heat * 22, damp(3, dt));
    this.world.bossLight.color.set(hot ? '#ff4a2a' : '#b45cff');
    this.world.bossLight.position.set(b.root.position.x, 2.5 * (b.displayScale / 0.82), b.root.position.z + 1.5);
    if (b.root.visible && Math.random() < dt * (6 + heat * 18)) {
      _a.copy(b.root.position);
      this.fx.ember(_a, 2.5 * (b.displayScale / 0.82), hot ? 1 : 0.7, hot ? 0.35 : 0.4, hot ? 0.12 : 1);
    }
    if (this.respawnT >= 0) {
      this.respawnT -= dt;
      if (this.respawnT < 0 && (this.phase === 'play' || this.phase === 'intro')) {
        this.bossLevel += 1 + this.pendingEvolve;
        this.pendingEvolve = 0;
        b.spawn(this.bossLevel);
        if (this.apex) b.setApex();
        this.fx.dust(BOSS_HOME, 2.2, 16);
        this.fx.ground.ring(BOSS_HOME, 7, '#c47dff', 0.7);
        this.fx.shake(0.35);
        this.audio.roar(1, 1.3);
        this.hud.banner('BOSS EVOLVED!', `It returns stronger · Lv.${this.bossLevel}`, '#ff6a4d', 1200);
      }
    }
    if ((this.phase === 'play' || this.phase === 'intro') && b.state === 'idle' && this.phase === 'play') {
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) {
        b.attackTimer = this.apex ? 1.35 : bossAttackInterval(this.bossLevel) * rand(0.85, 1.15);
        b.attack(() => this.bossImpact());
      }
    }
  }

  private bossImpact(): void {
    const x = this.boss.root.position.x + rand(-2, 2);
    _a.set(x, 0, WALL_Z - 0.4);
    this.fx.ground.ring(_a, 4.5 + this.bossLevel * 0.2, this.bossLevel >= 6 ? '#ff5a2a' : '#c47dff', 0.55);
    this.fx.dust(_a, 1.4, 14);
    this.fx.explosion(_a, 0.45, 0.8, 0.5, 1);
    this.fx.shake(0.35 + Math.min(0.4, this.bossLevel * 0.03));
    this.audio.boom(1 + Math.min(0.6, this.bossLevel * 0.05));
    const alive = this.units.some((u) => u.state === 'fight');
    const kills = this.apex ? 3 : 1 + Math.floor(this.bossLevel / 3);
    this.killSoldiers(kills, x);
    const dmg = this.apex ? this.wallMax * 0.085 : bossWallDamage(this.bossLevel) * (alive ? 0.55 : 1);
    this.damageWall(dmg, x);
  }

  private damageWall(dmg: number, x: number): void {
    this.wallHp = Math.max(this.wallFloor(), this.wallHp - dmg);
    if (this.wallHp <= 0.001) this.wallHp = 0;
    this.barricade.setRatio(this.wallHp / this.wallMax, x);
    this.hud.flash(0.12, 200, '#ff3a1a');
    if (this.wallHp <= 0) this.collapse();
  }

  private killBoss(): void {
    this.bossesKilled++;
    this.slowmo = 0.45;
    this.fx.shake(0.6);
    this.audio.boom(1.5);
    this.audio.chime(5);
    this.hud.banner('BOSS DEFEATED!', 'Grab the loot!', '#7dff9a', 1100);
    const L = this.bossLevel;
    this.boss.die(
      () => {
        this.boss.centre(_a);
        this.fx.explosion(_a, 1.4, 0.8, 0.45, 1);
        this.fx.ground.ring(_a, 9, '#ffd34d', 0.8);
        this.fx.shake(0.5);
        this.audio.boom(1.2);
        const nCoins = Math.min(26, 8 + L * 2);
        for (let i = 0; i < nCoins; i++) this.loot.burst(_a, 'coin', 5 + L * 3);
        const nGems = 1 + Math.floor(L / 2);
        for (let i = 0; i < Math.min(6, nGems); i++) this.loot.burst(_a, 'gem', 1);
        if (this.bossesKilled === 1 || Math.random() < 0.5) this.loot.burst(_a, 'chest', 1);
        if (this.tutorial <= 1) this.tutorial = 2;
      },
      () => {
        this.respawnT = 1.6;
      },
    );
  }

  // =============================================================================================
  // Pads: unlocks, weapon levels, expansion, wall fortification (each purchase evolves the boss)

  private refreshPads(): void {
    WEAPONS.forEach((w, i) => {
      const pad = this.pads[i];
      const prevUnlocked = i === 0 || this.unlocked.has(WEAPONS[i - 1].id);
      if (!this.unlocked.has(w.id)) {
        if (prevUnlocked) pad.show(w.unlockCost, w.unlockGems, w.name, 'UNLOCK', w.id);
        else pad.hide();
      } else if (this.wLevel[w.id] < MAX_WEAPON_LEVEL) {
        const lv = this.wLevel[w.id];
        pad.show(Math.round(w.upgradeCost * Math.pow(1.8, lv - 1)), lv >= 3 ? lv - 2 : 0, w.name, `Lv.${lv + 1}`, w.id);
      } else pad.hide();
      if (this.apex && pad.active) pad.cost *= 4;
    });
    const expand = this.pads.find((p) => p.id === 'expand')!;
    if (!this.expanded && (this.bossesKilled > 0 || this.t > 20)) {
      if (!expand.active) expand.show(90, 1, 'Second Counter', 'EXPAND', 'expand');
    } else if (this.expanded) expand.hide();
    const fort = this.pads.find((p) => p.id === 'fortify')!;
    if (this.wallHp < this.wallMax * 0.8) {
      if (!fort.active) fort.show(Math.round(50 * Math.pow(1.6, this.fortifyCount)) * (this.apex ? 4 : 1), 0, 'Repair Wall', 'FORTIFY', 'fortify');
    } else fort.hide();
  }

  private updatePads(dt: number): void {
    this.refreshPadsThrottle -= dt;
    if (this.refreshPadsThrottle <= 0) {
      this.refreshPadsThrottle = 0.5;
      this.refreshPads();
    }
    this.toastCd = Math.max(0, this.toastCd - dt);
    const pp = this.player.root.position;
    for (const pad of this.pads) {
      pad.occupied = pad.active && pad.contains(pp) && !this.input.active;
      if (!pad.occupied) {
        if (this.lastPadId === pad.id && !(pad.active && pad.contains(pp))) this.lastPadId = '';
        continue;
      }
      if (this.lastPadId !== pad.id) {
        this.hud.toast(`${pad.label} · ${pad.sub}`);
        this.toastCd = 1.2;
      }
      this.lastPadId = pad.id;
      if (pad.paid < pad.cost) {
        if (this.coins <= 0) {
          pad.denied = 0.3;
          if (this.toastCd <= 0) {
            this.hud.toast('Not enough coins!');
            this.toastCd = 2;
          }
          continue;
        }
        const rate = Math.max(pad.cost / 1.1, 30);
        const pay = Math.min(rate * dt, this.coins, pad.cost - pad.paid);
        this.coins -= pay;
        pad.paid += pay;
        this.padCoinT -= dt;
        if (this.padCoinT <= 0) {
          this.padCoinT = 0.06;
          _a.copy(pp).setY(1.2);
          this.loot.fly('coin', _a, () => pad.group.position, 0.32, null, 0, 1.2);
          if ((this.padSoundT = (this.padSoundT + 1) % 2) === 0) this.audio.play('coin', 0.3, 1.3);
        }
      }
      if (pad.paid >= pad.cost - 0.001) {
        if (this.gems < pad.gems) {
          pad.denied = 0.3;
          if (this.toastCd <= 0) {
            this.hud.toast(`Need ${pad.gems} gem${pad.gems > 1 ? 's' : ''} — kill the boss!`);
            this.toastCd = 2;
          }
          continue;
        }
        this.gems -= pad.gems;
        this.purchase(pad);
      }
    }
  }
  private refreshPadsThrottle = 0;

  private purchase(pad: Pad): void {
    this.obstacleCache = null;
    _a.copy(pad.at);
    this.fx.poof(_a, 0.4, 1, 0.55, 1.3);
    this.fx.ground.pillar(_a, 0.9, 6, '#4dff88', 0.9);
    this.audio.chime(3);
    this.audio.play('order', 0.9);
    this.hud.flash(0.15, 200, '#4dff88');
    PlayableAdsFlowManager.instance.trackClick(true, 1);
    if (this.tutorial <= 3) this.tutorial = 4;
    if (pad.weapon) {
      const w = WEAPON_BY_ID[pad.weapon];
      if (!this.unlocked.has(w.id)) {
        this.unlocked.add(w.id);
        this.armory.setUnlocked(w.id, true);
        this.armory.crateTop(w.id, _b);
        this.fx.poof(_b.setY(0.2), 1, 0.85, 0.4, 1.4);
        this.hud.banner(`${w.name.toUpperCase()} UNLOCKED!`, 'Customers can buy it now', w.color, 1100);
      } else {
        this.wLevel[w.id]++;
        this.hud.banner(`${w.name.toUpperCase()} Lv.${this.wLevel[w.id]}`, 'Damage +40%', w.color, 1000);
      }
    } else if (pad.id === 'expand') {
      this.expanded = true;
      this.counters.setEnabled(1, true, true);
      this.assistant.root.visible = true;
      this.assistant.root.position.copy(COUNTERS[1].serveSpot);
      this.assistant.targetYaw = this.assistant.yaw = -Math.PI / 2;
      this.fx.poof(COUNTERS[1].counter, 1, 1, 1, 1.5);
      this.hud.banner('CAMP EXPANDED!', 'An assistant joins the shop', '#ffd34d', 1100);
    } else if (pad.id === 'fortify') {
      this.fortifyCount++;
      this.wallMax *= 1.15;
      this.wallHp = this.wallMax;
      this.barricade.restore();
      this.hud.banner('WALL FORTIFIED!', 'Max HP +15%', '#ffd34d', 1000);
    }
    pad.hide();
    this.refreshPads();
    // every upgrade feeds the boss
    window.setTimeout(() => {
      if (this.phase === 'play') this.evolveBoss('Your upgrade made it adapt!');
    }, 900);
  }

  // =============================================================================================
  // Tutorial hints

  private updateTutorial(dt: number): void {
    const cam = this.engine.camera;
    let target: THREE.Vector3 | null = null;
    let hint: string | null = null;
    if (this.phase !== 'play') {
      this.hud.handAt(null);
      return;
    }
    if (this.tutorial === 0) {
      target = _c.copy(COUNTERS[0].serveSpot);
      hint = 'TAP to move · Stand here to sell weapons';
      if (this.serveActive(0)) target = null;
    } else if (this.tutorial === 2) {
      if (this.loot.firstGround(_c)) {
        target = _c;
        hint = 'Collect the loot! (auto-collects in 10s)';
      }
    } else if (this.tutorial === 3 || this.tutorial === 1) {
      const pad = this.pads.find((p) => p.active && p.weapon && this.coins >= p.cost - p.paid && this.gems >= p.gems);
      if (pad) {
        target = _c.copy(pad.at);
        hint = 'Stand on a pad to upgrade your armory';
      }
    } else if (this.idleT > 5) {
      const pad = this.pads.find((p) => p.active && this.coins >= p.cost - p.paid && this.gems >= p.gems);
      if (pad) target = _c.copy(pad.at);
      else if (this.loot.firstGround(_c)) target = _c;
      else if (!this.serveActive(0)) target = _c.copy(COUNTERS[0].serveSpot);
    }
    void dt;
    this.currentTutorialTarget = target ? target.clone() : null;
    this.hud.hint(hint);
    if (target && !this.input.active) {
      const s = this.hud.project(target, cam);
      this.hud.handAt(s.x, s.y);
    } else this.hud.handAt(null);
  }

  // =============================================================================================
  // Ending

  private collapse(): void {
    if (this.phase === 'collapse' || this.phase === 'end') return;
    this.phase = 'collapse';
    this.phaseT = 0;
    this.input.enabled = false;
    this.input.reset();
    this.hud.hint(null);
    this.hud.handAt(null);
    this.hud.warn(false);
    for (const p of this.pads) p.hide();
    this.barricade.setRatio(0, 0);
    this.killSoldiers(99, 0);
    this.fx.shake(1);
    _a.set(0, 0, WALL_Z);
    this.fx.explosion(_a, 1.6, 1, 0.4, 0.2);
    for (let i = -2; i <= 2; i++) this.fx.dust(_a.set(i * WALL_HALF * 0.4, 0, WALL_Z), 1.6, 8);
    this.audio.roar(1.5, 2.2);
    this.audio.boom(2);
    this.audio.duckMusic(0.25, 0.6);
    this.hud.flash(0.6, 700, '#ff2a14');
    this.hud.banner('THE CAMP HAS FALLEN!', '', '#ff4d3d', 1800);
    if (this.boss.state === 'idle') this.boss.play('Combo', 0.1, false);
  }

  private finish(): void {
    this.phase = 'end';
    this.phaseT = 0;
    this.hud.showEnd({ bosses: this.bossesKilled, coins: this.totalCoins, level: this.bossLevel, time: this.t });
    PlayableAdsSDK.instance.logEvent(PlayableEvent.ENDCARD_SHOWN);
  }

  // =============================================================================================
  // HUD sync

  private updateHud(dt: number): void {
    const cam = this.engine.camera;
    this.hud.setCurrency(this.coins, this.gems);
    this.hud.setBoss(this.bossLevel, this.boss.root.visible ? this.boss.hp : 0, this.boss.maxHp, this.bossName(), dt);
    this.hud.setWall(this.wallHp / this.wallMax);
    const danger = this.phase === 'collapse' || this.phase === 'end' ? 0.9 : clamp(1 - this.wallHp / this.wallMax - 0.35, 0, 0.6) + (this.apex ? 0.25 : 0);
    this.hud.setDanger(danger);
    this.dmgTimer -= dt;

    for (const pad of this.pads) {
      if (!pad.active || this.phase === 'collapse' || this.phase === 'end') {
        this.hud.label(pad.id, '', '', 0, 0, false, '');
        continue;
      }
      // weapon offers sit on their pad (hidden while standing on it - the fill shows progress); the rest float above
      const onIt = pad.contains(this.player.root.position);
      const s = pad.weapon ? this.hud.project(_a.set(pad.at.x, 0.2, pad.at.z + 0.35), cam) : this.hud.project(_a.set(pad.at.x, 0.2, pad.at.z - 0.45), cam);
      const remaining = Math.ceil(pad.cost - pad.paid);
      const affordable = this.coins >= remaining && this.gems >= pad.gems;
      const gemTxt = pad.gems ? ` <i class="gem-ico"></i><em>${pad.gems}</em>` : '';
      const chip = !!pad.weapon;
      const html = chip
        ? `${iconHtml(pad.icon)}<div class="t">${pad.sub}</div><div class="p"><img src="${COIN_IMG}" alt="">${formatNum(remaining)}${gemTxt}</div>`
        : `${iconHtml(pad.icon)}<div><div class="t">${pad.sub}<br>${pad.label}</div><div class="p"><img src="${COIN_IMG}" alt="">${formatNum(remaining)}${gemTxt}</div></div>`;
      this.hud.label(pad.id, html, `${pad.sub}${pad.label}${remaining}${pad.gems}`, s.x, s.y, s.ok && !(chip && onIt), affordable ? 'ready' : pad.denied > 0 ? 'cant' : '', chip, chip);
    }
    for (let i = 0; i < 2; i++) {
      const p = this.serveProgress[i];
      if (p > 0.001 && (i === 0 || this.expanded)) {
        const s = this.hud.project(_a.copy(COUNTERS[i].serveSpot).setY(2.5), cam);
        this.hud.serve(i, s.x, s.y, p);
      } else this.hud.serve(i, 0, 0, null);
    }
  }
}

