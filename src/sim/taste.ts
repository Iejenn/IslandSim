// Her taste: what kind of life she leans towards. Rolled once per islander, so
// two castaways with the same traits still want different things in a different
// order. Leanings only tilt the odds (x0.5 … x2), they never forbid anything: an
// animal lover can still end up building a lodge, just less likely first.
// She also has one dream: a bigger thing she's set on from the start.
import { log, S, say, type PlanKey, type TaskId } from './state';
import { pick, rand } from './util';

export const LEANINGS = ['comfort', 'practical', 'animals', 'green', 'sea', 'creative', 'adventure'] as const;
export type Leaning = typeof LEANINGS[number];
export type Taste = Record<Leaning, number>;

/** Every leaning gets a mild random score; two of them are her real passions. */
export function rollTaste(): Taste {
  const t = Object.fromEntries(LEANINGS.map(l => [l, rand(0.05, 0.45)])) as Taste;
  const order = [...LEANINGS].sort(() => Math.random() - 0.5);
  t[order[0]] = rand(0.75, 1);
  t[order[1]] = rand(0.55, 0.8);
  return t;
}

// what someone with each passion might dream of building
const DREAMS: Record<Leaning, PlanKey[]> = {
  comfort: ['lodge', 'sofa', 'realbed'],
  practical: ['lodge', 'hearth', 'dock'],
  animals: ['coop', 'blanket'],
  green: ['garden', 'barrel'],
  sea: ['canoe', 'dock', 'trap'],
  creative: ['shelf', 'drum', 'treehouse'],
  adventure: ['treehouse', 'lookout', 'canoe'],
};
export function rollDream(t: Taste): PlanKey {
  return pick(DREAMS[strongest(t)]);
}
export const strongest = (t: Taste) => LEANINGS.reduce((a, b) => t[b] > t[a] ? b : a);

/** How much her taste makes her want a plan with these tags: 0.5 (not her thing) … 2 (her passion). */
export function tasteFor(tags: readonly Leaning[]) {
  if (!tags.length) return 1;
  const v = Math.max(...tags.map(l => S.taste[l]));
  return 0.5 + 1.5 * v;
}

/** Doing what she loves makes her love it a little more. */
export function growTaste(tags: readonly Leaning[], by = 0.04) {
  for (const l of tags) S.taste[l] = Math.min(1, S.taste[l] + by);
}

// Which leaning each everyday activity belongs to: a small nudge in decide()
const TASK_LEANING: Partial<Record<TaskId, Leaning>> = {
  fish: 'sea', swim: 'sea', sail: 'sea', checktrap: 'sea',
  herd: 'animals', collect: 'animals', shear: 'animals', befriend: 'animals', play: 'animals',
  plant: 'green', water: 'green', harvest: 'green', replant: 'green',
  drum: 'creative', write: 'creative',
  explore: 'adventure', watch: 'adventure', stargaze: 'adventure',
  relax: 'comfort',
};
/** −0.05 … +0.1 extra score for activities that match her taste. */
export function activityBias(id: TaskId) {
  const l = TASK_LEANING[id];
  return l ? 0.15 * (S.taste[l] - 0.35) : 0;
}

/* ---------- letting the player discover her taste through the diary ---------- */
const HINT: Record<Leaning, string> = {
  comfort: 'She keeps eyeing the softest patch of sand. She’s always liked a cosy home.',
  practical: 'She’s already sizing up which rocks would make good tools.',
  animals: 'She can’t stop watching the chickens and sheep wandering about.',
  green: 'She knelt to look at every little plant along the way. Green fingers, back home.',
  sea: 'She stood at the waterline a long time. The sea has always called to her.',
  creative: 'She drew pictures in the sand with a stick. She’s always made things.',
  adventure: 'She keeps looking at the far end of the island, wondering what’s there.',
};
const DREAM_SAY: Partial<Record<PlanKey, string>> = {
  lodge: 'One day I’ll build a real house here. With rooms.',
  sofa: 'Someday I’ll have a proper sofa again. Just you wait.',
  realbed: 'A real bed. One day. That’s the dream.',
  hearth: 'A proper stone hearth, that’s what this camp needs one day.',
  dock: 'I want to build a dock, out past the shallows.',
  coop: 'Imagine fresh eggs every morning. I’ll get those chickens one day.',
  blanket: 'If I could get some wool, I’d knit the warmest blanket.',
  garden: 'I want to grow my own food. A real garden.',
  barrel: 'I’m going to catch the rain one day, instead of walking to that pond.',
  canoe: 'One day I’ll make a canoe and paddle around this whole island.',
  trap: 'A fish trap that catches dinner while I sleep. That’s the dream.',
  shelf: 'I want a place to show off everything I find.',
  drum: 'I miss music so much. One day I’ll make an instrument.',
  treehouse: 'A house up in the trees… like when I was little.',
  lookout: 'I want to see the whole island from up high one day.',
};

/** Diary notes about her taste and dream, once each (and a reminder of the dream now and then). */
export function noteTaste(dayNum: number) {
  const note = (key: string, text: string) => { if (!S.feelingsNoted.includes(key)) { S.feelingsNoted.push(key); log(text); return true; } return false; };
  if (S.min > 10 * 60) note('taste:hint', HINT[strongest(S.taste)]);
  const line = dreamLine();
  if (dayNum >= 2 && line && note('dream', `She told the island about her dream: “${line}”`)) say(line);
}
export const dreamLine = () => (S.dream && DREAM_SAY[S.dream]) || '';
