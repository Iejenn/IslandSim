// The whole simulation state lives in one plain object (S) so it's easy to
// inspect and could later be saved/loaded. No Three.js or DOM in here: the
// sim talks to the outside world only through `hooks`, which main.ts wires up.
import type { AnimKey } from '../config/animations';
import { BAMBOO, ORCHARD, BOULDERS, BUSHES, CHICKEN_HOMES, copy, FOREST, FOREST_START, PLOTS, SHEEP_HOMES, START, type Pt } from './island';
import { rollEvents } from './events';
import { rollDream, rollStyle, rollTaste } from './taste';
import { YEAR_DAYS, type DayMood, type Illness } from './life';
import type { DecorKey } from './decor';
import { clamp, mergeInto, pick, rand } from './util';

export const NAMES = ['Mara', 'Lena', 'Iris', 'Noor', 'Sofie', 'Ava', 'Elin', 'Tess', 'Yara', 'Fenna'];
export const TRAITS = { musical: 'Musical', curious: 'Curious', hardworking: 'Hard-working', lazy: 'Easy-going', social: 'Sociable' };
export const SKILLS = { foraging: 'Foraging', fishing: 'Fishing', survival: 'Survival', crafting: 'Crafting', building: 'Building', gardening: 'Gardening', music: 'Music', writing: 'Storytelling' };
export const NEEDS = { food: 'Food', water: 'Water', energy: 'Energy', fun: 'Fun', company: 'Company' };

export type Trait = keyof typeof TRAITS;
export type SkillKey = keyof typeof SKILLS;
export type NeedKey = keyof typeof NEEDS;
/** Things she makes in one sitting at the campfire. */
export type CraftKey = 'axe' | 'pick' | 'rod' | 'spear' | 'snare' | 'basket' | 'hammock' | 'bucket' | 'drum' | 'flute' | 'ukulele' | 'marimba' | 'journal'
  | 'chair' | 'table' | 'bed' | 'shelf' | 'rocker' // furniture, once her crafting is good enough
  | 'realbed' | 'sofa' | 'kitchen' // for the lodge's rooms
  | 'blanket' | 'sweater' // from her sheep's wool
  | 'pots' | 'jug' | 'tiles' // fired in the kiln
  | 'lanterns' // along her paths
  | 'flinttools' | 'chimes' // from the cave's flint and the islet's bamboo
  | 'rework' // remaking a piece she already has in her favourite material (repeatable, see plans.ts)
  | 'irontools'; // from the furnace's iron
/** Things she builds over several sessions on site. */
export type ProjectKey = 'garden' | 'rack' | 'dock' | 'hut' | 'hearth' | 'lookout' | 'canoe' | 'lodge' | 'fence' | 'coop'
  | 'trap' | 'barrel' | 'treehouse' // other ways to get food, water and a home
  | 'houseboat' | 'shed' | 'bandstand' | 'orchard'
  | 'kiln' | 'oven' // working with clay
  | 'beehive' | 'sundial' | 'mosaic' | 'bathhouse' // rare: only some islands (see S.rare)
  | 'bridge' | 'cave' | 'pipe' | 'well' // island growth: the islet, the cave, water at camp
  | 'saltpans' | 'firecover' | 'smokehouse' | 'workshop' | 'furnace'; // v1.5: food that keeps, a workshop, metal
export type PlanKey = CraftKey | ProjectKey;
export type Resource = 'wood' | 'stone' | 'fibre' | 'wool' | 'clay' | 'shells' | 'bamboo' | 'flint' | 'salt' | 'ore' | 'iron';
/** What she likes to build things from (furniture, the fence, the bridge): a preference, not a rule. */
export type Style = 'wood' | 'bamboo' | 'stone';
export type TaskId =
  | 'forage' | 'fish' | 'cook' | 'eat' | 'drink' | 'wood' | 'sleep' | 'shelter' | 'relax' | 'explore' | 'talk'
  | 'sticks' | 'chop' | 'fibre' | 'stones' | 'mine' | 'replant' | 'craft' | 'build'
  | 'plant' | 'water' | 'harvest' | 'drum' | 'write' | 'sail' | 'stargaze' | 'watch'
  | 'befriend' | 'play' | 'repair' | 'swim' | 'herd' | 'shear' | 'collect' | 'checktrap' | 'hunt' | 'checksnares' | 'mushrooms'
  | 'clay' | 'salvage' | 'turtles' | 'tendgull' | 'dig' | 'honey' | 'bathe'
  | 'cairn' | 'sandcastle' | 'clouds' | 'bouquet' | 'whittle' | 'dance'
  | 'plantfruit' | 'pickfruit' | 'nightwalk' | 'beachstars' | 'tidepools' | 'bamboo' | 'flint' | 'salt' | 'smoke' | 'ore' | 'smelt' | 'tea' | 'party' | 'totem' | 'decorate' | 'ducks' | 'parrot'
  | 'celebrate' | 'stand';

/* ---------- task steps ---------- */
export interface GoStep {
  type: 'go';
  to: Pt;
  carry: boolean;
  run?: boolean; // hurry (critical need)
  ride?: boolean; // in the boat: no walking animation, moves over water
  path?: Pt[];
}
export interface DoStep {
  type: 'do';
  pose: 'sit' | 'lie' | 'gather' | 'idle' | 'chop' | 'hammer'; // lie: on her back, feet where she stood, head towards `face`
  face?: Pt;
  min: number; // game minutes
  tick?: (dm: number) => void;
  done?: (() => void) | null;
  lift?: number;
  begin?: () => void; // runs once when the step starts
}
export interface WaitStep { type: 'wait'; anim: AnimKey; sec: number } // real seconds
export type Step = GoStep | DoStep | WaitStep;

export interface Task {
  id: TaskId;
  label: string;
  thought?: string;
  steps: Step[];
  i: number;
  started: boolean;
  el: number;
  celebrate?: boolean;
  animal?: { kind: 'chicken' | 'sheep'; i: number }; // the animal she's herding home (so it can follow her)
  instrument?: 'drum' | 'flute' | 'ukulele' | 'marimba'; // what she's playing (for the animation and the sound)
}

// kind: 'big' = a moment worth highlighting, 'recap' = the summary of a day (shown at the top of that day)
export interface DiaryEntry { t: string; text: string; day?: number; kind?: 'big' | 'recap' }

/** One garden bed. growth 0→1 is ripe; water 0→100 drains over time. */
export type Crop = 'greens' | 'tomato' | 'corn' | 'pumpkin' | 'flowers' | 'herbs';
export interface Plot {
  state: 'empty' | 'growing' | 'ripe' | 'withered';
  crop?: Crop; // what's growing in it (older saves: tomatoes)
  growth: number;
  water: number;
  dryMin: number; // game minutes spent completely dry
}

// builtAt: game minute it was finished (or last repaired), so the world can weather it
export interface Project { started: boolean; progress: number; done: boolean; damaged?: boolean; builtAt?: number }

function rollTraits(): [Trait, Trait] {
  const k = Object.keys(TRAITS) as Trait[];
  const a = pick(k);
  let b: Trait;
  do b = pick(k);
  while (b === a || ((a + b).includes('lazy') && (a + b).includes('hardworking')));
  return [a, b];
}

// Random looks for the things she makes (0…1 each, the world maps them onto a
// colour palette), so one island's tent is green and another's blue.
// Small things that make one castaway unlike another (see diary hints in taste.ts)
export const QUIRKS = ['earlybird', 'nightowl', 'collector', 'seasick', 'hardy'] as const;
export type Quirk = typeof QUIRKS[number];
export const DISHES = ['fish', 'rabbit', 'eggs', 'veg', 'stew', 'berries'] as const;
// what washed ashore with her (or nothing)
export const WASHED_UP = ['knife', 'line', 'pot', 'tarp'] as const;

export const LOOK_KEYS = ['tarp', 'bedding', 'hammock', 'cushion', 'blanket', 'roof', 'wood'] as const;

function createState() {
  const taste = rollTaste();
  return {
    name: pick(NAMES),
    traits: rollTraits(),
    taste, // what kind of life she leans towards (see taste.ts)
    dream: rollDream(taste) as PlanKey | null, // the one big thing she's set on
    style: rollStyle(taste), // what she likes to build from (see plans.ts styleFor)
    madeStyle: {} as Partial<Record<PlanKey, Style>>, // what each styled thing was actually made from
    reworkOf: null as PlanKey | null, // which piece her 'rework' goal is remaking
    quirk: (Math.random() < 0.7 ? pick(QUIRKS) : null) as Quirk | null,
    favFood: pick(DISHES) as typeof DISHES[number],
    washedUp: (Math.random() < 0.6 ? pick(WASHED_UP) : null) as typeof WASHED_UP[number] | null,
    // the island's own character: when its year starts, how rainy it is, who lives there
    island: {
      seasonStart: Math.floor(Math.random() * 4), // 0 spring … 3 winter
      rain: rand(0.65, 1.5), // a dry island or a wet one
      dog: Math.random() < 0.75, // not every island gets a stray dog
    },
    look: Object.fromEntries(LOOK_KEYS.map(k => [k, Math.random()])) as Record<typeof LOOK_KEYS[number], number>,
    min: 7 * 60, // game minutes since day 1, 00:00
    dayIdx: 0,
    speed: 1,
    needs: { food: 78, water: 72, energy: 88, fun: 66, company: 62 } as Record<NeedKey, number>,
    health: 100,
    mood: 0,
    fire: 55,
    skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, { xp: 0, lvl: 0 }])) as Record<SkillKey, { xp: number; lvl: number }>,
    berries: BUSHES.map(() => 6), // one count per bush in island.BUSHES
    items: {} as Partial<Record<CraftKey, boolean>>, // things she has crafted
    diary: [] as DiaryEntry[],
    story: [] as { day: number; text: string }[], // the big moments of her life, kept for good (the "Her story" tab)
    thought: '',
    activity: 'Waking up',
    lastAction: null as TaskId | null,
    curious: [] as CraftKey[], // new things she hasn't tried yet
    fishFails: 0,
    warned: 0,
    dead: false,
    lift: 0, // extra height above the ground (hammock)

    /* ---------- island life ---------- */
    // logs on the woodpile, stones, plant fibre, saplings to replant, fresh fish to cook, dried fish, garden seeds
    stock: { wood: 2, stone: 0, fibre: 0, saplings: 0, raw: 0, fish: 0, seeds: 0, veg: 0, shells: 0, eggs: 0, wool: 0, meat: 0, clay: 0, honey: 0, fruit: 0, bamboo: 0, flint: 0, salt: 0, ore: 0, iron: 0, herbs: 0 }, // veg: stored garden vegetables; shells: her collection
    rawSince: 0, // game minute the oldest uncooked fish was caught
    meatSince: 0, // …and the oldest uncooked rabbit
    lastMeal: 0, // game minute of her last cooked meal
    // (empty: open ground at the forest's edge where a tree may seed itself; planted: day she planted it)
    trees: FOREST.map((_, i) => ({ state: (i < FOREST_START ? 'tree' : 'empty') as 'tree' | 'stump' | 'sapling' | 'empty', growth: i < FOREST_START ? 1 : 0, planted: 0 })),
    boulders: BOULDERS.map(() => 8), // stones left in each boulder
    deadwood: 6, // fallen branches lying around the forest
    loose: 8, // loose stones lying around the rocky area
    projects: {
      garden: { started: false, progress: 0, done: false },
      rack: { started: false, progress: 0, done: false },
      dock: { started: false, progress: 0, done: false },
      hut: { started: false, progress: 0, done: false },
      hearth: { started: false, progress: 0, done: false },
      lookout: { started: false, progress: 0, done: false },
      canoe: { started: false, progress: 0, done: false },
      lodge: { started: false, progress: 0, done: false },
      fence: { started: false, progress: 0, done: false },
      coop: { started: false, progress: 0, done: false },
      trap: { started: false, progress: 0, done: false },
      barrel: { started: false, progress: 0, done: false },
      treehouse: { started: false, progress: 0, done: false },
      houseboat: { started: false, progress: 0, done: false },
      shed: { started: false, progress: 0, done: false },
      bandstand: { started: false, progress: 0, done: false },
      orchard: { started: false, progress: 0, done: false },
      bridge: { started: false, progress: 0, done: false },
      cave: { started: false, progress: 0, done: false },
      pipe: { started: false, progress: 0, done: false },
      well: { started: false, progress: 0, done: false },
      saltpans: { started: false, progress: 0, done: false },
      firecover: { started: false, progress: 0, done: false },
      smokehouse: { started: false, progress: 0, done: false },
      workshop: { started: false, progress: 0, done: false },
      furnace: { started: false, progress: 0, done: false },
      kiln: { started: false, progress: 0, done: false },
      oven: { started: false, progress: 0, done: false },
      beehive: { started: false, progress: 0, done: false },
      sundial: { started: false, progress: 0, done: false },
      mosaic: { started: false, progress: 0, done: false },
      bathhouse: { started: false, progress: 0, done: false },
    } as Record<ProjectKey, Project>,
    goal: null as PlanKey | null, // what she's working towards (something to craft or build)
    goalSince: 0, // game minute the goal was set
    gaveUp: {} as Partial<Record<PlanKey, number>>, // goals she dropped, and the day she dropped them
    crafting: { started: false, progress: 0 }, // progress on the current goal when it's a craft
    plots: PLOTS.map((): Plot => ({ state: 'empty', growth: 0, water: 0, dryMin: 0 })),
    // how much she likes each activity, -1..1, learned from how it went
    likes: {} as Partial<Record<TaskId, number>>,
    feelingsNoted: [] as string[], // strong likes/dislikes already written in the diary
    // lifetime counters (unlock new plans)
    stats: { hunted: 0, freed: 0, herded: 0, eggs: 0, shorn: 0, forages: 0, fishTrips: 0, fishCaught: 0, nightsInShelter: 0, waterings: 0, harvests: 0, rainsSeen: 0, writeMin: 0, treesFelled: 0, stonesMined: 0, crafted: 0, meals: 0, storms: 0, repairs: 0, reworks: 0 },
    // highlights of the current day, summarised in the diary at dawn
    today: [] as string[],
    // coming: when the clouds that have been gathering will start to rain (0 = none on the way)
    weather: { raining: false, until: 0, storm: false, hot: false, clearedAt: -9999, coming: 0, comingStorm: false },
    // chickens and sheep roam wild until she fences her home and herds them in
    // not every island has the same flock: some homes stay empty ("away")
    chickens: CHICKEN_HOMES.map((_, i) => ({ penned: false, away: i >= 2 && Math.random() < 0.4 })),
    sheep: SHEEP_HOMES.map((_, i) => ({ penned: false, wool: 0, away: i >= 1 && Math.random() < 0.4 })), // wool: 0…1, ready to shear at 1
    coopEggs: 0, // eggs waiting in the coop
    // animals born on the island: young ones (chicks, lambs) grow up into extra hens and sheep
    young: [] as { kind: 'chick' | 'lamb'; born: number }[],
    bredHens: 0,
    bredSheep: [] as { wool: number }[],
    trapFish: 0, // fish waiting in her fish trap
    barrel: 0, // drinks of rainwater in the barrel
    rabbits: Math.round(rand(4, 12)), // wild rabbits around the warren deep in the forest (they breed back)
    snareCatch: 0, // rabbits waiting in her snares
    mushrooms: 0, // patches of mushrooms in the forest (autumn only)
    hive: 0, // honey waiting in the beehive
    // fruit trees she planted in her orchard (one per spot in island.ORCHARD)
    orchard: ORCHARD.map(() => ({ kind: null as FruitKind | null, growth: 0, fruit: 0, planted: 0 })),
    bamboo: BAMBOO.map(() => 4 + Math.floor(Math.random() * 3)), // canes ready to cut in each clump on the islet (they grow back fast)
    isletFound: false, // has she waded out to the islet yet?
    saltPans: 0, // salt drying in her salt pans, ready to scrape up
    // which rare projects this island allows (most islands get two of the four)
    rare: pickSome(['beehive', 'sundial', 'mosaic', 'bathhouse'] as ProjectKey[], Math.random() < 0.3 ? 3 : 2),
    // things that happen on this island, and when (see events.ts)
    events: rollEvents(),
    wreck: { state: 'none' as 'none' | 'ashore' | 'salvaged', a: 0 }, // a: where on the beach (angle)
    turtle: { state: 'none' as 'none' | 'nest' | 'hatched', a: 0, hatchAt: 0, visits: 0 },
    gull: { state: 'none' as 'none' | 'hurt' | 'pet' | 'gone', care: 0 },
    droughtUntil: 0, // game minute a drought ends
    // little things she makes for the joy of it (and leaves lying around)
    cairns: [] as number[], // beach angles of the stone stacks she's built
    sandcastle: null as { a: number; at: number } | null, // until the tide takes it
    bouquetAt: 0, // game minute she last put fresh flowers on the table (0 = none)
    carvings: 0, // little wooden animals she's whittled
    madeAt: {} as Partial<Record<PlanKey, number>>, // day each thing was first made or built (for the info cards)
    wear: {} as Record<string, number>, // trodden paths: how worn each grid cell is, 0…1 (see paths.ts)
    wearVersion: 0, // bumped whenever wear changes, so the world knows to redraw
    injuredUntil: 0, // game minute her sprained ankle has healed
    // her life (see life.ts): today's mood, the odd illness, her birthday, what she's mastered
    dayMood: 'ordinary' as DayMood,
    ill: null as { kind: Illness; until: number } | null,
    ateRawAt: -99999, // when she last ate raw fish (a bad idea)
    birthday: Math.floor(rand(4, YEAR_DAYS + 1)), // day of the island year
    partied: false, // has she celebrated today's birthday yet?
    mastery: {} as Partial<Record<SkillKey, number>>, // day she became known for each skill
    song: '', book: '', islandName: '', recordFish: 0, totems: 0, // what she has to show for it
    decor: [] as { key: DecorKey; spot: number; at: number }[], // how she's decorated her camp (decor.ts)
    // her animal friends (friends.ts)
    names: { hens: [] as string[], sheep: [] as string[] }, favHen: -1, ducks: 0,
    parrot: { state: 'none' as 'none' | 'wild' | 'friend', trust: 0, name: '', words: [] as string[] },
    caughtKinds: [] as string[], // the kinds of fish she's landed
    treasure: { found: 0, spots: [] as number[] }, // spots: beach angles still to dig (0 = none)
    // a stray dog that may wash ashore; she has to win its trust
    dog: { state: 'none' as 'none' | 'wild' | 'friend', trust: 0, name: '', home: copy(START), since: 0 },
    sailing: false, // in the boat

    // her body, as far as the sim is concerned
    pos: copy(START),
    faceTarget: null as Pt | null,
    task: null as Task | null,
    sitting: false,
    // tells the UI which lists need re-rendering
    diaryDirty: true,
  };
}
export type SimState = ReturnType<typeof createState>;

// Created by initState() rather than at import time so that random rolls
// (name, traits) happen after the world is scattered.
export let S: SimState;
/** Start a new life, or continue a saved one (see sim/persist.ts). */
export function initState(saved?: Record<string, unknown>) {
  S = createState();
  if (saved) {
    const fresh = createState();
    mergeInto(S as unknown as Record<string, unknown>, saved);
    // Lists tied to the island layout must match it; if the layout changed
    // since the save (e.g. a bigger forest), start those lists fresh.
    if (S.trees.length !== fresh.trees.length) S.trees = fresh.trees;
    if (S.boulders.length !== fresh.boulders.length) S.boulders = fresh.boulders;
    if (S.plots.length !== fresh.plots.length) S.plots = fresh.plots;
    if (S.berries.length !== fresh.berries.length) S.berries = fresh.berries;
    if (S.chickens.length !== fresh.chickens.length) S.chickens = fresh.chickens;
    if (S.sheep.length !== fresh.sheep.length) S.sheep = fresh.sheep;
    if (S.orchard.length !== fresh.orchard.length) S.orchard = fresh.orchard;
    if (S.bamboo.length !== fresh.bamboo.length) S.bamboo = fresh.bamboo;
    // (saves from before "Her story": start it from the big moments still in the diary)
    if (!S.story.length) S.story = S.diary.filter(d => d.kind === 'big' && d.day && !/^(Spring has come|Summer is here|Autumn has come|Winter has come)/.test(d.text))
      .reverse().map(d => ({ day: d.day!, text: d.text }));
  }
  return S;
}

/** How the sim reaches the outside world. main.ts replaces these no-ops. */
export const hooks = {
  play: (_anim: AnimKey, _forceOnce?: boolean) => {},
  onSay: () => {},
  onDeath: () => {},
};

export type FruitKind = 'mango' | 'banana' | 'lemon';
export const tr = (k: Trait) => S.traits.includes(k);
/** n different items from a list, in random order. */
function pickSome<T>(a: T[], n: number) { return [...a].sort(() => Math.random() - 0.5).slice(0, n); }
export const hour = () => (S.min / 60) % 24;
export const dayNum = () => Math.floor(S.min / 1440) + 1;
export const isNight = () => {
  const h = hour();
  return h >= 21 || h < 6;
};
export const clock = () => {
  const h = Math.floor(hour()), m = Math.floor(S.min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function log(text: string, kind?: DiaryEntry['kind'], day = dayNum(), story = kind === 'big') {
  S.diary.unshift({ t: clock(), text, day, kind });
  if (story) { S.story.push({ day, text }); if (S.story.length > 250) S.story.splice(1, 1); } // (keeps her first day)
  S.diary.length = Math.min(S.diary.length, 200);
  S.diaryDirty = true;
}
/** Who's listening when she speaks (her parrot, see friends.ts), without state.ts importing them. */
export const listeners = { said: [] as ((text: string) => void)[] };
export function say(text: string) {
  S.thought = text;
  hooks.onSay();
  for (const f of listeners.said) f(text);
}
/** Raise (or lower) a need, kept within 0–100. */
export function feed(k: NeedKey, v: number) {
  S.needs[k] = clamp(S.needs[k] + v, 0, 100);
}
/** Note something for tonight's diary recap (deduplicated). */
export function highlight(text: string) {
  if (!S.today.includes(text)) S.today.push(text);
}
