// Weather: rain showers come and go at random, some turn into storms that
// strip the berry bushes and can damage what she's built, and some days are
// scorching hot. Rain waters the garden, damps the fire and sends her to shelter.
// Clouds gather for an hour or two before each shower, so you can see it
// coming (darker and angrier before a storm).
import { damaged, PLANS, REPAIRABLE } from './plans';
import { dayNum, highlight, hour, log, S, say, type ProjectKey } from './state';
import { interrupt, RAIN_STOPS } from './tasks';
import { drought } from './events';
import { fx } from './seasons';
import { clamp, pick, rand } from './util';

const AVG_GAP_MIN = 40 * 60; // on average a shower starts every ~40 game hours
const STORM_CHANCE = 0.25; // share of showers (from day 3) that are storms

/** @param dm game minutes elapsed */
export function updateWeather(dm: number) {
  const w = S.weather;
  if (w.hot && (hour() >= 19 || w.raining)) w.hot = false; // the heat breaks in the evening
  if (w.raining) {
    S.fire = Math.max(0, S.fire - dm * (w.storm ? 10 : 4) / 60);
    if (S.min >= w.until) {
      const wasStorm = w.storm;
      w.raining = false;
      w.clearedAt = S.min; // (a rainbow may follow)
      w.storm = false;
      say(wasStorm ? 'The storm’s passed. Let’s see what’s left standing.' : pick(['The sun’s back.', 'Finally, the rain stopped.', 'Everything smells fresh after the rain.']));
    }
    return;
  }
  if (w.coming) {
    if (S.min >= w.coming) startRain();
    return;
  }
  // no rain on the first morning, she has enough to deal with
  // the season and the island's own climate decide how often it rains (and a drought, whether at all)
  if (drought() || S.min < 20 * 60 || Math.random() >= dm * fx().rain * S.island.rain / AVG_GAP_MIN) return;
  w.coming = S.min + rand(60, 120);
  w.comingStorm = dayNum() >= 3 && Math.random() < STORM_CHANCE * fx().storm;
  if (w.comingStorm) say(pick(['Those clouds look angry.', 'The sky’s going dark out there…', 'I don’t like the look of that sky.']));
  else if (Math.random() < 0.4) say(pick(['Looks like rain.', 'Clouds coming in.', 'I can smell rain.']));
}

/** The clouds have gathered: it starts to rain (or storm). */
function startRain() {
  const w = S.weather;
  w.raining = true;
  w.storm = w.comingStorm;
  w.coming = 0;
  w.until = S.min + (w.storm ? rand(120, 300) : rand(60, 240));
  S.stats.rainsSeen++;
  if (w.storm) startStorm();
  else {
    say(pick(['Rain! Everything’s getting soaked.', 'Here comes the rain.', 'Great. Wet again.']));
    log('It started to rain.');
    highlight('got caught in the rain');
  }
  if (S.task && RAIN_STOPS.has(S.task.id)) interrupt();
}

function startStorm() {
  S.stats.storms++;
  say(pick(['That’s not rain, that’s a storm!', 'The wind! Hold on to something!', 'Thunder… this is going to be a bad one.']));
  log('A storm rolled in.');
  highlight('rode out a storm');
  S.berries = S.berries.map(b => clamp(b - 2, 0, 6)); // the wind strips the bushes
  if (S.cairns.length && Math.random() < 0.5) { S.cairns.pop(); log('The storm knocked over one of her stone stacks.'); }
  S.sandcastle = null; // (no sandcastle survives a storm)
  // the wind may damage one of her buildings
  // (a tiled roof keeps the shelter and lodge safe)
  const tiled = (k: ProjectKey) => S.items.tiles && (k === 'hut' || k === 'lodge');
  const standing = (Object.keys(REPAIRABLE) as ProjectKey[]).filter(k => S.projects[k].done && !damaged().includes(k) && !tiled(k));
  if (standing.length && Math.random() < 0.6) {
    const k = pick(standing);
    S.projects[k].damaged = true;
    log(`The storm tore a piece off the ${PLANS[k].name}.`);
  }
}

/** At dawn: maybe a scorching day. */
export function maybeHotDay() {
  if (S.weather.raining || Math.random() > fx().hot) return;
  S.weather.hot = true;
  say(pick(['It’s scorching today.', 'The sand is too hot to walk on.', 'What a heatwave.']));
  log('A scorching hot day.');
}
