// Utility AI: score every possible task from her needs, traits, memories,
// goals, resources, weather and the time of day, then start the best one
// that's actually possible right now.
import { driest, freePlots, growingPlots, ripePlots } from './garden';
import { liking } from './memory';
import { wouldBeCutShort } from './needs';
import { nextToHerd, sheepToShear } from './animals';
import { canWork, damaged, FIREWOOD_RESERVE, missing, PLANS, REPAIRABLE, works } from './plans';
import { standingTrees } from './resources';
import { hour, isNight, S, tr, type TaskId } from './state';
import { activityBias } from './taste';
import { fx, season } from './seasons';
import { catchChance as gearCatch, CURIOUS_TASK, sleepShift, startTask, T } from './tasks';

// Hobbies her memories can make more (or less) appealing.
const HOBBIES = new Set<TaskId>(['mushrooms', 'hunt', 'checktrap', 'fish', 'explore', 'talk', 'relax', 'drum', 'write', 'chop', 'mine', 'build', 'craft', 'cook', 'sail', 'stargaze', 'watch', 'plant', 'harvest', 'play', 'swim']);
// Chores she doesn't mind doing twice in a row.
const REPEATABLE = new Set<TaskId>(['drink', 'forage', 'sleep', 'fish', 'build', 'craft', 'chop', 'sticks', 'fibre', 'stones', 'mine', 'eat', 'cook', 'wood', 'repair', 'befriend']);

const dark0 = (night: boolean) => night ? 0.6 : 0;

export function decide() {
  const n = S.needs, night = isNight(), h = hour();
  // her body clock: an early riser gets sleepy earlier, a night owl later
  const hb = (h - sleepShift() + 24) % 24, sleepy = hb >= 21 || hb < 6, late = hb >= 22 || hb < 5;
  const rain = S.weather.raining, wet = rain ? 0.35 : 0; // outdoor activities lose appeal in the rain
  const u = (v: number) => Math.pow((100 - v) / 100, 2); // urgency: grows fast as a need empties
  const c: { id: TaskId; score: number }[] = [];
  const add = (id: TaskId, score: number) => c.push({
    id,
    score: score + Math.random() * 0.08
      - (S.lastAction === id && !REPEATABLE.has(id) ? 0.15 : 0) // avoid repeating hobbies
      + (S.curious.some(k => CURIOUS_TASK[k] === id) ? 0.8 : 0) // new things get tried first
      + (HOBBIES.has(id) ? 0.12 * liking(id) : 0) // things she's come to love (or dread)
      + activityBias(id) // what kind of life she leans towards (taste.ts)
      // Never start something a critical need would cancel at once. (Before this,
      // a starving castaway at night could loop: pick a hobby → interrupted → pick it again…)
      - (wouldBeCutShort(id) ? 5 : 0),
  });
  const fireLit = S.fire > 0, fishUseful = fireLit || S.stock.wood > 0 || works('rack');
  // Berries keep her alive, but when she isn't starving she craves a hot meal
  // more the longer it's been (up to +0.6 after a day).
  const craving = fishUseful && n.food > 25 ? Math.min(0.6, (S.min - S.lastMeal) / 1440 * 0.6) : 0;
  // When hungry, fishing only appeals as much as she's likely to catch something
  // (and a catch still needs cooking), so reliable berries win when it's urgent.
  const catchChance = gearCatch();

  /* survival: food, water, fire, sleep */
  // when she's starving, the dark doesn't stop her looking for berries
  add('forage', 1.6 * u(n.food) + (tr('hardworking') ? 0.05 : 0) - (night && n.food >= 20 ? 0.4 : 0) - wet * 0.3);
  // a catch is only worth much if she can cook it (or dry it)
  // with fish already waiting to be cooked, another catch doesn't help: light the fire instead
  const uncooked = S.stock.raw + S.stock.meat; // fish or rabbit waiting to be cooked
  const haveCatch = uncooked >= 2 ? 0.2 : 1;
  add('fish', 1.4 * u(n.food) * catchChance * (fishUseful ? 1 : 0.3) * haveCatch + (S.items.rod || S.items.spear ? 0.05 : 0) + 0.2 * u(n.fun)
    + craving * haveCatch + (S.projects.dock.done ? 0.1 : 0) - (night ? 0.6 : 0) + (tr('hardworking') ? 0.05 : 0) - wet * 0.7);
  const canCook = fireLit || (S.items.kitchen && S.projects.lodge.done && S.stock.wood > 0);
  const hasMeal = uncooked > 0 || S.stock.veg >= 2 || S.stock.eggs >= 2;
  if (hasMeal && canCook) add('cook', 1.8 * u(n.food) + (uncooked > 0 ? 0.45 : 0.25));
  // autumn: mushrooms under the forest trees
  if (season() === 'autumn' && S.mushrooms >= 1 && !night) add('mushrooms', 1.2 * u(n.food) + 0.25 - wet);
  // rabbits: a long walk into the deep forest with her spear, or snares she checks now and then
  if (S.items.spear && S.rabbits >= 2 && !night) add('hunt', (0.7 * u(n.food) + craving * 0.9) * haveCatch + 0.2 - wet);
  if (S.items.snare && S.snareCatch >= 1) add('checksnares', 0.8 + 0.6 * u(n.food) + craving * 0.5 - dark0(night) - wet); // a routine round, like collecting eggs
  // a full trap: fish she doesn't have to wait for
  if (S.trapFish >= 1 && works('trap')) add('checktrap', 0.45 + 0.12 * S.trapFish + 0.8 * u(n.food) + craving * 0.5 - dark0(night) - wet);
  if (S.stock.fish > 0 || S.stock.veg > 0) add('eat', 1.9 * u(n.food) * (S.stock.fish > 0 ? 1 : 0.8) + 0.05);
  else if (S.stock.raw > 0 && n.food < 15 && !canCook) add('eat', 1.5 * u(n.food));
  add('drink', 2.2 * u(n.water));
  // keeping the fire alive is a priority: it's how she cooks, and it's home
  if (S.stock.wood > 0) add('wood', (S.fire < 40 ? 0.8 * (1 - S.fire / 40) : 0.02) + (fireLit ? 0 : 0.3) + (h >= 15 && h < 20 ? 0.12 : 0) + (!fireLit && uncooked > 0 ? 0.6 + craving + 0.8 * u(n.food) : 0));
  add('sleep', sleepy ? 0.6 + 1.5 * u(n.energy) + (late ? 0.6 : 0) : (n.energy < 30 ? 1.6 * u(n.energy) : -1));
  if (rain) add('shelter', 0.5 + (works('hut') ? 0.15 : 0) + (S.weather.storm ? 0.4 : 0));

  /* gathering: for her goal, and enough firewood to keep the fire alive */
  // Drive to work on her goal: stronger for hard workers, and it grows the
  // longer the goal sits unfinished (up to +0.4 after two days).
  const busy = (tr('hardworking') ? 0.12 : 0) - (tr('lazy') ? 0.08 : 0) + (S.goal ? 0.05 + Math.min(0.4, (S.min - S.goalSince) / 2880 * 0.4) : 0);
  const need = missing(), dark = night ? 0.6 : 0;
  // storm damage to fix: gather what the repairs need too
  const broken = damaged();
  const repairWood = broken.reduce((s, k) => s + (REPAIRABLE[k]?.wood ?? 0), 0), repairStone = broken.reduce((s, k) => s + (REPAIRABLE[k]?.stone ?? 0), 0);
  if (repairWood && S.stock.wood < repairWood + FIREWOOD_RESERVE) need.wood = Math.max(need.wood, 1);
  if (repairStone && S.stock.stone < repairStone) need.stone = Math.max(need.stone, 1);
  if (broken.length) add('repair', 0.7 + busy - dark - wet);

  /* animals: bring them home, collect eggs, shear the sheep (wool is often what her goal is waiting on) */
  // once the fence (or coop) is up, bringing the animals home is the obvious next step
  // (it carries the same drive as her current goal, so a new project doesn't leave the animals out)
  if (nextToHerd(S.pos)) add('herd', 0.85 + Math.max(0, busy) - dark - wet);
  if (S.coopEggs >= 2) add('collect', 0.62 + S.coopEggs * 0.04 - dark);
  if (sheepToShear()) add('shear', 0.88 + 0.05 * sheepToShear() + (need.wool > 0 ? 0.3 : 0) - dark - wet); // heavy fleeces need taking off
  // in autumn and winter she keeps a bigger woodpile: the fire burns faster and the nights are cold
  const woodLow = S.stock.wood < (fx().cold > 0 ? 6 : 3), desperate = !fireLit && S.stock.wood === 0 ? 0.4 : 0; // no fire, no cooking
  const canChop = !!S.items.axe && standingTrees() > 0;
  if (need.wood > 0 || woodLow) {
    const base = (need.wood > 0 ? 0.6 : 0.36) + busy + desperate - dark - wet;
    if (canChop) add('chop', base);
    if (S.deadwood >= 1) add('sticks', base - 0.06 - (canChop ? 0.15 : 0));
  }
  if (need.fibre > 0) add('fibre', 0.6 + busy - dark - wet);
  if (need.stone > 0) {
    if (S.items.pick && S.boulders.some(b => b > 0)) add('mine', 0.6 + busy - dark - wet);
    if (S.loose >= 1) add('stones', 0.56 + busy - (S.items.pick ? 0.15 : 0) - dark - wet);
  }
  const stumps = S.trees.filter(t => t.state === 'stump').length;
  // the more stumps she sees, the more she wants to replant
  if (S.stock.saplings > 0 && stumps > 0) add('replant', 0.45 + 1.0 * stumps / S.trees.length + (standingTrees() < 12 ? 0.25 : 0) + (tr('hardworking') ? 0.1 : 0) - dark - wet);

  /* making things: crafts happen by the fire (fine after dark if it's lit), building needs daylight */
  if (canWork() && S.goal) {
    if (PLANS[S.goal].kind === 'craft') add('craft', 0.7 + busy - (night && !fireLit ? 0.6 : 0) - wet);
    else add('build', 0.68 + busy - (night ? 0.7 : 0) - wet);
  }

  /* garden */
  if (S.projects.garden.done) {
    if (freePlots().length && S.stock.seeds > 0) add('plant', 0.62 + (tr('hardworking') ? 0.1 : 0) - (tr('lazy') ? 0.05 : 0) - dark - wet); // a routine chore, not a whim
    if (growingPlots().length && !rain && driest() < 35) add('water', 0.55 + 0.6 * (1 - driest() / 35) - (night ? 0.5 : 0));
    if (ripePlots().length) add('harvest', 0.6 + 0.9 * u(n.food) - (night ? 0.5 : 0));
  }

  /* hobbies */
  if (fireLit) add('relax', 0.9 * u(n.fun) + 0.2 * u(n.energy) + (h >= 18 ? 0.15 : 0) + (tr('lazy') ? 0.15 : 0) + 0.2 * fx().cold - wet); // the fire is extra cosy when it's cold
  if (!night) add('explore', 0.8 * u(n.fun) + (tr('curious') ? 0.2 : 0) + 0.05 - wet);
  add('talk', 1.1 * u(n.company) + (tr('social') ? 0.1 : 0) - (night ? 0.3 : 0) - wet * 0.5);
  if (S.items.drum) add('drum', 1.3 * u(n.fun) + 0.2 * u(n.company) + 0.25 + (tr('musical') ? 0.3 : 0) - wet);
  if (S.items.journal) add('write', 1.1 * u(n.fun) + 0.15 + (tr('curious') ? 0.25 : 0) - wet * 0.6);
  if (S.projects.canoe.done && works('dock') && !night && !rain && S.quirk !== 'seasick') add('sail', 0.9 * u(n.fun) + 0.2 + (tr('curious') ? 0.15 : 0));
  if (!night && !rain && season() !== 'winter') add('swim', S.weather.hot ? 0.55 + 0.7 * u(n.fun) : 0.5 * u(n.fun) - 0.1 - fx().cold * 0.3);
  /* the dog: win its trust, then play */
  if (S.dog.state === 'wild') add('befriend', 0.45 + 0.7 * u(n.company) + (tr('social') ? 0.2 : 0) - dark - wet);
  if (S.dog.state === 'friend') add('play', 0.9 * u(n.fun) + 0.6 * u(n.company) + 0.2 - dark - wet);
  if (works('lookout') && !rain) {
    if (h >= 21 || h < 1.5) add('stargaze', 0.8 * u(n.fun) + 0.3 + (tr('curious') ? 0.2 : 0));
    if (!night) add('watch', 0.8 * u(n.fun) + 0.15 + (tr('curious') ? 0.2 : 0));
  }

  c.sort((a, b) => b.score - a.score);
  for (const o of c) {
    const t = T[o.id]();
    if (t) {
      S.curious = S.curious.filter(k => CURIOUS_TASK[k] !== o.id);
      startTask(t);
      return;
    }
  }
}
