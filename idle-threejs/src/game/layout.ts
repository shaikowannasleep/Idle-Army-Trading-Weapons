import * as THREE from 'three';

/**
 * World-space layout of the camp (Y up, camera looks toward -Z).
 * Map origin: tent sits at x 3..8.7 / z 0.3..5.9, horizontal road at z -14.5..-8,
 * fallen logs at x -2.4..-1.4 / z -1.8..1.4 and x 1.1..2.5 / z -3.4..-2.4.
 */
export const MAP_OFFSET = new THREE.Vector3(0, 0, 0);

export const BOSS_HOME = new THREE.Vector3(0, 0, -11.8);
export const BOSS_LUNGE = 1.8;

export const WALL_Z = -7.6;
export const WALL_HALF = 6.4;

/** Soldier firing slots: two rows behind the wall. */
export const SLOTS: THREE.Vector3[] = [];
for (const z of [-6.35, -5.2]) {
  for (let i = 0; i < 9; i++) SLOTS.push(new THREE.Vector3(-5 + i * 1.25 + (z > -6 ? 0.62 : 0), 0, z));
}
/** Soldiers leave the shop through this lane so they never clip the logs. */
export const RALLY = new THREE.Vector3(-4.3, 0, -4.2);

export interface CounterDef {
  counter: THREE.Vector3;
  customerSpot: THREE.Vector3;
  serveSpot: THREE.Vector3;
  queue: THREE.Vector3[];
}
export const COUNTERS: CounterDef[] = [
  {
    counter: new THREE.Vector3(-3.0, 0, 3.9),
    customerSpot: new THREE.Vector3(-3.0, 0, 5.1),
    serveSpot: new THREE.Vector3(-3.0, 0, 2.75),
    queue: [new THREE.Vector3(-4.3, 0, 5.5), new THREE.Vector3(-5.5, 0, 6.0), new THREE.Vector3(-6.7, 0, 6.6)],
  },
  {
    counter: new THREE.Vector3(-6.4, 0, 2.2),
    customerSpot: new THREE.Vector3(-7.6, 0, 2.2),
    serveSpot: new THREE.Vector3(-5.3, 0, 2.2),
    queue: [new THREE.Vector3(-8.2, 0, 3.3), new THREE.Vector3(-8.8, 0, 4.4), new THREE.Vector3(-9.4, 0, 5.5)],
  },
];
export const CUSTOMER_ENTRY = new THREE.Vector3(-15, 0, 7.4);

/** Armory crates sit along the southern edge; upgrade pads sit in front of them in the open courtyard. */
export const ARMORY_Z = 7.7;
export const ARMORY_X = [-1.8, 0.8, 3.4, 5.2, 7.0];
export const PAD_Z = 6.2;

export const EXPAND_PAD = new THREE.Vector3(-6.4, 0, 0.1);
export const FORTIFY_PAD = new THREE.Vector3(3.6, 0, -1.2);

/** Loot landing zone (between wall and shop). */
export const LOOT_ZONE = { x0: -5.6, x1: 5.6, z0: -4.4, z1: 0.6 };
export const LOOT_BLOCKERS: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];

/** Player walk bounds. */
export const PLAY_BOUNDS = { x0: -9.5, x1: 8.2, z0: -6.9, z1: 9.4 };

/** Points the camera must always keep in frame (boss head height included). */
export const FRAME_POINTS = [
  new THREE.Vector3(-7.2, 0, 9.6),
  new THREE.Vector3(7.4, 0, 9.6),
  new THREE.Vector3(-7.2, 0, -14.5),
  new THREE.Vector3(7.4, 0, -14.5),
  new THREE.Vector3(0, 6.5, -12.5),
];
