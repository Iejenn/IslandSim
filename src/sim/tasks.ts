// Everything she can do, expressed as a list of steps (walk here, do this
// for N game minutes, wait for an animation). runner.ts plays them out.
import { ONE_SHOT_SECONDS } from '../config/animations';
import { freePlots, growingPlots, ripePlots } from './garden';
import {
  addScaled, dirXZ, SP, BATH_P, CLAY_P, CLAY_STAND, HIVE_P, KILN_P, MOSAIC_P, OVEN_P, SUNDIAL_P, BURROWS, HOUSEBOAT_BED, HOUSEBOAT_P, WARREN_P, WARREN_STAND, BARREL_P, BOAT_DOCK, BOULDERS, SPEAR_SPOT, TRAP_P, TRAP_STAND, TREEHOUSE_BED, TREEHOUSE_P, TREEHOUSE_TREE, BUSHES, CHAIR_P, COOP_P, FENCE_R, LODGE_BED, LODGE_DOOR, LODGE_P, LODGE_KITCHEN, LODGE_SOFA, SHEEP_PEN_P, clearOf, copy, dist, DOCK_END, DOCK_FACE, DRUM_P, FIRE, FISH, FOREST, GARDEN_P, GARDEN_STAND, ground,
  HAMMOCK_BED, SHELTER_BED, LOOKOUT_DECK, LOOKOUT_P, pointAt, RACK_P, SAIL_ROUTE, SCREE_P, SCREE_STAND, SEATS, SH, SHELTER, SPRING, standNear,
  V, WOODPILE_P, type Pt,
} from './island';
import { feelingAbout, remember } from './memory';
import { nextToHerd, sheepToShear } from './animals';
import { gainTrust } from './companion';
import { checkFinished, damaged, indoors, minutesLeft, PLANS, REPAIRABLE, startPlan, workOn, works } from './plans';
import { addMeat, addRawFish, nearestBoulder, nearestTree } from './resources';
import { addXp } from './skills';
import {
  feed, highlight, hour, isNight, log, S, say, tr,
  type CraftKey, type DoStep, type GoStep, type PlanKey, type Resource, type Step, type Task, type TaskId, type WaitStep,
} from './state';
import { fx, season } from './seasons';
import { TH, thoughtFor } from './thoughts';
import { clamp, pick, rand } from './util';

/** Odds a fishing trip lands something, for the gear she'd use right now. */
export function catchChance() {
  const rod = has('rod'), spear = !rod && has('spear');
  return Math.min(0.95, 0.35 + 0.06 * S.skills.fishing.lvl + (rod ? 0.25 : spear ? 0.2 : 0) + (works('dock') && !spear ? 0.12 : 0)
    + (S.washedUp === 'line' ? 0.05 : 0) + fx().fish); // a real fishing line helps; fish bite best in summer
}

/** Hours her body clock is shifted: an early riser wakes and tires 1.5h earlier, a night owl later. */
export function sleepShift() {
  return S.quirk === 'earlybird' ? -1.5 : S.quirk === 'nightowl' ? 1.5 : 0;
}

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
const BARREL_STAND = standNear(BARREL_P, 0.8, FIRE);
const CRAFT_SEAT = SEATS[0]; // she crafts sitting by the fire
/** Her seat by the fire: the chair once she's made one, otherwise a log. */
const fireSeat = () => S.items.chair ? CHAIR_P : CRAFT_SEAT.p;
const DRUM_SEAT = standNear(DRUM_P, 0.6, FIRE);
/** Lie down on her back (feet at p, head towards face), then get up again. */
function lieAt(p: Pt, face: Pt, min: number, tick?: (dm: number) => void, done?: (() => void) | null, lift?: number): Step[] {
  return [go(p), act({ pose: 'lie', face, min, tick, done, lift }), standUp()];
}
// where she stands to work on each project
const SITE: Record<string, { stand: Pt; face: Pt }> = {
  garden: { stand: GARDEN_STAND, face: GARDEN_P },
  rack: { stand: RACK_STAND, face: RACK_P },
  dock: { stand: ground(pointAt(Math.PI / 2, 0.78)), face: DOCK_END },
  hut: { stand: standNear(SH, 1.6), face: SH },
  hearth: { stand: standNear(FIRE, 1.1, SEATS[0].p), face: FIRE },
  lookout: { stand: standNear(LOOKOUT_P, 1.3), face: LOOKOUT_P },
  canoe: { stand: ground(pointAt(Math.PI / 2, 0.8)), face: DOCK_END },
  lodge: { stand: LODGE_DOOR, face: LODGE_P },
  fence: { stand: ground(V(Math.cos(0.9) * (FENCE_R - 1), Math.sin(0.9) * (FENCE_R - 1))), face: ground(V(Math.cos(0.9) * FENCE_R * 1.2, Math.sin(0.9) * FENCE_R * 1.2)) },
  coop: { stand: standNear(COOP_P, 1.3), face: COOP_P },
  trap: { stand: TRAP_STAND, face: TRAP_P },
  barrel: { stand: BARREL_STAND, face: BARREL_P },
  treehouse: { stand: standNear(TREEHOUSE_P, 1.2, FIRE), face: TREEHOUSE_P },
  houseboat: { stand: DOCK_END, face: HOUSEBOAT_P },
  kiln: { stand: standNear(KILN_P, 1.1, FIRE), face: KILN_P },
  oven: { stand: standNear(OVEN_P, 1.0, FIRE), face: OVEN_P },
  beehive: { stand: standNear(HIVE_P, 1.1, FIRE), face: HIVE_P },
  sundial: { stand: standNear(SUNDIAL_P, 0.9, FIRE), face: SUNDIAL_P },
  mosaic: { stand: standNear(MOSAIC_P, 1.0, FIRE), face: MOSAIC_P },
  bathhouse: { stand: standNear(BATH_P, 1.3, SP), face: BATH_P },
};
/* where event things are: on the beach at the event's angle */
export const wreckPos = () => ground(pointAt(S.wreck.a, 0.88));
export const nestPos = () => ground(pointAt(S.turtle.a, 0.8));
export const digPos = (a: number) => ground(pointAt(a, 0.78));
export const GULL_P = ground(V(3.0, 2.6)); // the hurt gull hops about by the fire
const has = (k: CraftKey) => !!S.items[k];
/** Up on the lookout platform: standing, or rocking in her chair if she made one. */
function onLookout(face: Pt, min: number, funPerHour: number, done: () => void): Step[] {
  const rocker = has('rocker'), k = rocker ? 1.3 : 1;
  const sit = act({ pose: rocker ? 'sit' : 'idle', face, min, lift: LOOKOUT_DECK, tick: dm => feed('fun', dm * funPerHour * k / 60), done });
  return rocker ? [go(LOOKOUT_P), sit, standUp()] : [go(LOOKOUT_P), sit];
}
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
        if (S.favFood === 'berries') { feed('fun', 6); S.mood = Math.min(40, S.mood + 3); } // she just loves berries
        addXp('foraging', 8);
        S.stats.forages++;
        // once she has a garden she keeps the best seeds
        if (S.projects.garden.done && Math.random() < 0.3) { S.stock.seeds++; say('I’ll keep these seeds for the garden.'); }
      },
    })]);
  },
  fish() {
    // three ways to fish: a rod (from the shore or the dock), wading in with a spear, or by hand
    const rod = has('rod'), spear = !rod && has('spear'), dock = works('dock') && !spear;
    const spot = dock ? DOCK_END : FISH.spot, face = dock ? DOCK_FACE : FISH.face;
    const landed = () => {
      const lvl = S.skills.fishing.lvl, ok = Math.random() < catchChance();
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
    };
    if (spear) {
      return mk('fish', 'Spear fishing in the shallows', pick(['Hold still… hold still…', 'There! No… there!', 'Quick hands, quick hands.']), [go(SPEAR_SPOT.spot), act({
        pose: 'idle', face: SPEAR_SPOT.face, min: 70, tick: dm => feed('fun', dm * 7 / 60), done: landed,
      })]);
    }
    return mk('fish', dock ? 'Fishing off the dock' : 'Fishing at the shore', thoughtFor('fish', 'food'), sitAt(spot, face, rod ? 60 : 90, dm => feed('fun', dm * (dock ? 6 : 4) / 60), landed));
  },
  checktrap() {
    if (!works('trap') || S.trapFish < 1) return null;
    return mk('checktrap', 'Checking the fish trap', pick(['Anything in there?', 'Let’s see what the sea brought.', 'Come to mama.']), [go(TRAP_STAND), act({
      pose: 'gather', face: TRAP_P, min: 15, done() {
        const n = Math.floor(S.trapFish);
        S.trapFish -= n;
        addRawFish(n);
        S.stats.fishCaught += n;
        addXp('fishing', 5);
        say(n > 1 ? `${n} fish in the trap!` : 'One fish in the trap. I’ll take it.');
        highlight('emptied the fish trap');
      },
    })]);
  },
  cook() {
    // she cooks over the campfire, or in her kitchen (whose stove burns a log from the pile)
    const kitchen = has('kitchen') && works('lodge') && (S.fire <= 0 || S.weather.raining) && S.stock.wood > 0;
    if (S.fire <= 0 && !kitchen) return null;
    // the best meal she can make from what she has: a stew needs the bucket as a pot
    const st = S.stock;
    // everything she could make right now, best first; her favourite dish wins if it's possible
    const pot = has('bucket') || S.washedUp === 'pot';
    const oven = works('oven') && S.stock.wood > 0;
    const options = ([
      oven && st.veg > 0 && (st.eggs > 0 || st.meat > 0 || st.raw > 0) && 'pie',
      (st.raw > 0 || st.meat > 0) && st.veg > 0 && pot && 'stew',
      st.eggs >= 2 && st.veg > 0 && 'omelette',
      st.meat > 0 && 'rabbit',
      st.raw > 0 && 'fish',
      st.eggs >= 2 && 'eggs',
      st.veg >= 2 && 'veg',
    ].filter(Boolean)) as ('pie' | 'stew' | 'omelette' | 'rabbit' | 'fish' | 'eggs' | 'veg')[];
    const fav = options.find(o => o === S.favFood || (S.favFood === 'eggs' && o === 'omelette') || (S.favFood === 'veg' && o === 'pie'));
    const recipe = fav ?? options[0] ?? null;
    if (!recipe) return null;
    const n = recipe === 'fish' ? Math.min(2, st.raw) : 1;
    const label = { pie: 'Baking a pie in the oven', rabbit: 'Roasting rabbit', stew: st.raw > 0 ? 'Cooking a fish stew' : 'Cooking a rabbit stew', omelette: 'Making an omelette', fish: 'Grilling fish', eggs: 'Frying eggs', veg: 'Roasting vegetables' }[recipe];
    const steps = recipe === 'pie'
      ? [go(SITE.oven.stand), act({ pose: 'gather', face: OVEN_P, min: 40, begin() { st.wood--; }, done: () => serve() })]
      : kitchen
      ? [go(LODGE_KITCHEN.spot), act({ pose: 'gather', face: LODGE_KITCHEN.face, min: recipe === 'stew' ? 30 : 15 * n, begin() { st.wood--; }, done: () => serve() })]
      : sitAt(fireSeat(), FIRE, recipe === 'stew' ? 35 : 15 * n, undefined, () => serve());
    const serve = () => {
      if (!kitchen && recipe !== 'pie' && S.fire <= 0) { say('The fire went out before it was done…'); return; }
      const lvl = S.skills.fishing.lvl;
      if (recipe === 'pie') { st.veg--; if (st.eggs > 0) st.eggs--; else if (st.meat > 0) st.meat--; else st.raw--; feed('food', 65); feed('fun', 10); S.mood = Math.min(40, S.mood + 14); }
      else if (recipe === 'stew') { if (st.raw > 0) st.raw--; else st.meat--; st.veg--; feed('food', 60 + 2 * lvl); feed('fun', 8); S.mood = Math.min(40, S.mood + 12); }
      else if (recipe === 'omelette') { st.eggs -= 2; st.veg--; feed('food', 48); feed('fun', 7); S.mood = Math.min(40, S.mood + 10); }
      else if (recipe === 'rabbit') { st.meat--; feed('food', 52 + 2 * lvl); feed('fun', 6); S.mood = Math.min(40, S.mood + 8); }
      else if (recipe === 'fish') { st.raw -= n; feed('food', n * (38 + 2 * lvl)); feed('fun', 6); S.mood = Math.min(40, S.mood + 8); }
      else if (recipe === 'eggs') { st.eggs -= 2; feed('food', 30); feed('fun', 4); S.mood = Math.min(40, S.mood + 6); }
      else { st.veg -= 2; feed('food', 35); feed('fun', 4); S.mood = Math.min(40, S.mood + 5); }
      if (has('table')) { S.mood = Math.min(40, S.mood + 6); feed('fun', 4); } // eating at a real table
      if (recipe === fav) { S.mood = Math.min(40, S.mood + 8); feed('fun', 5); } // her favourite
      addXp('survival', 3 * n);
      S.stats.meals++;
      S.lastMeal = S.min;
      remember('cook', recipe === 'stew' ? 0.1 : 0.05);
      const dish = { pie: 'a fresh-baked pie', rabbit: 'roast rabbit', stew: 'a stew', omelette: 'an omelette', fish: 'grilled fish', eggs: 'fried eggs', veg: 'roast vegetables' }[recipe];
      if (!S.feelingsNoted.includes('dish:' + dish)) { S.feelingsNoted.push('dish:' + dish); log(`She made ${dish} for the first time${recipe === fav ? '. Her favourite!' : '.'}`); }
      highlight(`had ${dish}${has('table') ? ' at her table' : ''}`);
    };
    return mk('cook', label, pick(TH.cook), steps);
  },
  eat() {
    // cold food: dried fish from the rack, or raw garden vegetables
    if (S.stock.fish > 0) {
      return mk('eat', 'Eating dried fish', pick(TH.eat), [go(RACK_STAND, false, urgent(S.needs.food)), act({
        pose: 'gather', face: RACK_P, min: 8, done() { if (S.stock.fish > 0) { S.stock.fish--; feed('food', 32); } },
      })]);
    }
    if (S.stock.honey > 0 && S.stock.veg <= 0) {
      return mk('eat', 'Eating honey', 'Sweet, sticky, perfect.', [go(standNear(HIVE_P, 1.1, FIRE), false, urgent(S.needs.food)), act({
        pose: 'gather', face: HIVE_P, min: 6, done() { if (S.stock.honey > 0) { S.stock.honey--; feed('food', 18); feed('fun', 10); } },
      })]);
    }
    // starving with no way to cook: raw fish it is
    if (S.stock.veg <= 0 && S.stock.raw > 0 && S.needs.food < 15) {
      return mk('eat', 'Eating raw fish', 'Raw fish. Desperate times.', [act({ pose: 'gather', min: 8, done() { if (S.stock.raw > 0) { S.stock.raw--; feed('food', 20); } } })]);
    }
    if (S.stock.veg <= 0) return null;
    return mk('eat', 'Eating raw vegetables', 'Crunchy. Better cooked, but crunchy.', [go(GARDEN_STAND, false, urgent(S.needs.food)), act({
      pose: 'gather', face: GARDEN_P, min: 6, done() { if (S.stock.veg > 0) { S.stock.veg--; feed('food', 16); } },
    })]);
  },
  drink() {
    // rainwater from the barrel when it's nearer than the pond
    if (S.barrel >= 1 && works('barrel') && dist(BARREL_STAND, S.pos) < dist(SPRING.spot, S.pos)) {
      return mk('drink', 'Drinking rainwater from the barrel', pick(['Rainwater. Free delivery.', 'Best idea I ever had, this barrel.']), [go(BARREL_STAND, false, urgent(S.needs.water)), act({
        pose: 'gather', face: BARREL_P, min: 8, done() { S.barrel = Math.max(0, S.barrel - 1); feed('water', 45); addXp('survival', 1); },
      })]);
    }
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
    const i = nearestTree('tree', S.pos, TREEHOUSE_TREE); // never the big tree by camp (the treehouse tree)
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
    const bucket = has('bucket'), barrel = works('barrel') && S.barrel >= 1;
    const src = barrel ? { spot: BARREL_STAND, face: BARREL_P } : SPRING;
    return mk('water', 'Watering the garden', pick(TH.water), [go(src.spot), act({ pose: 'gather', face: src.face, min: 5, done() { if (barrel) S.barrel = Math.max(0, S.barrel - 1); } }), go(GARDEN_STAND, true),
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
          feed('food', 10); // a few bites right there
          S.stock.veg = Math.min(10, S.stock.veg + 1); // the rest goes in the pantry
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
    const lodge = works('lodge'), cosy = indoors(), sofa = lodge && has('sofa');
    const min = clamp(S.weather.until - S.min, 20, 90);
    const where = lodge ? LODGE_SOFA : SHELTER;
    return mk('shelter', sofa ? 'Curled up on the sofa, listening to the rain' : cosy ? 'Cosy inside, out of the rain' : 'Sheltering from the rain', pick(TH.shelter),
      sitAt(where.spot, where.face, min, dm => { feed('energy', dm * 4 / 60); feed('fun', dm * (sofa ? 9 : cosy ? 5 : 0) / 60); }));
  },
  sleep() {
    const night = isNight(), lodge = works('lodge');
    // energy per hour in each place she could sleep; she picks the best
    const blanket = has('blanket') ? 3 : 0;
    const beds = [
      { where: 'shelter', spot: SHELTER_BED, lift: has('bed') ? 0.22 : 0.08, rate: (works('hut') ? 15 : 13) + (has('bed') ? 4 : 0) + blanket + (S.washedUp === 'tarp' ? 2 : 0), label: 'Sleeping in the shelter' },
      ...(has('hammock') ? [{ where: 'hammock', spot: HAMMOCK_BED, lift: HAMMOCK_BED.lift!, rate: 18, label: 'Sleeping in the hammock' }] : []),
      // (an adventurous soul likes the treehouse even when there's a softer bed)
      ...(works('treehouse') ? [{ where: 'treehouse', spot: TREEHOUSE_BED, lift: TREEHOUSE_BED.lift!, rate: 19 + blanket, pref: 6 * S.taste.adventure, label: 'Sleeping in the treehouse' }] : []),
      ...(works('houseboat') ? [{ where: 'houseboat', spot: { spot: HOUSEBOAT_BED, face: addScaled(HOUSEBOAT_BED, dirXZ(HOUSEBOAT_BED, HOUSEBOAT_P), 3) }, lift: 0, rate: 20 + blanket, pref: 6 * S.taste.sea, label: 'Sleeping on the houseboat' }] : []),
      ...(lodge ? [{ where: 'lodge', spot: LODGE_BED, lift: has('realbed') ? 0.46 : 0.18, rate: (has('realbed') ? 24 : 16 + (has('bed') ? 4 : 0)) + blanket, label: has('realbed') ? 'Sleeping in her bed' : 'Sleeping in the lodge' }] : []),
    ];
    // on cold nights the open-air beds lose their charm (less so with a blanket)
    const chilly = fx().cold * (S.quirk === 'hardy' ? 0.3 : 1) * (has('blanket') ? 0.5 : 1);
    const exposed = (w: string) => w === 'hammock' || w === 'treehouse' || w === 'houseboat' || (w === 'shelter' && !works('hut'));
    const score = (b: { rate: number; pref?: number; where: string }) => b.rate + (b.pref ?? 0) - (exposed(b.where) ? 10 * chilly : 0);
    const bed = beds.reduce((a, b) => score(b) > score(a) ? b : a);
    let mins = 120;
    if (night) { const hr = hour(); mins = Math.max(60, ((7 + sleepShift() - hr + 24) % 24) * 60); } // sleep until 07:00 (or her own body clock)
    const th = night ? (bed.where === 'hammock' ? 'This hammock is heaven.' : bed.where === 'treehouse' ? 'Goodnight, stars. Goodnight, leaves.' : has('realbed') && bed.where === 'lodge' ? 'My own bed. Bliss.' : thoughtFor('sleep', 'energy')) : pick(TH.nap);
    if (bed.where === 'houseboat') {
      // along the dock, step aboard, sleep rocked by the waves, back to the dock in the morning
      return mk('sleep', night ? bed.label : 'Napping on the houseboat', night ? 'Rocked to sleep by the sea.' : pick(TH.nap), [
        go(DOCK_END), ride(HOUSEBOAT_BED),
        act({ pose: 'lie', face: bed.spot.face, min: mins, tick: dm => { feed('energy', dm * bed.rate / 60); } }),
        ride(DOCK_END), act({ pose: 'sit', face: FIRE, min: 1, begin() { S.sailing = false; } }), standUp(),
      ]);
    }
    return mk('sleep', night ? bed.label : 'Taking a nap', th,
      lieAt(bed.spot.spot, bed.spot.face, mins, dm => { feed('energy', dm * bed.rate / 60); }, () => { if (night && bed.where === 'shelter') S.stats.nightsInShelter++; }, bed.lift));
  },
  relax() {
    const chair = has('chair'), s = pick(SEATS);
    const k = chair ? 1.3 : 1; // a real chair is much more restful than a log
    return mk('relax', chair ? 'Relaxing in her chair by the fire' : 'Resting by the fire', thoughtFor('relax', 'fun'), sitAt(chair ? CHAIR_P : s.p, FIRE, 60, dm => {
      feed('fun', dm * 10 * k / 60); feed('energy', dm * 3 * k / 60); feed('company', dm * 1 / 60);
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
          if (r < (S.quirk === 'collector' ? 0.5 : 0.3)) { say('Ooh, a pretty shell.'); log('Found a pretty shell on the beach.'); S.stock.shells++; S.mood = Math.min(40, S.mood + 5); highlight('found a pretty shell'); remember('explore', 0.08); }
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
    if (!S.projects.canoe.done || !works('dock')) return null;
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
    if (!works('lookout')) return null;
    return mk('stargaze', 'Stargazing from the lookout', pick(TH.stargaze), onLookout(pointAt(-1.2, 2), 50, 16, () => {
      addXp('writing', 4); remember('stargaze', tr('curious') ? 0.08 : 0.04); highlight('looked at the stars');
    }));
  },
  watch() {
    if (!works('lookout')) return null;
    return mk('watch', 'Watching the sea from the lookout', pick(TH.watch), onLookout(pointAt(-1.2 + rand(-0.6, 0.6), 2), 40, 12, () => {
      remember('watch', tr('curious') ? 0.06 : 0.03);
      const r = Math.random();
      if (r < 0.15) { say('A whale! Right there!'); log('She spotted a whale from the lookout.'); S.mood = Math.min(40, S.mood + 12); highlight('spotted a whale'); }
      else if (r < 0.2) { say('Was that… a sail? It’s gone.'); log('She thought she saw a sail on the horizon.'); highlight('thought she saw a sail'); }
    }));
  },

  /* ----- the animals ----- */
  herd() {
    const a = nextToHerd(S.pos);
    if (!a) return null;
    const chicken = a.kind === 'chicken', home = chicken ? COOP_P : SHEEP_PEN_P;
    const task = mk('herd', chicken ? 'Bringing a chicken home' : 'Leading a sheep home', pick(TH.herd), [
      go(standNear(a.home, 0.9)),
      act({ pose: chicken ? 'gather' : 'idle', face: a.home, min: 12 }), // coaxing it over
      go(standNear(home, 1.4), chicken), // a chicken gets carried; a sheep follows
      act({
        pose: 'gather', face: home, min: 3, done() {
          (chicken ? S.chickens : S.sheep)[a.i].penned = true;
          S.stats.herded++;
          addXp('survival', 4);
          remember('herd', 0.06);
          log(chicken ? 'She brought a chicken home to the coop.' : 'She led a sheep home inside the fence.');
          highlight(chicken ? 'brought a chicken home' : 'brought a sheep home');
        },
      }),
    ]);
    task.animal = { kind: a.kind, i: a.i };
    return task;
  },
  collect() {
    if (S.coopEggs < 2) return null;
    return mk('collect', 'Collecting eggs', pick(['Fresh eggs!', 'Thank you, ladies.', 'Still warm.']), [go(standNear(COOP_P, 1.1)), act({
      pose: 'gather', face: COOP_P, min: 5, done() {
        const n = Math.floor(S.coopEggs);
        S.coopEggs -= n;
        S.stock.eggs = Math.min(12, S.stock.eggs + n);
        S.stats.eggs += n;
      },
    })]);
  },
  shear() {
    const ready = sheepToShear();
    if (!ready) return null;
    return mk('shear', 'Shearing the sheep', pick(['Hold still, you fluffball.', 'So much wool!', 'Off with that winter coat.']), [go(standNear(SHEEP_PEN_P, 1.2)), act({
      pose: 'gather', face: SHEEP_PEN_P, min: 15 * ready, done() {
        for (const sh of S.sheep) if (sh.penned && sh.wool >= 1) { sh.wool = 0; S.stock.wool = Math.min(15, S.stock.wool + 2); }
        S.stats.shorn++;
        addXp('crafting', 4);
        log(`She sheared ${ready > 1 ? 'her sheep' : 'a sheep'}.`);
        highlight('sheared the sheep');
      },
    })]);
  },

  /* ----- clay from the pond's edge ----- */
  clay() {
    return mk('clay', 'Digging clay by the pond', pick(['Squelch. Good, sticky clay.', 'My hands will be orange for days.', 'Mud pies, but useful.']), [go(CLAY_STAND), act({
      pose: 'gather', face: CLAY_P, min: 35, done() { S.stock.clay = Math.min(20, S.stock.clay + 3); addXp('crafting', 2); },
    })]);
  },
  honey() {
    if (!works('beehive') || S.hive < 1) return null;
    return mk('honey', 'Collecting honey', pick(['Easy, bees. I just want a little.', 'Ow! Worth it.', 'Liquid gold.']), [go(SITE.beehive.stand), act({
      pose: 'gather', face: HIVE_P, min: 15, done() { const n = Math.floor(S.hive); S.hive -= n; S.stock.honey = Math.min(10, S.stock.honey + n); highlight('collected honey'); },
    })]);
  },
  bathe() {
    if (!works('bathhouse')) return null;
    return mk('bathe', 'Soaking in her bathhouse', pick(['Ahhh. This is the life.', 'Hot water. On a desert island.', 'I’m never getting out.']), sitAt(BATH_P, SP, 60, dm => {
      feed('fun', dm * 16 / 60); feed('energy', dm * 8 / 60);
    }, () => { remember('bathe', 0.08); highlight('had a hot bath'); }, 0.05)); // in the tub, up to her shoulders
  },

  /* ----- island events ----- */
  salvage() {
    if (S.wreck.state !== 'ashore') return null;
    const p = wreckPos();
    return mk('salvage', 'Searching the shipwreck', pick(['What have we got here…', 'Rope! And is that a lantern?', 'Somebody’s bad day is my lucky one.']), [go(standNear(p, 1.2)), act({
      pose: 'gather', face: p, min: 60, done() {
        S.wreck.state = 'salvaged';
        S.stock.wood = Math.min(20, S.stock.wood + 5);
        S.stock.fibre = Math.min(20, S.stock.fibre + 4); // rope
        S.stock.seeds += 4;
        S.stock.shells += 1;
        const extra = pick(['a lantern', 'a frying pan', 'a little tin of tea', 'an old compass']);
        log(`She salvaged planks, rope and seeds from the wreck, and ${extra}.`, 'big');
        say(`Look at all this! And ${extra}!`);
        highlight('salvaged the shipwreck');
        S.mood = Math.min(40, S.mood + 15);
        if (S.task) S.task.celebrate = true;
      },
    })]);
  },
  turtles() {
    if (S.turtle.state !== 'nest') return null;
    const p = nestPos();
    return mk('turtles', 'Guarding the turtle nest', pick(['Nobody’s digging these up on my watch.', 'Sleep tight, little ones.', 'I wonder how many are in there.']), sitAt(standNear(p, 1.3), p, 40, dm => { feed('company', dm * 10 / 60); feed('fun', dm * 6 / 60); }, () => {
      S.turtle.visits++;
      remember('turtles', 0.05);
      highlight('kept watch over the turtle nest');
    }));
  },
  tendgull() {
    if (S.gull.state !== 'hurt') return null;
    return mk('tendgull', 'Looking after the hurt seagull', pick(['There we go, a nice bit of fish.', 'Let me see that wing.', 'You’re getting stronger, aren’t you?']), [go(standNear(GULL_P, 0.8)), act({
      pose: 'gather', face: GULL_P, min: 20, tick: dm => feed('company', dm * 12 / 60), done() {
        if (S.stock.raw > 0) S.stock.raw--; // she shares a fish if she has one
        S.gull.care++;
        if (S.gull.care < 4) return;
        // healed: does it stay?
        const stays = Math.random() < 0.4 + 0.4 * S.taste.animals;
        S.gull.state = stays ? 'pet' : 'gone';
        log(stays ? 'The seagull’s wing has healed, but it decided to stay with her.' : 'The seagull’s wing has healed. It circled her once, and flew off over the sea.', 'big');
        say(stays ? 'You’re staying? Then you need a name… Captain.' : 'Goodbye! Fly safe!');
        highlight(stays ? 'gained a feathered friend' : 'set a healed seagull free');
        S.mood = Math.min(40, S.mood + 15);
      },
    })]);
  },
  dig() {
    const a = S.treasure.spots[S.treasure.found];
    if (a === undefined) return null;
    const p = digPos(a);
    return mk('dig', 'Digging for treasure', pick(['X marks the spot. I hope.', 'Dig, dig, dig…', 'If this is a joke, it’s a cruel one.']), [go(standNear(p, 0.7)), act({
      pose: 'chop', face: p, min: 45, done() {
        S.treasure.found++;
        if (S.treasure.found < S.treasure.spots.length) {
          say(pick(['Nothing but sand. On to the next cross.', 'An old bottle cap. The next one, then.']));
          log('She dug at one of the crosses on the map. Nothing yet.');
          return;
        }
        S.stock.shells += 6;
        S.mood = 40;
        say('A chest! Coins, beads, a ring… I’m rich! On an island. Ha!');
        log('At the last cross she dug up a little chest full of old coins and beads.', 'big');
        highlight('found buried treasure');
        if (S.task) S.task.celebrate = true;
      },
    })]);
  },

  /* ----- autumn: mushrooms under the forest trees ----- */
  mushrooms() {
    if (season() !== 'autumn' || S.mushrooms < 1) return null;
    // any tree in the forest: she wanders to a different one each time
    const standing = S.trees.flatMap((t, i) => t.state === 'tree' ? [i] : []);
    if (!standing.length) return null;
    const i = pick(standing);
    const t = FOREST[i];
    return mk('mushrooms', 'Picking mushrooms in the forest', pick(['Chanterelles! I think.', 'The forest smells of autumn.', 'Only the ones I know. Only the ones I know.']), [go(t.stand), act({
      pose: 'gather', face: t.pos, min: 30, done() {
        S.mushrooms = Math.max(0, S.mushrooms - 1);
        feed('food', 22 + S.skills.foraging.lvl); feed('fun', 5);
        addXp('foraging', 6);
        highlight('picked mushrooms');
        remember('mushrooms', 0.05);
      },
    })]);
  },

  /* ----- rabbits in the deep forest ----- */
  hunt() {
    if (!has('spear') || S.rabbits < 2) return null;
    const burrow = pick(BURROWS);
    return mk('hunt', 'Hunting rabbits in the deep forest', pick(['Quiet… quiet…', 'I can see one by the burrow.', 'Dinner’s around here somewhere.']), [
      go(WARREN_STAND),
      act({ pose: 'idle', face: WARREN_P, min: 35 }), // waiting, very still
      go(standNear(burrow, 0.9, WARREN_STAND), false, true), // a quick dash
      act({
        pose: 'chop', face: burrow, min: 4, done() {
          const ok = Math.random() < 0.3 + 0.04 * S.skills.survival.lvl + 0.02 * S.rabbits;
          addXp('survival', ok ? 8 : 4);
          if (!ok) { say('Too quick for me. Next time.'); remember('hunt', -0.05); return; }
          S.rabbits = Math.max(0, S.rabbits - 1);
          addMeat(1); S.stats.hunted++;
          say(pick(['Got one! Roast rabbit tonight.', 'Sorry, little one. Thank you.']));
          log('She caught a rabbit in the deep forest.');
          highlight('caught a rabbit');
          remember('hunt', 0.08);
          if (S.task) S.task.celebrate = true;
        },
      }),
    ]);
  },
  checksnares() {
    if (!has('snare') || S.snareCatch < 1) return null;
    return mk('checksnares', 'Checking her snares', pick(['Let’s see if the snares caught anything.', 'Fingers crossed.']), [go(WARREN_STAND), act({
      pose: 'gather', face: WARREN_P, min: 15, done() {
        const n = Math.floor(S.snareCatch);
        S.snareCatch -= n;
        // a soft-hearted castaway sometimes can't do it
        if (S.taste.animals > 0.6 && Math.random() < 0.5) {
          S.rabbits += n; S.stats.freed += n;
          say('Look at its little face… go on, off you go.');
          log('She found a rabbit in her snare, and let it go.');
          highlight('let a rabbit go');
          return;
        }
        addMeat(n); S.stats.hunted += n;
        say(n > 1 ? 'Two in the snares!' : 'One in the snares.');
        highlight('checked her snares');
      },
    })]);
  },

  /* ----- the dog ----- */
  befriend() {
    if (S.dog.state !== 'wild') return null;
    const home = S.dog.home;
    return mk('befriend', 'Making friends with the stray dog', pick(TH.befriend), [go(standNear(home, 1.3)), act({
      pose: 'idle', face: home, min: 25, tick: dm => feed('company', dm * 15 / 60),
      done() {
        // sharing food wins its trust fastest
        let t = 0.2;
        if (S.stock.raw > 0) { S.stock.raw--; t = 0.45; }
        else if (S.stock.fish > 0) { S.stock.fish--; t = 0.4; }
        else if (S.needs.food > 30) { feed('food', -6); t = 0.3; }
        gainTrust(t + (tr('social') ? 0.1 : 0));
      },
    })]);
  },
  play() {
    if (S.dog.state !== 'friend') return null;
    const p = ground(pointAt(rand(0, 6.3), 0.8));
    return mk('play', `Playing fetch with ${S.dog.name}`, pick([`Go get it, ${S.dog.name}!`, 'Good dog! Again?', `${S.dog.name}, you’re the best.`]), [go(p), act({
      pose: 'idle', face: pointAt(Math.atan2(p.z, p.x), 1.4), min: 30, tick: dm => { feed('fun', dm * 20 / 60); feed('company', dm * 30 / 60); },
      done() { remember('play', 0.08); highlight(`played fetch with ${S.dog.name}`); },
    })]);
  },

  /* ----- fixing what the storm broke ----- */
  repair() {
    const k = damaged().find(d => Object.entries(REPAIRABLE[d] ?? {}).every(([r, n]) => S.stock[r as Resource] >= n!));
    if (!k) return null;
    const site = SITE[k];
    return mk('repair', `Repairing the ${PLANS[k].name}`, pick(TH.repair), [go(site.stand), act({
      pose: 'hammer', face: site.face, min: 40,
      begin() { for (const [r, n] of Object.entries(REPAIRABLE[k] ?? {})) S.stock[r as Resource] -= n!; },
      done() {
        S.projects[k].damaged = false;
        S.projects[k].builtAt = Math.max(S.projects[k].builtAt ?? 0, S.min - 8 * 1440); // patched up: looks a lot fresher
        S.stats.repairs++;
        addXp('building', 6);
        log(`She repaired the ${PLANS[k].name}.`);
        highlight(`repaired the ${PLANS[k].name}`);
      },
    })]);
  },

  /* ----- hot days ----- */
  swim() {
    const a = rand(0, 6.3), beach = ground(pointAt(a, 0.86)), wade = ground(pointAt(a, 1.07));
    return mk('swim', 'Cooling off in the sea', pick(TH.swim), [go(beach), go(wade), act({
      pose: 'idle', face: pointAt(a, 2), min: 30, tick: dm => { feed('fun', dm * 18 / 60); feed('energy', -dm * 3 / 60); },
      done() { remember('swim', 0.06); highlight('cooled off in the sea'); },
    }), go(beach)]);
  },
};

// Tasks that urgent needs (or something new to try) are allowed to cut short.
export const INTERRUPTIBLE = new Set<TaskId>(['clay', 'honey', 'bathe', 'salvage', 'turtles', 'tendgull', 'dig', 'mushrooms', 'hunt', 'checksnares', 'checktrap', 'relax', 'explore', 'talk', 'drum', 'write', 'sleep', 'sticks', 'chop', 'fibre', 'stones', 'mine', 'replant', 'craft', 'build', 'plant', 'stargaze', 'watch', 'shelter', 'befriend', 'play', 'repair', 'swim', 'herd', 'shear', 'collect']);
// Outdoor tasks a sudden shower sends her away from.
export const RAIN_STOPS = new Set<TaskId>(['clay', 'salvage', 'turtles', 'dig', 'mushrooms', 'hunt', 'checksnares', 'checktrap', 'relax', 'explore', 'talk', 'drum', 'write', 'sticks', 'chop', 'fibre', 'stones', 'mine', 'replant', 'craft', 'build', 'plant', 'stargaze', 'watch', 'befriend', 'play', 'repair', 'swim', 'herd', 'shear']);
// Which task "tries out" each newly made thing.
export const CURIOUS_TASK: Partial<Record<CraftKey, TaskId>> = { rod: 'fish', spear: 'fish', drum: 'drum', journal: 'write', axe: 'chop', pick: 'mine', chair: 'relax', rocker: 'watch' };

/* ---------- task lifecycle ---------- */
export function startTask(t: Task) {
  S.task = Object.assign(t, { i: 0, started: false, el: 0 });
  S.activity = t.label;
  const feeling = feelingAbout(t.id);
  if (feeling) t.thought = feeling;
  if (t.thought) say(t.thought);
}

/** If a task ended while she was still on a boat, put her back on the dock. */
function leaveBoat() {
  if (!S.sailing) return;
  S.sailing = false;
  S.pos = copy(DOCK_END);
}

export function endTask() {
  const task = S.task;
  if (!task) return;
  leaveBoat();
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
  leaveBoat();
  if (S.sitting) S.task = { id: 'stand', label: S.activity, steps: [standUp()], i: 0, started: false, el: 0 };
  else S.task = null;
}
