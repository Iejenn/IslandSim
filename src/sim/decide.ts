// Utility AI: score every possible task from her needs, traits and the time
// of day, then start the best one that's actually possible.
import { hour, isNight, S, tr, type TaskId } from './state';
import { CURIOUS_TASK, startTask, T } from './tasks';

export function decide() {
  const n = S.needs, night = isNight(), h = hour(), late = h >= 22 || h < 5;
  const u = (v: number) => Math.pow((100 - v) / 100, 2); // urgency: grows fast as a need empties
  const c: { id: TaskId; score: number }[] = [];
  const add = (id: TaskId, score: number) => c.push({
    id,
    score: score + Math.random() * 0.08
      - (S.lastAction === id && !['drink', 'forage', 'sleep', 'fish'].includes(id) ? 0.15 : 0) // avoid repeating hobbies
      + (S.curious.some(k => CURIOUS_TASK[k] === id) ? 0.8 : 0), // new gifts get tried first
  });
  add('forage', 1.6 * u(n.food) + (tr('hardworking') ? 0.05 : 0) - (night ? 0.4 : 0));
  add('fish', 1.3 * u(n.food) + 0.2 * u(n.fun) + (S.items.rod ? 0.25 * u(n.food) + 0.05 : 0) - (night ? 0.6 : 0) + (tr('hardworking') ? 0.05 : 0));
  add('drink', 2.2 * u(n.water));
  add('wood', (S.fire < 40 ? 0.45 * (1 - S.fire / 40) : 0.02) + (h >= 15 && h < 20 ? 0.12 : 0) + (tr('hardworking') ? 0.1 : 0) - (night ? 0.4 : 0));
  add('sleep', night ? 0.6 + 1.5 * u(n.energy) + (late ? 0.6 : 0) : (n.energy < 30 ? 1.6 * u(n.energy) : -1));
  if (S.fire > 0) add('relax', 0.9 * u(n.fun) + 0.2 * u(n.energy) + (h >= 18 ? 0.15 : 0) + (tr('lazy') ? 0.15 : 0));
  if (!night) add('explore', 0.8 * u(n.fun) + (tr('curious') ? 0.2 : 0) + 0.05);
  add('talk', 1.1 * u(n.company) + (tr('social') ? 0.1 : 0) - (night ? 0.3 : 0));
  if (S.items.piano) add('piano', 1.3 * u(n.fun) + 0.25 + (tr('musical') ? 0.3 : 0));
  if (S.items.books) add('read', 1.1 * u(n.fun) + 0.15 + (tr('curious') ? 0.25 : 0));
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
