import * as THREE from 'three';
import { clamp, easeOutBack, lerp } from '../core/math';

/** What the 15 s trailer needs from the live game (wired in Game.trailerCtl). */
export interface TrailerCtl {
  cam: THREE.PerspectiveCamera;
  trauma(): number;
  flash(strength: number, ms: number, color: string): void;
  shake(amount: number): void;
  slam(): void;
  hit(dmg: number): void;
  bossHp(): number;
  bossMax(): number;
  setBossHp(hp: number): void;
}

type Ease = 'inOut' | 'out' | 'linear' | 'cut';
interface Key {
  t: number;
  p: [number, number, number];
  l: [number, number, number];
  fov: number;
  e?: Ease;
}
interface Cap {
  t: number;
  dur: number;
  text: string;
  sub?: string;
  cls: string;
}

export const TRAILER_LENGTH = 15;
const BARRAGE = { from: 6.2, to: 10.4 };

// Beat sheet (portrait 9:16):
//  0.0  HOOK    low angle up at the boss, red shout, wall slam
//  2.4  REWIND  VHS glitch whip to the shop
//  2.9  LOOP    SELL -> ARM -> DEFEND stamps over the counter
//  6.2  ARMY    orbit the firing line, boss HP melts, slow-mo kill at 10.4
// 12.4  CTA     logo + pulsing PLAY NOW
const CAMERA: Key[] = [
  { t: 0, p: [0.6, 0.8, -3.4], l: [0, 3.4, -11.8], fov: 64 },
  { t: 2.4, p: [0, 1.5, -4.6], l: [0, 3.8, -11.8], fov: 50, e: 'inOut' },
  { t: 2.9, p: [-1, 7, 13], l: [-3, 0.6, 3], fov: 44, e: 'cut' },
  { t: 6.2, p: [-6, 3.2, 8.6], l: [-3, 1, 3.4], fov: 40, e: 'inOut' },
  { t: 6.3, p: [9.5, 2.6, -0.5], l: [0, 1.2, -7], fov: 46, e: 'cut' },
  { t: 8.4, p: [0, 3.4, -1.2], l: [0, 2.4, -9], fov: 46, e: 'inOut' },
  { t: 10.4, p: [-8.5, 2.2, -3.5], l: [0, 2.2, -9.5], fov: 44, e: 'inOut' },
  { t: 12.4, p: [0, 8.5, 6], l: [0, 1, -8], fov: 52, e: 'out' },
  { t: 15, p: [0, 11, 11], l: [0, 0.5, -6], fov: 50, e: 'inOut' },
];

const CAPS: Cap[] = [
  { t: 0.25, dur: 2.1, text: "99% CAN'T", sub: 'HOLD THE WALL', cls: 'shout' },
  { t: 3.0, dur: 0.95, text: 'SELL', cls: 'stamp s1' },
  { t: 3.95, dur: 0.95, text: 'ARM', cls: 'stamp s2' },
  { t: 4.9, dur: 1.3, text: 'DEFEND', cls: 'stamp s3' },
  { t: 12.5, dur: 2.5, text: 'BOSS ARMORY', sub: 'BUILD THE ARMY. BREAK THE BOSS.', cls: 'logo' },
];

const css = `
#trailer{position:fixed;inset:0;z-index:50;pointer-events:none;overflow:hidden;font-family:var(--font,system-ui);font-weight:900;color:#fff}
body.trailer .hint,body.trailer .hand{display:none!important}
#trailer>*{position:absolute;left:0;right:0;text-align:center;opacity:0;will-change:transform,opacity}
#trailer b{display:block;white-space:nowrap;-webkit-text-stroke:8px #14202a;paint-order:stroke fill;line-height:.95}
#trailer small{display:block;margin-top:.5em;font-size:min(4.2vw,2.4vh);letter-spacing:.14em;color:#ffe9a8;text-shadow:0 2px 8px #000}
#trailer .shout{top:22%}#trailer .shout b{font-size:min(19vw,10vh);color:#ff4b3a}
#trailer .shout small{font-size:min(8vw,4.4vh);color:#fff;letter-spacing:.06em}
#trailer .stamp{top:36%}#trailer .stamp b{font-size:min(23vw,12vh)}
#trailer .s1 b{color:#ffd34d}#trailer .s2 b{color:#7df0ff}#trailer .s3 b{color:#ff6a4d}
#trailer .logo{top:30%}#trailer .logo b{font-size:min(12.5vw,7vh);color:#ffd34d;white-space:nowrap}
#trailer .vig{inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(120,0,0,.65) 100%)}
#trailer .glitch{inset:0;background:repeating-linear-gradient(0deg,rgba(0,255,255,.16) 0 3px,rgba(255,0,200,.16) 3px 6px,rgba(0,0,0,0) 6px 11px);mix-blend-mode:screen}
#trailer .rew{top:8%;font-size:min(9vw,5vh);letter-spacing:.2em;color:#fff;text-shadow:3px 0 #f0f,-3px 0 #0ff}
#trailer .cta{bottom:12%}
#trailer .cta span{display:inline-block;padding:.45em 1.3em;border-radius:99px;font-size:min(10vw,5.2vh);color:#1b2a12;background:linear-gradient(#9dff6a,#3fcf3a);border:5px solid #14202a;box-shadow:0 8px 0 #14202a}
#trailer .fade{inset:0;background:#000}`;

const ease = (e: Ease | undefined, k: number): number => (e === 'inOut' ? k * k * (3 - 2 * k) : e === 'out' ? 1 - (1 - k) * (1 - k) : e === 'cut' ? 0 : k);
const mix = (a: number[], b: number[], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export class Trailer {
  t = 0;
  playing = false;
  private el = document.createElement('div');
  private caps: HTMLElement[] = [];
  private glitch: HTMLElement;
  private rew: HTMLElement;
  private vig: HTMLElement;
  private cta: HTMLElement;
  private fade: HTMLElement;
  private fired = new Set<string>();
  private nextHit = 0;
  private startFrac = 1;
  private cp = new THREE.Vector3();
  private cl = new THREE.Vector3();

  constructor(private ctl: TrailerCtl) {
    document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
    document.body.classList.add('trailer');
    this.el.id = 'trailer';
    this.vig = this.add('vig', '');
    for (const c of CAPS) {
      this.caps.push(this.add(c.cls, `<b>${c.text}</b>${c.sub ? `<small>${c.sub}</small>` : ''}`));
    }
    this.glitch = this.add('glitch', '');
    this.rew = this.add('rew', '⏪ REWIND');
    this.cta = this.add('cta', '<span>PLAY NOW ▶</span>');
    this.fade = this.add('fade', '');
    document.body.append(this.el);
  }

  private add(cls: string, html: string): HTMLElement {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    this.el.append(d);
    return d;
  }

  start(): void {
    this.t = 0;
    this.playing = true;
    this.fired.clear();
    this.startFrac = this.ctl.bossHp() / this.ctl.bossMax();
  }

  /** Runs after Game.updateCamera: overrides the camera and drives the beats. */
  update(dt: number): void {
    // pre-roll: the army is allowed to fire but the boss must still be alive when the clock starts
    if (!this.playing) {
      this.ctl.setBossHp(this.ctl.bossMax());
      return;
    }
    this.t = Math.min(TRAILER_LENGTH, this.t + dt);
    const t = this.t;
    this.events(t);
    this.barrage(t, dt);
    this.camera(t);
    this.overlay(t);
    if (t >= TRAILER_LENGTH) this.playing = false;
  }

  private once(id: string, at: number, t: number, fn: () => void): void {
    if (t >= at && !this.fired.has(id)) {
      this.fired.add(id);
      fn();
    }
  }

  private events(t: number): void {
    const c = this.ctl;
    this.once('slam1', 0.9, t, () => {
      c.slam();
      c.flash(0.5, 220, '#ff3b2e');
    });
    this.once('slam2', 1.7, t, () => {
      c.slam();
      c.shake(0.9);
    });
    this.once('rew', 2.4, t, () => c.flash(0.9, 300, '#ffffff'));
    this.once('cut2', 6.2, t, () => c.flash(0.7, 240, '#fff3c4'));
    this.once('kill', BARRAGE.to, t, () => {
      c.setBossHp(1);
      c.hit(1e12);
    });
    this.once('cta', 12.4, t, () => c.flash(0.6, 400, '#ffe9a8'));
  }

  /** Boss HP melts on a fixed curve so the kill lands on the beat whatever the soldiers do. */
  private barrage(t: number, dt: number): void {
    if (t < BARRAGE.from || t >= BARRAGE.to) return;
    const c = this.ctl;
    const p = (t - BARRAGE.from) / (BARRAGE.to - BARRAGE.from);
    const want = lerp(this.startFrac, 0.06, p) * c.bossMax();
    if (c.bossHp() < want) c.setBossHp(want);
    this.nextHit -= dt;
    if (this.nextHit <= 0) {
      this.nextHit = 0.22;
      const d = c.bossHp() - want;
      if (d > 0) c.hit(d + 1);
    }
  }

  private camera(t: number): void {
    let i = 0;
    while (i < CAMERA.length - 2 && CAMERA[i + 1].t <= t) i++;
    const a = CAMERA[i];
    const b = CAMERA[i + 1];
    const k = ease(b.e, clamp((t - a.t) / (b.t - a.t), 0, 1));
    const cam = this.ctl.cam;
    const cut = b.e === 'cut';
    const pos = cut ? a.p : mix(a.p, b.p, k);
    const look = cut ? a.l : mix(a.l, b.l, k);
    this.cp.set(pos[0], pos[1], pos[2]);
    this.cl.set(look[0], look[1], look[2]);
    // hook: slow handheld breathing; later: trauma shake from impacts
    const tr = this.ctl.trauma();
    const s = tr * tr;
    this.cp.x += Math.sin(t * 53.1) * s * 0.55;
    this.cp.y += Math.sin(t * 61.7 + 1.3) * s * 0.45 + (t < 2.4 ? Math.sin(t * 7) * 0.05 : 0);
    cam.position.copy(this.cp);
    cam.lookAt(this.cl);
    cam.rotation.z += Math.sin(t * 47.3 + 2.1) * s * 0.03 + (t < 2.4 ? Math.sin(t * 2.2) * 0.025 : 0);
    cam.fov = cut ? a.fov : lerp(a.fov, b.fov, k);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  private overlay(t: number): void {
    CAPS.forEach((c, i) => {
      const el = this.caps[i];
      const u = t - c.t;
      if (u < 0 || u > c.dur) {
        el.style.opacity = '0';
        return;
      }
      const pop = easeOutBack(clamp(u / 0.22, 0, 1));
      const out = clamp((c.dur - u) / 0.15, 0, 1);
      const rot = c.cls.includes('stamp') ? (i % 2 ? 5 : -5) : 0;
      el.style.opacity = String(out);
      el.style.transform = `scale(${lerp(2.4, 1, pop)}) rotate(${rot}deg)`;
    });
    // red danger vignette pulses through the hook, gone at the rewind
    this.vig.style.opacity = t < 2.4 ? String(0.5 + 0.5 * Math.abs(Math.sin(t * 6))) : '0';
    const g = t > 2.35 && t < 3.0 ? 1 : 0;
    this.glitch.style.opacity = String(g * 0.9);
    this.glitch.style.transform = `translate(${g * Math.sin(t * 90) * 14}px,${g * Math.sin(t * 40) * 40}px)`;
    this.rew.style.opacity = String(g);
    this.fade.style.opacity = String(clamp(1 - t / 0.25, 0, 1));
    const c = clamp((t - 13.2) / 0.3, 0, 1);
    this.cta.style.opacity = String(c);
    this.cta.style.transform = `scale(${lerp(0.6, 1, easeOutBack(c)) * (1 + 0.06 * Math.sin(t * 9))})`;
  }
}
