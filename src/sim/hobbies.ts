// v2.1: three new hobbies that leave something behind.
//  - Painting: an easel on the beach, by the pond or in camp; her paintings
//    hang in her little gallery in camp (what's in each depends on where she
//    was and what's in her life: a sunset, her dog, the ducks, home…).
//  - Birdwatching: she sits still somewhere and waits; each island bird lives
//    in its own places and seasons, so filling her bird log takes a year or so.
//  - Weaving: on a hand loom, from wool or fibre, by the fire (or indoors when it
//    rains): a rug, cushions for the log seats, a wall hanging, then little things.
import { dayNum, highlight, hour, log, S, say } from './state';
import { lowTide } from './tide';
import { season, type Season } from './seasons';
import { pick } from './util';
import { SP } from './island';

/* ---------- painting ---------- */
export type PaintWhere = 'beach' | 'pond' | 'camp';
export type PaintSubject = 'sea' | 'sunset' | 'islet' | 'boat' | 'waterfall' | 'ducks' | 'camp' | 'dog' | 'hens' | 'home' | 'lodge';
export const SUBJECT_TITLE: Record<PaintSubject, string> = {
  sea: 'The sea', sunset: 'Sunset over the sea', islet: 'The bamboo islet', boat: 'Her canoe', waterfall: 'The waterfall',
  ducks: 'Ducks on the pond', camp: 'Her camp', dog: 'Her dog', hens: 'Her hens', home: 'Home, from memory', lodge: 'Her lodge',
};
/** The subjects she could paint from here right now (ones she hasn't painted yet come first). */
export function chooseSubject(where: PaintWhere): PaintSubject {
  const h = hour(), opts: PaintSubject[] = [];
  if (where === 'beach') {
    opts.push('sea');
    if (h >= 16.5) opts.push('sunset', 'sunset');
    if (S.isletFound) opts.push('islet');
    if (S.projects.canoe?.done) opts.push('boat');
  } else if (where === 'pond') {
    opts.push('waterfall');
    if (S.ducks >= 2) opts.push('ducks');
  } else {
    opts.push('camp');
    if (S.dog.state === 'friend') opts.push('dog');
    if (S.chickens.some(c => c.penned)) opts.push('hens');
    if (S.projects.lodge?.done) opts.push('lodge');
    if (S.dayMood === 'homesick') opts.push('home', 'home', 'home');
  }
  const fresh = opts.filter(o => !S.paintings.some(p => p.subject === o));
  return pick(fresh.length && Math.random() < 0.75 ? fresh : opts);
}
export function finishPainting(subject: PaintSubject, where: PaintWhere) {
  S.paintings.push({ subject, where, day: dayNum(), seed: Math.floor(Math.random() * 1e6) });
  if (S.paintings.length > 12) S.paintings.shift(); // (she paints over the oldest canvas)
  S.paintCount = (S.paintCount ?? 0) + 1;
  const first = S.paintCount === 1;
  log(first ? `She mixed paints from berries, clay and charcoal and painted her first picture: “${SUBJECT_TITLE[subject]}”.` : `She painted “${SUBJECT_TITLE[subject]}”${subject === 'home' ? ', and cried a little' : ''}.`, first ? 'big' : undefined);
  highlight(`painted ${SUBJECT_TITLE[subject].replace(/^The /, 'the ').replace(/^Her /, 'her ')}`);
  say(pick(subject === 'home' ? ['There. Now I won’t forget it.'] : ['Not bad, if I say so myself.', 'It’s going on the wall.', 'The colours came out just right.']));
}

/* ---------- birdwatching ---------- */
export type Habitat = 'forest' | 'meadow' | 'pond' | 'beach' | 'cliffs';
interface Bird { name: string; where: Habitat[]; seasons?: Season[]; when?: 'dusk' | 'lowtide'; weight: number; line: string; colour: string }
export const BIRDS: Bird[] = [
  { name: 'island thrush', where: ['forest', 'meadow'], weight: 10, line: 'a plain brown thrush, singing its heart out', colour: '#7A5A3C' },
  { name: 'white tern', where: ['beach', 'cliffs'], weight: 10, line: 'pure white, hovering over the waves', colour: '#F4F4F0' },
  { name: 'grey heron', where: ['pond'], weight: 8, line: 'standing still as a post at the pond’s edge', colour: '#8C949C' },
  { name: 'sunbird', where: ['meadow', 'forest'], seasons: ['spring', 'summer'], weight: 6, line: 'tiny and shining green, sipping from the flowers', colour: '#2E8A5A' },
  { name: 'kingfisher', where: ['pond'], weight: 4, line: 'a flash of blue, then a splash', colour: '#2F7FD0' },
  { name: 'sandpiper', where: ['beach'], when: 'lowtide', weight: 6, line: 'little legs running after the waves', colour: '#B49A78' },
  { name: 'frigatebird', where: ['beach', 'cliffs'], seasons: ['summer', 'autumn'], weight: 4, line: 'huge black wings, and a red throat puffed up like a balloon', colour: '#26262A' },
  { name: 'fruit dove', where: ['forest'], seasons: ['autumn'], weight: 4, line: 'green, with a purple cap, gorging on fruit', colour: '#6FAE4E' },
  { name: 'barn owl', where: ['forest', 'meadow'], when: 'dusk', weight: 4, line: 'a pale face, gliding without a sound in the dusk', colour: '#E6D3B0' },
  { name: 'wild geese', where: ['meadow', 'beach'], seasons: ['spring', 'autumn'], weight: 3, line: 'a long V of geese, calling, passing over the island', colour: '#9A8C78' },
  { name: 'tropicbird', where: ['cliffs', 'beach'], seasons: ['spring', 'summer'], weight: 2, line: 'white, with two long streamers for a tail', colour: '#FBFBF6' },
  { name: 'albatross', where: ['beach', 'cliffs'], seasons: ['winter'], weight: 1.5, line: 'an albatross, gliding for miles without one flap of its wings', colour: '#EDEDE6' },
];
const dusk = () => { const h = hour(); return h >= 17.5 && h < 20.5; };
const fits = (b: Bird, w: Habitat) => b.where.includes(w) && (!b.seasons || b.seasons.includes(season())) && (b.when !== 'dusk' || dusk()) && (b.when !== 'lowtide' || lowTide());
/** Where she'd go to watch: somewhere with a bird she hasn't logged yet, if she can. */
export function chooseHabitat(): Habitat {
  // (the pond is a long walk now: only when she's out that way, or now and then)
  const byPond = Math.hypot(S.pos.x - SP.x, S.pos.z - SP.z) < 12;
  const places: Habitat[] = ['forest', 'meadow', 'beach', ...(byPond || Math.random() < 0.3 ? ['pond' as Habitat] : []), ...(S.places?.cliffs ? ['cliffs' as Habitat] : [])];
  const fresh = places.filter(w => BIRDS.some(b => !S.birds[b.name] && fits(b, w)));
  return pick(fresh.length && Math.random() < 0.8 ? fresh : places);
}
/** Which bird turns up while she waits (the earlier in the morning, the better the odds). */
export function spotBird(w: Habitat): string {
  const h = hour(), dawn = h >= 5 && h < 9 ? 1.5 : 1;
  // (often nothing comes by at all; the common birds are the ones she sees most)
  if (Math.random() > 0.65 * dawn) return '';
  // (a bird she hasn't logged yet catches her eye more: she's looking out for it)
  const ok = BIRDS.filter(b => fits(b, w)), wt = (b: Bird) => b.weight * (S.birds[b.name] ? 1 : 2.5);
  let r = Math.random() * ok.reduce((s, b) => s + wt(b), 0);
  const b = ok.find(x => (r -= wt(x)) < 0) ?? ok[0];
  return b?.name ?? '';
}
export function logBird(name: string) {
  const b = BIRDS.find(x => x.name === name);
  if (!b) return;
  if (S.birds[name]) { say(pick([`The ${name} again. Hello, friend.`, `My ${name}!`, 'Shh… there it is.'])); return; }
  S.birds[name] = dayNum();
  const n = Object.keys(S.birds).length, rare = b.weight <= 2;
  log(`A new bird for her log: a ${name}, ${b.line}. (${n} of ${BIRDS.length})`, rare ? 'big' : undefined);
  highlight(`saw ${rare ? 'a rare ' : 'a '}${name}`);
  say(rare ? `A ${name}! I can’t believe it!` : `A ${name}! Into the log it goes.`);
  if (n === BIRDS.length && !S.birdwatcher) {
    S.birdwatcher = dayNum();
    log('Every bird on the island is in her log now. She knows them by their songs.', 'big');
    highlight('filled her bird log');
  }
}
export const birdColour = (name: string) => BIRDS.find(b => b.name === name)?.colour ?? '#8A7558';

/* ---------- weaving ---------- */
export type WeaveKey = 'rug' | 'cushions' | 'hanging' | 'scarf' | 'bag' | 'dogmat';
export const WEAVE_NAME: Record<WeaveKey, string> = { rug: 'a rug', cushions: 'cushions for the log seats', hanging: 'a wall hanging', scarf: 'a warm scarf', bag: 'a shoulder bag', dogmat: 'a mat for her dog' };
/** The things she weaves for her home first; after that, little things. */
export function nextWeave(): WeaveKey {
  for (const k of ['rug', 'cushions', 'hanging'] as WeaveKey[]) if (!S.woven.some(w => w.key === k)) return k;
  if (S.dog.state === 'friend' && !S.woven.some(w => w.key === 'dogmat')) return 'dogmat';
  return season() === 'winter' || season() === 'autumn' ? 'scarf' : 'bag';
}
/** Wool if she has it (it's warmer and softer), otherwise plant fibre. */
export const canWeave = () => S.stock.wool >= 1 || S.stock.fibre >= 4; // (she keeps a few bundles of fibre back for rope and crafts)
export function useYarn() {
  if (S.stock.wool >= 1) { S.stock.wool--; return 'wool'; }
  S.stock.fibre -= 2; return 'fibre';
}
/** One sitting at the loom; every third finishes a piece. */
export function weaveSession(yarn: string) {
  S.weaving = Math.min(1, (S.weaving ?? 0) + 0.34);
  if (S.weaving < 1) return;
  S.weaving = 0;
  const key = nextWeave();
  S.woven.push({ key, day: dayNum(), colour: Math.floor(Math.random() * 6), yarn });
  if (S.woven.length > 12) S.woven.splice(3, 1); // (the home pieces stay; little things get given to the sea…)
  log(`She finished weaving ${WEAVE_NAME[key]}${yarn === 'wool' ? ', from her own sheep’s wool' : ''}.`, S.woven.length === 1 ? 'big' : undefined);
  highlight(`wove ${WEAVE_NAME[key]}`);
  say(pick(['Look at that pattern!', 'All by hand. Every thread.', 'Cosy.']));
}
/** Pieces that make her home cosier (they count towards comfort). */
export const homeWeaves = () => (['rug', 'cushions', 'hanging'] as WeaveKey[]).filter(k => S.woven.some(w => w.key === k)).length;
