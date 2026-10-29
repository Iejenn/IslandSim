// The island's raw materials. Fallen branches come from living trees (so
// cutting the forest down without replanting means less firewood), loose
// stones slowly weather out of the rocky area, saplings grow back into
// trees, and fish she can't cook goes bad (or dries, with a rack).
import { BOULDERS, dist, FOREST, type Pt } from './island';
import { highlight, log, S } from './state';

const SAPLING_DAYS = 3.5; // replanted sapling → full tree
const FISH_KEEPS_MIN = 8 * 60; // fresh fish goes off after this long

export const standingTrees = () => S.trees.filter(t => t.state === 'tree').length;

/** @param dm game minutes elapsed */
export function updateResources(dm: number) {
  const days = dm / 1440;
  // more living trees → more fallen branches
  S.deadwood = Math.min(10, S.deadwood + days * 0.3 * standingTrees());
  S.loose = Math.min(10, S.loose + days * 2);
  for (const t of S.trees) {
    if (t.state !== 'sapling') continue;
    t.growth += days / SAPLING_DAYS;
    if (t.growth >= 1) { t.state = 'tree'; t.growth = 1; log('A sapling she planted has grown into a tree.'); }
  }
  if (S.stock.raw > 0 && S.min - S.rawSince > FISH_KEEPS_MIN) {
    if (S.projects.rack.done && !S.projects.rack.damaged) {
      S.stock.fish = Math.min(8, S.stock.fish + S.stock.raw);
      log('She hung the fish she couldn’t cook on the rack to dry.');
    } else {
      log(`The fish she couldn’t cook went bad.`);
      highlight('let a fish go bad');
    }
    S.stock.raw = 0;
  }
}

/** Index of the nearest forest tree in a given state (or -1). */
export function nearestTree(state: 'tree' | 'stump' | 'sapling', from: Pt) {
  let best = -1, bd = 1e9;
  S.trees.forEach((t, i) => {
    if (t.state !== state) return;
    const d = dist(FOREST[i].stand, from);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** Index of the nearest boulder that still has stone in it (or -1). */
export function nearestBoulder(from: Pt) {
  let best = -1, bd = 1e9;
  S.boulders.forEach((left, i) => {
    if (left <= 0) return;
    const d = dist(BOULDERS[i].stand, from);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** Add freshly caught fish; they need cooking within a few hours. */
export function addRawFish(n: number) {
  if (S.stock.raw === 0) S.rawSince = S.min;
  S.stock.raw += n;
}
