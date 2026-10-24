import './arcade.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Engine } from '../core/Engine';
import type { Assets } from '../core/assets';
import type { Audio } from '../core/Audio';
import { buildWeaponKit, proceduralMaterial } from '../game/Weapons';
import { PlayableAdsFlowManager } from '../tracking/PlayableAdsFlowManager';
import { PlayableAdsSDK, PlayableEvent } from '../tracking/PlayableAdsSDK';
import { ArcadeHud, ICON, h } from './ArcadeHud';
import { Mode, type Ctx } from './Mode';
import { SquadRush } from './SquadRush';
import { HordeSurvivor } from './HordeSurvivor';
import { MergeDefense } from './MergeDefense';
import { Brute } from './Brute';
import { Crowd } from './Crowd';
import { Fx } from '../vfx/Fx';

export type ModeId = 'rush' | 'horde' | 'merge';
const MODES: { id: ModeId; icon: string; title: string; tag: string; desc: string; color: string; make: (c: Ctx) => Mode }[] = [
  { id: 'rush', icon: ICON.army, title: 'SQUAD RUSH', tag: 'Gates · Army · Boss', desc: 'Pick the right gates, grow your army, crush the warlord.', color: '#4da3ff', make: (c) => new SquadRush(c) },
  { id: 'horde', icon: ICON.nova, title: 'HORDE SURVIVOR', tag: 'Joystick · Skills · Swarm', desc: 'One hero versus hundreds. Level up, stack skills, survive.', color: '#7cdc4a', make: (c) => new HordeSurvivor(c) },
  { id: 'merge', icon: ICON.rocket, title: 'MERGE DEFENSE', tag: 'Summon · Merge · Hold', desc: 'Merge troopers up to rocket tier and hold the wall.', color: '#ffb21f', make: (c) => new MergeDefense(c) },
];
const SAVE_KEY = 'arcade.levels.v1';

/** Main menu + the three mini games, sharing one renderer, asset set and HUD. */
export class Arcade {
  readonly ctx: Ctx;
  readonly hud: ArcadeHud;
  private modes = new Map<ModeId, Mode>();
  cur: Mode | null = null;
  private menuEl: HTMLElement;
  private menuScene = new THREE.Scene();
  private menuFx: Fx;
  private menuBoss: Brute;
  private menuCrowd: Crowd;
  private menuT = 0;
  private levels: Record<ModeId, number> = { rush: 1, horde: 1, merge: 1 };
  private audioOn = false;
  private plays = 0;

  constructor(
    private engine: Engine,
    assets: Assets,
    private audio: Audio,
    ui: HTMLElement,
  ) {
    this.hud = new ArcadeHud(ui);
    const kit = buildWeaponKit(assets.models.customer);
    const bodyMat = (assets.models.customer.scene.getObjectByName('Body_01_blackjacket') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const civA = bodyMat.clone();
    civA.map = assets.textures.skinCivA;
    const soldier = bodyMat.clone();
    soldier.map = assets.textures.skinSoldier;
    const zombie = bodyMat.clone();
    zombie.map = assets.textures.skinZombie;
    proceduralMaterial.map = assets.textures.weaponGrunge;
    proceduralMaterial.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(engine.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.ctx = { engine, assets, audio, hud: this.hud, kit, skins: { soldier, civA, civB: bodyMat, zombie }, env };
    try {
      Object.assign(this.levels, JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}'));
    } catch {
      /* private mode / blocked storage: keep defaults */
    }

    // ---- menu backdrop: the boss towering over a ring of firing troopers ----
    const s = this.menuScene;
    s.background = new THREE.Color('#1a1030');
    s.fog = new THREE.Fog('#1a1030', 14, 40);
    s.environment = env;
    s.environmentIntensity = 0.5;
    s.add(new THREE.HemisphereLight('#ffd9c0', '#2a1640', 1.6));
    const key = new THREE.DirectionalLight('#ffb27a', 3);
    key.position.set(-6, 12, 8);
    const rim = new THREE.DirectionalLight('#7f9bff', 2.2);
    rim.position.set(6, 6, -10);
    s.add(key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#2a1d3a', roughness: 0.6, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);
    this.menuFx = new Fx(s, assets.textures.smoke);
    this.menuBoss = new Brute(assets.models.boss);
    this.menuBoss.root.visible = true;
    this.menuBoss.root.scale.setScalar(1.5);
    this.menuBoss.play('Idle', 0);
    s.add(this.menuBoss.root);
    this.menuCrowd = new Crowd(assets.models.customer, kit, { clip: 'Attack_3', frames: 10, skin: soldier, weapon: 'rifle' }, 64);
    s.add(this.menuCrowd.group);

    this.menuEl = h('arc-menu');
    this.menuEl.innerHTML = `<div class="logo stroke"><small>ARMY</small>ARCADE<i>3 GAMES · 1 ARMY</i></div><div class="list"></div><div class="foot stroke">Tap a game to play</div>`;
    const list = this.menuEl.querySelector('.list')!;
    for (const m of MODES) {
      const b = h('arc-mcard', `<div class="ic">${m.icon}</div><div class="tx"><b class="stroke">${m.title}</b><em>${m.tag}</em><small>${m.desc}</small></div><span class="lv stroke"></span>`, 'button');
      b.style.setProperty('--c', m.color);
      b.dataset.id = m.id;
      b.addEventListener('click', () => {
        this.unlockAudio();
        this.audio.play('click');
        this.open(m.id);
      });
      list.append(b);
    }
    ui.append(this.menuEl);
    this.menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.hud.onMenu = () => this.toMenu();
    this.hud.onRetry = () => this.open(this.cur!.id as ModeId, this.cur!.level);
    this.hud.onNext = () => this.open(this.cur!.id as ModeId, this.cur!.level + 1);
    this.hud.onCta = () => {
      this.audio.play('click');
      PlayableAdsFlowManager.instance.trackClick(true, 1);
      if (PlayableAdsFlowManager.instance.isEnded) PlayableAdsSDK.instance.openStore();
      else PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
    };

    const canvas = engine.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.unlockAudio();
      if (this.cur && this.cur.outcome === 'play' && !this.hud.cardsOpen) this.cur.pointerDown(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e) => this.cur?.pointerMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', (e) => this.cur?.pointerUp(e.clientX, e.clientY));
    window.addEventListener('pointercancel', (e) => this.cur?.pointerUp(e.clientX, e.clientY));
    engine.onResize = (w, hh) => this.hud.resize(w, hh);
    this.hud.resize(window.innerWidth, window.innerHeight);
    this.toMenu();
  }

  private unlockAudio(): void {
    if (this.audioOn) return;
    this.audioOn = true;
    void this.audio.unlock().then(() => this.audio.startMusic());
  }

  private mode(id: ModeId): Mode {
    let m = this.modes.get(id);
    if (!m) {
      m = MODES.find((d) => d.id === id)!.make(this.ctx);
      m.onEnd = (win) => this.ended(m!, win);
      this.modes.set(id, m);
    }
    return m;
  }

  open(id: ModeId, level = this.levels[id]): void {
    this.cur?.exit();
    this.hud.hideEnd();
    this.menuEl.classList.remove('on');
    const m = this.mode(id);
    this.cur = m;
    this.engine.scene = m.scene;
    m.bot = this.botAll;
    m.start(Math.max(1, level));
    PlayableAdsFlowManager.instance.startLevel(MODES.findIndex((d) => d.id === id) * 100 + m.level - 1, 99999, true);
    if (this.plays++ === 0) PlayableAdsSDK.instance.logEvent(PlayableEvent.CHALLENGE_STARTED);
    this.audio.whoosh(true);
  }

  toMenu(): void {
    this.cur?.exit();
    this.cur = null;
    this.hud.hideEnd();
    this.hud.setVisible(false);
    this.engine.scene = this.menuScene;
    for (const b of this.menuEl.querySelectorAll<HTMLElement>('.arc-mcard')) b.querySelector('.lv')!.textContent = `LV ${this.levels[b.dataset.id as ModeId]}`;
    this.menuEl.classList.add('on');
  }

  private ended(m: Mode, win: boolean): void {
    const id = m.id as ModeId;
    if (win) {
      this.levels[id] = Math.max(this.levels[id], m.level + 1);
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.levels));
      } catch {
        /* storage blocked: progress is session-only */
      }
    }
    PlayableAdsFlowManager.instance.trackClick(win, win ? 1 : 0);
    // let the final blow / defeat breathe before the panel
    setTimeout(() => {
      if (this.cur !== m) return;
      this.audio.play(win ? 'receive' : 'death');
      if (win) this.audio.chime(6);
      this.hud.end({ win, title: win ? 'VICTORY!' : 'DEFEAT', sub: win ? `${m.title} · Level ${m.level} cleared` : `${m.title} · Level ${m.level}`, stats: m.endStats(), next: win });
      PlayableAdsSDK.instance.logEvent(PlayableEvent.ENDCARD_SHOWN);
    }, this.capture ? 0 : 700);
  }

  /** Set by tests / trailer: autoplay every mode. */
  botAll = false;
  /** Capture mode steps time by hand, so wall-clock delays are skipped. */
  capture = false;

  update(dt: number): void {
    if (this.cur) {
      this.cur.update(dt);
      return;
    }
    // menu: slow orbit, the boss roars now and then, troopers fire at it
    this.menuT += dt;
    const t = this.menuT;
    const b = this.menuBoss;
    if (b.currentName !== 'Combo' && Math.floor(t / 6) !== Math.floor((t - dt) / 6)) b.play('Combo', 0.2, false);
    if (b.currentName === 'Combo' && b.current!.time >= b.clipDuration('Combo') - 0.05) b.play('Idle', 0.3);
    b.updateAnim(dt);
    const c = this.menuCrowd;
    c.begin();
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 6.5 + (i % 2) * 1.3;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      c.add(x, 0, z, Math.atan2(-x, -z), 1.05, t + i * 0.23);
      if (Math.random() < 0.05) {
        const from = new THREE.Vector3(x * 0.92, 1, z * 0.92);
        this.menuFx.tracers.add(from, new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5), 0.08, 0.08, 0.6, 1.8, 2.6);
        if (Math.random() < 0.3) this.menuFx.hit(new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.5 + Math.random(), (Math.random() - 0.5) * 1.5), 0.6, 0.9, 1, 2);
      }
    }
    c.end();
    this.menuFx.update(dt);
    const cam = this.engine.camera;
    const a = t * 0.15;
    if (cam.fov !== 50) {
      cam.fov = 50;
      cam.updateProjectionMatrix();
    }
    cam.position.set(Math.sin(a) * 15, 6.5 + Math.sin(t * 0.3), Math.cos(a) * 15);
    cam.lookAt(0, 3.6, 0);
  }

  /** Compile every scene once so the first frame of each mode doesn't hitch. */
  async warmup(): Promise<void> {
    const r = this.engine.renderer;
    await r.compileAsync(this.menuScene, this.engine.camera);
    for (const d of MODES) await r.compileAsync(this.mode(d.id).scene, this.engine.camera);
  }

  debugApi(): Record<string, unknown> {
    return {
      open: (id: ModeId, level?: number) => this.open(id, level),
      menu: () => this.toMenu(),
      state: () => (this.cur ? this.cur.state() : { mode: 'menu' }),
      cheat: (k: 'win' | 'lose') => this.cur?.cheat(k),
      bot: (on: boolean) => {
        this.botAll = on;
        if (this.cur) this.cur.bot = on;
      },
      capture: (on: boolean) => (this.capture = on),
      /** Fast-forward the simulation without rendering (tests). */
      tick: (dt: number, n: number) => {
        for (let i = 0; i < n && (!this.cur || this.cur.outcome === 'play'); i++) this.update(dt);
        return this.cur ? this.cur.state() : null;
      },
      models: () => {
        const m = this.ctx.assets.models;
        const clips = (g: { animations: THREE.AnimationClip[] }) => g.animations.map((a) => a.name);
        return { customer: clips(m.customer), boss: clips(m.boss), staff: clips(m.staff), menuCrowdH: this.menuCrowd.height, calls: this.engine.renderer.info.render.calls };
      },
      mode: () => this.cur,
      levels: () => ({ ...this.levels }),
      ui: () => ({
        menu: this.menuEl.classList.contains('on'),
        cards: this.menuEl.querySelectorAll('.arc-mcard').length,
        hud: this.hud.root.style.display !== 'none',
        end: this.hud.endOpen,
        levelUp: this.hud.cardsOpen,
      }),
    };
  }
}
