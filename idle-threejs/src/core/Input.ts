/**
 * Floating virtual joystick: press anywhere, drag to steer. Also reports taps.
 * Movement vector is in screen space (x right, y down), length 0..1.
 */
export class Input {
  readonly move = { x: 0, y: 0 };
  active = false;
  private id = -1;
  private ox = 0;
  private oy = 0;
  private downT = 0;
  private travelled = 0;
  private readonly radius = 56;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  enabled = true;
  onDown: () => void = () => {};
  /** isDrag = the gesture actually steered the character */
  onUp: (isDrag: boolean) => void = () => {};

  constructor(surface: HTMLElement, layer: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    layer.appendChild(this.base);

    surface.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.moveH, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    // keyboard for desktop testing
    const keys = new Set<string>();
    const sync = () => {
      if (this.id !== -1) return;
      const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      const l = Math.hypot(x, y) || 1;
      this.move.x = x / l;
      this.move.y = y / l;
      this.active = x !== 0 || y !== 0;
    };
    window.addEventListener('keydown', (e) => {
      keys.add(e.key.toLowerCase());
      sync();
    });
    window.addEventListener('keyup', (e) => {
      keys.delete(e.key.toLowerCase());
      sync();
    });
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled || this.id !== -1) return;
    e.preventDefault();
    this.id = e.pointerId;
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.downT = performance.now();
    this.travelled = 0;
    this.base.style.transform = `translate3d(${this.ox}px, ${this.oy}px, 0)`;
    this.knob.style.transform = 'translate3d(0,0,0)';
    this.base.classList.add('on');
    this.onDown();
  };

  private moveH = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    e.preventDefault();
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    this.travelled = Math.max(this.travelled, d);
    if (d > this.radius) {
      // drag the base along so direction changes stay responsive
      this.ox += (dx / d) * (d - this.radius);
      this.oy += (dy / d) * (d - this.radius);
      dx = e.clientX - this.ox;
      dy = e.clientY - this.oy;
      this.base.style.transform = `translate3d(${this.ox}px, ${this.oy}px, 0)`;
    }
    const k = Math.min(1, Math.hypot(dx, dy) / this.radius);
    const l = Math.hypot(dx, dy) || 1;
    // small dead zone
    const mag = k < 0.12 ? 0 : (k - 0.12) / 0.88;
    this.move.x = (dx / l) * mag;
    this.move.y = (dy / l) * mag;
    this.active = mag > 0;
    this.knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    this.id = -1;
    this.move.x = this.move.y = 0;
    this.active = false;
    this.base.classList.remove('on');
    this.onUp(this.travelled > 14 || performance.now() - this.downT > 350);
  };

  reset(): void {
    this.id = -1;
    this.move.x = this.move.y = 0;
    this.active = false;
    this.base.classList.remove('on');
  }
}
