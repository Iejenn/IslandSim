// Seasons: every SEASON_DAYS days the island moves on to the next season,
// starting from a random one per island. Each season tweaks how fast things
// grow and breed, the weather, the fire and the cold, and the world recolours
// the forest and grass to match (see world/seasons.ts).
import { dayNum, highlight, log, S, say } from './state';
import type { Leaning } from './taste';
import { pick } from './util';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = typeof SEASONS[number];
export const SEASON_DAYS = 12;

/** What changes per season (multipliers are relative to the old, season-less island). */
export const SEASON_FX: Record<Season, {
  berries: number; // berries back on each bush per day
  grow: number; // garden growth speed
  eggs: number; // laying
  rabbits: number; // breeding
  rain: number; storm: number; // how often showers come, and how many are storms
  hot: number; // chance of a scorching day
  fish: number; // extra catch chance
  fire: number; // how fast the fire burns down
  cold: number; // 0…1, how chilly it gets when she's not somewhere warm
}> = {
  spring: { berries: 4, grow: 1.3, eggs: 1.25, rabbits: 1.6, rain: 1.2, storm: 0.6, hot: 0.08, fish: 0, fire: 1, cold: 0 },
  summer: { berries: 3, grow: 1.1, eggs: 1, rabbits: 1, rain: 0.7, storm: 0.8, hot: 0.4, fish: 0.08, fire: 1, cold: 0 },
  autumn: { berries: 4, grow: 0.8, eggs: 0.8, rabbits: 0.8, rain: 1.3, storm: 1.5, hot: 0.03, fish: 0, fire: 1.1, cold: 0.35 },
  winter: { berries: 2, grow: 0.4, eggs: 0.5, rabbits: 0.3, rain: 1.1, storm: 1.2, hot: 0, fish: -0.03, fire: 1.25, cold: 1 },
};

export const seasonIdx = (day = dayNum()) => (S.island.seasonStart + Math.floor((day - 1) / SEASON_DAYS)) % 4;
export const season = (day?: number): Season => SEASONS[seasonIdx(day)];
export const fx = () => SEASON_FX[season()];
/** 0…1 through the current season (the world blends colours over its first days). */
export const seasonProgress = () => ((S.min / 1440) % SEASON_DAYS) / SEASON_DAYS;

// each kind of castaway has a season she loves
const LOVES: Partial<Record<Season, Leaning>> = { spring: 'green', summer: 'sea', autumn: 'adventure', winter: 'comfort' };
const ARRIVES: Record<Season, [string, string]> = {
  spring: ['Spring has come. Everything is budding and the birds are back.', 'Spring! Everything’s growing again.'],
  summer: ['Summer is here: long, hot days and calm seas.', 'Summer. The sea is warm as a bath.'],
  autumn: ['Autumn has come. The forest is turning gold, and there are mushrooms under the trees.', 'The leaves are turning. Better stock up on firewood.'],
  winter: ['Winter has come. The nights are cold and little grows.', 'Brr. Winter’s here. I need to keep that fire going.'],
};

/** At dawn: note a new season (and the first one, on day 1). */
export function noteSeason() {
  const s = season(), key = `season:${Math.floor((dayNum() - 1) / SEASON_DAYS)}`;
  if (S.feelingsNoted.includes(key)) return;
  S.feelingsNoted.push(key);
  if (dayNum() === 1) { log(`It’s ${s} on the island.`); return; }
  const [diary, thought] = ARRIVES[s];
  log(diary, 'big', undefined, false); // (the story already has a chapter per season)
  highlight(`saw ${s} arrive`);
  const loved = LOVES[s];
  if (loved && S.taste[loved] > 0.6) {
    S.mood = Math.min(40, S.mood + 15);
    say(pick([`${s[0].toUpperCase() + s.slice(1)}! My favourite time of year.`, thought]));
  } else say(thought);
}
