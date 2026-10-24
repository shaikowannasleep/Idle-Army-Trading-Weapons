import * as THREE from 'three';
import { COIN_IMG } from '../ui/Hud';

export const h = (cls: string, html = '', tag = 'div'): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
};

const _v = new THREE.Vector3();

export interface Card {
  id: string;
  icon: string;
  title: string;
  desc: string;
  level?: number;
  /** image URL shown instead of the svg icon */
  art?: string;
}

export interface EndOpts {
  win: boolean;
  title: string;
  sub: string;
  stats: [string, string][];
  next?: boolean;
}

/** Shared DOM overlay for the arcade modes. All per-frame updates are transform/text only. */
export class ArcadeHud {
  readonly root: HTMLElement;
  /** Mode-owned controls (cleared on every mode switch). */
  readonly modeLayer: HTMLElement;
  private top: HTMLElement;
  private titleEl: HTMLElement;
  private stats: HTMLElement;
  private statEls = new Map<string, HTMLElement>();
  private statText = new Map<string, string>();
  private prog: HTMLElement;
  private progFill: HTMLElement;
  private progLabel: HTMLElement;
  private boss: HTMLElement;
  private bossFill: HTMLElement;
  private bossName: HTMLElement;
  private floatLayer: HTMLElement;
  private floats: HTMLElement[] = [];
  private floatIdx = 0;
  private bannerEl: HTMLElement;
  private flashEl: HTMLElement;
  private vignette: HTMLElement;
  private hintEl: HTMLElement;
  private tutEl: HTMLElement;
  private lastSpot = '';
  private endEl: HTMLElement;
  private cardsEl: HTMLElement;
  private joy: HTMLElement;
  private joyKnob: HTMLElement;
  private lastProg = -1;
  private lastBoss = -1;
  private lastHint: string | null = null;
  private lastVig = -1;
  w = 1;
  h = 1;
  onMenu: () => void = () => {};
  onRetry: () => void = () => {};
  onNext: () => void = () => {};
  onCta: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = h('arc');
    root.append(this.root);
    this.vignette = h('vignette');
    this.floatLayer = h('layer');
    this.modeLayer = h('layer arc-mode');
    this.top = h('arc-top');
    const back = h('arc-back stroke', '&#9776;', 'button');
    back.addEventListener('click', () => this.onMenu());
    this.titleEl = h('arc-title stroke');
    this.stats = h('arc-stats');
    this.top.append(back, this.titleEl, this.stats);
    this.prog = h('arc-prog', `<div class="fill"></div><span class="stroke"></span>`);
    this.progFill = this.prog.querySelector('.fill')!;
    this.progLabel = this.prog.querySelector('span')!;
    this.boss = h('arc-boss', `<span class="name stroke"></span><div class="bar"><div class="fill"></div></div>`);
    this.bossName = this.boss.querySelector('.name')!;
    this.bossFill = this.boss.querySelector('.fill')!;
    for (let i = 0; i < 28; i++) {
      const f = h('float stroke');
      this.floats.push(f);
      this.floatLayer.append(f);
    }
    this.bannerEl = h('banner stroke', '<h1></h1><p></p>');
    this.flashEl = h('flash');
    this.hintEl = h('hint stroke');
    this.endEl = h('arc-end');
    this.cardsEl = h('arc-cards');
    this.joy = h('arc-joy', '<i></i>');
    this.joyKnob = this.joy.querySelector('i')!;
    this.tutEl = h('arc-tut', '<div class="hole"></div><div class="hand">👆</div><div class="tip stroke"></div>');
    this.root.append(this.vignette, this.modeLayer, this.floatLayer, this.joy, this.top, this.prog, this.boss, this.bannerEl, this.hintEl, this.tutEl, this.cardsEl, this.endEl, this.flashEl);
    this.setVisible(false);
  }

  resize(w: number, hgt: number): void {
    this.w = w;
    this.h = hgt;
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  /** Reset everything a mode may have touched. */
  begin(title: string, stats: [string, string][], theme = ''): void {
    this.setVisible(true);
    this.root.dataset.theme = theme;
    this.modeLayer.innerHTML = '';
    this.titleEl.textContent = title;
    this.stats.innerHTML = '';
    this.statEls.clear();
    this.statText.clear();
    for (const [id, icon] of stats) {
      const p = h(`pill arc-pill ${id}`, `${icon === 'coin' ? `<img src="${COIN_IMG}" alt="">` : `<b>${icon}</b>`}<span class="stroke">0</span>`);
      this.stats.append(p);
      this.statEls.set(id, p.querySelector('span')!);
    }
    this.progress(null);
    this.bossBar(null);
    this.hint(null);
    this.spot(null);
    this.joystick(null);
    this.danger(0);
    this.endEl.classList.remove('on');
    this.cardsEl.classList.remove('on');
  }

  stat(id: string, text: string): void {
    if (this.statText.get(id) === text) return;
    this.statText.set(id, text);
    const e = this.statEls.get(id);
    if (e) e.textContent = text;
  }

  bump(id: string): void {
    this.statEls.get(id)?.parentElement?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  progress(frac: number | null, label = ''): void {
    this.prog.style.display = frac === null ? 'none' : '';
    if (frac === null) return;
    const q = Math.round(frac * 400) / 400;
    if (q !== this.lastProg) {
      this.lastProg = q;
      this.progFill.style.transform = `scaleX(${q})`;
    }
    if (this.progLabel.textContent !== label) this.progLabel.textContent = label;
  }

  bossBar(frac: number | null, name = ''): void {
    this.boss.classList.toggle('on', frac !== null);
    if (frac === null) return;
    if (this.bossName.textContent !== name) this.bossName.textContent = name;
    const q = Math.round(Math.max(0, frac) * 300) / 300;
    if (q !== this.lastBoss) {
      this.lastBoss = q;
      this.bossFill.style.transform = `scaleX(${q})`;
    }
  }

  danger(k: number): void {
    const q = Math.round(k * 20) / 20;
    if (q === this.lastVig) return;
    this.lastVig = q;
    this.vignette.style.opacity = String(q);
  }

  project(p: THREE.Vector3, cam: THREE.Camera): { x: number; y: number } {
    _v.copy(p).project(cam);
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h };
  }

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

  banner(title: string, sub = '', color = '#ffffff', hold = 1400): void {
    this.bannerEl.querySelector('h1')!.textContent = title;
    (this.bannerEl.querySelector('h1') as HTMLElement).style.color = color;
    this.bannerEl.querySelector('p')!.textContent = sub;
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

  flash(strength = 0.6, ms = 260, color = '#ffffff'): void {
    this.flashEl.style.background = color;
    this.flashEl.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }

  hint(text: string | null): void {
    if (text === this.lastHint) return;
    this.lastHint = text;
    if (text) this.hintEl.textContent = text;
    this.hintEl.classList.toggle('on', !!text);
  }

  /**
   * Tutorial spotlight: dims the screen except a circle of radius r at (x,y) px, with a caption and a tapping hand
   * (or a hand dragging by `drag` px). Input passes through, so the player does the real action. null hides it.
   */
  spot(o: { x: number; y: number; r: number; text: string; drag?: [number, number] } | null): void {
    this.tutEl.classList.toggle('on', !!o);
    if (!o) return;
    const st = this.tutEl.style;
    st.setProperty('--x', `${o.x}px`);
    st.setProperty('--y', `${o.y}px`);
    st.setProperty('--r', `${o.r}px`);
    const key = `${o.text}|${o.drag ?? ''}|${o.y > this.h * 0.55}`;
    if (key === this.lastSpot) return;
    this.lastSpot = key;
    this.tutEl.querySelector('.tip')!.textContent = o.text;
    this.tutEl.classList.toggle('above', o.y > this.h * 0.55);
    this.tutEl.classList.toggle('drag', !!o.drag);
    st.setProperty('--dx', `${o.drag?.[0] ?? 0}px`);
    st.setProperty('--dy', `${o.drag?.[1] ?? 0}px`);
  }

  /** Floating joystick: base at (bx,by), knob offset (kx,ky) in px; null hides it. */
  joystick(base: { x: number; y: number } | null, kx = 0, ky = 0): void {
    this.joy.classList.toggle('on', !!base);
    if (!base) return;
    this.joy.style.transform = `translate3d(${base.x}px, ${base.y}px, 0)`;
    this.joyKnob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
  }

  cards(list: Card[], onPick: (c: Card) => void, heading = 'LEVEL UP!'): void {
    this.cardsEl.innerHTML = `<h2 class="stroke">${heading}</h2>`;
    const row = h('row');
    for (const c of list) {
      const b = h('arc-card', `<div class="ic">${c.art ? `<img src="${c.art}" alt="">` : c.icon}</div><b class="stroke">${c.title}</b><small>${c.desc}</small>${c.level ? `<em>Lv.${c.level}</em>` : ''}`, 'button');
      b.dataset.id = c.id;
      b.addEventListener('click', () => {
        this.cardsEl.classList.remove('on');
        onPick(c);
      });
      row.append(b);
    }
    this.cardsEl.append(row);
    this.cardsEl.classList.add('on');
  }

  get cardsOpen(): boolean {
    return this.cardsEl.classList.contains('on');
  }

  end(o: EndOpts): void {
    this.endEl.innerHTML = `<div class="panel ${o.win ? 'win' : 'lose'}">
      <h1 class="stroke">${o.title}</h1><p>${o.sub}</p>
      <ul>${o.stats.map(([k, v]) => `<li><span>${k}</span><b class="stroke">${v}</b></li>`).join('')}</ul>
      <div class="btns">
        ${o.next ? '<button class="btn go stroke" data-a="next">NEXT LEVEL</button>' : ''}
        <button class="btn ${o.next ? '' : 'go'} stroke" data-a="retry">${o.win ? 'REPLAY' : 'TRY AGAIN'}</button>
        <button class="btn stroke" data-a="menu">MENU</button>
      </div>
      <button class="btn cta stroke" data-a="cta">PLAY FULL GAME</button></div>`;
    this.endEl.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = (b as HTMLElement).dataset.a;
        if (a === 'next') this.onNext();
        else if (a === 'retry') this.onRetry();
        else if (a === 'menu') this.onMenu();
        else this.onCta();
      }),
    );
    this.endEl.classList.add('on');
  }

  get endOpen(): boolean {
    return this.endEl.classList.contains('on');
  }

  hideEnd(): void {
    this.endEl.classList.remove('on');
  }
}

/** Tiny inline icons (no emoji: fonts differ across ad webviews). */
export const ICON = {
  army: `<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="3.2" fill="#9fd4ff"/><circle cx="16" cy="7" r="3.2" fill="#9fd4ff"/><path d="M2 20c0-5 3-8 6-8s6 3 6 8zM10 20c0-5 3-8 6-8s6 3 6 8z" fill="#4da3ff"/></svg>`,
  skull: `<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 3 5.8 3 10.5c0 2.7 1.3 4.6 3 5.7V20h12v-3.8c1.7-1.1 3-3 3-5.7C21 5.8 17.5 2 12 2z" fill="#f2efe6"/><circle cx="8.5" cy="11" r="2.3" fill="#10161b"/><circle cx="15.5" cy="11" r="2.3" fill="#10161b"/><path d="M10 17h1v3h-1zM13 17h1v3h-1z" fill="#10161b"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#10161b" stroke-width="2"/><path d="M12 6v6l4 3" stroke="#10161b" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="#ff4d6d"/></svg>`,
  flag: `<svg viewBox="0 0 24 24"><path d="M5 2v20" stroke="#ddd" stroke-width="2.4"/><path d="M6 3h13l-3 4.5 3 4.5H6z" fill="#ff7a3d"/></svg>`,
  gem: `<svg viewBox="0 0 24 24"><path d="M12 2l8 8-8 12-8-12z" fill="#5ee7ff" stroke="#fff" stroke-width="1.2"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#ffe14d"/></svg>`,
  blade: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#ffb35c"/><path d="M12 1l2 8h-4zM12 23l-2-8h4zM1 12l8-2v4zM23 12l-8 2v-4z" fill="#ffd8a8"/></svg>`,
  nova: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#c58bff" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="#e5ccff"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24"><path d="M14 3c4 0 7 3 7 7l-8 8-7-7z" fill="#d58bff"/><path d="M6 11l-4 2 3 2zM13 18l-2 4-2-3z" fill="#ff7a3d"/></svg>`,
  boot: `<svg viewBox="0 0 24 24"><path d="M7 3h6v9l7 3v5H4V15l3-2z" fill="#7dff9a"/></svg>`,
  magnet: `<svg viewBox="0 0 24 24"><path d="M5 3h4v9a3 3 0 0 0 6 0V3h4v9a7 7 0 0 1-14 0z" fill="#ff5c5c"/><path d="M5 3h4v3H5zM15 3h4v3h-4z" fill="#eee"/></svg>`,
  sword: `<svg viewBox="0 0 24 24"><path d="M19 2l3 3-11 11-3-3z" fill="#e6eef5"/><path d="M5 14l5 5-2 2-1.5-1.5L4 22l-2-2 2.5-2.5L3 16z" fill="#c9a043"/></svg>`,
};
