// The whole simulation state lives in one plain object (S) so it's easy to
// inspect and could later be saved/loaded. No Three.js or DOM in here: the
// sim talks to the outside world only through `hooks`, which main.ts wires up.
import type { AnimKey } from '../config/animations';
import { copy, START, type Pt, type Spot } from './island';
import { clamp, pick } from './util';

export const NAMES = ['Mara', 'Lena', 'Iris', 'Noor', 'Sofie', 'Ava', 'Elin', 'Tess', 'Yara', 'Fenna'];
export const TRAITS = { musical: 'Musical', curious: 'Curious', hardworking: 'Hard-working', lazy: 'Easy-going', social: 'Sociable' };
export const SKILLS = { foraging: 'Foraging', fishing: 'Fishing', survival: 'Survival', music: 'Piano', reading: 'Reading' };
export const NEEDS = { food: 'Food', water: 'Water', energy: 'Energy', fun: 'Fun', company: 'Company' };

export type Trait = keyof typeof TRAITS;
export type SkillKey = keyof typeof SKILLS;
export type NeedKey = keyof typeof NEEDS;
export type GiftKey = 'piano' | 'rod' | 'hammock' | 'books';
export type TaskId = 'forage' | 'fish' | 'drink' | 'wood' | 'sleep' | 'relax' | 'explore' | 'talk' | 'piano' | 'read' | 'celebrate' | 'stand';

/* ---------- task steps ---------- */
export interface GoStep { type: 'go'; to: Pt; carry: boolean; path?: Pt[] }
export interface DoStep {
  type: 'do';
  pose: 'sit' | 'gather' | 'idle';
  face?: Pt;
  min: number; // game minutes
  tick?: (dm: number) => void;
  done?: (() => void) | null;
  lift?: number;
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
    items: {} as Partial<Record<GiftKey, boolean>>,
    spots: {} as Partial<Record<GiftKey, Spot>>,
    wishes: [] as GiftKey[],
    diary: [] as DiaryEntry[],
    thought: '',
    activity: 'Waking up',
    lastAction: null as TaskId | null,
    curious: [] as GiftKey[], // gifts she hasn't tried yet
    firstWish: false,
    fishFails: 0,
    warned: 0,
    dead: false,
    lift: 0, // extra height above the ground (hammock)
    // her body, as far as the sim is concerned
    pos: copy(START),
    faceTarget: null as Pt | null,
    task: null as Task | null,
    sitting: false,
    // tells the UI which lists need re-rendering
    diaryDirty: true,
    giftsDirty: true,
  };
}
export type SimState = ReturnType<typeof createState>;

// Created by initState() rather than at import time so that random rolls
// (name, traits) happen after the world is scattered, same order as before.
export let S: SimState;
export function initState() {
  S = createState();
  return S;
}

/** How the sim reaches the outside world. main.ts replaces these no-ops. */
export const hooks = {
  play: (_anim: AnimKey, _forceOnce?: boolean) => {},
  onSay: () => {},
  onGift: (_k: GiftKey) => {},
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
  S.diary.length = Math.min(S.diary.length, 80);
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
