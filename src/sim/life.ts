// Her life beyond the work: the mood she wakes up in (which tilts what she
// feels like doing that day), the odd cold or upset stomach (herbal tea from
// the garden helps), her birthday and the anniversary of washing ashore, and
// mastery: when one of her skills gets good enough she becomes known for it,
// with a title and something to show for it on the island.
import { dayNum, highlight, hour, log, S, say, SKILLS, type SkillKey, type TaskId } from './state';
import { season } from './seasons';
import { pick, rand } from './util';

// four 12-day seasons (seasons.ts); a plain number, since state.ts imports this file while
// the modules are still loading (reading SEASON_DAYS here broke that in the browser)
export const YEAR_DAYS = 48;

/* ---------- the mood of the day ---------- */
export type DayMood = 'ordinary' | 'cheerful' | 'restless' | 'thoughtful' | 'lazy' | 'homesick';
export const DAY_MOOD: Record<DayMood, string> = {
  ordinary: '', cheerful: 'In high spirits today', restless: 'Restless today', thoughtful: 'Thoughtful today', lazy: 'Feeling lazy today', homesick: 'Homesick today',
};
const MOOD_WAKE: Record<Exclude<DayMood, 'ordinary'>, [string, string]> = {
  cheerful: ['She woke up humming. A good day, she could feel it.', 'What a morning! I feel like dancing.'],
  restless: ['She woke up restless, itching to go somewhere, anywhere.', 'I can’t sit still today. Let’s go see something.'],
  thoughtful: ['She woke up quiet and thoughtful, her head full of memories.', 'A day for thinking, I think.'],
  lazy: ['She woke up slow and heavy. Not a day for hard work.', 'Five more minutes… or five more hours.'],
  homesick: ['She woke up missing home. She sat a long time looking at the sea.', 'I wonder what they’re all doing back home.'],
};
// what each mood makes her more (or less) keen on
const MOOD_BIAS: Record<DayMood, Partial<Record<TaskId, number>>> = {
  ordinary: {},
  cheerful: { dance: 0.35, drum: 0.25, play: 0.2, swim: 0.15, sandcastle: 0.15, talk: 0.15 },
  restless: { explore: 0.35, sail: 0.25, hunt: 0.15, salvage: 0.2, tidepools: 0.2, nightwalk: 0.2, relax: -0.2 },
  thoughtful: { write: 0.35, stargaze: 0.25, beachstars: 0.2, clouds: 0.2, watch: 0.2, whittle: 0.15 },
  lazy: { relax: 0.35, clouds: 0.25, bathe: 0.2, sleep: 0.1, chop: -0.1, mine: -0.1, build: -0.08 },
  homesick: { write: 0.3, watch: 0.3, talk: 0.25, relax: 0.15, dance: -0.3, drum: -0.1 },
};
export const moodBias = (id: TaskId) => MOOD_BIAS[S.dayMood ?? 'ordinary'][id] ?? 0;

/* ---------- at dawn ---------- */
export function startDay() {
  rollDayMood();
  maybeFallIll();
  noteBirthday();
  noteAnniversary();
}

function rollDayMood() {
  const w: Record<DayMood, number> = {
    ordinary: 4,
    cheerful: 0.8 + Math.max(0, S.mood) / 30,
    restless: 0.6 + S.taste.adventure,
    thoughtful: 0.6 + S.taste.creative,
    lazy: S.traits.includes('lazy') ? 1.4 : 0.5,
    homesick: 0.4 + (S.needs.company < 40 ? 0.6 : 0) + (season() === 'winter' ? 0.4 : 0) + (dayNum() < 10 ? 0.3 : 0),
  };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  S.dayMood = (Object.keys(w) as DayMood[]).find(k => (r -= w[k]) < 0) ?? 'ordinary';
  if (S.dayMood !== 'ordinary') {
    const [diary, thought] = MOOD_WAKE[S.dayMood];
    log(diary);
    say(thought);
  }
}

/* ---------- falling ill ---------- */
export type Illness = 'cold' | 'stomach';
export const ILL_LABEL: Record<Illness, string> = { cold: 'Has a cold', stomach: 'Has an upset stomach' };
export const ill = () => !!S.ill && S.min < S.ill.until;

function maybeFallIll() {
  if (S.ill && S.min >= S.ill.until) {
    S.ill = null;
    log('She’s feeling better again.');
    say(pick(['I feel like myself again!', 'Better. Much better.']));
  }
  if (S.ill || dayNum() < 4) return;
  // a cold: more likely in winter and after getting soaked; a bad stomach: after eating raw fish
  const cold = 0.008 + (season() === 'winter' ? 0.025 : season() === 'autumn' ? 0.01 : 0) + (S.min - S.weather.clearedAt < 1440 ? 0.015 : 0);
  const stomach = S.min - (S.ateRawAt ?? -99999) < 1440 ? 0.3 : 0.005;
  const kind: Illness | null = Math.random() < stomach ? 'stomach' : Math.random() < cold ? 'cold' : null;
  if (!kind) return;
  S.ill = { kind, until: S.min + rand(1, 2) * 1440 };
  log(kind === 'cold' ? 'She woke up sneezing, with a sore throat. A cold.' : 'Her stomach was in knots all night. That raw fish, probably.', 'big');
  say(kind === 'cold' ? 'Achoo! Ugh, a cold.' : 'Oof. Never eating raw fish again.');
  highlight(kind === 'cold' ? 'caught a cold' : 'had an upset stomach');
}
/** A cup of herbal tea shortens whatever's left of it by half. */
export function drinkTea() {
  if (!S.ill) return;
  S.ill.until = S.min + (S.ill.until - S.min) / 2;
}

/* ---------- birthdays and anniversaries ---------- */
export const birthdayToday = () => ((dayNum() - 1) % YEAR_DAYS) + 1 === S.birthday;
function noteBirthday() {
  if (!birthdayToday()) return;
  log(`It’s her birthday today! ${dayNum() > YEAR_DAYS ? 'Another one' : 'Her first one'} on the island.`, 'big');
  say(pick(['It’s my birthday! I’m going to celebrate, island style.', 'Happy birthday to me…']));
  S.mood = Math.min(40, S.mood + 15);
  highlight('had a birthday');
}
function noteAnniversary() {
  const d = dayNum();
  if (d <= 1 || (d - 1) % YEAR_DAYS !== 0) return;
  const years = (d - 1) / YEAR_DAYS, built = Object.values(S.projects).filter(p => p.done).length;
  log(`${years === 1 ? 'A whole year' : `${years} years`} since she washed up here. She has built ${built} things${S.dog.state === 'friend' ? `, and ${S.dog.name} has been at her side` : ''}. The island is home now.`, 'big');
  say(years === 1 ? 'A year. A whole year on this island. Who’d have thought?' : `${years} years on my island.`);
  S.mood = Math.min(40, S.mood + 15);
  highlight(`marked ${years === 1 ? 'a year' : `${years} years`} on the island`);
}

/* ---------- mastery ---------- */
// The level at which she's known for a skill (they grow at very different speeds), her title, and what she says
export const MASTERY: Partial<Record<SkillKey, { lvl: number; title: string; line: string }>> = {
  fishing: { lvl: 8, title: 'Island angler', line: 'She can read the water now: where the fish hide, when they bite.' },
  crafting: { lvl: 6, title: 'Master carver', line: 'Her hands have learned the wood. Whatever she carves now comes out beautiful.' },
  building: { lvl: 5, title: 'Master builder', line: 'She builds like she was born to it now: straight, strong and quick.' },
  gardening: { lvl: 4, title: 'Green thumb', line: 'Everything she plants seems to want to grow for her.' },
  music: { lvl: 10, title: 'Island troubadour', line: 'Her music fills the evenings now. She’s even writing her own songs.' },
  writing: { lvl: 9, title: 'Island storyteller', line: 'Her island stories have grown into a whole book.' },
  foraging: { lvl: 7, title: 'Forager', line: 'She knows every bush and every hidden patch of the island.' },
  survival: { lvl: 10, title: 'Born survivor', line: 'Nothing this island throws at her worries her any more.' },
};
const SONGS = ['The Tide Comes Home', 'Salt and Starlight', 'Driftwood Waltz', 'The Lonely Gull', 'Coconut Moon', 'Fire on the Sand', 'Rain on the Roof'];
const BOOKS = ['Washed Ashore', 'One Island, One Life', 'Letters to Nobody', 'The Castaway’s Year', 'Sand Between the Pages'];
const ISLAND_NAMES = ['Hope Island', 'Driftwood Cove', 'Little Haven', 'Second Chance', 'Gull’s Rest', 'Sunny Shore', 'Home'];

/** Called on every level-up: has she become known for this skill? */
export function checkMastery(k: SkillKey) {
  const m = MASTERY[k];
  if (!m || S.mastery[k] || S.skills[k].lvl < m.lvl) return;
  S.mastery[k] = dayNum();
  log(`${m.line} She’s become the ${m.title.toLowerCase()} of her island.`, 'big');
  highlight(`became the island’s ${m.title.toLowerCase()}`);
  S.mood = Math.min(40, S.mood + 20);
  // and something to show for it
  if (k === 'music') { S.song = pick(SONGS); log(`She wrote her first song of her own: “${S.song}”.`); }
  if (k === 'writing') { S.book = pick(BOOKS); log(`She finished her book, and called it “${S.book}”.`); }
  if (k === 'building') { S.islandName = pick(ISLAND_NAMES); log(`She carved a sign for the beach: “Welcome to ${S.islandName}”.`); }
  if (k === 'fishing') { S.recordFish = Math.round(rand(6, 14) * 10) / 10; log(`She landed a monster: a ${S.recordFish} kg fish, her record. She mounted it on a board.`); }
  if (k === 'gardening') log('Her best pumpkin grew into a giant. She’s keeping it, just to look at.');
  say(pick([`They’d call me the ${m.title.toLowerCase()} back home.`, 'I’m actually really good at this now.', 'Look how far I’ve come.']));
}
export const isMaster = (k: SkillKey) => !!S.mastery[k];
export const titles = () => (Object.keys(S.mastery) as SkillKey[]).map(k => MASTERY[k]!.title);
/** Is she in a fit state for the evening? (birthday parties start around six) */
export const partyTime = () => birthdayToday() && hour() >= 17 && hour() < 22 && !S.partied;
export { SKILLS };
