// Rain showers: they come and go at random, water the garden, damp the fire
// and send her looking for shelter.
import { highlight, log, S, say } from './state';
import { interrupt, RAIN_STOPS } from './tasks';
import { pick, rand } from './util';

const AVG_GAP_MIN = 40 * 60; // on average a shower starts every ~40 game hours

/** @param dm game minutes elapsed */
export function updateWeather(dm: number) {
  const w = S.weather;
  if (w.raining) {
    S.fire = Math.max(0, S.fire - dm * 4 / 60);
    if (S.min >= w.until) {
      w.raining = false;
      say(pick(['The sun’s back.', 'Finally, the rain stopped.', 'Everything smells fresh after the rain.']));
    }
    return;
  }
  // no rain on the first morning, she has enough to deal with
  if (S.min < 20 * 60 || Math.random() >= dm / AVG_GAP_MIN) return;
  w.raining = true;
  w.until = S.min + rand(60, 240);
  S.stats.rainsSeen++;
  say(pick(['Rain! Everything’s getting soaked.', 'Here comes the rain.', 'Great. Wet again.']));
  log('It started to rain.');
  highlight('got caught in the rain');
  if (S.task && RAIN_STOPS.has(S.task.id)) interrupt();
}
