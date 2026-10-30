// The tide: the sea rises and falls twice a day (a little over 12 game hours
// per cycle, so high tide drifts later each day). At low tide the beach is a
// bit wider and there are tide pools to poke around in.
import { S } from './state';

const PERIOD_H = 12.4;
// how far the sea falls at low tide and rises at high tide (world units): it mostly goes out,
// uncovering more sand, and only comes in a little, so the beach spots she uses stay dry
export const TIDE_OUT = 0.1, TIDE_IN = 0.025;
/** −1 (low) … 1 (high). */
export const tide = (min = S.min) => Math.sin((min / 60 / PERIOD_H) * Math.PI * 2 + S.island.seasonStart);
export const lowTide = () => tide() < -0.6;
/** The sea's height right now (the water plane sits at 0.12 at mid-tide). */
export const seaLevel = (min = S.min) => 0.12 + tideOffset(min);
/** How far above (or below) mid-tide the sea is right now. */
export const tideOffset = (min = S.min) => { const t = tide(min); return t * (t < 0 ? TIDE_OUT : TIDE_IN); };
