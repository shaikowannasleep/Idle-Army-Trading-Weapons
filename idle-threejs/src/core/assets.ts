import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import bossUrl from '../assets/models/boss.glb?url';
import staffUrl from '../assets/models/staff.glb?url';
import customerUrl from '../assets/models/customer.glb?url';
import mapUrl from '../assets/models/map.glb?url';
import machine2Url from '../assets/models/machine2.glb?url';
import machine4Url from '../assets/models/machine4.glb?url';
import slot2Url from '../assets/models/slot2.glb?url';
import chestUrl from '../assets/models/chest.glb?url';
import coinUrl from '../assets/models/coin.glb?url';
import skinSoldierUrl from '../assets/ui/skin_soldier.webp?url';
import skinCivAUrl from '../assets/ui/skin_civilianA.webp?url';
import smokeUrl from '../assets/ui/smoke.png?url';

const MODELS = {
  boss: bossUrl,
  staff: staffUrl,
  customer: customerUrl,
  map: mapUrl,
  machine2: machine2Url,
  machine4: machine4Url,
  slot2: slot2Url,
  chest: chestUrl,
  coin: coinUrl,
};
const TEXTURES = { skinSoldier: skinSoldierUrl, skinCivA: skinCivAUrl, smoke: smokeUrl };

export type ModelKey = keyof typeof MODELS;
export type TextureKey = keyof typeof TEXTURES;

export interface Assets {
  models: Record<ModelKey, GLTF>;
  textures: Record<TextureKey, THREE.Texture>;
}

export async function loadAssets(renderer: THREE.WebGLRenderer, onProgress: (p: number) => void): Promise<Assets> {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, loaded, total) => onProgress(loaded / total);
  const gltfLoader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const texLoader = new THREE.TextureLoader(manager);
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const modelEntries = await Promise.all(
    (Object.keys(MODELS) as ModelKey[]).map(async (k) => [k, await gltfLoader.loadAsync(MODELS[k])] as const),
  );
  const texEntries = await Promise.all(
    (Object.keys(TEXTURES) as TextureKey[]).map(async (k) => {
      const t = await texLoader.loadAsync(TEXTURES[k]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      if (k.startsWith('skin')) t.flipY = false; // glTF UV convention
      return [k, t] as const;
    }),
  );

  const models = Object.fromEntries(modelEntries) as Record<ModelKey, GLTF>;
  // Uniform PBR response across the palette-textured kit.
  for (const g of Object.values(models)) {
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats as THREE.MeshStandardMaterial[]) {
        mat.roughness = 0.82;
        mat.metalness = 0.0;
        if (mat.map) mat.map.anisotropy = aniso;
      }
    });
  }
  return { models, textures: Object.fromEntries(texEntries) as Record<TextureKey, THREE.Texture> };
}

export function clip(gltf: GLTF, name: string): THREE.AnimationClip {
  const c = gltf.animations.find((a) => a.name === name);
  if (!c) throw new Error(`Missing clip ${name}`);
  return c;
}
