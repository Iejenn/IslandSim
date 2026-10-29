// Utility AI: score every possible task from her needs, traits, memories,
// goals, weather and the time of day, then start the best one that's
// actually possible right now.
import { driest, freePlots, growingPlots, ripePlots } from './garden';
import { liking } from './memory';
import { wouldBeCutShort } from './needs';
import { canBuild, woodNeeded } from './projects';
import { hour, isNight, S, tr, type TaskId } from './state';
import { CURIOUS_TASK, startTask, T } from './tasks';

// Hobbies her memories can make more (or less) appealing.
const HOBBIES = new Set<TaskId>(['fish', 'explore', 'talk', 'relax', 'piano', 'read', 'chop', 'build', 'sail', 'stargaze', 'plant', 'harvest']);

export function decide() {
  const n = S.needs, night = isNight(), h = hour(), late = h >= 22 || h < 5;
  const rain = S.weather.raining, wet = rain ? 0.35 : 0; // outdoor activities lose appeal in the rain
  const u = (v: number) => Math.pow((100 - v) / 100, 2); // urgency: grows fast as a need empties
  const c: { id: TaskId; score: number }[] = [];
  const add = (id: TaskId, score: number) => c.push({
    id,
    score: score + Math.random() * 0.08
      - (S.lastAction === id && !['drink', 'forage', 'sleep', 'fish', 'build', 'chop', 'eat'].includes(id) ? 0.15 : 0) // avoid repeating hobbies
      + (S.curious.some(k => CURIOUS_TASK[k] === id) ? 0.8 : 0) // new gifts get tried first
      + (HOBBIES.has(id) ? 0.12 * liking(id) : 0) // things she's come to love (or dread)
      // Never start something a critical need would cancel at once. (Before this,
      // a starving castaway at night could loop: pick piano → interrupted → pick piano…)
      - (wouldBeCutShort(id) ? 5 : 0),
  });

  /* survival */
  // when she's starving, the dark doesn't stop her looking for berries
  add('forage', 1.6 * u(n.food) + (tr('hardworking') ? 0.05 : 0) - (night && n.food >= 20 ? 0.4 : 0) - wet * 0.3);
  add('fish', 1.3 * u(n.food) + 0.2 * u(n.fun) + (S.items.rod ? 0.25 * u(n.food) + 0.05 : 0) + (S.projects.dock.done ? 0.1 : 0) - (night ? 0.6 : 0) + (tr('hardworking') ? 0.05 : 0) - wet * 0.7);
  if (S.stock.fish > 0) add('eat', 1.9 * u(n.food) + 0.05);
  add('drink', 2.2 * u(n.water));
  add('wood', (S.fire < 40 ? 0.45 * (1 - S.fire / 40) : 0.02) + (h >= 15 && h < 20 ? 0.12 : 0) + (tr('hardworking') ? 0.1 : 0) - (night && !S.stock.wood ? 0.4 : 0));
  add('sleep', night ? 0.6 + 1.5 * u(n.energy) + (late ? 0.6 : 0) : (n.energy < 30 ? 1.6 * u(n.energy) : -1));
  if (rain) add('shelter', 0.5 + (S.projects.hut.done ? 0.15 : 0));

  /* hobbies */
  if (S.fire > 0) add('relax', 0.9 * u(n.fun) + 0.2 * u(n.energy) + (h >= 18 ? 0.15 : 0) + (tr('lazy') ? 0.15 : 0) - wet);
  if (!night) add('explore', 0.8 * u(n.fun) + (tr('curious') ? 0.2 : 0) + 0.05 - wet);
  add('talk', 1.1 * u(n.company) + (tr('social') ? 0.1 : 0) - (night ? 0.3 : 0) - wet * 0.5);
  if (S.items.piano) add('piano', 1.3 * u(n.fun) + 0.25 + (tr('musical') ? 0.3 : 0) - wet);
  if (S.items.books) add('read', 1.1 * u(n.fun) + 0.15 + (tr('curious') ? 0.25 : 0) - wet * 0.6);
  if (S.items.boat && S.projects.dock.done && !night && !rain) add('sail', 0.9 * u(n.fun) + 0.2 + (tr('curious') ? 0.15 : 0));
  if (S.items.telescope && (h >= 21 || h < 1.5) && !rain) add('stargaze', 0.8 * u(n.fun) + 0.3 + (tr('curious') ? 0.2 : 0));

  /* goals: gather wood for, then build, whatever she's set her mind on */
  // Drive to work on her goal: stronger for hard workers, and it grows the
  // longer the goal sits unfinished (up to +0.3 after two days).
  const busy = (tr('hardworking') ? 0.12 : 0) - (tr('lazy') ? 0.08 : 0) + (S.goal ? Math.min(0.3, (S.min - S.goalSince) / 2880 * 0.3) : 0);
  const needWood = woodNeeded();
  if (needWood > 0) add('chop', 0.5 + busy - (night ? 0.6 : 0) - wet);
  else if (S.stock.wood < 2 && !S.goal) add('chop', 0.06 + busy - (night ? 0.6 : 0) - wet); // a little spare firewood
  if (canBuild()) add('build', 0.58 + busy - (night ? 0.7 : 0) - wet);

  /* garden */
  if (S.projects.garden.done) {
    if (freePlots().length && S.stock.seeds + S.stock.fine > 0) add('plant', 0.62 + (tr('hardworking') ? 0.1 : 0) - (tr('lazy') ? 0.05 : 0) - (night ? 0.6 : 0) - wet); // a routine chore, not a whim
    if (growingPlots().length && !rain && driest() < 35) add('water', 0.55 + 0.6 * (1 - driest() / 35) - (night ? 0.5 : 0));
    if (ripePlots().length) add('harvest', 0.6 + 0.9 * u(n.food) - (night ? 0.5 : 0));
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
