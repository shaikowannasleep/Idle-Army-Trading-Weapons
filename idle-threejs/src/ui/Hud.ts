import * as THREE from 'three';
import coinImg from '../assets/ui/coin.png?url';
import handImg from '../assets/ui/hand.png?url';
import shineImg from '../assets/ui/shine.png?url';
import logoImg from '../assets/ui/logo.png?url';
import pistolImg from '../assets/ui/icon_pistol.png?url';
import rifleImg from '../assets/ui/icon_rifle.png?url';
import upgradeImg from '../assets/ui/upgrade.png?url';
import { formatNum } from '../core/math';

const BAG_SVG = `<svg viewBox="0 0 64 64"><path d="M22 14c0-5 4-8 10-8s10 3 10 8l-4 5H26z" fill="#8a5a2b"/><path d="M12 30c0-9 9-13 20-13s20 4 20 13v16c0 8-8 12-20 12S12 54 12 46z" fill="#c98a43"/><path d="M20 22h24l-3 5H23z" fill="#6b4220"/><circle cx="32" cy="40" r="7" fill="#ffd34d" stroke="#8a5a2b" stroke-width="3"/></svg>`;
const SHIELD_SVG = `<svg viewBox="0 0 32 32"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#d9a42c" stroke="#fff" stroke-width="2"/><path d="M16 9v15" stroke="#fff" stroke-width="2"/></svg>`;
const GUN_SVG: Record<string, string> = {
  shotgun: `<svg viewBox="0 0 32 32"><rect x="3" y="12" width="22" height="3" fill="#cfd5dc"/><rect x="10" y="15" width="9" height="3" rx="1" fill="#a0683a"/><path d="M3 13h-1v6h6l3-3V13z" fill="#7a4a26"/><rect x="25" y="12" width="4" height="2" fill="#cfd5dc"/></svg>`,
  minigun: `<svg viewBox="0 0 32 32"><rect x="12" y="10" width="17" height="2" fill="#cfd5dc"/><rect x="12" y="13" width="17" height="2" fill="#cfd5dc"/><rect x="12" y="16" width="17" height="2" fill="#cfd5dc"/><rect x="4" y="9" width="10" height="10" rx="2" fill="#6b7480"/><rect x="5" y="19" width="6" height="6" fill="#4f5d2f"/></svg>`,
  rocket: `<svg viewBox="0 0 32 32"><rect x="4" y="12" width="20" height="7" rx="2" fill="#6d7d3a"/><path d="M24 11l6 4.5-6 4.5z" fill="#d23b31"/><rect x="9" y="19" width="3" height="5" fill="#444"/><rect x="15" y="9" width="5" height="3" fill="#444"/></svg>`,
};

export const COIN_IMG = coinImg;

export function iconHtml(icon: string): string {
  if (icon === 'pistol') return `<div class="ic" style="background-image:url(${pistolImg})"></div>`;
  if (icon === 'rifle') return `<div class="ic" style="background-image:url(${rifleImg})"></div>`;
  if (icon === 'expand') return `<div class="ic" style="background-image:url(${upgradeImg})"></div>`;
  if (icon === 'fortify') return `<div class="ic">${SHIELD_SVG}</div>`;
  return `<div class="ic">${GUN_SVG[icon] ?? ''}</div>`;
}

const el = (cls: string, html = '', tag = 'div'): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
};

interface Label {
  root: HTMLElement;
  key: string;
  visible: boolean;
  xy: string;
}

const _v = new THREE.Vector3();

export interface EndStats {
  bosses: number;
  coins: number;
  level: number;
  time: number;
}

/** DOM overlay. Everything world-anchored is moved with transforms only (no layout per frame). */
export class Hud {
  readonly root: HTMLElement;
  private coinsEl: HTMLElement;
  private gemsEl: HTMLElement;
  private coinPill: HTMLElement;
  private gemPill: HTMLElement;
  private bag: HTMLElement;
  private bossLv: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossTrail: HTMLElement;
  private bossText: HTMLElement;
  private wallFill: HTMLElement;
  private wallBar: HTMLElement;
  private bannerEl: HTMLElement;
  private toastEl: HTMLElement;
  private hintEl: HTMLElement;
  private hand: HTMLElement;
  private vignette: HTMLElement;
  private flashEl: HTMLElement;
  private warnEl: HTMLElement;
  private labelLayer: HTMLElement;
  private floatLayer: HTMLElement;
  private serveEls: { root: HTMLElement; fg: SVGCircleElement; on: boolean }[] = [];
  private labels = new Map<string, Label>();
  private floats: HTMLElement[] = [];
  private floatIdx = 0;
  private endcard: HTMLElement;
  private loading: HTMLElement;
  private lfill: HTMLElement;
  private trail = 1;
  private hpFrac = 1;
  private lastCoins = -1;
  private lastGems = -1;
  private lastHpText = '';
  private vignetteLevel = -1;
  private lastFill = -1;
  private lastTrail = -1;
  private lastWall = -1;
  onContinue: () => void = () => {};
  onRetry: () => void = () => {};
  onMute: (muted: boolean) => void = () => {};
  onLabelClick?: (id: string) => void;
  onHandClick?: () => void;
  w = 1;
  h = 1;

  constructor(root: HTMLElement) {
    this.root = root;
    this.vignette = el('vignette');
    this.labelLayer = el('layer');
    this.floatLayer = el('layer');
    root.append(this.vignette, this.labelLayer, this.floatLayer);

    const top = el('top');
    const res = el('res');
    this.coinPill = el('pill coin', `<img src="${coinImg}" alt=""><span class="stroke">0</span>`);
    this.gemPill = el('pill gem', `<i class="gem-ico"></i><span class="stroke">0</span>`);
    this.coinsEl = this.coinPill.querySelector('span')!;
    this.gemsEl = this.gemPill.querySelector('span')!;
    res.append(this.coinPill, this.gemPill);

    const card = el(
      'boss-card',
      `<div class="boss-row"><span class="boss-lv">Lv.1</span><span class="boss-name stroke">VOID SCORPION</span></div>
       <div class="bar boss-bar"><div class="trail"></div><div class="fill"></div><span class="hp-text"></span></div>
       <div class="wall-row"><span>WALL</span><div class="bar wall-bar"><div class="fill"></div></div></div>`,
    );
    this.bossLv = card.querySelector('.boss-lv')!;
    this.bossName = card.querySelector('.boss-name')!;
    this.bossFill = card.querySelector('.boss-bar .fill')!;
    this.bossTrail = card.querySelector('.boss-bar .trail')!;
    this.bossText = card.querySelector('.hp-text')!;
    this.wallFill = card.querySelector('.wall-bar .fill')!;
    this.wallBar = card.querySelector('.wall-bar')!;

    const right = el('right-col');
    this.bag = el('bag', BAG_SVG);
    const mute = el('mute', 'SFX', 'button') as HTMLButtonElement;
    let muted = false;
    mute.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      muted = !muted;
      mute.textContent = muted ? 'OFF' : 'SFX';
      this.onMute(muted);
    });
    right.append(this.bag, mute);
    top.append(res, card, right);

    this.warnEl = el('warn stroke', '⚠ BOSS IS GETTING TOO STRONG');
    this.bannerEl = el('banner', '<h1 class="stroke"></h1><p class="stroke"></p>');
    this.toastEl = el('toast');
    this.hintEl = el('hint stroke');
    this.hand = el('hand', `<img src="${handImg}" alt="">`);
    this.hand.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onHandClick?.();
    });
    this.flashEl = el('flash');

    for (let i = 0; i < 2; i++) {
      const s = el('serve', `<svg viewBox="0 0 46 46"><circle class="bg" cx="23" cy="23" r="18"/><circle class="fg" cx="23" cy="23" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1"/></svg>`);
      s.style.opacity = '0';
      this.labelLayer.appendChild(s);
      this.serveEls.push({ root: s, fg: s.querySelector('.fg') as SVGCircleElement, on: false });
    }
    for (let i = 0; i < 18; i++) {
      const f = el('float stroke');
      f.style.opacity = '0';
      this.floatLayer.appendChild(f);
      this.floats.push(f);
    }

    this.endcard = el(
      'endcard',
      `<div class="card">
        <img class="shine" src="${shineImg}" alt="">
        <img class="logo" src="${logoImg}" alt="">
        <h1 class="stroke">DEFEAT</h1>
        <div class="sub stroke">The boss evolved beyond your army!</div>
        <div class="stats">
          <div><span class="s-boss">0</span><small>BOSSES</small></div>
          <div><span class="s-coin">0</span><small>COINS</small></div>
          <div><span class="s-lv">1</span><small>BOSS LV</small></div>
        </div>
        <button class="btn cta stroke">CONTINUE</button>
        <button class="btn retry stroke">RETRY</button>
      </div>`,
    );
    this.endcard.querySelector('.cta')!.addEventListener('click', () => this.onContinue());
    this.endcard.querySelector('.retry')!.addEventListener('click', () => this.onRetry());
    this.endcard.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.loading = el(
      'loading',
      `<div class="box"><img src="${logoImg}" alt=""><div class="lbar"><div class="lfill"></div></div><div class="ltxt stroke">LOADING…</div></div>`,
    );
    this.lfill = this.loading.querySelector('.lfill')!;

    root.append(top, this.warnEl, this.bannerEl, this.toastEl, this.hintEl, this.hand, this.flashEl, this.endcard, this.loading);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  setLoading(p: number): void {
    this.lfill.style.transform = `scaleX(${p})`;
  }
  hideLoading(): void {
    this.loading.classList.add('done');
  }

  /** Screen-space centre of a HUD element (for 3D fly targets). */
  anchor(which: 'coin' | 'gem' | 'bag'): { x: number; y: number } {
    const e = which === 'coin' ? this.coinPill.querySelector('img')! : which === 'gem' ? this.gemPill.querySelector('i')! : this.bag;
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  bump(which: 'coin' | 'gem' | 'bag'): void {
    const e = which === 'coin' ? this.coinPill : which === 'gem' ? this.gemPill : this.bag;
    e.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
  }

  setCurrency(coins: number, gems: number): void {
    const c = Math.floor(coins);
    if (c !== this.lastCoins) {
      this.lastCoins = c;
      this.coinsEl.textContent = formatNum(c);
    }
    if (gems !== this.lastGems) {
      this.lastGems = gems;
      this.gemsEl.textContent = String(gems);
    }
  }

  setBoss(level: number, hp: number, maxHp: number, name: string, dt: number): void {
    const f = Math.max(0, hp / maxHp);
    this.hpFrac = f;
    if (this.trail < f) this.trail = f;
    else this.trail += (f - this.trail) * Math.min(1, dt * 3);
    const fq = Math.round(f * 1000) / 1000;
    const tq = Math.round(this.trail * 1000) / 1000;
    if (fq !== this.lastFill) {
      this.lastFill = fq;
      this.bossFill.style.transform = `scaleX(${fq})`;
    }
    if (tq !== this.lastTrail) {
      this.lastTrail = tq;
      this.bossTrail.style.transform = `scaleX(${tq})`;
    }
    const txt = `${formatNum(Math.max(0, hp))} / ${formatNum(maxHp)}`;
    if (txt !== this.lastHpText) {
      this.lastHpText = txt;
      this.bossText.textContent = txt;
      this.bossLv.textContent = `Lv.${level}`;
      this.bossLv.classList.toggle('hot', level >= 6);
      this.bossName.textContent = name;
    }
  }

  setWall(frac: number): void {
    const q = Math.round(Math.max(0, frac) * 500) / 500;
    if (q === this.lastWall) return;
    this.lastWall = q;
    this.wallFill.style.transform = `scaleX(${q})`;
    this.wallBar.classList.toggle('low', q < 0.35);
  }

  setDanger(level: number): void {
    const q = Math.round(level * 20) / 20;
    if (q === this.vignetteLevel) return;
    this.vignetteLevel = q;
    this.vignette.style.opacity = String(q);
  }

  warn(on: boolean): void {
    this.warnEl.classList.toggle('on', on);
    if (!on) this.warnEl.style.opacity = '0';
  }

  banner(title: string, sub = '', color = '#ffffff', hold = 1400): void {
    const h = this.bannerEl.querySelector('h1')!;
    const p = this.bannerEl.querySelector('p')!;
    h.textContent = title;
    h.style.color = color;
    p.textContent = sub;
    this.bannerEl.getAnimations().forEach((a) => a.cancel());
    this.bannerEl.animate(
      [
        { opacity: 0, transform: 'scale(1.6)' },
        { opacity: 1, transform: 'scale(0.95)', offset: 0.12 },
        { opacity: 1, transform: 'scale(1)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1)', offset: 0.85 },
        { opacity: 0, transform: 'scale(1) translateY(-20px)' },
      ],
      { duration: hold + 500, easing: 'ease-out', fill: 'forwards' },
    );
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.getAnimations().forEach((a) => a.cancel());
    this.toastEl.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 10px)' },
        { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 },
        { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.8 },
        { opacity: 0, transform: 'translate(-50%, -10px)' },
      ],
      { duration: 1500, fill: 'forwards' },
    );
  }

  flash(strength = 0.6, ms = 260, color = '#ffffff'): void {
    this.flashEl.style.background = color;
    this.flashEl.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }

  private hintText: string | null = null;
  private handOn = false;
  private handXY = '';

  hint(text: string | null): void {
    if (text === this.hintText) return;
    this.hintText = text;
    if (text) this.hintEl.textContent = text;
    this.hintEl.classList.toggle('on', !!text);
  }

  handAt(x: number | null, y = 0): void {
    const on = x !== null;
    if (on !== this.handOn) {
      this.handOn = on;
      this.hand.classList.toggle('on', on);
    }
    if (!on) return;
    const xy = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    if (xy !== this.handXY) {
      this.handXY = xy;
      this.hand.style.transform = xy;
    }
  }

  project(p: THREE.Vector3, cam: THREE.Camera): { x: number; y: number; ok: boolean } {
    _v.copy(p).project(cam);
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, ok: _v.z < 1 };
  }

  /** Damage numbers / reward popups (Web Animations, compositor-only). */
  float(x: number, y: number, text: string, cls = '', rise = 60, ms = 750): void {
    const f = this.floats[this.floatIdx];
    this.floatIdx = (this.floatIdx + 1) % this.floats.length;
    f.className = 'float stroke ' + cls;
    f.textContent = text;
    f.getAnimations().forEach((a) => a.cancel());
    const dx = (Math.random() - 0.5) * 30;
    f.animate(
      [
        { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(0.4)` },
        { opacity: 1, transform: `translate3d(${x + dx * 0.3}px, ${y - rise * 0.3}px, 0) translate(-50%, -50%) scale(1.15)`, offset: 0.18 },
        { opacity: 1, transform: `translate3d(${x + dx * 0.7}px, ${y - rise * 0.75}px, 0) translate(-50%, -50%) scale(1)`, offset: 0.7 },
        { opacity: 0, transform: `translate3d(${x + dx}px, ${y - rise}px, 0) translate(-50%, -50%) scale(0.9)` },
      ],
      { duration: ms, easing: 'ease-out', fill: 'forwards' },
    );
  }

  // ---- world-anchored pad labels ----
  label(id: string, html: string, key: string, x: number, y: number, visible: boolean, state: '' | 'cant' | 'ready', chip = false, center = false): void {
    let l = this.labels.get(id);
    if (!l) {
      const root = el('pad-label stroke');
      root.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.onLabelClick?.(id);
      });
      this.labelLayer.appendChild(root);
      l = { root, key: '', visible: true, xy: '' };
      this.labels.set(id, l);
    }
    if (visible !== l.visible) {
      l.visible = visible;
      l.root.style.display = visible ? '' : 'none';
    }
    if (!visible) return;
    if (l.key !== key + state) {
      l.key = key + state;
      l.root.innerHTML = html;
      l.root.className = `pad-label ${chip ? 'chip' : ''} ${state}`;
    }
    // keep wide labels inside the screen
    const half = chip ? 30 : 84;
    x = Math.min(this.w - half - 4, Math.max(half + 4, x));
    const xy = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, ${center ? '-50%' : '-100%'})`;
    if (xy !== l.xy) {
      l.xy = xy;
      l.root.style.transform = xy;
    }
  }

  serve(i: number, x: number, y: number, progress: number | null): void {
    const s = this.serveEls[i];
    const on = progress !== null;
    if (on !== s.on) {
      s.on = on;
      s.root.style.opacity = on ? '1' : '0';
    }
    if (!on) return;
    s.root.style.transform = `translate3d(${Math.round(x - 23)}px, ${Math.round(y - 23)}px, 0)`;
    s.fg.setAttribute('stroke-dashoffset', (113.1 * (1 - progress)).toFixed(1));
  }

  showEnd(stats: EndStats): void {
    this.endcard.querySelector('.s-boss')!.textContent = String(stats.bosses);
    this.endcard.querySelector('.s-coin')!.textContent = formatNum(stats.coins);
    this.endcard.querySelector('.s-lv')!.textContent = String(stats.level);
    this.endcard.classList.add('on');
  }

  hideEnd(): void {
    this.endcard.classList.remove('on');
  }

  get bossFrac(): number {
    return this.hpFrac;
  }
}
