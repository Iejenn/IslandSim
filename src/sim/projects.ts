// Things she builds herself. She picks one as a goal once it makes sense for
// her life (unlock conditions below), chops wood until she has enough, then
// builds it over several sessions. None of this is shown to the player in
// advance; it just starts happening.
import { DOCK, height, type Pt } from './island';
import { remember } from './memory';
import { addXp } from './skills';
import { dayNum, highlight, log, S, say, tr, type ProjectKey } from './state';

interface ProjectDef {
  name: string;
  a: string; // with article, for "she decided to build …"
  wood: number; // logs needed before she can start
  minutes: number; // game minutes of building at skill level 0
  unlocked: () => boolean;
  want: string; // what she says when she sets the goal
  done: string; // what she says when it's finished
  weight: () => number; // how much she wants it compared to the others
}

export const PROJECTS: Record<ProjectKey, ProjectDef> = {
  garden: {
    name: 'garden', a: 'a garden', wood: 4, minutes: 150,
    unlocked: () => dayNum() >= 2,
    want: 'If I grew my own food, I wouldn’t depend on these bushes.',
    done: 'My own little garden! I saved a few seeds to start with.',
    weight: () => 2 + (tr('hardworking') ? 1 : 0),
  },
  rack: {
    name: 'drying rack', a: 'a drying rack', wood: 3, minutes: 90,
    unlocked: () => S.stats.fishCaught >= 2,
    want: 'If I could dry fish, one good catch would last for days.',
    done: 'A drying rack. No more wasted fish.',
    weight: () => 1.5,
  },
  dock: {
    name: 'dock', a: 'a dock', wood: 8, minutes: 240,
    unlocked: () => S.stats.fishTrips >= 4 && dayNum() >= 3,
    want: 'A dock would get me out past the shallows, where the big fish are.',
    done: 'The dock is done! Look how far out I can go.',
    weight: () => 1 + (tr('curious') ? 1 : 0) + (tr('hardworking') ? 0.5 : 0),
  },
  hut: {
    name: 'shelter walls', a: 'walls for her shelter', wood: 6, minutes: 180,
    unlocked: () => S.stats.rainsSeen >= 1 && dayNum() >= 2,
    want: 'Next time it rains, I want real walls around me.',
    done: 'Walls! It finally feels like a home.',
    weight: () => 1.5 + (tr('lazy') ? 1 : 0),
  },
};

/** Maybe pick something to build. Returns true if she set a new goal. */
export function chooseGoal() {
  if (S.goal) return false;
  const cand = (Object.keys(PROJECTS) as ProjectKey[]).filter(k => !S.projects[k].done && PROJECTS[k].unlocked());
  if (!cand.length) return false;
  const tot = cand.reduce((s, k) => s + PROJECTS[k].weight(), 0);
  let r = Math.random() * tot, k = cand[0];
  for (const c of cand) { r -= PROJECTS[c].weight(); if (r <= 0) { k = c; break; } }
  S.goal = k;
  S.goalSince = S.min;
  say(PROJECTS[k].want);
  log(`She decided to build ${PROJECTS[k].a}.`);
  return true;
}

/** Logs still missing before she can start her current goal. */
export function woodNeeded() {
  const k = S.goal;
  if (!k || S.projects[k].started) return 0;
  return Math.max(0, PROJECTS[k].wood - S.stock.wood);
}
export const canBuild = () => !!S.goal && woodNeeded() === 0;

/** Game minutes of work left on the current goal (faster with skill). */
export function minutesLeft() {
  const k = S.goal!;
  return (1 - S.projects[k].progress) * PROJECTS[k].minutes / buildSpeed();
}
const buildSpeed = () => 1 + 0.08 * S.skills.building.lvl;

export function startProject(k: ProjectKey) {
  const p = S.projects[k];
  if (p.started) return;
  p.started = true;
  S.stock.wood -= PROJECTS[k].wood;
  log(`She started building the ${PROJECTS[k].name}.`);
}

export function workOn(k: ProjectKey, dm: number) {
  const p = S.projects[k];
  p.progress = Math.min(1, p.progress + dm / PROJECTS[k].minutes * buildSpeed());
  addXp('building', dm * 10 / 60);
}

/** Called when a building session ends; finishes the project if it's complete. */
export function checkFinished(k: ProjectKey) {
  const p = S.projects[k];
  highlight(`worked on the ${PROJECTS[k].name}`);
  if (p.done || p.progress < 0.999) return;
  p.done = true;
  p.progress = 1;
  S.goal = null;
  if (k === 'garden') S.stock.seeds += 3;
  S.mood = Math.min(40, S.mood + 20);
  say(PROJECTS[k].done);
  log(`She finished the ${PROJECTS[k].name}.`);
  highlight(`finished the ${PROJECTS[k].name}`);
  remember('build', 0.25);
  if (S.task) S.task.celebrate = true;
}

/* ---------- walking surface: terrain, or the dock deck once it exists ---------- */
const along = (p: Pt) => p.x * DOCK.dir.x + p.z * DOCK.dir.z;
const across = (p: Pt) => Math.abs(-p.x * DOCK.dir.z + p.z * DOCK.dir.x);
export function onDock(p: Pt) {
  if (!S.projects.dock.done) return false;
  const a = along(p);
  return a >= DOCK.from - 0.05 && a <= DOCK.to && across(p) <= DOCK.halfWidth;
}
export function surfaceY(x: number, z: number) {
  const p = { x, y: 0, z };
  return onDock(p) ? DOCK.deckY : height(x, z);
}
