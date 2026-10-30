// Trodden paths: repaints the terrain's vertex colours towards bare earth
// where the sim says the grass is worn (S.wear), with soft edges. Only the
// cells that changed are repainted, a couple of times a second at most.
import type { BufferGeometry } from 'three';
import { Color } from 'three';
import { PATH_CELL } from '../sim/paths';
import type { SimState } from '../sim/state';

const EARTH = new Color('#A08458'), REACH = 0.5; // how far (in units) a worn cell's colour spreads

export function createPaths(t: { geometry: BufferGeometry; baseColors: Float32Array; size: number; segments: number }) {
  const col = t.geometry.attributes.color, step = t.size / t.segments, half = t.size / 2, row = t.segments + 1;
  const painted = new Set<string>();
  let version = -1, last = 0;
  const c = new Color();

  /** Repaint every vertex within reach of one cell. */
  function repaintAround(key: string, wear: Record<string, number>) {
    const [cx, cz] = key.split(',').map(Number);
    const x0 = cx * PATH_CELL - REACH, x1 = (cx + 1) * PATH_CELL + REACH, z0 = cz * PATH_CELL - REACH, z1 = (cz + 1) * PATH_CELL + REACH;
    for (let j = Math.max(0, Math.ceil((z0 + half) / step)); j <= Math.min(t.segments, Math.floor((z1 + half) / step)); j++) {
      for (let i = Math.max(0, Math.ceil((x0 + half) / step)); i <= Math.min(t.segments, Math.floor((x1 + half) / step)); i++) {
        const v = j * row + i, x = -half + i * step, z = -half + j * step;
        // strongest nearby wear, fading with distance from each cell's centre
        let w = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const kx = Math.floor(x / PATH_CELL) + dx, kz = Math.floor(z / PATH_CELL) + dz, val = wear[`${kx},${kz}`];
          if (!val) continue;
          const d = Math.hypot(x - (kx + 0.5) * PATH_CELL, z - (kz + 0.5) * PATH_CELL);
          w = Math.max(w, val * Math.max(0, 1 - d / (PATH_CELL * 0.5 + REACH)));
        }
        c.setRGB(t.baseColors[v * 3], t.baseColors[v * 3 + 1], t.baseColors[v * 3 + 2]).lerp(EARTH, Math.min(1, w * 1.5) * 0.85);
        col.setXYZ(v, c.r, c.g, c.b);
      }
    }
  }

  /** @param now real seconds */
  return function updatePaths(S: SimState, now: number) {
    if (S.wearVersion === version || now - last < 0.5) return;
    version = S.wearVersion; last = now;
    const keys = new Set([...painted, ...Object.keys(S.wear)]);
    for (const k of keys) repaintAround(k, S.wear);
    painted.clear();
    for (const k of Object.keys(S.wear)) painted.add(k);
    col.needsUpdate = true;
  };
}
