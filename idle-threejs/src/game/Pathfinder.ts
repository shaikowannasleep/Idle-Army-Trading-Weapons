import * as THREE from 'three';
import { PLAY_BOUNDS } from './layout';

export interface Box2D {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Check if circle of radius `r` at point (px, pz) intersects box. */
function pointInBox(px: number, pz: number, b: Box2D, r = 0): boolean {
  return px >= b.x0 - r && px <= b.x1 + r && pz >= b.z0 - r && pz <= b.z1 + r;
}


/** Check if segment (ax, az)-(bx, bz) intersects an axis-aligned box with clearance radius r. */
function segmentIntersectsBox(ax: number, az: number, bx: number, bz: number, b: Box2D, r: number): boolean {
  const expBox: Box2D = {
    x0: b.x0 - r,
    x1: b.x1 + r,
    z0: b.z0 - r,
    z1: b.z1 + r,
  };

  // Quick bounding box rejection
  if (Math.max(ax, bx) < expBox.x0 || Math.min(ax, bx) > expBox.x1) return false;
  if (Math.max(az, bz) < expBox.z0 || Math.min(az, bz) > expBox.z1) return false;

  // If either endpoint is inside the expanded box
  if (ax >= expBox.x0 && ax <= expBox.x1 && az >= expBox.z0 && az <= expBox.z1) return true;
  if (bx >= expBox.x0 && bx <= expBox.x1 && bz >= expBox.z0 && bz <= expBox.z1) return true;

  // Segment-box intersection test using Liang-Barsky / slab method
  const dx = bx - ax;
  const dz = bz - az;

  let t0 = 0;
  let t1 = 1;

  // X slab
  if (Math.abs(dx) < 1e-6) {
    if (ax < expBox.x0 || ax > expBox.x1) return false;
  } else {
    let tx0 = (expBox.x0 - ax) / dx;
    let tx1 = (expBox.x1 - ax) / dx;
    if (tx0 > tx1) { const tmp = tx0; tx0 = tx1; tx1 = tmp; }
    t0 = Math.max(t0, tx0);
    t1 = Math.min(t1, tx1);
    if (t0 > t1) return false;
  }

  // Z slab
  if (Math.abs(dz) < 1e-6) {
    if (az < expBox.z0 || az > expBox.z1) return false;
  } else {
    let tz0 = (expBox.z0 - az) / dz;
    let tz1 = (expBox.z1 - az) / dz;
    if (tz0 > tz1) { const tmp = tz0; tz0 = tz1; tz1 = tmp; }
    t0 = Math.max(t0, tz0);
    t1 = Math.min(t1, tz1);
    if (t0 > t1) return false;
  }

  return true;
}

export class Pathfinder {
  private readonly step = 0.45;
  private readonly minX = PLAY_BOUNDS.x0;
  private readonly maxX = PLAY_BOUNDS.x1;
  private readonly minZ = PLAY_BOUNDS.z0;
  private readonly maxZ = PLAY_BOUNDS.z1;
  private readonly cols: number;
  private readonly rows: number;

  constructor() {
    this.cols = Math.ceil((this.maxX - this.minX) / this.step) + 1;
    this.rows = Math.ceil((this.maxZ - this.minZ) / this.step) + 1;
  }

  hasLineOfSight(ax: number, az: number, bx: number, bz: number, obstacles: Box2D[], radius = 0.35): boolean {
    for (const obs of obstacles) {
      if (segmentIntersectsBox(ax, az, bx, bz, obs, radius)) return false;
    }
    return true;
  }

  /**
   * Finds a smooth path from start to goal navigating around obstacles.
   * Returns an array of world-space Vector3 waypoints ending at goal.
   */
  findPath(start: THREE.Vector3, goal: THREE.Vector3, obstacles: Box2D[]): THREE.Vector3[] {
    const r = 0.35;

    // Direct line of sight: go straight
    if (this.hasLineOfSight(start.x, start.z, goal.x, goal.z, obstacles, r)) {
      return [goal.clone()];
    }

    // Grid A*
    const startCol = Math.max(0, Math.min(this.cols - 1, Math.round((start.x - this.minX) / this.step)));
    const startRow = Math.max(0, Math.min(this.rows - 1, Math.round((start.z - this.minZ) / this.step)));
    const goalCol = Math.max(0, Math.min(this.cols - 1, Math.round((goal.x - this.minX) / this.step)));
    const goalRow = Math.max(0, Math.min(this.rows - 1, Math.round((goal.z - this.minZ) / this.step)));

    const key = (c: number, rw: number) => rw * this.cols + c;
    const startKey = key(startCol, startRow);
    const goalKey = key(goalCol, goalRow);

    const isWalkable = (c: number, rw: number): boolean => {
      const wx = this.minX + c * this.step;
      const wz = this.minZ + rw * this.step;
      if (wx < this.minX || wx > this.maxX || wz < this.minZ || wz > this.maxZ) return false;
      for (const obs of obstacles) {
        if (pointInBox(wx, wz, obs, r)) return false;
      }
      return true;
    };

    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();
    const cameFrom = new Map<number, number>();
    const openSet: number[] = [startKey];

    gScore.set(startKey, 0);
    const h = (c: number, rw: number) => Math.hypot(c - goalCol, rw - goalRow);
    fScore.set(startKey, h(startCol, startRow));

    const DIRS = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];

    let found = false;
    let iterations = 0;
    const maxIterations = 800;

    while (openSet.length > 0 && iterations++ < maxIterations) {
      // Find lowest fScore in openSet
      let bestIdx = 0;
      let bestF = fScore.get(openSet[0]) ?? Infinity;
      for (let i = 1; i < openSet.length; i++) {
        const f = fScore.get(openSet[i]) ?? Infinity;
        if (f < bestF) {
          bestF = f;
          bestIdx = i;
        }
      }

      const current = openSet[bestIdx];
      if (current === goalKey) {
        found = true;
        break;
      }

      openSet.splice(bestIdx, 1);

      const curCol = current % this.cols;
      const curRow = Math.floor(current / this.cols);
      const curG = gScore.get(current) ?? Infinity;

      for (const [dc, dr] of DIRS) {
        const nc = curCol + dc;
        const nr = curRow + dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
        if (!isWalkable(nc, nr)) continue;

        // Diagonal corner cutting prevention
        if (dc !== 0 && dr !== 0) {
          if (!isWalkable(curCol + dc, curRow) || !isWalkable(curCol, curRow + dr)) continue;
        }

        const cost = Math.hypot(dc, dr);
        const tentativeG = curG + cost;
        const neighborKey = key(nc, nr);

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + h(nc, nr);
          fScore.set(neighborKey, f);
          if (!openSet.includes(neighborKey)) {
            openSet.push(neighborKey);
          }
        }
      }
    }

    if (!found) {
      // Fallback: direct line to goal
      return [goal.clone()];
    }

    // Reconstruct path
    const rawPath: THREE.Vector3[] = [];
    let curr: number | undefined = goalKey;
    while (curr !== undefined) {
      const c = curr % this.cols;
      const rw = Math.floor(curr / this.cols);
      rawPath.unshift(new THREE.Vector3(this.minX + c * this.step, 0, this.minZ + rw * this.step));
      curr = cameFrom.get(curr);
    }

    // Replace endpoints with actual start and goal positions
    rawPath[0] = start.clone();
    rawPath[rawPath.length - 1] = goal.clone();

    // String-pulling (Raycast line-of-sight shortcutting)
    const smoothed: THREE.Vector3[] = [rawPath[0]];
    let anchorIdx = 0;
    while (anchorIdx < rawPath.length - 1) {
      let furthest = anchorIdx + 1;
      for (let j = rawPath.length - 1; j > anchorIdx + 1; j--) {
        const pA = rawPath[anchorIdx];
        const pB = rawPath[j];
        if (this.hasLineOfSight(pA.x, pA.z, pB.x, pB.z, obstacles, r)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(rawPath[furthest]);
      anchorIdx = furthest;
    }

    // Drop the initial start waypoint as player is already there
    smoothed.shift();
    return smoothed.length > 0 ? smoothed : [goal.clone()];
  }
}
