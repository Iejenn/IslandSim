// Gifts the player can give, her wishes for them, and what happens on arrival.
// A gift only becomes wishable once her life gets there (see `unlocked`), and
// can only be given once she has wished for it. The 3D models are built by
// world/giftModels.ts via hooks.onGift.
import { addScaled, copy, FIRE, ground, HAMMOCK_P, PIANO_P, yawTo, type Spot } from './island';
import { dayNum, feed, highlight, hooks, log, S, say, tr, type GiftKey } from './state';
import { CURIOUS_TASK, interrupt, INTERRUPTIBLE } from './tasks';

interface GiftDef {
  name: string; desc: string; a: string;
  wish: string; got: string; log: string;
  unlocked: () => boolean; // can she think of wishing for this yet?
  weight: () => number; // how likely this wish is compared to the others
}

export const GIFTS: Record<GiftKey, GiftDef> = {
  rod: {
    name: 'Fishing rod', desc: 'Catches fish more often, and faster.', a: 'a fishing rod',
    wish: 'If only I had a proper fishing rod…', got: 'A real fishing rod! The fish don’t stand a chance.', log: 'A fishing rod was leaning against her shelter this morning.',
    unlocked: () => true,
    weight: () => (tr('hardworking') ? 3 : 1) + (S.fishFails >= 2 ? 2 : 0),
  },
  hammock: {
    name: 'Hammock', desc: 'Deeper sleep and faster recovery.', a: 'a hammock',
    wish: 'My back aches. A hammock would be heaven.', got: 'Someone strung up a hammock. Is someone watching over me?', log: 'A hammock appeared between two posts.',
    unlocked: () => S.stats.nightsInShelter >= 1,
    weight: () => tr('lazy') ? 3 : 1,
  },
  books: {
    name: 'Books', desc: 'Something to read. Builds a reading skill.', a: 'some books',
    wish: 'I’d give anything for a good book.', got: 'Books! Real books! I’m going to read every page.', log: 'A stack of books appeared by the fire.',
    unlocked: () => dayNum() >= 2,
    weight: () => tr('curious') ? 4 : 1,
  },
  piano: {
    name: 'Piano', desc: 'She can learn to play, and get better with practice.', a: 'a piano',
    wish: 'I wish I had a piano. I miss making music.', got: 'A piano?! On a beach? Am I dreaming?', log: 'A piano appeared near camp. She can’t explain it.',
    unlocked: () => tr('musical') || dayNum() >= 3,
    weight: () => tr('musical') ? 4 : 1,
  },
  seeds: {
    name: 'Seed packet', desc: 'Vegetable seeds that grow faster and feed her more than berry seeds.', a: 'proper seeds',
    wish: 'Berry seeds are fine, but real vegetable seeds…', got: 'A packet of seeds! Tomatoes, beans, squash!', log: 'A seed packet appeared next to the garden.',
    unlocked: () => S.projects.garden.done,
    weight: () => 2 + (tr('hardworking') ? 1 : 0),
  },
  can: {
    name: 'Watering can', desc: 'Keeps the garden watered for longer, with less work.', a: 'a watering can',
    wish: 'Carrying water in my hands is getting old. A watering can, please?', got: 'A watering can! My poor hands thank you.', log: 'A watering can appeared in the garden.',
    unlocked: () => S.stats.waterings >= 2,
    weight: () => tr('lazy') ? 3 : 1.5,
  },
  boat: {
    name: 'Rowing boat', desc: 'She can sail around the island from her dock.', a: 'a boat',
    wish: 'With the dock done… I keep dreaming of a little boat.', got: 'A boat, tied to my dock! Where did that come from?', log: 'A rowing boat was tied to the end of the dock.',
    unlocked: () => S.projects.dock.done,
    weight: () => 2 + (tr('curious') ? 2 : 0),
  },
  telescope: {
    name: 'Telescope', desc: 'For long nights of stargazing.', a: 'a telescope',
    wish: 'The stars here are unreal. I wish I could see them closer.', got: 'A telescope! Tonight I’m staying up late.', log: 'A telescope appeared on the south beach.',
    unlocked: () => dayNum() >= 3 && (tr('curious') || S.skills.reading.lvl >= 2 || S.stats.readMin >= 240),
    weight: () => tr('curious') ? 3 : 1,
  },
};

/** Where she stands/sits to use a gift (only piano and hammock have one). */
function giftSpot(k: GiftKey): Spot | undefined {
  if (k === 'piano') {
    const yaw = yawTo(PIANO_P, FIRE); // the piano faces the fire; she sits in front of it
    const fwd = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    return { spot: ground(addScaled(PIANO_P, fwd, 1.05)), face: copy(PIANO_P) };
  }
  if (k === 'hammock') return { spot: copy(HAMMOCK_P), face: copy(FIRE), lift: 0.35 };
  return undefined;
}

/** Maybe wish for a gift she can now imagine, weighted by her traits. Returns true if she wished. */
export function maybeWish(force: boolean) {
  const cand = (Object.keys(GIFTS) as GiftKey[]).filter(k => !S.items[k] && !S.wishes.includes(k) && GIFTS[k].unlocked());
  if (!cand.length) return false;
  if (!force && Math.random() > (S.needs.fun < 70 ? 0.7 : 0.4)) return false;
  const tot = cand.reduce((s, k) => s + GIFTS[k].weight(), 0);
  let r = Math.random() * tot, k = cand[0];
  for (const c of cand) { r -= GIFTS[c].weight(); if (r <= 0) { k = c; break; } }
  S.wishes.push(k);
  say(GIFTS[k].wish);
  log(`She wished for ${GIFTS[k].a}.`);
  S.giftsDirty = true;
  return true;
}

export function grant(k: GiftKey) {
  // Gifts are a reply to her wishes: the rule lives here in the sim, not
  // just in the UI, so nothing can hand her an item she never asked for.
  if (S.items[k] || S.dead || !S.wishes.includes(k)) return;
  S.items[k] = true;
  S.wishes = S.wishes.filter(w => w !== k);
  const spot = giftSpot(k);
  if (spot) S.spots[k] = spot;
  if (k === 'seeds') S.stock.fine += 6;
  hooks.onGift(k);
  S.mood = Math.min(40, S.mood + 25);
  feed('company', 15);
  if (CURIOUS_TASK[k]) S.curious.push(k);
  say(GIFTS[k].got);
  log(GIFTS[k].log + ' It’s exactly what she wished for.');
  highlight(`got ${GIFTS[k].a}`);
  S.giftsDirty = true;
  if (S.task && INTERRUPTIBLE.has(S.task.id) && S.task.id !== 'sleep') interrupt();
}
