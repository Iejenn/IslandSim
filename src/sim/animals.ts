// Chickens and sheep roam wild until she has a fence around her home (and a
// coop for the chickens). Then she herds them in one by one. Penned chickens
// lay eggs in the coop; penned sheep grow wool she can shear.
import { CHICKEN_HOMES, dist, SHEEP_HOMES, type Pt } from './island';
import { S } from './state';

const EGGS_PER_HEN_PER_DAY = 0.8;
const WOOL_DAYS = 2; // a shorn sheep's fleece grows back in this many days

/** @param dm game minutes elapsed */
export function updateAnimals(dm: number) {
  const days = dm / 1440;
  if (S.projects.coop.done) {
    const hens = S.chickens.filter(c => c.penned).length;
    S.coopEggs = Math.min(12, S.coopEggs + hens * EGGS_PER_HEN_PER_DAY * days);
  }
  for (const sh of S.sheep) if (sh.penned) sh.wool = Math.min(1, sh.wool + days / WOOL_DAYS);
}

/** The nearest animal she could bring home right now (sheep need the fence, chickens the coop too). */
export function nextToHerd(from: Pt): { kind: 'chicken' | 'sheep'; i: number; home: Pt } | null {
  if (!S.projects.fence.done) return null;
  let best: { kind: 'chicken' | 'sheep'; i: number; home: Pt } | null = null, bd = 1e9;
  const consider = (kind: 'chicken' | 'sheep', i: number, home: Pt) => {
    const d = dist(home, from);
    if (d < bd) { bd = d; best = { kind, i, home }; }
  };
  S.sheep.forEach((s, i) => { if (!s.penned) consider('sheep', i, SHEEP_HOMES[i]); });
  if (S.projects.coop.done) S.chickens.forEach((c, i) => { if (!c.penned) consider('chicken', i, CHICKEN_HOMES[i]); });
  return best;
}

export const sheepToShear = () => S.sheep.filter(s => s.penned && s.wool >= 1).length;
