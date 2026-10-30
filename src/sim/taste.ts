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
  practical: ['lodge', 'hearth', 'dock', 'shed'],
  animals: ['coop', 'blanket'],
  green: ['garden', 'barrel'],
  sea: ['canoe', 'dock', 'trap', 'houseboat'],
  creative: ['shelf', 'drum', 'treehouse', 'kiln', 'bandstand'],
  adventure: ['treehouse', 'lookout', 'canoe', 'houseboat'],
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
  dance: 'creative', cairn: 'adventure', sandcastle: 'sea', clouds: 'comfort', bouquet: 'green', whittle: 'creative', mushrooms: 'green', turtles: 'animals', tendgull: 'animals', honey: 'green', bathe: 'comfort', dig: 'adventure', salvage: 'adventure', explore: 'adventure', hunt: 'adventure', checksnares: 'practical', watch: 'adventure', stargaze: 'adventure',
  relax: 'comfort',
};
/** −0.05 … +0.1 extra score for activities that match her taste. */
export function activityBias(id: TaskId) {
  const l = TASK_LEANING[id];
  // hunting doesn't sit well with an animal lover
  const hunting = id === 'hunt' || id === 'checksnares' ? -0.3 * S.taste.animals : 0;
  return (l ? 0.15 * (S.taste[l] - 0.35) : 0) + hunting;
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
  houseboat: 'One day I’ll live on the water. A little houseboat.',
  lookout: 'I want to see the whole island from up high one day.',
  bandstand: 'One day I’ll have a little stage, and play my music to the whole island.',
  kiln: 'One day I’ll fire my own pottery. There must be clay somewhere.',
  shed: 'One day every tool I make will have its own hook on a wall.',
};

// what washed ashore with her, and the little quirks the player can spot
const WASHED: Record<string, [string, string]> = {
  knife: ['Washed up beside her: a rusty pocket knife. It still cuts.', 'A knife! That’ll make things easier.'],
  line: ['Tangled in the seaweed: a real fishing line with a hook.', 'A fishing line… with a hook!'],
  pot: ['A dented cooking pot washed up with her.', 'A pot! Proper cooking.'],
  tarp: ['A big sheet of tarp washed up on the beach. Good for a roof.', 'A tarp. That’ll keep the rain off.'],
};
const QUIRK_HINT: Record<string, string> = {
  earlybird: 'She was up before the sun again. Always the early riser.',
  nightowl: 'She stayed up late again, watching the fire. A night owl, through and through.',
  collector: 'Her pockets are already full of pretty stones and shells. She can’t help collecting.',
  seasick: 'Even watching the waves makes her a little queasy. She was always seasick.',
  hardy: 'The chilly night didn’t bother her one bit. Tough as old boots.',
};

/** Diary notes about her taste and dream, once each (and a reminder of the dream now and then). */
export function noteTaste(dayNum: number) {
  const note = (key: string, text: string) => { if (!S.feelingsNoted.includes(key)) { S.feelingsNoted.push(key); log(text); return true; } return false; };
  if (S.min > 10 * 60) note('taste:hint', HINT[strongest(S.taste)]);
  if (S.washedUp && S.min > 7.5 * 60 && note('washed', WASHED[S.washedUp][0])) say(WASHED[S.washedUp][1]);
  if (S.quirk && dayNum >= 2 && S.min % 1440 > 9 * 60) note('quirk', QUIRK_HINT[S.quirk]);
  const line = dreamLine();
  if (dayNum >= 2 && line && note('dream', `She told the island about her dream: “${line}”`)) say(line);
}
export const dreamLine = () => (S.dream && DREAM_SAY[S.dream]) || '';
