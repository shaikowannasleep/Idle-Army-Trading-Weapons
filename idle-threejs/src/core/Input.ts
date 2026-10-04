/**
 * Tap-to-move input with waypoints support: tap anywhere on the ground plane
 * to calculate and follow an obstacle-avoiding path to that point.
 * Also keeps keyboard WASD/arrow support for desktop testing.
 */
import * as THREE from 'three';

export class Input {
  readonly move = { x: 0, y: 0 };
  active = false;

  /** Queue of world-space waypoints navigated by Pathfinder. */
  waypoints: THREE.Vector3[] = [];

  /** World-space destination the player is currently walking toward, or null if none. */
  destination: THREE.Vector3 | null = null;

  /** Set by Game.ts each frame so Input can project taps into world space. */
  camera: THREE.Camera | null = null;

  /** Callback invoked when user taps the ground, allowing Game to run Pathfinder. */
  onTapGround: ((groundPos: THREE.Vector3) => void) | null = null;

  enabled = true;
  onDown: () => void = () => {};
  onUp: (isDrag: boolean) => void = () => {};

  // For clearing the tap-ripple marker from the DOM
  private rippleEl: HTMLDivElement | null = null;
  private rippleTimer = 0;

  // Keyboard state for desktop
  private keys = new Set<string>();
  private keyboardActive = false;

  // Internal raycasting helpers
  private readonly _ndc = new THREE.Vector2();
  private readonly _ray = new THREE.Raycaster();
  private readonly _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly _hit = new THREE.Vector3();

  constructor(surface: HTMLElement, layer: HTMLElement) {
    // Create a persistent ripple div (reused, never re-created in the loop)
    const ripple = document.createElement('div');
    ripple.className = 'tap-target';
    layer.appendChild(ripple);
    this.rippleEl = ripple;

    surface.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);

    // Keyboard for desktop testing
    const sync = () => {
      const x = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0)
              - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
      const y = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0)
              - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
      const l = Math.hypot(x, y) || 1;
      if (x !== 0 || y !== 0) {
        this.move.x = x / l;
        this.move.y = y / l;
        this.active = true;
        this.destination = null;
        this.waypoints = [];
        this.keyboardActive = true;
      } else {
        if (this.keyboardActive) {
          this.move.x = this.move.y = 0;
          this.active = this.waypoints.length > 0 || !!this.destination;
          this.keyboardActive = false;
        }
      }
    };
    window.addEventListener('keydown', (e) => { this.keys.add(e.key.toLowerCase()); sync(); });
    window.addEventListener('keyup',   (e) => { this.keys.delete(e.key.toLowerCase()); sync(); });
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.onDown();
    this.setDestinationFromPointer(e.clientX, e.clientY);
    this.showRipple(e.clientX, e.clientY);
  };

  private up = (_e: PointerEvent): void => {
    this.onUp(true);
  };

  /** Set new waypoints calculated by Pathfinder. */
  setWaypoints(wps: THREE.Vector3[]): void {
    this.waypoints = wps.map((w) => w.clone());
    if (this.waypoints.length > 0) {
      this.destination = this.waypoints[0];
      this.active = true;
    } else {
      this.destination = null;
      this.active = false;
    }
  }

  /** Project pointer position onto y=0 ground plane and dispatch to pathfinder. */
  private setDestinationFromPointer(clientX: number, clientY: number): void {
    if (!this.camera) return;

    // Convert to NDC [-1,1]
    this._ndc.set(
      (clientX / window.innerWidth)  * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this._ray.setFromCamera(this._ndc, this.camera);
    if (this._ray.ray.intersectPlane(this._ground, this._hit)) {
      if (this.onTapGround) {
        this.onTapGround(this._hit.clone());
      } else {
        this.setWaypoints([this._hit.clone()]);
      }
    }
  }

  /**
   * Called every game frame by Game.ts.
   * Updates move vector toward the current waypoint and shifts waypoints upon arrival.
   */
  tick(playerPos: THREE.Vector3, arrivalRadius = 0.4): void {
    // Keyboard takes over when keys are held
    if (this.keyboardActive) return;

    if (this.waypoints.length === 0 && !this.destination) {
      this.move.x = this.move.y = 0;
      this.active = false;
      return;
    }

    if (!this.destination && this.waypoints.length > 0) {
      this.destination = this.waypoints[0];
    }

    if (!this.destination) return;

    const dx = this.destination.x - playerPos.x;
    const dz = this.destination.z - playerPos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < arrivalRadius) {
      // Arrived at current waypoint
      this.waypoints.shift();
      if (this.waypoints.length > 0) {
        this.destination = this.waypoints[0];
      } else {
        // Final destination reached
        this.destination = null;
        this.move.x = this.move.y = 0;
        this.active = false;
        return;
      }
    }

    const curDx = this.destination.x - playerPos.x;
    const curDz = this.destination.z - playerPos.z;
    const curDist = Math.hypot(curDx, curDz) || 1;

    this.move.x = curDx / curDist;
    this.move.y = curDz / curDist;
    this.active = true;
  }

  /** Show a brief ripple/dot at the screen tap position. */
  showRipple(clientX: number, clientY: number): void {
    if (!this.rippleEl) return;
    clearTimeout(this.rippleTimer);
    this.rippleEl.style.transform = `translate(${clientX}px,${clientY}px)`;
    this.rippleEl.classList.add('on');
    this.rippleTimer = window.setTimeout(() => {
      if (this.rippleEl) this.rippleEl.classList.remove('on');
    }, 600);
  }

  reset(): void {
    this.waypoints = [];
    this.destination = null;
    this.move.x = this.move.y = 0;
    this.active = false;
    if (this.rippleEl) this.rippleEl.classList.remove('on');
  }
}
