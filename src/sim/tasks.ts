// Everything she can do, expressed as a list of steps (walk here, do this
// for N game minutes, wait for an animation). runner.ts plays them out.
import { ONE_SHOT_SECONDS } from '../config/animations';
import { freePlots, growingPlots, ripePlots } from './garden';
import {
  BOAT_DOCK, BUSHES, clearOf, copy, dist, DOCK_END, DOCK_FACE, FIRE, FISH, GARDEN_P, GARDEN_STAND, ground, pointAt,
  RACK_P, SAIL_ROUTE, SEATS, SH, SHELTER, SPRING, standNear, TELESCOPE_P, TELESCOPE_STAND, WOODPILE_P, WOODTREES, type Pt,
} from './island';
import { feelingAbout, remember } from './memory';
import { checkFinished, minutesLeft, PROJECTS, startProject, workOn } from './projects';
import { addXp } from './skills';
import {
  feed, highlight, hour, isNight, log, S, say, tr,
  type DoStep, type GiftKey, type GoStep, type ProjectKey, type Step, type Task, type TaskId, type WaitStep,
} from './state';
import { pianoThought, TH, thoughtFor } from './thoughts';
import { clamp, pick, rand } from './util';

/* ---------- step builders ---------- */
const go = (p: Pt, carry?: boolean, run?: boolean): GoStep => ({ type: 'go', to: copy(p), carry: !!carry, run });
const ride = (p: Pt): GoStep => ({ type: 'go', to: copy(p), carry: false, ride: true });
const act = (o: Omit<DoStep, 'type'>): DoStep => ({ type: 'do', ...o });
const standUp = (): WaitStep => ({ type: 'wait', anim: 'standUp', sec: ONE_SHOT_SECONDS.standUp });
function sitAt(p: Pt, face: Pt, min: number, tick?: (dm: number) => void, done?: (() => void) | null, lift?: number): Step[] {
  return [go(p), act({ pose: 'sit', face, min, tick, done, lift }), standUp()];
}
const mk = (id: TaskId, label: string, thought: string, steps: Step[]): Task => ({ id, label, thought, steps, i: 0, started: false, el: 0 });
/** Hurry if this need is nearly empty. */
const urgent = (v: number) => v < 15;

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

const WOODPILE_STAND = standNear(WOODPILE_P, 0.9);
const RACK_STAND = standNear(RACK_P, 0.9);
// where she stands to work on each project
const SITE: Record<ProjectKey, { stand: Pt; face: Pt }> = {
  garden: { stand: GARDEN_STAND, face: GARDEN_P },
  rack: { stand: RACK_STAND, face: RACK_P },
  dock: { stand: ground(pointAt(Math.PI / 2, 0.78)), face: DOCK_END },
  hut: { stand: standNear(SH, 1.6), face: SH },
};

/* ---------- task factories: return null when the task isn't possible right now ---------- */
export const T: Record<string, () => Task | null> = {
  forage() {
    const i = nearestBush();
    if (i < 0) return null;
    const b = BUSHES[i];
    return mk('forage', 'Picking berries', thoughtFor('forage', 'food'), [go(b.stand, false, urgent(S.needs.food)), act({
      pose: 'gather', face: b.pos, min: 30,
      done() {
        setBerries(i, S.berries[i] - 1);
        feed('food', 18 + 1.5 * S.skills.foraging.lvl);
        addXp('foraging', 8);
        S.stats.forages++;
        // once she has a garden she keeps the best seeds
        if (S.projects.garden.done && Math.random() < 0.3) { S.stock.seeds++; say('I’ll keep these seeds for the garden.'); }
      },
    })]);
  },
  fish() {
    const rod = !!S.items.rod, dock = S.projects.dock.done;
    const spot = dock ? DOCK_END : FISH.spot, face = dock ? DOCK_FACE : FISH.face;
    return mk('fish', dock ? 'Fishing off the dock' : 'Fishing at the shore', thoughtFor('fish', 'food'), sitAt(spot, face, rod ? 60 : 90, dm => feed('fun', dm * (dock ? 6 : 4) / 60), () => {
      const lvl = S.skills.fishing.lvl, ok = Math.random() < 0.35 + 0.06 * lvl + (rod ? 0.25 : 0) + (dock ? 0.12 : 0);
      S.stats.fishTrips++;
      if (ok) {
        feed('food', 35 + 2 * lvl); addXp('fishing', 15); S.fishFails = 0; S.stats.fishCaught++;
        say(pick(['Got one! Dinner is served.', 'Fish for dinner. I’m a natural.'])); log('Caught a fish.');
        highlight('caught a fish');
        remember('fish', 0.08);
        // with a drying rack, a good catch also feeds her later
        if (S.projects.rack.done && S.stock.fish < 6) { S.stock.fish++; log('She hung a spare fish on the drying rack.'); }
        if (S.task) S.task.celebrate = true;
      } else {
        addXp('fishing', 6); S.fishFails++;
        say('Nothing. The fish are laughing at me.'); log('Came back from fishing empty-handed.');
        remember('fish', -0.08);
      }
    }));
  },
  drink() {
    return mk('drink', 'Drinking at the spring', thoughtFor('drink', 'water'), [go(SPRING.spot, false, urgent(S.needs.water)), act({
      pose: 'gather', face: SPRING.face, min: 12, done() { feed('water', 50); addXp('survival', 2); },
    })]);
  },
  wood() {
    // feed the fire from the woodpile if there is one, otherwise fetch a fresh log
    if (S.stock.wood > 0) {
      return mk('wood', 'Feeding the fire', pick(TH.wood), [go(WOODPILE_STAND), act({ pose: 'gather', face: WOODPILE_P, min: 4 }),
        go(standNear(FIRE, 1.2, WOODPILE_P), true),
        act({ pose: 'gather', face: FIRE, min: 6, done() { S.stock.wood = Math.max(0, S.stock.wood - 1); S.fire = Math.min(100, S.fire + 45); addXp('survival', 4); } })]);
    }
    const w = pick(WOODTREES);
    const drop = standNear(FIRE, 1.2, w.pos);
    return mk('wood', 'Gathering firewood', pick(TH.wood), [go(w.stand), act({ pose: 'gather', face: w.pos, min: 35 }), go(drop, true),
      act({ pose: 'gather', face: FIRE, min: 6, done() { S.fire = Math.min(100, S.fire + 45); addXp('survival', 8); } })]);
  },
  chop() {
    const w = pick(WOODTREES);
    return mk('chop', 'Chopping wood', pick(TH.chop), [go(w.stand), act({ pose: 'chop', face: w.pos, min: 45 }), go(WOODPILE_STAND, true),
      act({
        pose: 'gather', face: WOODPILE_P, min: 4, done() {
          S.stock.wood = Math.min(20, S.stock.wood + 2 + (S.skills.survival.lvl >= 3 ? 1 : 0));
          addXp('survival', 4);
          remember('chop', tr('hardworking') ? 0.04 : tr('lazy') ? -0.05 : -0.01);
          highlight('chopped wood');
        },
      })]);
  },
  build() {
    const k = S.goal;
    if (!k) return null;
    const site = SITE[k], min = Math.min(60, Math.ceil(minutesLeft()));
    return mk('build', `Building the ${PROJECTS[k].name}`, pick(TH.build), [go(site.stand), act({
      pose: 'hammer', face: site.face, min,
      begin() { startProject(k); },
      tick: dm => { workOn(k, dm); feed('fun', dm * 2 / 60); },
      done() {
        remember('build', tr('hardworking') ? 0.06 : tr('lazy') ? -0.02 : 0.03);
        checkFinished(k);
      },
    })]);
  },
  plant() {
    const free = freePlots(), n = Math.min(free.length, S.stock.seeds + S.stock.fine);
    if (!S.projects.garden.done || n <= 0) return null;
    return mk('plant', 'Planting seeds', pick(TH.plant), [go(GARDEN_STAND), act({
      pose: 'gather', face: GARDEN_P, min: 10 * n, done() {
        for (const p of freePlots().slice(0, n)) {
          const fine = S.stock.fine > 0;
          if (fine) S.stock.fine--; else if (S.stock.seeds > 0) S.stock.seeds--; else break;
          Object.assign(p, { state: 'growing', growth: 0, water: 70, dryMin: 0, fine });
        }
        addXp('gardening', 6 * n);
        remember('plant', 0.04);
        highlight('planted seeds');
      },
    })]);
  },
  water() {
    if (!growingPlots().length) return null;
    const can = !!S.items.can;
    return mk('water', 'Watering the garden', pick(TH.water), [go(SPRING.spot), act({ pose: 'gather', face: SPRING.face, min: 5 }), go(GARDEN_STAND, true),
      act({
        pose: 'gather', face: GARDEN_P, min: can ? 5 : 10, done() {
          for (const p of growingPlots()) p.water = 100;
          S.stats.waterings++;
          addXp('gardening', 4);
          remember('water', 0.02);
        },
      })]);
  },
  harvest() {
    if (!ripePlots().length) return null;
    return mk('harvest', 'Harvesting the garden', pick(TH.harvest), [go(GARDEN_STAND), act({
      pose: 'gather', face: GARDEN_P, min: 15, done() {
        const ripe = ripePlots();
        for (const p of ripe) {
          feed('food', p.fine ? 28 : 18);
          S.stock.seeds += Math.random() < 0.6 ? 2 : 1; // she keeps seed from the crop
          Object.assign(p, { state: 'empty', growth: 0, water: 0, dryMin: 0, fine: false });
        }
        S.stats.harvests++;
        S.mood = Math.min(40, S.mood + 6);
        addXp('gardening', 10);
        remember('harvest', 0.08);
        log(`She harvested ${ripe.length} garden bed${ripe.length > 1 ? 's' : ''}.`);
        highlight('harvested from the garden');
      },
    })]);
  },
  eat() {
    if (S.stock.fish <= 0) return null;
    return mk('eat', 'Eating dried fish', pick(TH.eat), [go(RACK_STAND, false, urgent(S.needs.food)), act({
      pose: 'gather', face: RACK_P, min: 8, done() { S.stock.fish--; feed('food', 32); },
    })]);
  },
  shelter() {
    if (!S.weather.raining) return null;
    const hut = S.projects.hut.done;
    const min = clamp(S.weather.until - S.min, 20, 90);
    return mk('shelter', hut ? 'Cosy inside, out of the rain' : 'Sheltering from the rain', pick(TH.shelter),
      sitAt(SHELTER.spot, SHELTER.face, min, dm => { feed('energy', dm * 4 / 60); feed('fun', dm * (hut ? 5 : 0) / 60); }));
  },
  sleep() {
    const night = isNight(), h = S.items.hammock ? S.spots.hammock! : null, hut = S.projects.hut.done;
    const spot = h ? h.spot : SHELTER.spot, face = h ? h.face : SHELTER.face;
    let mins = 120;
    if (night) { const hr = hour(); mins = Math.max(60, ((7 - hr + 24) % 24) * 60); } // sleep until 07:00
    const th = night ? (h ? 'This hammock is heaven.' : thoughtFor('sleep', 'energy')) : pick(TH.nap);
    const rate = h ? 18 : hut ? 15 : 13; // energy per hour
    return mk('sleep', night ? (h ? 'Sleeping in the hammock' : 'Sleeping in the shelter') : 'Taking a nap', th,
      sitAt(spot, face, mins, dm => { feed('energy', dm * rate / 60); }, () => { if (night && !h) S.stats.nightsInShelter++; }, h ? h.lift : 0));
  },
  relax() {
    const s = pick(SEATS);
    return mk('relax', 'Resting by the fire', thoughtFor('relax', 'fun'), sitAt(s.p, s.face, 60, dm => {
      feed('fun', dm * 10 / 60); feed('energy', dm * 3 / 60); feed('company', dm * 1 / 60);
    }, () => remember('relax', tr('lazy') ? 0.04 : 0.01)));
  },
  explore() {
    const a0 = rand(0, 6.3), pts = [0, 0.35, 0.7].map(o => ground(pointAt(a0 + o, 0.84)));
    return mk('explore', 'Walking the beach', thoughtFor('explore', 'fun'), [
      go(pts[0]), act({ pose: 'idle', min: 6, face: pointAt(a0, 1.5) }),
      go(pts[1]), act({
        pose: 'idle', min: 6, face: pointAt(a0 + 0.35, 1.5), done() {
          const r = Math.random();
          if (r < 0.3) { say('Ooh, a pretty shell.'); log('Found a pretty shell on the beach.'); S.mood = Math.min(40, S.mood + 5); highlight('found a pretty shell'); remember('explore', 0.08); }
          else if (r < 0.38) { say('A message in a bottle… it’s blank. Figures.'); log('Found an empty bottle on the beach.'); }
          else if (r < 0.5 && S.goal) { S.stock.wood = Math.min(20, S.stock.wood + 1); say('Driftwood! That’ll be useful.'); log('Found driftwood on the beach.'); }
          else remember('explore', 0.02);
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
      done() { remember('talk', tr('social') ? 0.03 : 0.005); },
    })]);
  },
  piano() {
    const sp = S.spots.piano!;
    return mk('piano', 'Playing the piano', pianoThought(), sitAt(sp.spot, sp.face, 60, dm => { feed('fun', dm * 16 / 60); addXp('music', dm * 14 / 60); },
      () => { remember('piano', tr('musical') ? 0.06 : 0.03); highlight('played the piano'); }));
  },
  read() {
    const s = SEATS[1];
    return mk('read', 'Reading by the fire', pick(TH.read), sitAt(s.p, s.face, 60, dm => { feed('fun', dm * 12 / 60); addXp('reading', dm * 12 / 60); S.stats.readMin += dm; },
      () => { remember('read', tr('curious') ? 0.05 : 0.025); highlight('read for a while'); }));
  },
  sail() {
    if (!S.items.boat || !S.projects.dock.done) return null;
    return mk('sail', 'Sailing around the island', pick(TH.sail), [
      go(DOCK_END),
      act({ pose: 'sit', face: BOAT_DOCK, min: 2 }), // climb into the boat
      ride(BOAT_DOCK), ...SAIL_ROUTE.map(ride), ...[...SAIL_ROUTE].reverse().slice(1).map(ride), ride(BOAT_DOCK), ride(DOCK_END),
      act({
        pose: 'sit', face: FIRE, min: 2,
        begin() { S.sailing = false; }, // back on the dock
        done() {
          feed('fun', 35); addXp('survival', 5); remember('sail', 0.12); highlight('went sailing');
          const r = Math.random();
          if (r < 0.3) { S.stock.wood = Math.min(20, S.stock.wood + 2); log('She towed some driftwood back from her boat trip.'); }
          else if (r < 0.45) { say('Dolphins! Actual dolphins!'); log('She saw dolphins while sailing.'); S.mood = Math.min(40, S.mood + 10); highlight('saw dolphins'); }
        },
      }),
      standUp(),
    ]);
  },
  stargaze() {
    if (!S.items.telescope) return null;
    return mk('stargaze', 'Stargazing', pick(TH.stargaze), [go(TELESCOPE_STAND), act({
      pose: 'idle', face: TELESCOPE_P, min: 50, tick: dm => feed('fun', dm * 16 / 60),
      done() { addXp('reading', 4); remember('stargaze', tr('curious') ? 0.08 : 0.04); highlight('looked at the stars'); },
    })]);
  },
};

// Tasks that urgent needs (or a new gift) are allowed to cut short.
export const INTERRUPTIBLE = new Set<TaskId>(['relax', 'explore', 'talk', 'piano', 'read', 'wood', 'sleep', 'chop', 'build', 'plant', 'stargaze', 'shelter']);
// Outdoor tasks a sudden shower sends her away from.
export const RAIN_STOPS = new Set<TaskId>(['relax', 'explore', 'talk', 'piano', 'read', 'chop', 'build', 'plant', 'stargaze']);
// Which task "tries out" each new gift.
export const CURIOUS_TASK: Partial<Record<GiftKey, TaskId>> = { piano: 'piano', books: 'read', rod: 'fish', boat: 'sail', telescope: 'stargaze', seeds: 'plant' };

/* ---------- task lifecycle ---------- */
export function startTask(t: Task) {
  S.task = Object.assign(t, { i: 0, started: false, el: 0 });
  S.activity = t.label;
  const feeling = feelingAbout(t.id);
  if (feeling) t.thought = feeling;
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
