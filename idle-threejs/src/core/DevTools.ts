import type { Engine } from './Engine';
import type { Game } from '../game/Game';

/**
 * Three.js In-Game Developer & QA Automation Overlay
 * Toggle via '~' (Backquote) key or URL parameter '?debug=1'
 */
export class DevTools {
  private panel: HTMLElement | null = null;
  private visible = false;
  private timeScale = 1;

  constructor(
    private engine: Engine,
    private game: Game,
  ) {
    const isDebugUrl = new URLSearchParams(window.location.search).get('debug') === '1';
    if (isDebugUrl) {
      this.init();
      this.show();
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        if (!this.panel) this.init();
        this.toggle();
      }
    });
  }

  private init(): void {
    if (this.panel) return;
    this.panel = document.createElement('div');
    this.panel.id = 'threejs-devtools-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      width: 260px;
      padding: 12px;
      background: rgba(18, 22, 28, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: #e0e6ed;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      z-index: 999999;
      pointer-events: auto;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      display: none;
    `;

    this.panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #333; padding-bottom:6px;">
        <b style="color:#ffd34d; font-size:12px;">🛠️ THREE.JS DEVTOOLS</b>
        <span id="dt-fps" style="color:#7dff9a; font-weight:bold;">60 FPS</span>
      </div>
      <div id="dt-stats" style="line-height:1.6; margin-bottom:10px; color:#a0aec0;">
        Calls: 0 | Tris: 0<br>
        Geos: 0 | Textures: 0
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
        <button id="dt-add-coins" style="background:#2a4365; color:#90cdf4; border:none; border-radius:4px; padding:6px; cursor:pointer;">+100K 🪙</button>
        <button id="dt-add-gems" style="background:#44337a; color:#d6bcfa; border:none; border-radius:4px; padding:6px; cursor:pointer;">+1K 💎</button>
        <button id="dt-kill-boss" style="background:#742a2a; color:#feb2b2; border:none; border-radius:4px; padding:6px; cursor:pointer;">⚡ Kill Boss</button>
        <button id="dt-speed" style="background:#234e52; color:#81e6d9; border:none; border-radius:4px; padding:6px; cursor:pointer;">⏩ Speed: 1x</button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <button id="dt-prev-stage" style="background:#2d3748; color:#cbd5e0; border:none; border-radius:4px; padding:6px; cursor:pointer;">◀ Prev Stage</button>
        <button id="dt-next-stage" style="background:#2d3748; color:#cbd5e0; border:none; border-radius:4px; padding:6px; cursor:pointer;">Next Stage ▶</button>
        <button id="dt-god-mode" style="background:#744210; color:#f6e05e; border:none; border-radius:4px; padding:6px; cursor:pointer;">👑 God Mode</button>
        <button id="dt-stage-40" style="background:#702459; color:#fbb6ce; border:none; border-radius:4px; padding:6px; cursor:pointer;">🔥 Stage 40</button>
      </div>
    `;

    document.body.appendChild(this.panel);

    // Event listeners
    this.panel.querySelector('#dt-add-coins')?.addEventListener('click', () => {
      this.game.coins += 100000;
    });

    this.panel.querySelector('#dt-add-gems')?.addEventListener('click', () => {
      this.game.gems += 1000;
    });

    this.panel.querySelector('#dt-kill-boss')?.addEventListener('click', () => {
      // @ts-expect-error Access private debug hook
      this.game.hitBoss?.(9999999, true, this.engine.camera.position);
    });

    this.panel.querySelector('#dt-prev-stage')?.addEventListener('click', () => {
      if (this.game.currentStage > 1) {
        this.game.startStage(this.game.currentStage - 1, false);
      }
    });

    this.panel.querySelector('#dt-next-stage')?.addEventListener('click', () => {
      if (this.game.currentStage < 40) {
        this.game.startStage(this.game.currentStage + 1, false);
      }
    });

    this.panel.querySelector('#dt-god-mode')?.addEventListener('click', () => {
      this.game.initMode('infinite');
    });

    this.panel.querySelector('#dt-stage-40')?.addEventListener('click', () => {
      this.game.startStage(40, false);
    });

    const speedBtn = this.panel.querySelector('#dt-speed') as HTMLButtonElement | null;
    speedBtn?.addEventListener('click', () => {
      if (this.timeScale === 1) this.timeScale = 2;
      else if (this.timeScale === 2) this.timeScale = 5;
      else this.timeScale = 1;
      speedBtn.textContent = `⏩ Speed: ${this.timeScale}x`;
    });

    // Stats loop
    setInterval(() => {
      if (!this.visible || !this.panel) return;
      const r = this.engine.renderer;
      const fps = Math.round(1000 / Math.max(1, this.engine.frameMs));
      const fpsEl = this.panel.querySelector('#dt-fps');
      if (fpsEl) fpsEl.textContent = `${fps} FPS`;

      const statsEl = this.panel.querySelector('#dt-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          Draw Calls: <b style="color:#fff">${r.info.render.calls}</b> | Tris: <b style="color:#fff">${r.info.render.triangles.toLocaleString()}</b><br>
          Geometries: <b style="color:#fff">${r.info.memory.geometries}</b> | Textures: <b style="color:#fff">${r.info.memory.textures}</b>
        `;
      }
    }, 250);
  }

  show(): void {
    if (!this.panel) this.init();
    if (this.panel) this.panel.style.display = 'block';
    this.visible = true;
  }

  hide(): void {
    if (this.panel) this.panel.style.display = 'none';
    this.visible = false;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }
}
