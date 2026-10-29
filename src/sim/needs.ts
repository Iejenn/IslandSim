// Needs decay over game time, health follows from them, plus the slower
// rhythms: weather, the garden, new goals and the daily recap.
import { updateGarden } from './garden';
import { endOfDay } from './memory';
import { chooseGoal } from './plans';
import { updateResources } from './resources';
import { dayNum, hooks, hour, log, S, say, tr, type TaskId } from './state';
import { interrupt, INTERRUPTIBLE } from './tasks';
import { clamp } from './util';
import { updateWeather } from './weather';

/** @param dm game minutes elapsed */
export function updateNeeds(dm: number) {
  const n = S.needs, asleep = S.task && S.task.id === 'sleep' && S.sitting;
  const indoors = S.task && (S.task.id === 'sleep' || S.task.id === 'shelter') && S.sitting;
  n.food -= dm * (asleep ? 2 : 4) / 60;
  n.water -= dm * (asleep ? 3 : 6) / 60;
  n.fun -= dm * (asleep ? 0 : 4) / 60;
  n.company -= dm * (tr('social') ? 3 : 2) / 60;
  if (!asleep) n.energy -= dm * 4 / 60;
  if (S.weather.raining && !indoors) n.fun -= dm * 2 / 60; // being soaked isn't fun
  for (const k in n) n[k as keyof typeof n] = clamp(n[k as keyof typeof n], 0, 100);

  if (n.food < 8) S.health -= dm * 6 / 60;
  if (n.water < 8) S.health -= dm * 6 / 60;
  if (n.energy < 5) S.health -= dm * 2 / 60;
  if (n.food > 35 && n.water > 35 && n.energy > 15) S.health += dm * 3 / 60;
  S.health = clamp(S.health, 0, 100);
  S.mood = Math.max(0, S.mood - dm * 6 / 60);
  const wasLit = S.fire > 0;
  S.fire = Math.max(0, S.fire - dm * (S.projects.hearth.done ? 1.8 : 3) / 60); // a stone hearth burns wood slower
  if (wasLit && S.fire <= 0) log('The campfire went out.');

  if (S.health < 50 && S.warned < 1) { S.warned = 1; log('She’s getting weak.'); say('I don’t feel well…'); }
  if (S.health < 20 && S.warned < 2) { S.warned = 2; log('She’s in serious danger.'); }
  if (S.health > 60) S.warned = 0;

  // drop a hobby if she's about to starve, dehydrate or collapse
  const id = S.task && S.task.id;
  if (id && wouldBeCutShort(id)) interrupt();

  updateWeather(dm);
  updateGarden(dm);
  updateResources(dm);

  // a new day starts at 07:00: recap yesterday, bushes regrow, she may wish for something
  const di = Math.floor((S.min - 420) / 1440);
  if (di > S.dayIdx) {
    endOfDay(dayNum() - 1, happiness());
    S.dayIdx = di;
    S.berries = S.berries.map(b => clamp(b + 3, 0, 6));
    log(`Day ${dayNum()} begins.`);
  }
  // when she's comfortable during the day, she sometimes sets herself something to make (~every 3 game hours)
  const h = hour();
  if (!S.goal && h >= 8 && h < 18 && n.food > 35 && n.water > 35 && Math.random() < dm / 180) chooseGoal();
  if (S.health <= 0) die();
}

/** True if this task would be interrupted right away because a need is critical. */
export function wouldBeCutShort(id: TaskId) {
  const n = S.needs;
  const crit = (n.water < 12 && id !== 'drink') || (n.food < 12 && id !== 'forage' && id !== 'fish' && id !== 'eat' && id !== 'cook' && id !== 'harvest') || (n.energy < 6 && id !== 'sleep');
  return crit && INTERRUPTIBLE.has(id);
}

export function happiness() {
  const n = S.needs;
  return clamp(0.22 * n.fun + 0.18 * n.company + 0.15 * n.food + 0.15 * n.water + 0.1 * n.energy + 0.2 * S.health + S.mood - 8, 0, 100);
}

function die() {
  if (S.dead) return;
  S.dead = true;
  S.task = null;
  S.activity = 'Gone';
  S.lift = 0;
  hooks.play('death', true);
  say('…');
  log(`${S.name} died.`);
  hooks.onDeath();
}
