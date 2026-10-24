import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WeaponId, WeaponKit } from '../game/Weapons';

export interface CrowdSpec {
  clip: string;
  frames: number;
  skin: THREE.Material;
  weapon?: WeaponId | null;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1);

/**
 * Hordes without skinning: the customer clip is baked into `frames` static poses once, and each
 * pose is one InstancedMesh. Hundreds of agents cost `frames` draw calls and no bone updates.
 */
export class Crowd {
  readonly group = new THREE.Group();
  /** Model-space height of the baked pose (for hit points / health bars). */
  readonly height: number;
  readonly duration: number;
  private meshes: THREE.InstancedMesh[] = [];
  private counts: number[];
  private dirtyColor: boolean[];

  constructor(gltf: GLTF, kit: WeaponKit, spec: CrowdSpec, cap: number) {
    const root = skClone(gltf.scene);
    const body = root.getObjectByName('Body_01_blackjacket') as THREE.SkinnedMesh;
    const parts: { mesh: THREE.SkinnedMesh; mat: THREE.Material }[] = [{ mesh: body, mat: spec.skin }];
    if (spec.weapon) {
      const k = kit.skinned[spec.weapon];
      const rifle = root.getObjectByName('3') as THREE.SkinnedMesh;
      let wm: THREE.SkinnedMesh;
      if (k.source) wm = root.getObjectByName(k.source) as THREE.SkinnedMesh;
      else {
        wm = new THREE.SkinnedMesh(k.geo, k.mat);
        wm.bind(rifle.skeleton, rifle.bindMatrix);
        wm.position.copy(rifle.position);
        wm.quaternion.copy(rifle.quaternion);
        wm.scale.copy(rifle.scale);
        rifle.parent!.add(wm);
      }
      parts.push({ mesh: wm, mat: k.mat });
    }
    const clip = gltf.animations.find((a) => a.name === spec.clip);
    if (!clip) throw new Error(`Crowd: missing clip ${spec.clip}`);
    this.duration = clip.duration;
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();

    const box = new THREE.Box3();
    const mats = parts.map((p) => p.mat);
    for (let f = 0; f < spec.frames; f++) {
      mixer.setTime((f / spec.frames) * clip.duration);
      root.updateMatrixWorld(true);
      const geos = parts.map(({ mesh }) => {
        mesh.skeleton.update();
        const src = mesh.geometry;
        const pos = src.getAttribute('position');
        const n = pos.count;
        const out = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          _v.fromBufferAttribute(pos, i);
          mesh.applyBoneTransform(i, _v);
          _v.applyMatrix4(mesh.matrixWorld);
          out[i * 3] = _v.x;
          out[i * 3 + 1] = _v.y;
          out[i * 3 + 2] = _v.z;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(out, 3));
        const uv = src.getAttribute('uv');
        g.setAttribute('uv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        const col = src.getAttribute('color');
        g.setAttribute('color', col && col.itemSize === 3 ? col.clone() : new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        if (src.index) g.setIndex(src.index.clone());
        g.computeVertexNormals();
        return g;
      });
      const geo = mergeGeometries(geos, true)!;
      if (f === 0) {
        geo.computeBoundingBox();
        box.copy(geo.boundingBox!);
      }
      const im = new THREE.InstancedMesh(geo, mats.length > 1 ? mats : mats[0], cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.count = 0;
      this.meshes.push(im);
      this.group.add(im);
    }
    this.height = box.max.y - box.min.y;
    this.counts = new Array(spec.frames).fill(0);
    this.dirtyColor = new Array(spec.frames).fill(false);
  }

  begin(): void {
    this.counts.fill(0);
  }

  /** `t` is the agent's animation clock in seconds; `tilt` pitches the body (death fling). */
  add(x: number, y: number, z: number, yaw: number, scale: number, t: number, color: THREE.Color = WHITE, tilt = 0): void {
    const nf = this.meshes.length;
    let f = Math.floor((t / this.duration) * nf) % nf;
    if (f < 0) f += nf;
    const im = this.meshes[f];
    const i = this.counts[f];
    if (i >= im.instanceMatrix.count) return;
    this.counts[f] = i + 1;
    _p.set(x, y, z);
    _q.setFromEuler(_e.set(tilt, yaw, 0, 'YXZ'));
    _s.setScalar(scale);
    _m.compose(_p, _q, _s);
    im.setMatrixAt(i, _m);
    const c = im.instanceColor!.array as Float32Array;
    if (c[i * 3] !== color.r || c[i * 3 + 1] !== color.g || c[i * 3 + 2] !== color.b) {
      c[i * 3] = color.r;
      c[i * 3 + 1] = color.g;
      c[i * 3 + 2] = color.b;
      this.dirtyColor[f] = true;
    }
  }

  end(): void {
    for (let f = 0; f < this.meshes.length; f++) {
      const im = this.meshes[f];
      im.count = this.counts[f];
      if (im.count) im.instanceMatrix.needsUpdate = true;
      if (this.dirtyColor[f]) {
        im.instanceColor!.needsUpdate = true;
        this.dirtyColor[f] = false;
      }
    }
  }

  get drawn(): number {
    return this.counts.reduce((a, b) => a + b, 0);
  }
}
