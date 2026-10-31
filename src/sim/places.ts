// Hidden places on the island that she discovers over time: an overgrown ruin
// in the forest, a blowhole on the rocky coast, a hidden cove (only reachable at
// low tide), the hilltop, the seabird cliffs, a sunken wreck on the reef and
// glow-worms deep in the cave. An adventurous soul goes roaming to find them;
// once found, she goes back to them now and then (see the 'visit' task), and a
// bark map keeps track. Finding them all makes her the island's explorer.
import { BLOWHOLE_P, CAVE_P, CLIFFS_P, COVE_P, HILLTOP_P, RUIN_P, WRECK_STAND, type Pt } from './island';
import { dayNum, highlight, hour, log, S, say } from './state';
import { season } from './seasons';
import { lowTide } from './tide';
import { pick } from './util';

export type PlaceKey = 'ruin' | 'blowhole' | 'cove' | 'hilltop' | 'cliffs' | 'wreck' | 'grotto';
interface PlaceDef {
  name: string; at: Pt; near: number; // where it is, and how close she must get to stumble on it
  findable: () => boolean; // when it can be found (and visited)
  found: string; // the diary line when she finds it
  visit: string; visitLine: string[]; // the activity, and what she says there
}
const night = () => hour() >= 20 || hour() < 5;
export const PLACES: Record<PlaceKey, PlaceDef> = {
  ruin: { name: 'the old ruin', at: RUIN_P, near: 8, findable: () => !night(), found: 'Deep in the forest she found a ring of mossy, toppled stones, carved with spirals. Someone was here, long before her.', visit: 'Studying the old ruin', visitLine: ['Who carved these?', 'Spirals and waves. And a turtle?', 'I’ll write down every mark.'] },
  blowhole: { name: 'the blowhole', at: BLOWHOLE_P, near: 7, findable: () => !night(), found: 'On the rocky coast, the sea burst up through a hole in the rocks with a roar, soaking her. A blowhole!', visit: 'Watching the blowhole', visitLine: ['WHOOSH! Ha!', 'Here comes a big one…', 'It breathes like a whale.'] },
  cove: { name: 'the hidden cove', at: COVE_P, near: 6, findable: () => lowTide() && !night(), found: 'At low tide she squeezed round the rocks and found a tiny hidden cove, calm as a bath.', visit: 'Swimming in the hidden cove', visitLine: ['My secret beach.', 'Calm as a bath.', 'Nobody knows about this place. Well, nobody else.'] },
  hilltop: { name: 'the hilltop', at: HILLTOP_P, near: 5, findable: () => !night(), found: 'She climbed to the top of the hill by the waterfall. The whole island lay below her, and the sea all around.', visit: 'Sitting on the hilltop', visitLine: ['I can see my whole world from here.', 'Look how small my camp is!', 'The best view on the island.'] },
  cliffs: { name: 'the seabird cliffs', at: CLIFFS_P, near: 7, findable: () => (season() === 'spring' || season() === 'summer') && !night(), found: 'On the cliffs past the rocks, hundreds of seabirds were nesting, wheeling and shrieking.', visit: 'Watching the seabirds', visitLine: ['So many chicks!', 'They never stop shouting.', 'Look at that one dive!'] },
  wreck: { name: 'the sunken wreck', at: WRECK_STAND, near: 0, findable: () => season() !== 'winter' && !night() && !S.weather.raining, found: 'Paddling over the reef she saw the dark shape of an old ship lying on the bottom. A wreck!', visit: 'Diving down to the wreck', visitLine: ['Deep breath…', 'There’s something shiny down there.', 'Old, old wood, all covered in coral.'] },
  grotto: { name: 'the glow-worm grotto', at: CAVE_P, near: 3, findable: () => night() && !!S.projects.cave?.done, found: 'Deep in the cave at night, the ceiling was covered in tiny blue-green lights. Glow-worms, like a sky of their own.', visit: 'Watching the glow-worms in the cave', visitLine: ['It’s like the stars came inside.', 'Shh… don’t wake them.', 'Magic. Actual magic.'] },
};
export const PLACE_KEYS = Object.keys(PLACES) as PlaceKey[];
export const foundPlaces = () => PLACE_KEYS.filter(k => S.places[k]);
const RELICS = ['an old brass compass', 'a green glass bottle', 'a handful of tarnished coins', 'a ship’s bell', 'a little porcelain cup', 'a rusted spyglass'];

/** Something not yet found that could be found right now (for roaming), or null. */
export function placeToFind(): PlaceKey | null {
  const options = PLACE_KEYS.filter(k => !S.places[k] && k !== 'wreck' && PLACES[k].findable());
  return options.length ? pick(options) : null;
}
/** She found it (from roaming nearby, or the wreck while paddling). */
export function discover(k: PlaceKey) {
  if (S.places[k]) return;
  S.places[k] = dayNum();
  log(PLACES[k].found, 'big');
  say(pick(['I had no idea this was here!', 'Oh! Look at this!', 'What a place.']));
  highlight(`discovered ${PLACES[k].name}`);
  S.mood = Math.min(40, S.mood + 15);
  // (the wreck only counts for someone with a canoe to find it from)
  const needed = PLACE_KEYS.filter(p => p !== 'wreck' || S.projects.canoe?.done);
  if (!S.explorer && needed.every(p => S.places[p])) {
    S.explorer = dayNum();
    log('She has found every hidden corner of the island. She knows it now like the back of her hand.', 'big');
    say('I’ve seen it all. Every rock, every cove. This island is mine.');
  }
}
/** Places she's found that she could go back to now. */
export const visitable = () => foundPlaces().filter(k => PLACES[k].findable());
/** What happens when she spends time at a place she loves. */
export function enjoyPlace(k: PlaceKey) {
  if (k === 'cove' && Math.random() < 0.4) S.stock.shells = Math.min(20, S.stock.shells + 1);
  if (k === 'cliffs' && season() === 'spring' && Math.random() < 0.3) S.stock.eggs = Math.min(12, S.stock.eggs + 1);
  if (k === 'wreck' && Math.random() < 0.45) {
    const r = pick(RELICS.filter(x => !S.relics.includes(x)).concat(RELICS.length === S.relics.length ? ['nothing this time'] : []));
    if (r !== 'nothing this time') { S.relics.push(r); log(`From the wreck she brought up ${r}.`); }
  }
}
