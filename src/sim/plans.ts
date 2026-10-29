// Everything she can make: crafts (one sitting at the campfire, e.g. an axe)
// and projects (built on site over several sessions, e.g. the dock). She sets
// one as her goal once it fits her life (see `unlocked`), gathers the
// resources, then makes it. Nothing is listed for the player in advance.
import { DOCK, height, type Pt } from './island';
import { remember } from './memory';
import { addXp } from './skills';
import { dayNum, highlight, log, S, say, tr, type CraftKey, type PlanKey, type ProjectKey, type Resource } from './state';

interface PlanDef {
  kind: 'craft' | 'build';
  name: string;
  a: string; // with article, for "she decided to make …"
  cost: Partial<Record<Resource, number>>;
  minutes: number; // game minutes of work at skill level 0
  unlocked: () => boolean;
  want: string; // what she says when she sets the goal
  done: string; // what she says when it's finished
  weight: () => number; // how much she wants it compared to the other options
}

export const PLANS: Record<PlanKey, PlanDef> = {
  /* ---------- crafts ---------- */
  axe: {
    kind: 'craft', name: 'stone axe', a: 'a stone axe', cost: { wood: 1, stone: 2 }, minutes: 60,
    unlocked: () => S.min >= 9 * 60,
    want: 'A sharp stone on a stick… an axe. Then I can cut real firewood.',
    done: 'A stone axe! Crude, but it’ll bite.',
    weight: () => 6,
  },
  pick: {
    kind: 'craft', name: 'stone pick', a: 'a stone pick', cost: { wood: 1, stone: 3 }, minutes: 60,
    unlocked: () => !!S.items.axe,
    want: 'With a pick I could break proper stones off those boulders.',
    done: 'A pick. Those boulders don’t stand a chance.',
    weight: () => 2,
  },
  rod: {
    kind: 'craft', name: 'fishing rod', a: 'a fishing rod', cost: { wood: 1, fibre: 2 }, minutes: 45,
    unlocked: () => S.stats.fishTrips >= 1,
    want: 'If only I had a proper fishing rod… I could make one.',
    done: 'A real fishing rod, made by me. The fish don’t stand a chance.',
    weight: () => (tr('hardworking') ? 3 : 1.5) + (S.fishFails >= 2 ? 2 : 0),
  },
  basket: {
    kind: 'craft', name: 'basket', a: 'a basket', cost: { fibre: 4 }, minutes: 50,
    unlocked: () => S.stats.forages >= 3,
    want: 'If I wove a basket, I could carry more berries back.',
    done: 'A woven basket. My grandmother would be proud.',
    weight: () => 1.5,
  },
  hammock: {
    kind: 'craft', name: 'hammock', a: 'a hammock', cost: { fibre: 6, wood: 2 }, minutes: 90,
    unlocked: () => S.stats.nightsInShelter >= 2,
    want: 'My back aches. A hammock would be heaven, if I can weave one.',
    done: 'A hammock! Tonight I sleep like a queen.',
    weight: () => tr('lazy') ? 3 : 1.2,
  },
  bucket: {
    kind: 'craft', name: 'bucket', a: 'a bucket', cost: { wood: 3, fibre: 1 }, minutes: 60,
    // for watering the garden, or as a cooking pot once she's growing vegetables
    unlocked: () => S.stats.waterings >= 2 || (S.projects.garden.done && S.stats.meals >= 4),
    want: 'A bucket would carry water for the garden, and double as a cooking pot.',
    done: 'A bucket! My poor hands thank me.',
    weight: () => tr('lazy') ? 2.5 : 1.5,
  },
  drum: {
    kind: 'craft', name: 'drum', a: 'a drum', cost: { wood: 2, fibre: 2 }, minutes: 75,
    unlocked: () => tr('musical') || dayNum() >= 4,
    want: 'I miss music. Maybe I can make a drum.',
    done: 'It’s just a log and some fibre, but it has a beat!',
    weight: () => tr('musical') ? 4 : 1,
  },
  journal: {
    kind: 'craft', name: 'story boards', a: 'some story boards', cost: { wood: 2 }, minutes: 60,
    unlocked: () => tr('curious') || dayNum() >= 3,
    want: 'I could carve my stories into wooden boards. A book only I can read.',
    done: 'My first story board. Chapter one: the beach.',
    weight: () => tr('curious') ? 3 : 1,
  },

  /* ---------- furniture: she only thinks of these once her crafting is good enough ---------- */
  chair: {
    kind: 'craft', name: 'chair', a: 'a chair', cost: { wood: 3 }, minutes: 70,
    unlocked: () => S.skills.crafting.lvl >= 1,
    want: 'I’m sick of sitting on logs. A real chair by the fire, that’s the dream.',
    done: 'A chair! An actual chair. I feel like a queen.',
    weight: () => 2 + (tr('lazy') ? 1 : 0),
  },
  table: {
    kind: 'craft', name: 'table', a: 'a table', cost: { wood: 4, stone: 2 }, minutes: 90,
    unlocked: () => S.skills.crafting.lvl >= 2 && !!S.items.chair,
    want: 'Eating off my knees gets old. A table would make meals feel civilised.',
    done: 'A table! Dinner is served. Properly.',
    weight: () => 1.5,
  },
  bed: {
    kind: 'craft', name: 'bed frame', a: 'a bed frame', cost: { wood: 4, fibre: 3 }, minutes: 100,
    unlocked: () => S.skills.crafting.lvl >= 3 && S.stats.nightsInShelter >= 3,
    want: 'If I raised my bed off the ground, maybe I’d stop waking up with sand everywhere.',
    done: 'A proper bed frame. Goodbye, sand.',
    weight: () => 1.5 + (tr('lazy') ? 1 : 0),
  },
  shelf: {
    kind: 'craft', name: 'shelf', a: 'a shelf', cost: { wood: 3 }, minutes: 60,
    unlocked: () => S.skills.crafting.lvl >= 3 && (S.stock.shells >= 3 || !!S.items.journal),
    want: 'My shells and story boards deserve a proper place. A shelf!',
    done: 'Everything has its place now. It looks like someone lives here.',
    weight: () => 1.2 + (tr('curious') ? 0.8 : 0),
  },
  rocker: {
    kind: 'craft', name: 'rocking chair', a: 'a rocking chair', cost: { wood: 4, fibre: 2 }, minutes: 110,
    unlocked: () => S.skills.crafting.lvl >= 4 && S.projects.lookout.done,
    want: 'A rocking chair up on the lookout… I could watch the sea for hours.',
    done: 'A rocking chair with the best view on the island.',
    weight: () => 1 + (tr('lazy') ? 1 : 0) + (tr('curious') ? 0.5 : 0),
  },

  /* ---------- projects ---------- */
  garden: {
    kind: 'build', name: 'garden', a: 'a garden', cost: { wood: 4 }, minutes: 150,
    unlocked: () => dayNum() >= 2,
    want: 'If I grew my own food, I wouldn’t depend on these bushes.',
    done: 'My own little garden! I saved a few berry seeds to start with.',
    weight: () => 2 + (tr('hardworking') ? 1 : 0),
  },
  rack: {
    kind: 'build', name: 'drying rack', a: 'a drying rack', cost: { wood: 3, fibre: 2 }, minutes: 90,
    unlocked: () => S.stats.fishCaught >= 2,
    want: 'If I could dry fish, a catch wouldn’t go bad when the fire is out.',
    done: 'A drying rack. No more wasted fish.',
    weight: () => 1.5,
  },
  dock: {
    kind: 'build', name: 'dock', a: 'a dock', cost: { wood: 8, stone: 4 }, minutes: 240,
    unlocked: () => S.stats.fishTrips >= 4 && dayNum() >= 3,
    want: 'A dock would get me out past the shallows, where the big fish are.',
    done: 'The dock is done! Look how far out I can go.',
    weight: () => 1 + (tr('curious') ? 1 : 0) + (tr('hardworking') ? 0.5 : 0),
  },
  hut: {
    kind: 'build', name: 'stone walls', a: 'stone walls for her shelter', cost: { wood: 6, stone: 10 }, minutes: 200,
    unlocked: () => S.stats.rainsSeen >= 1 && dayNum() >= 2,
    want: 'Next time it rains, I want real walls around me. Stone ones.',
    done: 'Stone walls! It finally feels like a home.',
    weight: () => 1.5 + (tr('lazy') ? 1 : 0),
  },
  hearth: {
    kind: 'build', name: 'stone hearth', a: 'a stone hearth', cost: { stone: 6 }, minutes: 90,
    unlocked: () => S.stats.meals >= 3,
    want: 'A proper stone hearth would keep the fire going longer on less wood.',
    done: 'A real hearth. The fire will last much longer now.',
    weight: () => 1.5 + (tr('hardworking') ? 0.5 : 0),
  },
  lookout: {
    kind: 'build', name: 'lookout tower', a: 'a lookout tower', cost: { wood: 10, stone: 4 }, minutes: 240,
    unlocked: () => dayNum() >= 5 && (tr('curious') || !!S.items.journal),
    want: 'From up high I could see the whole sea… and the stars.',
    done: 'The lookout is finished! I can see forever from up there.',
    weight: () => tr('curious') ? 2.5 : 1,
  },
  canoe: {
    kind: 'build', name: 'canoe', a: 'a canoe', cost: { wood: 8, fibre: 4 }, minutes: 200,
    unlocked: () => S.projects.dock.done,
    want: 'With the dock done… I keep dreaming of a little canoe.',
    done: 'A canoe! Hollowed out by hand. Where shall we go?',
    weight: () => 2 + (tr('curious') ? 2 : 0),
  },
};

const isProject = (k: PlanKey): k is ProjectKey => PLANS[k].kind === 'build';
export const isDone = (k: PlanKey) => isProject(k) ? S.projects[k].done : !!S.items[k as CraftKey];
const progressOf = (k: PlanKey) => isProject(k) ? S.projects[k] : S.crafting;

/** Maybe pick something to make. Returns true if she set a new goal. */
export function chooseGoal() {
  if (S.goal) return false;
  const cand = (Object.keys(PLANS) as PlanKey[]).filter(k => !isDone(k) && PLANS[k].unlocked());
  if (!cand.length) return false;
  const tot = cand.reduce((s, k) => s + PLANS[k].weight(), 0);
  let r = Math.random() * tot, k = cand[0];
  for (const c of cand) { r -= PLANS[c].weight(); if (r <= 0) { k = c; break; } }
  S.goal = k;
  S.goalSince = S.min;
  S.crafting = { started: false, progress: 0 };
  say(PLANS[k].want);
  log(`She decided to ${PLANS[k].kind === 'craft' ? 'make' : 'build'} ${PLANS[k].a}.`);
  return true;
}

// Logs she always keeps back for the campfire; projects can't use these.
export const FIREWOOD_RESERVE = 2;

/** How much of each resource she still has to gather before she can start her goal. */
export function missing(): Record<Resource, number> {
  const out = { wood: 0, stone: 0, fibre: 0 }, k = S.goal;
  if (!k || progressOf(k).started) return out;
  for (const r of Object.keys(out) as Resource[]) {
    const cost = PLANS[k].cost[r] ?? 0;
    out[r] = cost ? Math.max(0, cost + (r === 'wood' ? FIREWOOD_RESERVE : 0) - S.stock[r]) : 0;
  }
  return out;
}
export const canWork = () => !!S.goal && Object.values(missing()).every(v => v === 0);

const workSpeed = (k: PlanKey) => 1 + 0.08 * S.skills[PLANS[k].kind === 'craft' ? 'crafting' : 'building'].lvl;
/** Game minutes of work left on the current goal (faster with skill). */
export function minutesLeft() {
  const k = S.goal!;
  return (1 - progressOf(k).progress) * PLANS[k].minutes / workSpeed(k);
}

/** Use up the resources when work begins. */
export function startPlan(k: PlanKey) {
  const p = progressOf(k);
  if (p.started) return;
  p.started = true;
  for (const [r, n] of Object.entries(PLANS[k].cost) as [Resource, number][]) S.stock[r] -= n;
  if (isProject(k)) log(`She started building the ${PLANS[k].name}.`);
}

export function workOn(k: PlanKey, dm: number) {
  const p = progressOf(k);
  p.progress = Math.min(1, p.progress + dm / PLANS[k].minutes * workSpeed(k));
  // crafting levels up faster than building: furniture depends on it
  addXp(PLANS[k].kind === 'craft' ? 'crafting' : 'building', dm * (PLANS[k].kind === 'craft' ? 30 : 10) / 60);
}

/** Called when a work session ends; finishes the plan if it's complete. */
export function checkFinished(k: PlanKey) {
  const p = progressOf(k), def = PLANS[k];
  if (def.kind === 'build') highlight(`worked on the ${def.name}`);
  if (p.progress < 0.999) return;
  if (isProject(k)) { S.projects[k].done = true; S.projects[k].progress = 1; }
  else {
    S.items[k as CraftKey] = true;
    S.stats.crafted++;
    addXp('crafting', 20);
    S.curious.push(k as CraftKey); // she'll want to try it out
  }
  S.goal = null;
  if (k === 'garden') S.stock.seeds += 3;
  S.mood = Math.min(40, S.mood + 20);
  say(def.done);
  log(def.kind === 'craft' ? `She made ${def.a}.` : `She finished the ${def.name}.`);
  highlight(def.kind === 'craft' ? `made ${def.a}` : `finished the ${def.name}`);
  remember(def.kind === 'craft' ? 'craft' : 'build', 0.2);
  if (S.task) S.task.celebrate = true;
}

/* ---------- storm damage ---------- */
// What the storm can damage, and what fixing it costs.
export const REPAIRABLE: Partial<Record<ProjectKey, Partial<Record<Resource, number>>>> = {
  rack: { wood: 1 }, dock: { wood: 3 }, hut: { wood: 1, stone: 2 }, lookout: { wood: 2 },
};
/** A finished project that isn't storm-damaged right now. */
export const works = (k: ProjectKey) => S.projects[k].done && !S.projects[k].damaged;
export const damaged = () => (Object.keys(REPAIRABLE) as ProjectKey[]).filter(k => S.projects[k].damaged);

/* ---------- home comfort: how much the camp feels like a home ---------- */
const COMFORT_ITEMS: CraftKey[] = ['chair', 'table', 'bed', 'shelf', 'rocker', 'hammock', 'drum'];
/** 0…10: furniture and comforts she has made, plus a sound roof and hearth. */
export function comfort() {
  return COMFORT_ITEMS.filter(k => S.items[k]).length + (works('hut') ? 2 : 0) + (S.projects.hearth.done ? 1 : 0);
}

/* ---------- walking surface: terrain, or the dock deck once it exists ---------- */
const along = (p: Pt) => p.x * DOCK.dir.x + p.z * DOCK.dir.z;
const across = (p: Pt) => Math.abs(-p.x * DOCK.dir.z + p.z * DOCK.dir.x);
export function onDock(p: Pt) {
  if (!S.projects.dock.done) return false; // (a storm-damaged dock is still walkable, just not usable)
  const a = along(p);
  return a >= DOCK.from - 0.05 && a <= DOCK.to && across(p) <= DOCK.halfWidth;
}
export function surfaceY(x: number, z: number) {
  const p = { x, y: 0, z };
  return onDock(p) ? DOCK.deckY : height(x, z);
}
