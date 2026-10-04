import * as THREE from 'three';

/**
 * Renderer + frame loop tuned for low device heat:
 *  - frame cap at 60 fps (120 Hz panels render every other vsync),
 *  - adaptive pixel ratio (drops toward 1x if frames run long, climbs back when stable),
 *  - full stop while the tab is hidden.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 140);

  /** URL quality overrides (?dpr=1&shadows=0&aa=0) for low-end devices / profiling. */
  static readonly params = new URLSearchParams(location.search);
  private readonly maxDpr = Math.min(window.devicePixelRatio || 1, Number(Engine.params.get('dpr') ?? 2));
  private dpr = this.maxDpr;
  private last = 0;
  private slowTime = 0;
  private fastTime = 0;
  private running = false;
  private hidden = false;
  private raf = 0;
  private frame = 0;
  private update: (dt: number) => void = () => {};
  /** Smoothed frame interval in ms (for the debug overlay / perf harness). */
  frameMs = 16.7;
  onResize: (w: number, h: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // MSAA only below 2x density: retina panels are already crisp and a 4x MSAA
      // framebuffer at 2x costs ~25 MB of memory (?aa=1 forces it on, ?aa=0 off)
      antialias: Engine.params.has('aa') ? Engine.params.get('aa') === '1' : (window.devicePixelRatio || 1) < 1.9,
      powerPreference: 'default',
      stencil: false,
      depth: true,
      alpha: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = Engine.params.get('shadows') !== '0';
    r.shadowMap.type = THREE.PCFShadowMap;
    // shadows refresh at 30 Hz: halves the shadow pass draw calls, imperceptible at this camera distance
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    r.setPixelRatio(this.dpr);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize(w, h);
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!hidden && this.running) {
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  start(update: (dt: number) => void): void {
    this.update = update;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    if (this.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
    const elapsed = now - this.last;
    // 60 fps cap with ~2ms tolerance for vsync jitter.
    if (elapsed < 14.6) return;
    this.last = now;
    this.frameMs += (elapsed - this.frameMs) * 0.08;
    this.adaptResolution(elapsed);
    const dt = Math.min(elapsed / 1000, 1 / 20);
    this.update(dt);
    if ((this.frame++ & 1) === 0) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  };

  private adaptResolution(elapsed: number): void {
    if (elapsed > 21) {
      this.slowTime += elapsed;
      this.fastTime = 0;
    } else {
      this.fastTime += elapsed;
      this.slowTime = Math.max(0, this.slowTime - elapsed * 0.5);
    }
    if (this.slowTime > 900 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.resize();
      this.slowTime = 0;
    } else if (this.fastTime > 4000 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.resize();
      this.fastTime = 0;
    }
  }

  get pixelRatio(): number {
    return this.dpr;
  }
}
