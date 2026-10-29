// Everything she can do, expressed as a list of steps (walk here, do this
// for N game minutes, wait for an animation). runner.ts plays them out.
import { ONE_SHOT_SECONDS } from '../config/animations';
import { freePlots, growingPlots, ripePlots } from './garden';
import {
  BOAT_DOCK, BOULDERS, BUSHES, clearOf, copy, dist, DOCK_END, DOCK_FACE, DRUM_P, FIRE, FISH, FOREST, GARDEN_P, GARDEN_STAND, ground,
  HAMMOCK_P, LOOKOUT_DECK, LOOKOUT_P, pointAt, RACK_P, SAIL_ROUTE, SCREE_P, SCREE_STAND, SEATS, SH, SHELTER, SPRING, standNear,
  WOODPILE_P, type Pt,
} from './island';
import { feelingAbout, remember } from './memory';
import { checkFinished, minutesLeft, PLANS, startPlan, workOn } from './plans';
import { addRawFish, nearestBoulder, nearestTree } from './resources';
import { addXp } from './skills';
import {
  feed, highlight, hour, isNight, log, S, say, tr,
  type CraftKey, type DoStep, type GoStep, type PlanKey, type Step, type Task, type TaskId, type WaitStep,
} from './state';
import { TH, thoughtFor } from './thoughts';
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
const CRAFT_SEAT = SEATS[0]; // she crafts sitting by the fire
const DRUM_SEAT = standNear(DRUM_P, 0.6, FIRE);
const HAMMOCK = { spot: HAMMOCK_P, face: FIRE, lift: 0.35 };
// where she stands to work on each project
const SITE: Record<string, { stand: Pt; face: Pt }> = {
  garden: { stand: GARDEN_STAND, face: GARDEN_P },
  rack: { stand: RACK_STAND, face: RACK_P },
  dock: { stand: ground(pointAt(Math.PI / 2, 0.78)), face: DOCK_END },
  hut: { stand: standNear(SH, 1.6), face: SH },
  hearth: { stand: standNear(FIRE, 1.1, SEATS[0].p), face: FIRE },
  lookout: { stand: standNear(LOOKOUT_P, 1.3), face: LOOKOUT_P },
  canoe: { stand: ground(pointAt(Math.PI / 2, 0.8)), face: DOCK_END },
};
const has = (k: CraftKey) => !!S.items[k];
/** Fun per hour from making things: making something with your own hands is satisfying (to most). */
const workJoy = () => tr('hardworking') ? 10 : tr('lazy') ? 3 : 6;

/* ---------- task factories: return null when the task isn't possible right now ---------- */
export const T: Record<string, () => Task | null> = {
  /* ----- food & water ----- */
  forage() {
    const i = nearestBush();
    if (i < 0) return null;
    const b = BUSHES[i];
    return mk('forage', 'Picking berries', thoughtFor('forage', 'food'), [go(b.stand, false, urgent(S.needs.food)), act({
      pose: 'gather', face: b.pos, min: 30,
      done() {
        setBerries(i, S.berries[i] - 1);
        feed('food', (18 + 1.5 * S.skills.foraging.lvl) * (has('basket') ? 1.25 : 1)); // a basket carries more back
        addXp('foraging', 8);
        S.stats.forages++;
        // once she has a garden she keeps the best seeds
        if (S.projects.garden.done && Math.random() < 0.3) { S.stock.seeds++; say('I’ll keep these seeds for the garden.'); }
      },
    })]);
  },
  fish() {
    const rod = has('rod'), dock = S.projects.dock.done;
    const spot = dock ? DOCK_END : FISH.spot, face = dock ? DOCK_FACE : FISH.face;
    return mk('fish', dock ? 'Fishing off the dock' : 'Fishing at the shore', thoughtFor('fish', 'food'), sitAt(spot, face, rod ? 60 : 90, dm => feed('fun', dm * (dock ? 6 : 4) / 60), () => {
      const lvl = S.skills.fishing.lvl, ok = Math.random() < 0.35 + 0.06 * lvl + (rod ? 0.25 : 0) + (dock ? 0.12 : 0);
      S.stats.fishTrips++;
      if (ok) {
        const n = lvl >= 4 && Math.random() < 0.4 ? 2 : 1;
        addRawFish(n); addXp('fishing', 15); S.fishFails = 0; S.stats.fishCaught += n;
        feed('food', 5); // a nibble; the real meal needs the fire
        say(n > 1 ? 'Two fish! Time to light up the grill.' : pick(['Got one! Now to cook it.', 'Fish for dinner, if the fire’s going.']));
        log(n > 1 ? 'Caught two fish.' : 'Caught a fish.');
        highlight('caught a fish');
        remember('fish', 0.08);
        if (S.task) S.task.celebrate = true;
      } else {
        addXp('fishing', 6); S.fishFails++;
        say('Nothing. The fish are laughing at me.'); log('Came back from fishing empty-handed.');
        remember('fish', -0.08);
      }
    }));
  },
  cook() {
    if (S.stock.raw <= 0 || S.fire <= 0) return null;
    const n = Math.min(2, S.stock.raw);
    return mk('cook', 'Grilling fish by the fire', pick(TH.cook), sitAt(CRAFT_SEAT.p, FIRE, 15 * n, undefined, () => {
      if (S.fire <= 0) { say('The fire went out before it was done…'); return; }
      S.stock.raw -= n;
      feed('food', n * (38 + 2 * S.skills.fishing.lvl));
      feed('fun', 6);
      addXp('survival', 3 * n);
      S.stats.meals++;
      S.lastMeal = S.min;
      S.mood = Math.min(40, S.mood + 8); // a hot meal lifts the spirits
      remember('cook', 0.05);
      highlight('grilled fish over the fire');
    }));
  },
  eat() {
    if (S.stock.fish <= 0) return null;
    return mk('eat', 'Eating dried fish', pick(TH.eat), [go(RACK_STAND, false, urgent(S.needs.food)), act({
      pose: 'gather', face: RACK_P, min: 8, done() { S.stock.fish--; feed('food', 32); },
    })]);
  },
  drink() {
    return mk('drink', 'Drinking at the spring', thoughtFor('drink', 'water'), [go(SPRING.spot, false, urgent(S.needs.water)), act({
      pose: 'gather', face: SPRING.face, min: 12, done() { feed('water', 50); addXp('survival', 2); },
    })]);
  },
  wood() {
    // feed the fire from the woodpile; no logs, no fire
    if (S.stock.wood <= 0) return null;
    return mk('wood', 'Feeding the fire', pick(TH.wood), [go(WOODPILE_STAND), act({ pose: 'gather', face: WOODPILE_P, min: 4 }),
      go(standNear(FIRE, 1.2, WOODPILE_P), true),
      act({
        pose: 'gather', face: FIRE, min: 6, done() {
          if (S.stock.wood <= 0) return;
          S.stock.wood--;
          if (S.fire <= 0) log('She got the fire going again.');
          S.fire = Math.min(100, S.fire + 45);
          addXp('survival', 3);
        },
      })]);
  },

  /* ----- gathering ----- */
  sticks() {
    const i = nearestTree('tree', S.pos);
    if (S.deadwood < 1 || i < 0) return null;
    const t = FOREST[i];
    return mk('sticks', 'Collecting fallen branches', pick(TH.sticks), [go(t.stand), act({ pose: 'gather', face: t.pos, min: 25 }), go(WOODPILE_STAND, true),
      act({
        pose: 'gather', face: WOODPILE_P, min: 3, done() {
          const n = Math.min(2, Math.floor(S.deadwood));
          S.deadwood -= n;
          S.stock.wood = Math.min(20, S.stock.wood + n);
          addXp('survival', 2);
        },
      })]);
  },
  chop() {
    const i = nearestTree('tree', S.pos);
    if (!has('axe') || i < 0) return null;
    const t = FOREST[i];
    return mk('chop', 'Chopping down a tree', pick(TH.chop), [go(t.stand), act({
      pose: 'chop', face: t.pos, min: 50, done() {
        S.trees[i] = { state: 'stump', growth: 0 };
        S.stats.treesFelled++;
        if (Math.random() < 0.7) S.stock.saplings++; // a seedling from the forest floor to replant
        log('She felled a tree.');
        highlight('felled a tree');
      },
    }), go(WOODPILE_STAND, true), act({
      pose: 'gather', face: WOODPILE_P, min: 4, done() {
        S.stock.wood = Math.min(20, S.stock.wood + 4 + (S.skills.survival.lvl >= 3 ? 1 : 0));
        addXp('survival', 5);
        remember('chop', tr('hardworking') ? 0.04 : tr('lazy') ? -0.05 : -0.01);
      },
    })]);
  },
  replant() {
    const i = nearestTree('stump', S.pos);
    if (S.stock.saplings <= 0 || i < 0) return null;
    const t = FOREST[i];
    return mk('replant', 'Planting a sapling', pick(TH.replant), [go(t.stand), act({
      pose: 'gather', face: t.pos, min: 15, done() {
        S.stock.saplings--;
        S.trees[i] = { state: 'sapling', growth: 0 };
        addXp('gardening', 4);
        highlight('planted a sapling');
      },
    })]);
  },
  fibre() {
    const i = nearestTree('tree', S.pos);
    if (i < 0) return null;
    const t = FOREST[i];
    return mk('fibre', 'Stripping vines for fibre', pick(TH.fibre), [go(t.stand), act({
      pose: 'gather', face: t.pos, min: 30, done() { S.stock.fibre = Math.min(20, S.stock.fibre + 2 + (has('basket') ? 1 : 0)); addXp('crafting', 2); },
    })]);
  },
  stones() {
    if (S.loose < 1) return null;
    return mk('stones', 'Collecting loose stones', pick(TH.stones), [go(SCREE_STAND), act({
      pose: 'gather', face: SCREE_P, min: 30, done() {
        const n = Math.min(2, Math.floor(S.loose));
        S.loose -= n;
        S.stock.stone = Math.min(30, S.stock.stone + n);
      },
    })]);
  },
  mine() {
    const i = nearestBoulder(S.pos);
    if (!has('pick') || i < 0) return null;
    const b = BOULDERS[i];
    return mk('mine', 'Breaking stones off a boulder', pick(TH.mine), [go(b.stand), act({
      pose: 'chop', face: b.pos, min: 45, done() {
        const n = Math.min(3, S.boulders[i]);
        S.boulders[i] -= n;
        S.stock.stone = Math.min(30, S.stock.stone + n);
        S.stats.stonesMined += n;
        addXp('survival', 4);
        remember('mine', tr('hardworking') ? 0.03 : -0.02);
        if (S.boulders[i] <= 0) log('She broke the last of a boulder apart.');
      },
    })]);
  },

  /* ----- making things ----- */
  craft() {
    const k = S.goal;
    if (!k || PLANS[k].kind !== 'craft') return null;
    const min = Math.min(90, Math.ceil(minutesLeft()));
    return mk('craft', `Making ${PLANS[k].a}`, pick(TH.craft), [go(CRAFT_SEAT.p), act({
      pose: 'sit', face: FIRE, min,
      begin() { startPlan(k); },
      tick: dm => { workOn(k, dm); feed('fun', dm * workJoy() / 60); },
      done() { checkFinished(k); },
    }), standUp()]);
  },
  build() {
    const k = S.goal;
    if (!k || PLANS[k].kind !== 'build') return null;
    const site = SITE[k], min = Math.min(60, Math.ceil(minutesLeft()));
    return mk('build', `Building the ${PLANS[k].name}`, pick(TH.build), [go(site.stand), act({
      pose: 'hammer', face: site.face, min,
      begin() { startPlan(k as PlanKey); },
      tick: dm => { workOn(k, dm); feed('fun', dm * workJoy() / 60); },
      done() {
        remember('build', tr('hardworking') ? 0.06 : tr('lazy') ? -0.02 : 0.03);
        checkFinished(k);
      },
    })]);
  },

  /* ----- garden ----- */
  plant() {
    const free = freePlots(), n = Math.min(free.length, S.stock.seeds);
    if (!S.projects.garden.done || n <= 0) return null;
    return mk('plant', 'Planting seeds', pick(TH.plant), [go(GARDEN_STAND), act({
      pose: 'gather', face: GARDEN_P, min: 10 * n, done() {
        for (const p of freePlots().slice(0, n)) {
          if (S.stock.seeds <= 0) break;
          S.stock.seeds--;
          Object.assign(p, { state: 'growing', growth: 0, water: 70, dryMin: 0 });
        }
        addXp('gardening', 6 * n);
        remember('plant', 0.04);
        highlight('planted seeds');
      },
    })]);
  },
  water() {
    if (!growingPlots().length) return null;
    const bucket = has('bucket');
    return mk('water', 'Watering the garden', pick(TH.water), [go(SPRING.spot), act({ pose: 'gather', face: SPRING.face, min: 5 }), go(GARDEN_STAND, true),
      act({
        pose: 'gather', face: GARDEN_P, min: bucket ? 5 : 10, done() {
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
          feed('food', 20);
          S.stock.seeds += Math.random() < 0.6 ? 2 : 1; // she keeps seed from the crop
          Object.assign(p, { state: 'empty', growth: 0, water: 0, dryMin: 0 });
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

  /* ----- rest ----- */
  shelter() {
    if (!S.weather.raining) return null;
    const hut = S.projects.hut.done;
    const min = clamp(S.weather.until - S.min, 20, 90);
    return mk('shelter', hut ? 'Cosy inside, out of the rain' : 'Sheltering from the rain', pick(TH.shelter),
      sitAt(SHELTER.spot, SHELTER.face, min, dm => { feed('energy', dm * 4 / 60); feed('fun', dm * (hut ? 5 : 0) / 60); }));
  },
  sleep() {
    const night = isNight(), h = has('hammock') ? HAMMOCK : null, hut = S.projects.hut.done;
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

  /* ----- fun ----- */
  explore() {
    const a0 = rand(0, 6.3), pts = [0, 0.35, 0.7].map(o => ground(pointAt(a0 + o, 0.84)));
    return mk('explore', 'Walking the beach', thoughtFor('explore', 'fun'), [
      go(pts[0]), act({ pose: 'idle', min: 6, face: pointAt(a0, 1.5) }),
      go(pts[1]), act({
        pose: 'idle', min: 6, face: pointAt(a0 + 0.35, 1.5), done() {
          const r = Math.random();
          if (r < 0.3) { say('Ooh, a pretty shell.'); log('Found a pretty shell on the beach.'); S.mood = Math.min(40, S.mood + 5); highlight('found a pretty shell'); remember('explore', 0.08); }
          else if (r < 0.38) { say('A message in a bottle… it’s blank. Figures.'); log('Found an empty bottle on the beach.'); }
          else if (r < 0.55) { S.stock.wood = Math.min(20, S.stock.wood + 1); say('Driftwood! That’ll burn.'); log('Found driftwood on the beach.'); }
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
  drum() {
    if (!has('drum')) return null;
    const l = S.skills.music.lvl;
    const th = l < 2 ? pick(['Boom. Boom-boom. Hm.', 'Rhythm is harder than it looks.']) : l < 5 ? pick(['I’ve almost got a groove going.', 'The waves are keeping time with me.']) : pick(['The whole island is dancing.', 'I’ve never played this well in my life.']);
    return mk('drum', 'Playing the drum', th, sitAt(DRUM_SEAT, DRUM_P, 50, dm => { feed('fun', dm * 16 / 60); feed('company', dm * 4 / 60); addXp('music', dm * 14 / 60); },
      () => { remember('drum', tr('musical') ? 0.06 : 0.03); highlight('played the drum'); }));
  },
  write() {
    if (!has('journal')) return null;
    const s = SEATS[1];
    return mk('write', 'Carving stories into her boards', pick(TH.write), sitAt(s.p, s.face, 60, dm => { feed('fun', dm * 12 / 60); feed('company', dm * 6 / 60); addXp('writing', dm * 12 / 60); S.stats.writeMin += dm; },
      () => { remember('write', tr('curious') ? 0.05 : 0.025); highlight('carved a story'); }));
  },
  sail() {
    if (!S.projects.canoe.done || !S.projects.dock.done) return null;
    return mk('sail', 'Paddling around the island', pick(TH.sail), [
      go(DOCK_END),
      act({ pose: 'sit', face: BOAT_DOCK, min: 2 }), // climb into the canoe
      ride(BOAT_DOCK), ...SAIL_ROUTE.map(ride), ...[...SAIL_ROUTE].reverse().slice(1).map(ride), ride(BOAT_DOCK), ride(DOCK_END),
      act({
        pose: 'sit', face: FIRE, min: 2,
        begin() { S.sailing = false; }, // back on the dock
        done() {
          feed('fun', 35); addXp('survival', 5); remember('sail', 0.12); highlight('went paddling');
          const r = Math.random();
          if (r < 0.3) { S.stock.wood = Math.min(20, S.stock.wood + 2); log('She towed some driftwood back from her canoe trip.'); }
          else if (r < 0.45) { say('Dolphins! Actual dolphins!'); log('She saw dolphins while paddling.'); S.mood = Math.min(40, S.mood + 10); highlight('saw dolphins'); }
        },
      }),
      standUp(),
    ]);
  },
  stargaze() {
    if (!S.projects.lookout.done) return null;
    return mk('stargaze', 'Stargazing from the lookout', pick(TH.stargaze), [go(LOOKOUT_P), act({
      pose: 'idle', face: pointAt(-1.2, 2), min: 50, lift: LOOKOUT_DECK, tick: dm => feed('fun', dm * 16 / 60),
      done() { addXp('writing', 4); remember('stargaze', tr('curious') ? 0.08 : 0.04); highlight('looked at the stars'); },
    })]);
  },
  watch() {
    if (!S.projects.lookout.done) return null;
    return mk('watch', 'Watching the sea from the lookout', pick(TH.watch), [go(LOOKOUT_P), act({
      pose: 'idle', face: pointAt(-1.2 + rand(-0.6, 0.6), 2), min: 40, lift: LOOKOUT_DECK, tick: dm => feed('fun', dm * 12 / 60),
      done() {
        remember('watch', tr('curious') ? 0.06 : 0.03);
        const r = Math.random();
        if (r < 0.15) { say('A whale! Right there!'); log('She spotted a whale from the lookout.'); S.mood = Math.min(40, S.mood + 12); highlight('spotted a whale'); }
        else if (r < 0.2) { say('Was that… a sail? It’s gone.'); log('She thought she saw a sail on the horizon.'); highlight('thought she saw a sail'); }
      },
    })]);
  },
};

// Tasks that urgent needs (or something new to try) are allowed to cut short.
export const INTERRUPTIBLE = new Set<TaskId>(['relax', 'explore', 'talk', 'drum', 'write', 'sleep', 'sticks', 'chop', 'fibre', 'stones', 'mine', 'replant', 'craft', 'build', 'plant', 'stargaze', 'watch', 'shelter']);
// Outdoor tasks a sudden shower sends her away from.
export const RAIN_STOPS = new Set<TaskId>(['relax', 'explore', 'talk', 'drum', 'write', 'sticks', 'chop', 'fibre', 'stones', 'mine', 'replant', 'craft', 'build', 'plant', 'stargaze', 'watch']);
// Which task "tries out" each newly made thing.
export const CURIOUS_TASK: Partial<Record<CraftKey, TaskId>> = { rod: 'fish', drum: 'drum', journal: 'write', axe: 'chop', pick: 'mine' };

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
