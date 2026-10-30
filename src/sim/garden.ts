// Garden beds: planted seeds grow over ~2 game days if kept watered, then
// need harvesting. Dry beds wither; ripe crops left too long rot.
import { fx } from './seasons';
import { highlight, log, S } from './state';

const GROW_MIN = 2 * 1440; // game minutes to ripen
const WITHER_DRY_MIN = 0.75 * 1440; // completely dry this long → withered
const ROT_AT = 2.2; // growth value where an unharvested crop rots

export const freePlots = () => S.plots.filter(p => p.state === 'empty' || p.state === 'withered');
export const growingPlots = () => S.plots.filter(p => p.state === 'growing');
export const ripePlots = () => S.plots.filter(p => p.state === 'ripe');
/** Driest growing bed's water level (100 if nothing is growing). */
export const driest = () => growingPlots().reduce((m, p) => Math.min(m, p.water), 100);

/** @param dm game minutes elapsed */
export function updateGarden(dm: number) {
  if (!S.projects.garden.done) return;
  const dryDays = S.items.bucket ? 2.4 : 1.4; // full bed → bone dry, in days (a bucket soaks them properly)
  let ripened = 0;
  for (const p of S.plots) {
    if (p.state !== 'growing' && p.state !== 'ripe') continue;
    if (S.weather.raining) p.water = 100;
    p.water = Math.max(0, p.water - dm * 100 / (1440 * dryDays));
    if (p.state === 'growing') {
      if (p.water <= 0) {
        p.dryMin += dm;
        if (p.dryMin > WITHER_DRY_MIN) {
          p.state = 'withered';
          log('A garden bed dried out and withered.');
          highlight('lost a plant to the dry');
        }
        continue;
      }
      p.dryMin = 0;
      p.growth += dm / GROW_MIN * (1 + 0.05 * S.skills.gardening.lvl) * fx().grow; // fast in spring, barely in winter
      if (p.growth >= 1) { p.state = 'ripe'; ripened++; }
    } else {
      p.growth += dm / GROW_MIN;
      if (p.growth >= ROT_AT) {
        p.state = 'withered';
        log('A ripe crop rotted before she picked it.');
      }
    }
  }
  if (ripened) log(ripened > 1 ? 'Several garden beds are ripe.' : 'Something in the garden is ripe.');
}
