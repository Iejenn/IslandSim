// Gifts the player can give, her wishes for them, and what happens on arrival.
// The 3D models are built by world/giftModels.ts via hooks.onGift.
import { addScaled, copy, FIRE, ground, HAMMOCK_P, PIANO_P, yawTo, type Spot } from './island';
import { feed, hooks, log, S, say, tr, type GiftKey } from './state';
import { CURIOUS_TASK, interrupt, INTERRUPTIBLE } from './tasks';

export const GIFTS: Record<GiftKey, { name: string; desc: string; a: string; wish: string; got: string; log: string }> = {
  piano: {
    name: 'Piano', desc: 'She can learn to play, and get better with practice.', a: 'a piano',
    wish: 'I wish I had a piano. I miss making music.', got: 'A piano?! On a beach? Am I dreaming?', log: 'A piano appeared near camp. She can’t explain it.',
  },
  rod: {
    name: 'Fishing rod', desc: 'Catches fish more often, and faster.', a: 'a fishing rod',
    wish: 'If only I had a proper fishing rod…', got: 'A real fishing rod! The fish don’t stand a chance.', log: 'A fishing rod was leaning against her shelter this morning.',
  },
  hammock: {
    name: 'Hammock', desc: 'Deeper sleep and faster recovery.', a: 'a hammock',
    wish: 'My back aches. A hammock would be heaven.', got: 'Someone strung up a hammock. Is someone watching over me?', log: 'A hammock appeared between two posts.',
  },
  books: {
    name: 'Books', desc: 'Something to read. Builds a reading skill.', a: 'some books',
    wish: 'I’d give anything for a good book.', got: 'Books! Real books! I’m going to read every page.', log: 'A stack of books appeared by the fire.',
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

/** Maybe wish for a gift she doesn't have yet, weighted by her traits. */
export function maybeWish(force: boolean) {
  const cand = (Object.keys(GIFTS) as GiftKey[]).filter(k => !S.items[k] && !S.wishes.includes(k));
  if (!cand.length) return;
  if (!force && Math.random() > (S.needs.fun < 70 ? 0.7 : 0.4)) return;
  const w: Record<GiftKey, number> = {
    piano: tr('musical') ? 4 : 1,
    rod: (tr('hardworking') ? 3 : 1) + (S.fishFails >= 2 ? 2 : 0),
    hammock: tr('lazy') ? 3 : 1,
    books: tr('curious') ? 4 : 1,
  };
  const tot = cand.reduce((s, k) => s + w[k], 0);
  let r = Math.random() * tot, k = cand[0];
  for (const c of cand) { r -= w[c]; if (r <= 0) { k = c; break; } }
  S.wishes.push(k);
  say(GIFTS[k].wish);
  log(`She wished for ${GIFTS[k].a}.`);
  S.giftsDirty = true;
}

export function grant(k: GiftKey) {
  // Gifts are a reply to her wishes: the rule lives here in the sim, not
  // just in the UI, so nothing can hand her an item she never asked for.
  if (S.items[k] || S.dead || !S.wishes.includes(k)) return;
  S.items[k] = true;
  S.wishes = S.wishes.filter(w => w !== k);
  const spot = giftSpot(k);
  if (spot) S.spots[k] = spot;
  hooks.onGift(k);
  S.mood = Math.min(40, S.mood + 25);
  feed('company', 15);
  if (CURIOUS_TASK[k]) S.curious.push(k);
  say(GIFTS[k].got);
  log(GIFTS[k].log + ' It’s exactly what she wished for.');
  S.giftsDirty = true;
  if (S.task && INTERRUPTIBLE.has(S.task.id) && S.task.id !== 'sleep') interrupt();
}
