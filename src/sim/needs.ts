// Needs decay over game time, health follows from them, plus the slower
// rhythms: weather, the garden, new goals and the daily recap.
import { updateAnimals } from './animals';
import { maybeDogArrives } from './companion';
import { updateGarden } from './garden';
import { endOfDay } from './memory';
import { chooseGoal, comfort } from './plans';
import { updateResources } from './resources';
import { dreamLine, noteTaste } from './taste';
import { dayNum, hooks, hour, log, S, say, tr, type TaskId } from './state';
import { interrupt, INTERRUPTIBLE } from './tasks';
import { clamp } from './util';
import { maybeHotDay, updateWeather } from './weather';

/** @param dm game minutes elapsed */
export function updateNeeds(dm: number) {
  const n = S.needs, asleep = S.task && S.task.id === 'sleep' && S.sitting;
  const indoors = S.task && (S.task.id === 'sleep' || S.task.id === 'shelter') && S.sitting;
  const dog = S.dog.state === 'friend';
  n.food -= dm * ((asleep ? 2 : 4) + (dog ? 0.4 : 0)) / 60; // she shares scraps with her dog
  n.water -= dm * (asleep ? 3 : S.weather.hot ? 9 : 6) / 60; // hot days make her thirsty
  n.fun -= dm * (asleep ? 0 : 4) / 60;
  n.company -= dm * (tr('social') ? 3 : 2) * (dog ? 0.5 : 1) / 60; // a dog is good company
  if (!asleep) n.energy -= dm * 4 / 60;
  if (S.weather.raining && !indoors) n.fun -= dm * (S.weather.storm ? 4 : 2) * (S.items.sweater ? 0.5 : 1) / 60; // being soaked isn't fun (less so in a sweater)
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
  updateAnimals(dm);

  // a new day starts at 07:00: recap yesterday, bushes regrow, she may wish for something
  const di = Math.floor((S.min - 420) / 1440);
  if (di > S.dayIdx) {
    endOfDay(dayNum() - 1, happiness());
    S.dayIdx = di;
    S.berries = S.berries.map(b => clamp(b + 3, 0, 6));
    log(`Day ${dayNum()} begins.`);
    maybeHotDay();
    maybeDogArrives();
    noteComfort();
    // every few days she's reminded of her dream, until it comes true
    if (dayNum() % 4 === 0 && dreamLine() && S.feelingsNoted.includes('dream')) say(dreamLine());
  }
  noteTaste(dayNum());
  // when she's comfortable during the day, she sometimes sets herself something to make (~every 3 game hours)
  const h = hour();
  if (!S.goal && h >= 8 && h < 18 && n.food > 35 && n.water > 35 && Math.random() < dm / 180) chooseGoal();
  if (S.health <= 0) die();
}

/** True if this task would be interrupted right away because a need is critical. */
export function wouldBeCutShort(id: TaskId) {
  const n = S.needs;
  // with the fire out, fetching wood IS getting food (no fire, no cooking her catch)
  const feedsHer = id === 'forage' || id === 'fish' || id === 'eat' || id === 'cook' || id === 'harvest' || id === 'checktrap' || id === 'hunt' || id === 'checksnares'
    || (S.fire <= 0 && (id === 'sticks' || id === 'chop' || id === 'wood'));
  const crit = (n.water < 12 && id !== 'drink') || (n.food < 12 && !feedsHer) || (n.energy < 6 && id !== 'sleep');
  return crit && INTERRUPTIBLE.has(id);
}

export function happiness() {
  const n = S.needs;
  const home = Math.min(10, comfort() * 1.2); // a camp that feels like home makes everything a bit better
  return clamp(0.22 * n.fun + 0.18 * n.company + 0.15 * n.food + 0.15 * n.water + 0.1 * n.energy + 0.2 * S.health + S.mood + home - 8, 0, 100);
}

/** Diary notes the first time the camp starts to feel like home. */
function noteComfort() {
  const c = comfort();
  const note = (key: string, text: string) => { if (!S.feelingsNoted.includes(key)) { S.feelingsNoted.push(key); log(text); } };
  if (c >= 3) note('home:1', 'The camp is starting to feel like a real home.');
  if (c >= 7) note('home:2', 'She can’t imagine living anywhere else now.');
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
