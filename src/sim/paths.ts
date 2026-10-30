// Trodden paths: every game minute she walks somewhere wears the grass down a
// little, and the grass slowly grows back where she stops going. Kept as a
// sparse grid of 1×1 cells ("x,z" → 0…1) so it saves small; the world draws
// worn cells as bare earth (see world/paths.ts).
import type { Pt } from './island';
import { S } from './state';

export const PATH_CELL = 1;
const WEAR_PER_MIN = 0.03; // a cell she crosses ~25 times becomes a clear path
const REGROW_PER_DAY = 0.04;
export const cellKey = (x: number, z: number) => `${Math.floor(x / PATH_CELL)},${Math.floor(z / PATH_CELL)}`;

/** @param dm game minutes spent walking here */
export function wearPath(p: Pt, dm: number) {
  const k = cellKey(p.x, p.z);
  S.wear[k] = Math.min(1, (S.wear[k] ?? 0) + dm * WEAR_PER_MIN);
  S.wearVersion++;
}

/** At dawn: grass grows back a little everywhere (and forgotten cells are dropped). */
export function regrowPaths() {
  for (const k in S.wear) {
    S.wear[k] -= REGROW_PER_DAY;
    if (S.wear[k] <= 0.01) delete S.wear[k];
    else S.wear[k] = Math.round(S.wear[k] * 100) / 100; // (keeps the save small)
  }
  S.wearVersion++;
}
