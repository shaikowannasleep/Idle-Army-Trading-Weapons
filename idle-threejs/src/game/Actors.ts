import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { dampAngle } from '../core/math';
import { WEAPONS, type WeaponDef, type WeaponId, type WeaponKit } from './Weapons';

/** Skinned character wrapper: mixer, cross-faded clips, waypoint walking. */
export class Actor {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  current: THREE.AnimationAction | null = null;
  currentName = '';
  yaw = 0;
  targetYaw = 0;
  private path: THREE.Vector3[] = [];
  speed = 3;
  moving = false;
  moveAnim = 'Move';
  idleAnim = 'Idle';
  /** Animations are evaluated at half rate when far from the action to save CPU. */
  private animAcc = Math.random() / 30; // random phase spreads half-rate updates across frames

  constructor(gltf: GLTF) {
    this.model = skClone(gltf.scene);
    this.root.add(this.model);
    this.root.matrixWorldAutoUpdate = false; // see updateAnim
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const c of gltf.animations) this.actions.set(c.name, this.mixer.clipAction(c));
    // SkeletonUtils.clone gives every SkinnedMesh its own Skeleton; share one per actor so bone
    // matrices are computed and uploaded once per frame instead of once per mesh.
    let shared: THREE.Skeleton | null = null;
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      // characters use blob shadows (one instanced draw) instead of the shadow-map pass
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      if (!m.isSkinnedMesh) return;
      if (!shared) shared = m.skeleton;
      else if (m.skeleton.bones.length === shared.bones.length && m.skeleton.bones.every((b, i) => b === shared!.bones[i])) {
        m.skeleton.dispose();
        m.bind(shared, m.bindMatrix);
      }
    });
  }

  play(name: string, fade = 0.18, loop = true, timeScale = 1): THREE.AnimationAction {
    const a = this.actions.get(name)!;
    if (this.current === a && loop) {
      a.timeScale = timeScale;
      return a;
    }
    a.reset();
    a.enabled = true;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    a.setEffectiveWeight(1);
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentName = name;
    return a;
  }

  clipDuration(name: string): number {
    return this.actions.get(name)!.getClip().duration;
  }

  walkTo(points: THREE.Vector3[]): void {
    this.path = points.map((p) => p.clone());
    this.moving = this.path.length > 0;
  }

  stop(): void {
    this.path.length = 0;
    this.moving = false;
  }

  get pos(): THREE.Vector3 {
    return this.root.position;
  }

  /** Returns true on the frame the path completes. */
  updateMove(dt: number): boolean {
    if (!this.moving) return false;
    const target = this.path[0];
    const p = this.root.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) {
      p.x = target.x;
      p.z = target.z;
      this.path.shift();
      if (this.path.length === 0) {
        this.moving = false;
        return true;
      }
    } else {
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      this.targetYaw = Math.atan2(dx, dz);
    }
    return false;
  }

  private lastX = NaN;
  private lastY = NaN;
  private lastZ = NaN;
  private lastYaw = NaN;
  private lastS = NaN;
  private lastRx = NaN;

  updateAnim(dt: number, lowRate = false): void {
    this.yaw = dampAngle(this.yaw, this.targetYaw, 12, dt);
    this.root.rotation.y = this.yaw;
    let animated = true;
    if (lowRate) {
      this.animAcc += dt;
      if (this.animAcc < 1 / 30) animated = false;
      else dt = this.animAcc;
    }
    if (animated) {
      this.animAcc = 0;
      this.mixer.update(dt);
    }
    // The renderer skips this subtree (matrixWorldAutoUpdate = false); refresh the ~30 bone
    // matrices only on frames where the pose or the transform actually changed.
    const p = this.root.position;
    const moved = p.x !== this.lastX || p.y !== this.lastY || p.z !== this.lastZ || this.yaw !== this.lastYaw || this.root.scale.x !== this.lastS || this.root.rotation.x !== this.lastRx;
    if (animated || moved) {
      this.lastX = p.x;
      this.lastY = p.y;
      this.lastZ = p.z;
      this.lastYaw = this.yaw;
      this.lastS = this.root.scale.x;
      this.lastRx = this.root.rotation.x;
      // root.updateMatrixWorld() is a no-op while matrixWorldAutoUpdate is false: compose it by hand
      // (the parent is the identity-transform scene), then refresh the subtree.
      this.root.updateMatrix();
      this.root.matrixWorld.copy(this.root.matrix);
      const kids = this.root.children;
      for (let i = 0; i < kids.length; i++) kids[i].updateMatrixWorld(true);
    }
  }
}

export type UnitState = 'enter' | 'queue' | 'counter' | 'serving' | 'toFront' | 'fight' | 'dying' | 'gone';

/**
 * Customer that turns into a soldier once armed. Civilian and soldier skins share one UV atlas,
 * so the transformation is a material swap + weapon reveal.
 */
export class Unit extends Actor {
  state: UnitState = 'gone';
  readonly body: THREE.SkinnedMesh;
  private weapons = new Map<WeaponId, THREE.SkinnedMesh>();
  private readonly hand: THREE.Object3D;
  weapon: WeaponDef = WEAPONS[0];
  counter = 0;
  queueIndex = 0;
  slot = -1;
  fireTimer = 0;
  dieT = 0;
  dieVel = new THREE.Vector3();
  scaleBase = 1;
  popT = 0;
  serveT = 0;
  wantWeapon: WeaponId = 'pistol';

  constructor(gltf: GLTF, kit: WeaponKit) {
    super(gltf);
    this.body = this.model.getObjectByName('Body_01_blackjacket') as THREE.SkinnedMesh;
    // GLTFLoader strips '.' from node names: 'WP.R' -> 'WPR'
    this.hand = this.model.getObjectByName('WPR') ?? this.model.getObjectByName('WP.R')!;
    (this.model.getObjectByName('1') as THREE.Object3D).visible = false; // knife: unused
    const rifle = this.model.getObjectByName('3') as THREE.SkinnedMesh;
    for (const w of WEAPONS) {
      const k = kit.skinned[w.id];
      let mesh: THREE.SkinnedMesh;
      if (k.source) {
        mesh = this.model.getObjectByName(k.source) as THREE.SkinnedMesh;
      } else {
        mesh = new THREE.SkinnedMesh(k.geo, k.mat);
        mesh.bind(rifle.skeleton, rifle.bindMatrix);
        mesh.position.copy(rifle.position);
        mesh.quaternion.copy(rifle.quaternion);
        mesh.scale.copy(rifle.scale);
        mesh.frustumCulled = false;
        rifle.parent!.add(mesh);
      }
      mesh.visible = false;
      this.weapons.set(w.id, mesh);
    }
    this.speed = 3.4;
  }

  setSkin(mat: THREE.Material): void {
    this.body.material = mat;
  }

  arm(w: WeaponDef | null): void {
    for (const [id, m] of this.weapons) m.visible = !!w && id === w.id;
    if (w) this.weapon = w;
    this.idleAnim = w ? w.aim : 'Idle';
  }

  muzzle(out: THREE.Vector3): THREE.Vector3 {
    this.hand.getWorldPosition(out);
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const f = this.weapon.muzzle * this.root.scale.x;
    out.x += s * f;
    out.z += c * f;
    out.y += 0.05;
    return out;
  }
}

/** Shop clerk (player avatar or hired assistant). */
export class Staff extends Actor {
  constructor(gltf: GLTF, tint?: THREE.ColorRepresentation) {
    super(gltf);
    const pick = this.model.getObjectByName('w_pick');
    if (pick) pick.visible = false;
    this.moveAnim = 'Move 1';
    this.speed = 5.6;
    if (tint) {
      this.model.traverse((o) => {
        const m = o as THREE.Mesh;
        // multi-material nodes load as a Group of per-primitive meshes
        if (m.isMesh && (m.name.startsWith('Shirt') || m.parent?.name.startsWith('Shirt'))) {
          const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
            const c = (x as THREE.MeshStandardMaterial).clone();
            c.color.multiply(new THREE.Color(tint));
            return c;
          });
          m.material = Array.isArray(m.material) ? mats : mats[0];
        }
      });
    }
  }
}
