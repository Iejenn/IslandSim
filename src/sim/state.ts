// The whole simulation state lives in one plain object (S) so it's easy to
// inspect and could later be saved/loaded. No Three.js or DOM in here: the
// sim talks to the outside world only through `hooks`, which main.ts wires up.
import type { AnimKey } from '../config/animations';
import { BOULDERS, copy, FOREST, PLOTS, START, type Pt } from './island';
import { clamp, mergeInto, pick } from './util';

export const NAMES = ['Mara', 'Lena', 'Iris', 'Noor', 'Sofie', 'Ava', 'Elin', 'Tess', 'Yara', 'Fenna'];
export const TRAITS = { musical: 'Musical', curious: 'Curious', hardworking: 'Hard-working', lazy: 'Easy-going', social: 'Sociable' };
export const SKILLS = { foraging: 'Foraging', fishing: 'Fishing', survival: 'Survival', crafting: 'Crafting', building: 'Building', gardening: 'Gardening', music: 'Music', writing: 'Storytelling' };
export const NEEDS = { food: 'Food', water: 'Water', energy: 'Energy', fun: 'Fun', company: 'Company' };

export type Trait = keyof typeof TRAITS;
export type SkillKey = keyof typeof SKILLS;
export type NeedKey = keyof typeof NEEDS;
/** Things she makes in one sitting at the campfire. */
export type CraftKey = 'axe' | 'pick' | 'rod' | 'basket' | 'hammock' | 'bucket' | 'drum' | 'journal'
  | 'chair' | 'table' | 'bed' | 'shelf' | 'rocker'; // furniture, once her crafting is good enough
/** Things she builds over several sessions on site. */
export type ProjectKey = 'garden' | 'rack' | 'dock' | 'hut' | 'hearth' | 'lookout' | 'canoe';
export type PlanKey = CraftKey | ProjectKey;
export type Resource = 'wood' | 'stone' | 'fibre';
export type TaskId =
  | 'forage' | 'fish' | 'cook' | 'eat' | 'drink' | 'wood' | 'sleep' | 'shelter' | 'relax' | 'explore' | 'talk'
  | 'sticks' | 'chop' | 'fibre' | 'stones' | 'mine' | 'replant' | 'craft' | 'build'
  | 'plant' | 'water' | 'harvest' | 'drum' | 'write' | 'sail' | 'stargaze' | 'watch'
  | 'befriend' | 'play' | 'repair' | 'swim'
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
  pose: 'sit' | 'gather' | 'idle' | 'chop' | 'hammer';
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
}

export interface DiaryEntry { t: string; text: string }

/** One garden bed. growth 0→1 is ripe; water 0→100 drains over time. */
export interface Plot {
  state: 'empty' | 'growing' | 'ripe' | 'withered';
  growth: number;
  water: number;
  dryMin: number; // game minutes spent completely dry
}

export interface Project { started: boolean; progress: number; done: boolean; damaged?: boolean }

function rollTraits(): [Trait, Trait] {
  const k = Object.keys(TRAITS) as Trait[];
  const a = pick(k);
  let b: Trait;
  do b = pick(k);
  while (b === a || ((a + b).includes('lazy') && (a + b).includes('hardworking')));
  return [a, b];
}

function createState() {
  return {
    name: pick(NAMES),
    traits: rollTraits(),
    min: 7 * 60, // game minutes since day 1, 00:00
    dayIdx: 0,
    speed: 1,
    needs: { food: 78, water: 72, energy: 88, fun: 66, company: 62 } as Record<NeedKey, number>,
    health: 100,
    mood: 0,
    fire: 55,
    skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, { xp: 0, lvl: 0 }])) as Record<SkillKey, { xp: number; lvl: number }>,
    berries: [6, 6, 6], // one count per bush in island.BUSHES
    items: {} as Partial<Record<CraftKey, boolean>>, // things she has crafted
    diary: [] as DiaryEntry[],
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
    stock: { wood: 2, stone: 0, fibre: 0, saplings: 0, raw: 0, fish: 0, seeds: 0, veg: 0, shells: 0 }, // veg: stored garden vegetables; shells: her collection
    rawSince: 0, // game minute the oldest uncooked fish was caught
    lastMeal: 0, // game minute of her last cooked meal
    trees: FOREST.map(() => ({ state: 'tree' as 'tree' | 'stump' | 'sapling', growth: 1 })),
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
    } as Record<ProjectKey, Project>,
    goal: null as PlanKey | null, // what she's working towards (something to craft or build)
    goalSince: 0, // game minute the goal was set
    crafting: { started: false, progress: 0 }, // progress on the current goal when it's a craft
    plots: PLOTS.map((): Plot => ({ state: 'empty', growth: 0, water: 0, dryMin: 0 })),
    // how much she likes each activity, -1..1, learned from how it went
    likes: {} as Partial<Record<TaskId, number>>,
    feelingsNoted: [] as string[], // strong likes/dislikes already written in the diary
    // lifetime counters (unlock new plans)
    stats: { forages: 0, fishTrips: 0, fishCaught: 0, nightsInShelter: 0, waterings: 0, harvests: 0, rainsSeen: 0, writeMin: 0, treesFelled: 0, stonesMined: 0, crafted: 0, meals: 0, storms: 0, repairs: 0 },
    // highlights of the current day, summarised in the diary at dawn
    today: [] as string[],
    weather: { raining: false, until: 0, storm: false, hot: false },
    // a stray dog that may wash ashore; she has to win its trust
    dog: { state: 'none' as 'none' | 'wild' | 'friend', trust: 0, name: '', home: copy(START) },
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
  }
  return S;
}

/** How the sim reaches the outside world. main.ts replaces these no-ops. */
export const hooks = {
  play: (_anim: AnimKey, _forceOnce?: boolean) => {},
  onSay: () => {},
  onDeath: () => {},
};

export const tr = (k: Trait) => S.traits.includes(k);
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

export function log(text: string) {
  S.diary.unshift({ t: `Day ${dayNum()}, ${clock()}`, text });
  S.diary.length = Math.min(S.diary.length, 120);
  S.diaryDirty = true;
}
export function say(text: string) {
  S.thought = text;
  hooks.onSay();
}
/** Raise (or lower) a need, kept within 0–100. */
export function feed(k: NeedKey, v: number) {
  S.needs[k] = clamp(S.needs[k] + v, 0, 100);
}
/** Note something for tonight's diary recap (deduplicated). */
export function highlight(text: string) {
  if (!S.today.includes(text)) S.today.push(text);
}
