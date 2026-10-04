import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Soft contact shadows for characters: one instanced draw instead of skinned shadow-map passes. */
export class BlobShadows {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(cap: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.32)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  add(pos: THREE.Vector3, radius: number): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    // fade/shrink with height so airborne bodies still read as airborne
    const k = Math.max(0.2, 1 - pos.y * 0.25);
    _p.set(pos.x, 0.035, pos.z);
    _s.set(radius * 2 * k, 1, radius * 2 * k);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(this.n++, _m);
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
