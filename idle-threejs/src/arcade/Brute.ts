import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Actor } from '../game/Actors';
import { clamp, easeOutBack } from '../core/math';

export type BruteState = 'hidden' | 'spawn' | 'idle' | 'leap' | 'attack' | 'dying' | 'dead';
const ATTACKS = ['Attack 1', 'Attack 2', 'Attack 3', 'Attack 4'];

/**
 * Arcade boss built on boss.glb. The rig has no walk cycle, so it closes distance with
 * 'Jump forward' leaps and slams with one of four attacks once in reach.
 */
export class Brute extends Actor {
  state: BruteState = 'hidden';
  hp = 1;
  maxHp = 1;
  scale = 1;
  /** Seconds between attacks once in reach. */
  attackGap = 2.2;
  /** Leap length in world units at scale 1. */
  leapLen = 3.4;
  private st = 0;
  private dur = 0;
  private impactAt = 0;
  private impactDone = false;
  private leapFrom = new THREE.Vector3();
  private leapTo = new THREE.Vector3();
  private cd = 0;
  private flashK = 0;
  private mat: THREE.MeshStandardMaterial;
  onSlam: (at: THREE.Vector3) => void = () => {};
  onDead: () => void = () => {};

  constructor(gltf: GLTF) {
    super(gltf);
    let mat: THREE.MeshStandardMaterial | null = null;
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      mat ??= (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
    });
    this.mat = mat!;
    this.mat.emissive = new THREE.Color('#ff3010');
    this.mat.emissiveIntensity = 0;
    this.root.visible = false;
  }

  get alive(): boolean {
    return this.state !== 'hidden' && this.state !== 'dying' && this.state !== 'dead';
  }
  get reach(): number {
    return 3.0 * this.scale;
  }

  spawn(at: THREE.Vector3, yaw: number, scale: number, hp: number, tint = '#ffffff'): void {
    this.root.position.copy(at);
    this.yaw = this.targetYaw = yaw;
    this.scale = scale;
    this.hp = this.maxHp = hp;
    this.mat.color.set(tint);
    this.root.visible = true;
    this.root.rotation.x = 0;
    this.state = 'spawn';
    this.st = 0;
    this.dur = this.clipDuration('Spawn');
    this.cd = 1;
    this.play('Spawn', 0, false);
  }

  hide(): void {
    this.state = 'hidden';
    this.root.visible = false;
  }

  damage(n: number): boolean {
    if (!this.alive || this.state === 'spawn') return false;
    this.hp -= n;
    this.flashK = Math.min(1, this.flashK + 0.25);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.st = 0;
      this.dur = this.clipDuration('Die') / 1.1;
      this.play('Die', 0.1, false, 1.1);
      return true;
    }
    return false;
  }

  /** World-space point on the torso. */
  centre(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, 2.0 * this.scale, this.root.position.z);
  }

  update(dt: number, target: THREE.Vector3 | null): void {
    if (this.state === 'hidden' || this.state === 'dead') return;
    this.st += dt;
    const p = this.root.position;
    switch (this.state) {
      case 'spawn':
        this.root.scale.setScalar(this.scale * easeOutBack(clamp(this.st / 0.5, 0, 1)));
        if (this.st >= this.dur) this.toIdle();
        break;
      case 'idle':
        this.cd -= dt;
        if (target) {
          this.targetYaw = Math.atan2(target.x - p.x, target.z - p.z);
          const d = Math.hypot(target.x - p.x, target.z - p.z);
          if (d > this.reach && this.cd <= 0) this.leap(target, d);
          else if (d <= this.reach && this.cd <= 0) this.attack();
        }
        break;
      case 'leap': {
        // airborne between 20% and 70% of the clip; ease the translation over that window
        const k = clamp((this.st / this.dur - 0.2) / 0.5, 0, 1);
        const e = k * k * (3 - 2 * k);
        p.lerpVectors(this.leapFrom, this.leapTo, e);
        if (this.st >= this.dur) this.toIdle(0.15);
        break;
      }
      case 'attack':
        if (!this.impactDone && this.st >= this.impactAt) {
          this.impactDone = true;
          const s = Math.sin(this.yaw);
          const c = Math.cos(this.yaw);
          this.onSlam(new THREE.Vector3(p.x + s * this.reach * 0.75, 0, p.z + c * this.reach * 0.75));
        }
        if (this.st >= this.dur) this.toIdle(this.attackGap);
        break;
      case 'dying':
        if (this.st >= this.dur + 0.4) {
          const k = clamp((this.st - this.dur - 0.4) / 1.2, 0, 1);
          p.y = -k * 3 * this.scale;
          if (k >= 1) {
            this.state = 'dead';
            this.root.visible = false;
            this.onDead();
          }
        }
        break;
    }
    this.flashK = Math.max(0, this.flashK - dt * 4);
    this.mat.emissiveIntensity = this.flashK * 1.6;
    this.updateAnim(dt);
  }

  private toIdle(cd = 0.35): void {
    this.state = 'idle';
    this.st = 0;
    this.cd = cd;
    this.play('Idle', 0.2);
  }

  private leap(target: THREE.Vector3, d: number): void {
    this.state = 'leap';
    this.st = 0;
    this.dur = this.clipDuration('Jump forward');
    this.leapFrom.copy(this.root.position);
    const len = Math.min(this.leapLen * this.scale, d - this.reach * 0.8);
    this.leapTo.set(target.x - this.root.position.x, 0, target.z - this.root.position.z).normalize().multiplyScalar(len).add(this.root.position);
    this.leapTo.y = 0;
    this.play('Jump forward', 0.1, false);
  }

  private attack(): void {
    const name = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    this.state = 'attack';
    this.st = 0;
    this.dur = this.clipDuration(name);
    this.impactAt = this.dur * 0.5;
    this.impactDone = false;
    this.play(name, 0.12, false);
  }
}
