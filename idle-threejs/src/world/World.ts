import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Assets } from '../core/assets';
import { MAP_OFFSET } from '../game/layout';

/** Static environment: lighting rig, sky/fog, the camp map and the ground skirt. */
export class World {
  readonly sun: THREE.DirectionalLight;
  readonly bossLight: THREE.PointLight;
  readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    assets: Assets,
  ) {
    const sky = new THREE.Color('#1d3a3b');
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 34, 78);

    // Soft image-based fill from a one-off PMREM bake (no per-frame cost).
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.4;

    const hemi = new THREE.HemisphereLight('#c4e6ff', '#3b2a1c', 1.75);
    scene.add(hemi);

    this.sun = new THREE.DirectionalLight('#ffe2b8', 3.1);
    this.sun.position.set(-9, 18, 9);
    this.sun.target.position.set(0, 0, -3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -15;
    sc.right = 15;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 2;
    sc.far = 50;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);


    // Boss aura light (always present so the shader light count never changes).
    this.bossLight = new THREE.PointLight('#b45cff', 0, 16, 1.6);
    this.bossLight.position.set(0, 3, -13);
    scene.add(this.bossLight);

    // Camp map from the Cocos project.
    const map = assets.models.map.scene;
    map.position.copy(MAP_OFFSET);
    map.traverse((o) => {
      // Hide obstructive fallen logs in the camp center to make the main courtyard completely clear
      if (o.name === 'Cylinder.003' || o.name === 'Cylinder.004') {
        o.visible = false;
        return;
      }
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.roughness = 0.92;
      // The map atlas is authored dark for night scenes; lift it for a dusk mood.
      mat.color.setRGB(1.55, 1.55, 1.5);
    });
    map.updateMatrixWorld(true);
    map.matrixAutoUpdate = false;
    map.traverse((o) => (o.matrixAutoUpdate = false));
    this.root.add(map);

    // Ground skirt beyond the map edge so the fog never reveals the void.
    const skirt = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: '#18342c', roughness: 1 }),
    );
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = -0.06;
    skirt.receiveShadow = true;
    skirt.matrixAutoUpdate = false;
    skirt.updateMatrix();
    this.root.add(skirt);

    scene.add(this.root);
  }
}
