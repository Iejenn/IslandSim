// Everything she can do, expressed as a list of steps (walk here, do this
// for N game minutes, wait for an animation). runner.ts plays them out.
import { ONE_SHOT_SECONDS } from '../config/animations';
import { BUSHES, clearOf, copy, dist, FIRE, FISH, ground, pointAt, SEATS, SHELTER, SPRING, standNear, WOODTREES, type Pt } from './island';
import { addXp } from './skills';
import { feed, hour, isNight, log, S, say, type DoStep, type GiftKey, type GoStep, type Step, type Task, type TaskId, type WaitStep } from './state';
import { pianoThought, TH, thoughtFor } from './thoughts';
import { clamp, pick, rand } from './util';

/* ---------- step builders ---------- */
const go = (p: Pt, carry?: boolean): GoStep => ({ type: 'go', to: copy(p), carry: !!carry });
const act = (o: Omit<DoStep, 'type'>): DoStep => ({ type: 'do', ...o });
const standUp = (): WaitStep => ({ type: 'wait', anim: 'standUp', sec: ONE_SHOT_SECONDS.standUp });
function sitAt(p: Pt, face: Pt, min: number, tick?: (dm: number) => void, done?: (() => void) | null, lift?: number): Step[] {
  return [go(p), act({ pose: 'sit', face, min, tick, done, lift }), standUp()];
}
const mk = (id: TaskId, label: string, thought: string, steps: Step[]): Task => ({ id, label, thought, steps, i: 0, started: false, el: 0 });

function nearestBush() {
  let best = -1, bd = 1e9;
  BUSHES.forEach((b, i) => {
    if (S.berries[i] <= 0) return;
    const d = dist(b.stand, S.pos);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
const setBerries = (i: number, n: number) => { S.berries[i] = clamp(n, 0, 6); };

/* ---------- task factories: return null when the task isn't possible right now ---------- */
export const T: Record<string, () => Task | null> = {
  forage() {
    const i = nearestBush();
    if (i < 0) return null;
    const b = BUSHES[i];
    return mk('forage', 'Picking berries', thoughtFor('forage', 'food'), [go(b.stand), act({
      pose: 'gather', face: b.pos, min: 30,
      done() { setBerries(i, S.berries[i] - 1); feed('food', 18 + 1.5 * S.skills.foraging.lvl); addXp('foraging', 8); },
    })]);
  },
  fish() {
    const rod = !!S.items.rod;
    return mk('fish', 'Fishing at the shore', thoughtFor('fish', 'food'), sitAt(FISH.spot, FISH.face, rod ? 60 : 90, dm => feed('fun', dm * 4 / 60), () => {
      const lvl = S.skills.fishing.lvl, ok = Math.random() < 0.35 + 0.06 * lvl + (rod ? 0.25 : 0);
      if (ok) {
        feed('food', 35 + 2 * lvl); addXp('fishing', 15); S.fishFails = 0;
        say(pick(['Got one! Dinner is served.', 'Fish for dinner. I’m a natural.'])); log('Caught a fish.');
        if (S.task) S.task.celebrate = true;
      } else {
        addXp('fishing', 6); S.fishFails++;
        say('Nothing. The fish are laughing at me.'); log('Came back from fishing empty-handed.');
      }
    }));
  },
  drink() {
    return mk('drink', 'Drinking at the spring', thoughtFor('drink', 'water'), [go(SPRING.spot), act({
      pose: 'gather', face: SPRING.face, min: 12, done() { feed('water', 50); addXp('survival', 2); },
    })]);
  },
  wood() {
    const w = pick(WOODTREES);
    const drop = standNear(FIRE, 1.2, w.pos);
    return mk('wood', 'Gathering firewood', pick(TH.wood), [go(w.stand), act({ pose: 'gather', face: w.pos, min: 35 }), go(drop, true),
      act({ pose: 'gather', face: FIRE, min: 6, done() { S.fire = Math.min(100, S.fire + 45); addXp('survival', 8); } })]);
  },
  sleep() {
    const night = isNight(), h = S.items.hammock ? S.spots.hammock! : null;
    const spot = h ? h.spot : SHELTER.spot, face = h ? h.face : SHELTER.face;
    let mins = 120;
    if (night) { const hr = hour(); mins = Math.max(60, ((7 - hr + 24) % 24) * 60); } // sleep until 07:00
    const th = night ? (h ? 'This hammock is heaven.' : thoughtFor('sleep', 'energy')) : pick(TH.nap);
    return mk('sleep', night ? (h ? 'Sleeping in the hammock' : 'Sleeping in the shelter') : 'Taking a nap', th,
      sitAt(spot, face, mins, dm => { feed('energy', dm * (h ? 18 : 13) / 60); }, null, h ? h.lift : 0));
  },
  relax() {
    const s = pick(SEATS);
    return mk('relax', 'Resting by the fire', thoughtFor('relax', 'fun'), sitAt(s.p, s.face, 60, dm => {
      feed('fun', dm * 10 / 60); feed('energy', dm * 3 / 60); feed('company', dm * 1 / 60);
    }));
  },
  explore() {
    const a0 = rand(0, 6.3), pts = [0, 0.35, 0.7].map(o => ground(pointAt(a0 + o, 0.84)));
    return mk('explore', 'Walking the beach', thoughtFor('explore', 'fun'), [
      go(pts[0]), act({ pose: 'idle', min: 6, face: pointAt(a0, 1.5) }),
      go(pts[1]), act({
        pose: 'idle', min: 6, face: pointAt(a0 + 0.35, 1.5), done() {
          const r = Math.random();
          if (r < 0.3) { say('Ooh, a pretty shell.'); log('Found a pretty shell on the beach.'); S.mood = Math.min(40, S.mood + 5); }
          else if (r < 0.38) { say('A message in a bottle… it’s blank. Figures.'); log('Found an empty bottle on the beach.'); }
        },
      }),
      go(pts[2]), act({ pose: 'idle', min: 5, face: pointAt(a0 + 0.7, 1.5), done() { feed('fun', 16); addXp('survival', 3); } }),
    ]);
  },
  talk() {
    let p!: Pt;
    for (let i = 0; i < 12; i++) { p = pointAt(rand(0, 6.3), rand(0.25, 0.5)); if (clearOf(p, 1.6)) break; }
    ground(p);
    return mk('talk', 'Talking to herself', thoughtFor('talk', 'company'), [go(p), act({
      pose: 'idle', min: 20, tick: dm => { feed('company', dm * 36 / 60); feed('fun', dm * 6 / 60); },
    })]);
  },
  piano() {
    const sp = S.spots.piano!;
    return mk('piano', 'Playing the piano', pianoThought(), sitAt(sp.spot, sp.face, 60, dm => { feed('fun', dm * 16 / 60); addXp('music', dm * 14 / 60); }));
  },
  read() {
    const s = SEATS[1];
    return mk('read', 'Reading by the fire', pick(TH.read), sitAt(s.p, s.face, 60, dm => { feed('fun', dm * 12 / 60); addXp('reading', dm * 12 / 60); }));
  },
};

// Tasks that urgent needs (or a new gift) are allowed to cut short.
export const INTERRUPTIBLE = new Set<TaskId>(['relax', 'explore', 'talk', 'piano', 'read', 'wood', 'sleep']);
// Which task "tries out" each new gift.
export const CURIOUS_TASK: Partial<Record<GiftKey, TaskId>> = { piano: 'piano', books: 'read', rod: 'fish' };

/* ---------- task lifecycle ---------- */
export function startTask(t: Task) {
  S.task = Object.assign(t, { i: 0, started: false, el: 0 });
  S.activity = t.label;
  if (t.thought) say(t.thought);
}

export function endTask() {
  const task = S.task;
  if (!task) return;
  S.lastAction = task.id;
  S.lift = 0;
  if (task.celebrate) {
    S.task = { id: 'celebrate', label: 'Celebrating', steps: [{ type: 'wait', anim: 'celebrate', sec: ONE_SHOT_SECONDS.celebrate }], i: 0, started: false, el: 0 };
    return;
  }
  S.task = null;
}

/** Drop the current task; if she's sitting, stand up first. */
export function interrupt() {
  if (!S.task) return;
  if (S.sitting) S.task = { id: 'stand', label: S.activity, steps: [standUp()], i: 0, started: false, el: 0 };
  else S.task = null;
}
