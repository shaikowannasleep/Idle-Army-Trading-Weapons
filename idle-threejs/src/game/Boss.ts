import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Actor } from './Actors';
import { BOSS_HOME, BOSS_LUNGE } from './layout';
import { clamp, damp, easeOutBack, lerp, rand } from '../core/math';

export type BossState = 'hidden' | 'spawn' | 'idle' | 'attack' | 'evolve' | 'dying' | 'sinking';

const BASE_SCALE = 0.82;
const ATTACKS = ['Attack 1', 'Attack 2', 'Attack 3', 'Attack 4'];

const C_TINT_LOW = new THREE.Color('#ffffff');
const C_TINT_HIGH = new THREE.Color('#ff7a6a');
const C_EMI_LOW = new THREE.Color('#3b1670');
const C_EMI_HIGH = new THREE.Color('#ff2410');
const WHITE = new THREE.Color(1, 1, 1);

/** Boss stats per evolution level. */
export function bossMaxHp(level: number): number {
  return Math.round(260 * Math.pow(1.7, level - 1));
}
export function bossWallDamage(level: number): number {
  return 2 + 1.2 * Math.pow(level, 1.5);
}
export function bossAttackInterval(level: number): number {
  return Math.max(2.0, 5 - 0.32 * level);
}

export class Boss extends Actor {
  state: BossState = 'hidden';
  level = 1;
  hp = 1;
  maxHp = 1;
  displayScale = BASE_SCALE;
  private targetScale = BASE_SCALE;
  private stateT = 0;
  private stateDur = 0;
  private impactAt = 0;
  private impactDone = false;
  private lunge = 0;
  private flash = 0;
  private mat!: THREE.MeshStandardMaterial;
  private tint = new THREE.Color();
  private emissive = new THREE.Color();
  private onImpact: (() => void) | null = null;
  private onBurst: (() => void) | null = null;
  private onDone: (() => void) | null = null;
  attackTimer = 3;
  /** 0..1 aura heat used for embers / light */
  heat = 0;
  apex = false;

  constructor(gltf: GLTF) {
    super(gltf);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; // the boss keeps a real shadow-map shadow
        this.mat = (m.material as THREE.MeshStandardMaterial).clone();
        m.material = this.mat;
      }
    });
    this.mat ??= new THREE.MeshStandardMaterial();
    this.root.visible = false;
  }

  get alive(): boolean {
    return this.state === 'idle' || this.state === 'attack' || this.state === 'evolve' || this.state === 'spawn';
  }
  get targetable(): boolean {
    return this.state === 'idle' || this.state === 'attack' || this.state === 'evolve';
  }

  scaleFor(level: number): number {
    return BASE_SCALE * Math.min(1.85, 1 + 0.075 * (level - 1)) * (this.apex ? 1.15 : 1);
  }

  spawn(level: number): void {
    this.level = level;
    this.maxHp = bossMaxHp(level);
    this.hp = this.maxHp;
    this.root.visible = true;
    this.root.position.copy(BOSS_HOME);
    this.yaw = this.targetYaw = 0;
    this.targetScale = this.scaleFor(level);
    this.displayScale = 0.01;
    this.lunge = 0;
    this.state = 'spawn';
    this.stateT = 0;
    this.stateDur = this.clipDuration('Spawn');
    this.play('Spawn', 0.05, false);
    this.attackTimer = 2.4;
    this.applyLook();
  }

  /** Grow stronger; keeps HP ratio but adds a partial heal. */
  evolve(newLevel: number, heal = 0.35): void {
    const ratio = this.hp / this.maxHp;
    this.level = newLevel;
    this.maxHp = bossMaxHp(newLevel);
    this.hp = Math.min(this.maxHp, this.maxHp * Math.min(1, ratio + heal));
    this.targetScale = this.scaleFor(newLevel);
    this.applyLook();
    if (this.state === 'idle' || this.state === 'attack') {
      this.state = 'evolve';
      this.stateT = 0;
      this.stateDur = this.clipDuration('Combo') * 0.75;
      this.lunge = 0;
      this.play('Combo', 0.12, false, 1.15);
    }
  }

  attack(onImpact: () => void): void {
    if (this.state !== 'idle') return;
    const name = this.level >= 6 && Math.random() < 0.35 ? 'Combo' : ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    const speed = clamp(1 + (this.level - 1) * 0.06, 1, 1.6) * (this.apex ? 1.3 : 1);
    this.state = 'attack';
    this.stateT = 0;
    this.stateDur = this.clipDuration(name) / speed;
    this.impactAt = this.stateDur * (name === 'Combo' ? 0.42 : 0.5);
    this.impactDone = false;
    this.onImpact = onImpact;
    this.play(name, 0.12, false, speed);
  }

  damage(amount: number): boolean {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flash = Math.min(1, this.flash + 0.35);
    return this.hp <= 0;
  }

  die(onBurst: () => void, onDone: () => void): void {
    this.hp = 0;
    this.state = 'dying';
    this.stateT = 0;
    this.stateDur = this.clipDuration('Die');
    this.onBurst = onBurst;
    this.onDone = onDone;
    this.impactDone = false;
    this.play('Die', 0.1, false, 1.1);
  }

  hide(): void {
    this.state = 'hidden';
    this.root.visible = false;
    this.apex = false;
  }

  private applyLook(): void {
    const k = clamp((this.level - 1) / 9, 0, 1);
    this.tint.copy(C_TINT_LOW).lerp(C_TINT_HIGH, k);
    this.emissive.copy(C_EMI_LOW).lerp(C_EMI_HIGH, k);
    this.heat = 0.25 + 0.75 * k;
    if (this.apex) {
      this.tint.set('#ff5040');
      this.emissive.set('#ff1500');
      this.heat = 1.2;
    }
  }

  setApex(): void {
    this.apex = true;
    this.targetScale = this.scaleFor(this.level);
    this.applyLook();
  }

  /** World point on the body for hits / tracers. */
  hitPoint(out: THREE.Vector3): THREE.Vector3 {
    const s = this.displayScale / BASE_SCALE;
    return out.set(
      this.root.position.x + rand(-1.4, 1.4) * s,
      rand(1.3, 3.0) * s,
      this.root.position.z + 1.1 * s,
    );
  }

  centre(out: THREE.Vector3): THREE.Vector3 {
    const s = this.displayScale / BASE_SCALE;
    return out.set(this.root.position.x, 2.2 * s, this.root.position.z + 0.6);
  }

  update(dt: number): void {
    if (this.state === 'hidden') return;
    this.stateT += dt;
    const t = this.stateT;

    switch (this.state) {
      case 'spawn': {
        const k = clamp(t / 0.5, 0, 1);
        this.displayScale = this.targetScale * easeOutBack(k);
        if (t >= this.stateDur) this.toIdle();
        break;
      }
      case 'attack': {
        // lunge in, hit, retreat
        const k = t / this.stateDur;
        const tgt = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45);
        this.lunge = lerp(this.lunge, tgt, damp(9, dt));
        if (!this.impactDone && t >= this.impactAt) {
          this.impactDone = true;
          this.onImpact?.();
        }
        if (t >= this.stateDur) this.toIdle();
        break;
      }
      case 'evolve':
        if (t >= this.stateDur) this.toIdle();
        break;
      case 'dying':
        this.lunge = lerp(this.lunge, 0, damp(4, dt));
        if (!this.impactDone && t >= this.stateDur * 0.45) {
          this.impactDone = true;
          this.onBurst?.();
        }
        if (t >= this.stateDur) {
          this.state = 'sinking';
          this.stateT = 0;
        }
        break;
      case 'sinking':
        this.root.position.y = -t * t * 2.2;
        if (t > 1.1) {
          this.root.position.y = 0;
          this.hide();
          this.onDone?.();
        }
        break;
      case 'idle':
        this.lunge = lerp(this.lunge, 0, damp(6, dt));
        break;
    }

    if (this.state !== 'spawn') this.displayScale = lerp(this.displayScale, this.targetScale, damp(4, dt));
    this.root.scale.setScalar(this.displayScale);
    if (this.state !== 'sinking') this.root.position.z = BOSS_HOME.z + this.lunge * BOSS_LUNGE * (this.displayScale / BASE_SCALE);

    // material: evolution tint + hit flash
    this.flash = Math.max(0, this.flash - dt * 5);
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.004 * (1 + this.heat));
    this.mat.color.copy(this.tint);
    this.mat.emissive.copy(this.emissive).multiplyScalar(0.35 + 0.5 * this.heat * pulse);
    if (this.flash > 0) this.mat.emissive.lerp(WHITE, this.flash * 0.55);

    this.updateAnim(dt);
  }

  private toIdle(): void {
    this.state = 'idle';
    this.stateT = 0;
    this.play('Idle', 0.2, true, 1 + this.level * 0.03);
  }
}
