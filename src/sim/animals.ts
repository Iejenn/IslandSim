// Chickens and sheep roam wild until she has a fence around her home (and a
// coop for the chickens). Then she herds them in one by one. Penned chickens
// lay eggs in the coop; penned sheep grow wool she can shear.
import { CHICKEN_HOMES, dist, SHEEP_HOMES, type Pt } from './island';
import { fx, season } from './seasons';
import { highlight, log, S, say } from './state';

const EGGS_PER_HEN_PER_DAY = 0.8;
const WOOL_DAYS = 2; // a shorn sheep's fleece grows back in this many days

/** @param dm game minutes elapsed */
export function updateAnimals(dm: number) {
  const days = dm / 1440;
  if (S.projects.coop.done) {
    const hens = S.chickens.filter(c => c.penned).length + S.bredHens;
    S.coopEggs = Math.min(12, S.coopEggs + hens * EGGS_PER_HEN_PER_DAY * fx().eggs * days);
  }
  for (const sh of [...S.sheep.filter(s => s.penned), ...S.bredSheep]) sh.wool = Math.min(1, sh.wool + days / WOOL_DAYS);
  breed(days);
}

const GROW_UP_DAYS = 8, MAX_BRED_HENS = 4, MAX_BRED_SHEEP = 3;
/** Spring (and a bit of summer): chicks hatch in the coop, lambs are born in the pen. They grow up in a week or so. */
function breed(days: number) {
  const s = season(), hens = S.chickens.filter(c => c.penned).length + S.bredHens, flock = S.sheep.filter(c => c.penned).length + S.bredSheep.length;
  const chicks = S.young.filter(y => y.kind === 'chick').length, lambs = S.young.filter(y => y.kind === 'lamb').length;
  const warm = s === 'spring' ? 1 : s === 'summer' ? 0.4 : 0;
  if (S.projects.coop.done && hens >= 2 && S.bredHens + chicks < MAX_BRED_HENS && Math.random() < days * 0.3 * warm) {
    S.young.push({ kind: 'chick', born: S.min });
    log('A chick hatched in the coop!', 'big');
    say('A chick! Look at you, little fluffball.');
    highlight('saw a chick hatch');
  }
  if (S.projects.fence.done && flock >= 2 && S.bredSheep.length + lambs < MAX_BRED_SHEEP && Math.random() < days * 0.18 * (s === 'spring' ? 1 : 0)) {
    S.young.push({ kind: 'lamb', born: S.min });
    log('A lamb was born in the pen, wobbly legs and all.', 'big');
    say('A lamb! Oh, I’m going to cry.');
    highlight('saw a lamb being born');
  }
  // growing up
  S.young = S.young.filter(y => {
    if (S.min - y.born < GROW_UP_DAYS * 1440) return true;
    if (y.kind === 'chick') S.bredHens++; else S.bredSheep.push({ wool: 0 });
    return false;
  });
}

/** The nearest animal she could bring home right now (sheep need the fence, chickens the coop too). */
export function nextToHerd(from: Pt): { kind: 'chicken' | 'sheep'; i: number; home: Pt } | null {
  if (!S.projects.fence.done) return null;
  let best: { kind: 'chicken' | 'sheep'; i: number; home: Pt } | null = null, bd = 1e9;
  const consider = (kind: 'chicken' | 'sheep', i: number, home: Pt) => {
    const d = dist(home, from);
    if (d < bd) { bd = d; best = { kind, i, home }; }
  };
  S.sheep.forEach((s, i) => { if (!s.penned && !s.away) consider('sheep', i, SHEEP_HOMES[i]); });
  if (S.projects.coop.done) S.chickens.forEach((c, i) => { if (!c.penned && !c.away) consider('chicken', i, CHICKEN_HOMES[i]); });
  return best;
}

export const sheepToShear = () => S.sheep.filter(s => s.penned && s.wool >= 1).length + S.bredSheep.filter(s => s.wool >= 1).length;
