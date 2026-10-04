import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'minigun' | 'rocket';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** UI accent + tracer tint */
  color: string;
  tracer: [number, number, number];
  dmg: number;
  /** shots per second */
  rate: number;
  pellets: number;
  splash: number;
  /** price paid by a customer buying it */
  price: number;
  unlockCost: number;
  unlockGems: number;
  upgradeCost: number;
  anim: 'Attack_2' | 'Attack_3';
  aim: 'Attack_2_Idle' | 'Attack_3_Idle';
  muzzle: number;
  tracerWidth: number;
  /** soldier scale (heavy weapons get bigger troopers) */
  troop: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'pistol', name: 'Pistol', color: '#9fd4ff', tracer: [1, 0.85, 0.5], dmg: 9, rate: 2.4, pellets: 1, splash: 0, price: 12, unlockCost: 0, unlockGems: 0, upgradeCost: 30, anim: 'Attack_2', aim: 'Attack_2_Idle', muzzle: 0.35, tracerWidth: 0.07, troop: 1 },
  { id: 'rifle', name: 'Assault Rifle', color: '#7dff9a', tracer: [1, 0.8, 0.35], dmg: 7, rate: 7, pellets: 1, splash: 0, price: 20, unlockCost: 45, unlockGems: 0, upgradeCost: 60, anim: 'Attack_3', aim: 'Attack_3_Idle', muzzle: 0.75, tracerWidth: 0.07, troop: 1.04 },
  { id: 'shotgun', name: 'Shotgun', color: '#ffb35c', tracer: [1, 0.7, 0.3], dmg: 6, rate: 1.4, pellets: 6, splash: 0, price: 30, unlockCost: 110, unlockGems: 1, upgradeCost: 120, anim: 'Attack_3', aim: 'Attack_3_Idle', muzzle: 0.7, tracerWidth: 0.06, troop: 1.08 },
  { id: 'minigun', name: 'Minigun', color: '#ff6b6b', tracer: [1, 0.55, 0.25], dmg: 6, rate: 15, pellets: 1, splash: 0, price: 45, unlockCost: 220, unlockGems: 2, upgradeCost: 230, anim: 'Attack_3', aim: 'Attack_3_Idle', muzzle: 0.8, tracerWidth: 0.08, troop: 1.18 },
  { id: 'rocket', name: 'Rocket Launcher', color: '#d58bff', tracer: [1, 0.6, 0.2], dmg: 110, rate: 0.7, pellets: 1, splash: 2.5, price: 65, unlockCost: 380, unlockGems: 4, upgradeCost: 400, anim: 'Attack_3', aim: 'Attack_3_Idle', muzzle: 0.7, tracerWidth: 0, troop: 1.12 },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w])) as Record<WeaponId, WeaponDef>;

// ---------------------------------------------------------------------------------------------
// Procedural weapon meshes (vertex-coloured, built along +Z, centred at the origin).

const STEEL = new THREE.Color('#2c3138');
const GUNMETAL = new THREE.Color('#454c57');
const WOOD = new THREE.Color('#7a4a26');
const OLIVE = new THREE.Color('#4f5d2f');
const RED = new THREE.Color('#c7372f');
const BRASS = new THREE.Color('#c9a043');

function part(g: THREE.BufferGeometry, color: THREE.Color, pos: [number, number, number], rotX = 0, rotZ = 0): THREE.BufferGeometry {
  const geo = (g.index ? g.toNonIndexed() : g).clone();
  if (rotX) geo.rotateX(rotX);
  if (rotZ) geo.rotateZ(rotZ);
  geo.translate(pos[0], pos[1], pos[2]);
  const n = geo.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.toArray(c, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.deleteAttribute('uv');
  return geo;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const tube = (r: number, len: number, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);

function centre(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.computeVertexNormals();
  return g;
}

function shotgun(): THREE.BufferGeometry {
  return centre(
    mergeGeometries([
      part(tube(0.035, 0.78), STEEL, [0, 0.05, 0.42]),
      part(tube(0.03, 0.62), GUNMETAL, [0, -0.01, 0.36]),
      part(box(0.09, 0.08, 0.24), WOOD, [0, -0.01, 0.3]),
      part(box(0.08, 0.13, 0.3), STEEL, [0, 0.02, 0.0]),
      part(box(0.06, 0.15, 0.07), WOOD, [0, -0.1, -0.06], -0.35),
      part(box(0.07, 0.11, 0.4), WOOD, [0, -0.03, -0.32], 0.12),
      part(box(0.02, 0.03, 0.04), BRASS, [0, 0.1, 0.76]),
    ]),
  );
}

function minigun(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(part(tube(0.022, 0.78, 6), STEEL, [Math.cos(a) * 0.055, Math.sin(a) * 0.055 + 0.03, 0.46]));
  }
  parts.push(
    part(tube(0.085, 0.04, 14), GUNMETAL, [0, 0.03, 0.78]),
    part(tube(0.085, 0.04, 14), GUNMETAL, [0, 0.03, 0.4]),
    part(tube(0.1, 0.34, 14), GUNMETAL, [0, 0.03, -0.02]),
    part(box(0.06, 0.16, 0.06), STEEL, [0, -0.1, -0.08]),
    part(box(0.18, 0.14, 0.2), OLIVE, [0.13, -0.08, -0.04]),
    part(box(0.05, 0.05, 0.22), STEEL, [0, 0.14, 0.02]),
    part(box(0.03, 0.08, 0.03), RED, [0, 0.17, 0.12]),
  );
  return centre(mergeGeometries(parts));
}

function rocket(): THREE.BufferGeometry {
  return centre(
    mergeGeometries([
      part(tube(0.085, 1.0, 14), OLIVE, [0, 0.06, 0.2]),
      part(tube(0.1, 0.12, 14), STEEL, [0, 0.06, 0.72]),
      part(tube(0.1, 0.1, 14), STEEL, [0, 0.06, -0.32]),
      part(new THREE.ConeGeometry(0.075, 0.22, 12).rotateX(Math.PI / 2), RED, [0, 0.06, 0.86]),
      part(box(0.05, 0.16, 0.06), STEEL, [0, -0.08, 0.12]),
      part(box(0.05, 0.14, 0.06), STEEL, [0, -0.07, -0.1]),
      part(box(0.04, 0.07, 0.16), GUNMETAL, [0.1, 0.16, 0.25]),
      part(box(0.02, 0.02, 0.02), BRASS, [0.1, 0.2, 0.33]),
    ]),
  );
}

export const proceduralMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });

/** Rocket projectile mesh (shared). */
export function rocketProjectile(): THREE.BufferGeometry {
  return centre(
    mergeGeometries([
      part(tube(0.07, 0.42, 10), OLIVE, [0, 0, 0]),
      part(new THREE.ConeGeometry(0.07, 0.18, 10).rotateX(Math.PI / 2), RED, [0, 0, 0.3]),
      part(box(0.2, 0.02, 0.08), STEEL, [0, 0, -0.18]),
      part(box(0.02, 0.2, 0.08), STEEL, [0, 0, -0.18]),
    ]),
  );
}

// ---------------------------------------------------------------------------------------------

export interface WeaponKit {
  /** Bind-space skinned geometry for each weapon (rifle-aligned) + material. */
  skinned: Record<WeaponId, { geo: THREE.BufferGeometry; mat: THREE.Material; source?: string }>;
  /** Centred static display meshes (crate tops, flying deliveries). */
  display: Record<WeaponId, { geo: THREE.BufferGeometry; mat: THREE.Material; rot: THREE.Euler; scale: number }>;
}

function stripSkin(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone();
  g.deleteAttribute('skinIndex');
  g.deleteAttribute('skinWeight');
  return centre(g);
}

/**
 * The customer FBX carries three hand-skinned props: '1' knife, '2' pistol, '3' M4 rifle.
 * New weapons are generated procedurally and skinned to the same hand joint as the rifle.
 */
export function buildWeaponKit(customer: GLTF): WeaponKit {
  const find = (n: string) => customer.scene.getObjectByName(n) as THREE.SkinnedMesh;
  const rifle = find('3');
  const pistol = find('2');
  const rifleGeo = rifle.geometry;
  rifleGeo.computeBoundingBox();
  const anchor = rifleGeo.boundingBox!.getCenter(new THREE.Vector3());
  const si = rifleGeo.getAttribute('skinIndex');
  const joint = si.getX(0);

  const skinnedFrom = (g: THREE.BufferGeometry, lengthScale: number) => {
    const geo = g.clone();
    geo.scale(lengthScale, lengthScale, lengthScale);
    geo.translate(anchor.x, anchor.y, anchor.z + 0.05);
    const n = geo.getAttribute('position').count;
    const idx = new Uint16Array(n * 4);
    const w = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      idx[i * 4] = joint;
      w[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
    return geo;
  };

  const sg = shotgun();
  const mg = minigun();
  const rk = rocket();
  // Procedural weapons are authored ~1m long; the rifle is ~1.47 (chibi proportions).
  const S = 1.25;
  const kit: WeaponKit = {
    skinned: {
      pistol: { geo: pistol.geometry, mat: pistol.material as THREE.Material, source: '2' },
      rifle: { geo: rifle.geometry, mat: rifle.material as THREE.Material, source: '3' },
      shotgun: { geo: skinnedFrom(sg, S), mat: proceduralMaterial },
      minigun: { geo: skinnedFrom(mg, S), mat: proceduralMaterial },
      rocket: { geo: skinnedFrom(rk, S * 1.05), mat: proceduralMaterial },
    },
    display: {
      pistol: { geo: stripSkin(pistol.geometry), mat: pistol.material as THREE.Material, rot: new THREE.Euler(0, Math.PI / 2, 0), scale: 1.25 },
      rifle: { geo: stripSkin(rifle.geometry), mat: rifle.material as THREE.Material, rot: new THREE.Euler(0, Math.PI / 2, 0), scale: 0.8 },
      shotgun: { geo: sg, mat: proceduralMaterial, rot: new THREE.Euler(0, Math.PI / 2, 0), scale: 1.1 },
      minigun: { geo: mg, mat: proceduralMaterial, rot: new THREE.Euler(0, Math.PI / 2, 0), scale: 1.1 },
      rocket: { geo: rk, mat: proceduralMaterial, rot: new THREE.Euler(0, Math.PI / 2, 0), scale: 1.0 },
    },
  };
  return kit;
}

export function displayMesh(kit: WeaponKit, id: WeaponId): THREE.Mesh {
  const d = kit.display[id];
  const m = new THREE.Mesh(d.geo, d.mat);
  m.rotation.copy(d.rot);
  m.scale.setScalar(d.scale);
  m.castShadow = false;
  return m;
}
