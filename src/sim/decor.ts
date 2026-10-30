// Making her camp her own: once it's established she decorates it, one piece
// at a time, from things that suit her taste (flower planters for a gardener,
// nets and floats for a sea lover, bunting and painted stones for a creative
// soul…), each in its own spot around camp (see world/decor.ts).
import { DECOR_SPOTS } from './island';
import { dayNum, highlight, log, S, type Resource } from './state';
import { tasteFor, type Leaning } from './taste';

export type DecorKey = 'planters' | 'bunting' | 'stones' | 'nets' | 'feeder' | 'bench' | 'statue' | 'border' | 'kennel' | 'garland';
interface DecorDef { name: string; tags: Leaning[]; cost: Partial<Record<Resource, number>>; ok?: () => boolean }
export const DECOR: Record<DecorKey, DecorDef> = {
  planters: { name: 'flower planters', tags: ['green'], cost: { wood: 1, stone: 2 } },
  bunting: { name: 'bunting', tags: ['creative'], cost: { fibre: 3, wood: 2 } },
  stones: { name: 'a ring of painted stones', tags: ['creative'], cost: { stone: 4 } },
  nets: { name: 'fishing nets and floats', tags: ['sea'], cost: { fibre: 4 }, ok: () => S.stats.fishTrips >= 5 },
  feeder: { name: 'a bird feeder', tags: ['animals', 'green'], cost: { wood: 2 } },
  bench: { name: 'a driftwood bench', tags: ['comfort'], cost: { wood: 3 } },
  statue: { name: 'a carved statue', tags: ['creative'], cost: { wood: 3 }, ok: () => S.skills.crafting.lvl >= 4 },
  border: { name: 'a stone border', tags: ['practical'], cost: { stone: 5 } },
  kennel: { name: 'a kennel', tags: ['animals', 'comfort'], cost: { wood: 4 }, ok: () => S.dog.state === 'friend' },
  garland: { name: 'a shell garland', tags: ['sea', 'creative'], cost: { shells: 2, fibre: 1 } },
};
const RESERVE: Partial<Record<Resource, number>> = { wood: 2 }; // (logs for the fire come first)

/** Is her camp established enough to start decorating? */
export const decorating = () => dayNum() >= 12 && Object.values(S.projects).filter(p => p.done).length >= 5 && S.decor.length < DECOR_SPOTS.length;
const affordable = (k: DecorKey) => Object.entries(DECOR[k].cost).every(([r, n]) => S.stock[r as Resource] >= n! + (RESERVE[r as Resource] ?? 0));
/** What she'd make next: something she hasn't got yet that suits her (and that she has the stuff for). */
export function nextDecor(): DecorKey | null {
  const options = (Object.keys(DECOR) as DecorKey[]).filter(k => !S.decor.some(d => d.key === k) && (DECOR[k].ok?.() ?? true) && affordable(k));
  if (!options.length) return null;
  let r = Math.random() * options.reduce((s, k) => s + tasteFor(DECOR[k].tags), 0);
  return options.find(k => (r -= tasteFor(DECOR[k].tags)) < 0) ?? options[0];
}
export function placeDecor(k: DecorKey) {
  for (const [r, n] of Object.entries(DECOR[k].cost)) S.stock[r as Resource] -= n!;
  S.decor.push({ key: k, spot: S.decor.length, at: dayNum() });
  const name = k === 'kennel' ? `a kennel for ${S.dog.name}` : DECOR[k].name;
  log(S.decor.length === 1 ? `She’s started making her camp pretty: ${name}.` : `She made ${name} for her camp.`, S.decor.length === 1 ? 'big' : undefined);
  highlight(`made ${name} for her camp`);
}
