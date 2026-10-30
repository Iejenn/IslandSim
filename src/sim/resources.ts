// The island's raw materials. Fallen branches come from living trees (so
// cutting the forest down without replanting means less firewood), loose
// stones slowly weather out of the rocky area, saplings grow back into
// trees, and fish she can't cook goes bad (or dries, with a rack).
import { BOULDERS, dist, FOREST, type Pt } from './island';
import { works } from './plans';
import { highlight, log, S } from './state';

const SAPLING_DAYS = 3.5; // replanted sapling → full tree
const FISH_KEEPS_MIN = 8 * 60; // fresh fish (or meat) goes off after this long
export const RABBITS_MAX = 14;

export const standingTrees = () => S.trees.filter(t => t.state === 'tree').length;

/** @param dm game minutes elapsed */
export function updateResources(dm: number) {
  const days = dm / 1440;
  // more living trees → more fallen branches
  S.deadwood = Math.min(10, S.deadwood + days * 0.3 * standingTrees());
  S.loose = Math.min(10, S.loose + days * 2);
  // the fish trap fills up slowly (fish keep alive in it); rain fills the barrel
  if (works('trap')) S.trapFish = Math.min(3, S.trapFish + days * 1.6);
  if (works('barrel') && S.weather.raining) S.barrel = Math.min(8, S.barrel + dm / 25);
  // rabbits breed back (fastest when there are some but not too many); her snares catch some of them
  const r = S.rabbits;
  S.rabbits = Math.min(RABBITS_MAX, r + days * (0.35 * r * (1 - r / RABBITS_MAX) + 0.15));
  if (S.items.snare && S.snareCatch < 2 && S.rabbits >= 2) {
    const caught = Math.min(2 - S.snareCatch, days * 0.9 * S.rabbits / RABBITS_MAX);
    S.snareCatch += caught;
    S.rabbits -= caught;
  }
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
  if (S.stock.meat > 0 && S.min - S.meatSince > FISH_KEEPS_MIN) {
    if (S.projects.rack.done && !S.projects.rack.damaged) {
      S.stock.fish = Math.min(8, S.stock.fish + S.stock.meat);
      log('She hung the rabbit meat she couldn’t cook on the rack to dry.');
    } else {
      log('The rabbit she couldn’t cook went bad.');
      highlight('let some meat go bad');
    }
    S.stock.meat = 0;
  }
}

/** Add rabbit meat; like fish, it needs cooking (or drying) within a few hours. */
export function addMeat(n: number) {
  if (S.stock.meat === 0) S.meatSince = S.min;
  S.stock.meat += n;
}

/** Index of the nearest forest tree in a given state (or -1). */
export function nearestTree(state: 'tree' | 'stump' | 'sapling', from: Pt, skip = -1) {
  let best = -1, bd = 1e9;
  S.trees.forEach((t, i) => {
    if (t.state !== state || i === skip) return;
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
