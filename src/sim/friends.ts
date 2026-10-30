// The animals around her as company: she names her hens and sheep (one hen
// becomes her favourite and potters after her), ducks settle on the pond and
// raise ducklings, a wild parrot in the forest can be won over with fruit and
// starts repeating things she says, her dog brings her little gifts, and the
// sea gives up different kinds of fish.
import { FOREST } from './island';
import { dayNum, highlight, listeners, log, S, say } from './state';
import { season } from './seasons';
import { pick } from './util';

const HEN_NAMES = ['Clara', 'Henrietta', 'Peep', 'Mabel', 'Goldie', 'Nugget', 'Dot', 'Pearl'];
const SHEEP_NAMES = ['Woolly', 'Bramble', 'Cloud', 'Biscuit', 'Daisy', 'Fern'];
const PARROT_NAMES = ['Captain', 'Kiwi', 'Rio', 'Mango', 'Polly', 'Juno'];
const freshName = (pool: string[], used: string[]) => pool.find(n => !used.includes(n)) ?? pick(pool);

/* ---------- at dawn ---------- */
export function friendsAtDawn() {
  nameAnimals();
  ducksArrive();
  parrotAppears();
  dogGift();
}

function nameAnimals() {
  const before = S.names.hens.filter(Boolean).length + S.names.sheep.filter(Boolean).length;
  S.chickens.forEach((c, i) => { if (c.penned && !S.names.hens[i]) S.names.hens[i] = freshName(HEN_NAMES, S.names.hens); });
  S.sheep.forEach((c, i) => { if (c.penned && !S.names.sheep[i]) S.names.sheep[i] = freshName(SHEEP_NAMES, S.names.sheep); });
  const named = [...S.names.hens, ...S.names.sheep].filter(Boolean);
  if (named.length > before && before === 0) log(`She’s given her animals names: ${named.join(', ')}.`);
  // one hen becomes her favourite and follows her around camp
  const hens = S.chickens.map((c, i) => c.penned ? i : -1).filter(i => i >= 0);
  if (S.favHen < 0 && hens.length >= 2 && Math.random() < 0.3) {
    S.favHen = pick(hens);
    log(`${S.names.hens[S.favHen]} has become her favourite hen. She follows her all around camp.`, 'big');
    say(`${S.names.hens[S.favHen]}, you little shadow.`);
  }
}

function ducksArrive() {
  if (S.ducks === 0 && dayNum() >= 10 && Math.random() < 0.12) {
    S.ducks = 2;
    log('A pair of ducks landed on the pond, and decided to stay.', 'big');
    say('Ducks! On my pond!');
    highlight('saw ducks settle on the pond');
  } else if (S.ducks >= 2 && S.ducks < 6 && season() === 'spring' && !S.feelingsNoted.includes(`ducklings:${Math.floor(dayNum() / 48)}`) && Math.random() < 0.15) {
    S.feelingsNoted.push(`ducklings:${Math.floor(dayNum() / 48)}`);
    const n = 2 + Math.floor(Math.random() * 3);
    S.ducks = Math.min(6, S.ducks + n);
    log(`${n} fluffy ducklings paddled out behind their mother on the pond.`, 'big');
    highlight('saw ducklings on the pond');
  }
}

/* ---------- the parrot ---------- */
// a tree deep enough in the forest for a wild parrot
export const PARROT_TREE = Math.min(40, FOREST.length - 1);
function parrotAppears() {
  if (S.parrot.state !== 'none' || dayNum() < 8 || Math.random() > 0.1) return;
  S.parrot.state = 'wild';
  log('A bright red parrot has been watching her from the forest. Every time she looks, it squawks.', 'big');
  say('Was that… a parrot?');
}
/** She left it some fruit; it trusts her a little more. */
export function offerParrot() {
  if (S.parrot.state !== 'wild') return;
  S.parrot.trust = Math.min(1, S.parrot.trust + 0.3);
  if (S.parrot.trust < 1) return;
  S.parrot.state = 'friend';
  S.parrot.name = pick(PARROT_NAMES);
  log(`The parrot flew down and landed on her shoulder. She called it ${S.parrot.name}, and it moved into camp.`, 'big');
  say(`Hello, ${S.parrot.name}! Welcome home.`);
  highlight(`made friends with ${S.parrot.name} the parrot`);
  S.mood = Math.min(40, S.mood + 20);
}
/** Whenever she says something, a friendly parrot may pick it up. */
export function parrotHears(text: string) {
  if (S.parrot.state !== 'friend' || Math.random() > 0.08) return;
  const short = text.split(/[.!?…]/)[0].trim();
  if (short.length < 3 || short.length > 28 || S.parrot.words.includes(short)) return;
  S.parrot.words.push(short);
  if (S.parrot.words.length > 12) S.parrot.words.shift();
}
listeners.said.push(t => { if (!t.includes('squawked')) parrotHears(t); });

/** Now and then (a couple of times a day) it says one of them back. */
export function updateFriends(dm: number) {
  if (S.parrot.state === 'friend' && S.parrot.words.length && Math.random() < dm / 700) {
    const w = pick(S.parrot.words);
    say(`${S.parrot.name} just squawked “${w}!” Cheeky bird.`);
    if (!S.feelingsNoted.includes('parrot:talks')) { S.feelingsNoted.push('parrot:talks'); log(`${S.parrot.name} said its first words: “${w}!” She laughed until she cried.`, 'big'); }
  }
}

/* ---------- the dog's gifts ---------- */
function dogGift() {
  if (S.dog.state !== 'friend' || Math.random() > 0.12) return;
  const gift = pick(['a shell', 'a smooth stone', 'a crab (very much alive)', 'a stick twice its size', 'an old bottle']);
  if (gift === 'a shell') S.stock.shells = Math.min(20, S.stock.shells + 1);
  log(`${S.dog.name} dropped ${gift} at her feet this morning, tail wagging.`);
  say(`For me? Thank you, ${S.dog.name}!`);
}

/* ---------- kinds of fish ---------- */
const FISH_KINDS: { name: string; weight: number; lvl: number; first: string }[] = [
  { name: 'mackerel', weight: 30, lvl: 0, first: 'A mackerel, stripy and quick.' },
  { name: 'snapper', weight: 20, lvl: 1, first: 'A red snapper! A proper dinner fish.' },
  { name: 'sea bream', weight: 15, lvl: 2, first: 'A silver sea bream, flashing in the sun.' },
  { name: 'parrotfish', weight: 10, lvl: 3, first: 'A parrotfish, blue and green like a painting.' },
  { name: 'octopus', weight: 6, lvl: 4, first: 'An octopus wrapped itself round her line! She got it in the end.' },
  { name: 'golden trevally', weight: 2, lvl: 6, first: 'A golden trevally, shining like treasure. She’ll remember this one.' },
];
/** What kind of fish she landed (the better she gets, the more kinds she can catch). */
export function catchKind() {
  const ok = FISH_KINDS.filter(f => S.skills.fishing.lvl >= f.lvl);
  let r = Math.random() * ok.reduce((s, f) => s + f.weight, 0);
  const f = ok.find(k => (r -= k.weight) < 0) ?? ok[0];
  if (!S.caughtKinds.includes(f.name)) {
    S.caughtKinds.push(f.name);
    if (S.caughtKinds.length > 1) log(`Her first ${f.name}! ${f.first}`, f.lvl >= 4 ? 'big' : undefined);
  }
  return f.name;
}
