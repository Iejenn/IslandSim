// Things that happen to an island: each island rolls a handful of events from
// the pool below, on random days, so no two islands share the same story. Most
// leave something behind for her to do (salvage a wreck, guard a turtle nest,
// nurse a gull, dig for treasure); see the matching tasks in tasks.ts.
import { dayNum, highlight, log, S, say } from './state';
import { pick, rand } from './util';

export const EVENTS = ['shipwreck', 'turtle', 'gull', 'drought', 'landslide', 'treasure', 'sprain'] as const;
export type EventKey = typeof EVENTS[number];

/** 4–5 events on random days between day 5 and 50, at least three days apart. */
export function rollEvents() {
  const keys = [...EVENTS].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 4 : 5);
  const days: number[] = [];
  return keys.map(key => {
    let d = 5;
    for (let i = 0; i < 30; i++) { d = Math.round(rand(5, 50)); if (days.every(o => Math.abs(o - d) >= 3)) break; }
    days.push(d);
    return { key, day: d, done: false };
  });
}

// beach angles away from the dock, rocks and forest headland
const beachAngle = () => pick([0.2, 0.55, -0.2, -1.6, -2.9, 3.2, 1.0]) + rand(-0.1, 0.1);

/** At dawn: start any event due today. */
export function startEvents() {
  for (const e of S.events) {
    if (e.done || e.day > dayNum()) continue;
    e.done = true;
    START[e.key as EventKey]?.();
  }
  // a nest hatches about ten days after it's laid
  if (S.turtle.state === 'nest' && S.min >= S.turtle.hatchAt) {
    S.turtle.state = 'hatched';
    log(S.turtle.visits >= 2 ? 'The turtle eggs hatched! She watched dozens of tiny turtles scramble to the sea.' : 'The turtle eggs hatched while she wasn’t looking. Tiny tracks lead to the sea.');
    if (S.turtle.visits >= 2) { S.mood = 40; say('Go, little ones! Go!'); highlight('watched baby turtles hatch'); }
  }
  if (S.droughtUntil && S.min >= S.droughtUntil) { S.droughtUntil = 0; log('The drought is over. The pond is filling up again.'); }
}

const START: Record<EventKey, () => void> = {
  shipwreck() {
    S.wreck = { state: 'ashore', a: beachAngle() };
    log('Overnight, the wreck of a small boat washed up on the beach, crates and all.');
    say('A shipwreck! There might be something useful in those crates.');
    highlight('found a shipwreck');
  },
  turtle() {
    S.turtle = { state: 'nest', a: beachAngle(), hatchAt: S.min + 10 * 1440, visits: 0 };
    log('A sea turtle crawled up the beach in the night and buried her eggs in the sand.');
    say('A turtle nest! I’ll keep an eye on it.');
    highlight('found a turtle nest');
  },
  gull() {
    S.gull = { state: 'hurt', care: 0 };
    log('A seagull with a hurt wing is hopping around the camp.');
    say('Oh, you poor thing. Let me help.');
  },
  drought() {
    if (S.weather.raining) S.weather.until = S.min;
    S.droughtUntil = S.min + 7 * 1440;
    log('A drought has begun. Not a cloud in the sky, and the pond is shrinking.');
    say('No rain for days now… I’ll have to be careful with water.');
    highlight('felt the drought');
  },
  landslide() {
    S.loose = 10;
    S.boulders = S.boulders.map(b => Math.max(b, 6)); // fresh rock exposed
    log('Part of the rocky slope slid down in the night, exposing fresh stone.');
    say('The rocks came down! Plenty of stone now, at least.');
  },
  treasure() {
    S.treasure = { found: 0, spots: [beachAngle(), beachAngle() + 0.8, beachAngle() - 0.9] };
    log('A bottle washed up with a map inside: three crosses along this very beach.');
    say('A treasure map?! X marks the spot… three times.');
    highlight('found a treasure map');
  },
  sprain() {
    S.injuredUntil = S.min + 3 * 1440;
    log('She twisted her ankle on a root. A few days of taking it easy.');
    say('Ow, ow, ow. That’s going to swell up.');
    highlight('sprained her ankle');
  },
};

export const injured = () => S.min < S.injuredUntil;
export const drought = () => S.min < S.droughtUntil;
