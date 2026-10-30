// A stray dog that may wash ashore. It starts wary; she wins its trust by
// sitting with it and sharing her food. Once it's her friend it follows her
// around (see world/dog.ts), plays fetch, and she's far less lonely.
import { ground, pointAt, FOREST_A, ROCKS_A, FISH_A } from './island';
import { remember } from './memory';
import { dayNum, highlight, log, S, say } from './state';
import { pick, rand } from './util';

const NAMES = ['Biscuit', 'Pepper', 'Mango', 'Scout', 'Coco', 'Rusty', 'Pebble', 'Nemo', 'Sandy', 'Tofu'];

/** At dawn: from day 3 on, a dog might wash ashore (once). */
export function maybeDogArrives() {
  if (!S.island.dog || S.dog.state !== 'none' || dayNum() < 3 || Math.random() > 0.35) return; // (not every island has one)
  // somewhere on the beach, away from the forest, rocks and the fishing spot
  let a = 0;
  for (let i = 0; i < 20; i++) {
    a = rand(0, Math.PI * 2);
    const away = (c: number) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) > 0.7;
    if (away(FOREST_A) && away(ROCKS_A) && away(FISH_A)) break;
  }
  S.dog = { state: 'wild', trust: 0, name: '', home: ground(pointAt(a, 0.78)) };
  log('A scruffy dog washed up on the beach, half-starved and wary of her.');
  say('A dog?! Where did you come from?');
  highlight('met a stray dog');
}

/** She spent time with the dog; it trusts her a little more. */
export function gainTrust(amount: number) {
  if (S.dog.state !== 'wild') return;
  S.dog.trust = Math.min(1, S.dog.trust + amount);
  if (S.dog.trust < 1) return;
  S.dog.state = 'friend';
  S.dog.name = pick(NAMES);
  log(`The dog finally trusts her. She named it ${S.dog.name}.`);
  say(`I’ll call you ${S.dog.name}. We’re a team now.`);
  highlight(`made friends with ${S.dog.name}`);
  remember('befriend', 0.3);
  S.mood = Math.min(40, S.mood + 25);
}
