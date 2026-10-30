// The night sky and the sea at night: the moon's phase (an 8-day cycle, so
// you see it change), and the summer nights when the waves glow blue with
// tiny sea creatures. The world draws them; the sim uses them for what she
// does after dark (a walk along the glowing water, a dance under a full moon).
import { season } from './seasons';
import { S } from './state';

export const MOON_DAYS = 8;
const hash = (n: number) => { const x = Math.sin(n * 57.3 + 21.7) * 43758.5453; return x - Math.floor(x); };
/** The night of a given minute: before 7 in the morning still counts as the night before. */
const nightOf = (min = S.min) => Math.floor((min - 7 * 60) / 1440);

/** 0 new moon … 0.5 full … 1 new again. */
export const moonPhase = (min = S.min) => (((nightOf(min) % MOON_DAYS) + MOON_DAYS) % MOON_DAYS) / MOON_DAYS;
/** 0 (dark) … 1 (full): how much of the moon is lit. */
export const moonLight = (min = S.min) => 0.5 - 0.5 * Math.cos(moonPhase(min) * Math.PI * 2);
export const fullMoon = () => moonLight() > 0.9;
/** Some warm nights the waves glow blue (most often in summer). */
export function glowingSea(min = S.min) {
  const chance = { spring: 0.12, summer: 0.4, autumn: 0.2, winter: 0 }[season(Math.floor(min / 1440) + 1)];
  return !S.weather.raining && hash(nightOf(min) * 3 + S.island.seasonStart) < chance;
}

/** How far through its cycle the moon is right now, smoothly (0 new · 0.5 full), for drawing it. */
// (shifted so the moon is exactly full around 21:30 on the night fullMoon() says, rising as the sun sets)
export const moonAge = (min = S.min) => (((((min - 7 * 60) / 1440 - 0.6) / MOON_DAYS) % 1) + 1) % 1;
