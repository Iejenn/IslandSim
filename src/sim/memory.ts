// What she remembers: how much she likes each activity (learned from how it
// went), and a short diary recap of each day. Likes nudge decide() so two
// castaways with the same traits can still grow different habits.
import { log, S, type TaskId } from './state';
import { clamp, pick } from './util';

const LABEL: Partial<Record<TaskId, string>> = {
  fish: 'fishing', explore: 'walking the beach', talk: 'talking to the seagulls', relax: 'sitting by the fire',
  drum: 'drumming', write: 'carving stories', chop: 'chopping wood', mine: 'breaking stones', build: 'building things',
  craft: 'making things', cook: 'cooking', plant: 'gardening', water: 'gardening', harvest: 'gardening',
  sail: 'paddling', stargaze: 'stargazing', watch: 'watching the sea', play: 'playing with her dog', swim: 'swimming',
};

export const liking = (id: TaskId) => S.likes[id] ?? 0;

/** Learn from an experience: positive = enjoyed it, negative = didn't. */
export function remember(id: TaskId, delta: number) {
  // diminishing returns: the stronger a feeling already is, the less one more experience moves it
  const before = liking(id), after = clamp(before + delta * (delta > 0 ? 1 - before : 1 + before), -1, 1);
  S.likes[id] = after;
  const what = LABEL[id];
  if (!what) return;
  // note it in the diary the first time a like or dislike becomes strong
  // (only once per activity, even if it fades and comes back)
  const note = (key: string, text: string) => {
    if (S.feelingsNoted.includes(key)) return;
    S.feelingsNoted.push(key);
    log(text);
  };
  if (before < 0.45 && after >= 0.45) note(`love:${what}`, `She’s really come to love ${what}.`);
  if (before > -0.35 && after <= -0.35) note(`dread:${what}`, `She’s starting to dread ${what}.`);
}

/** Sometimes says how she feels about an activity as she starts it. */
export function feelingAbout(id: TaskId): string | null {
  const l = liking(id), what = LABEL[id];
  if (!what) return null;
  if (l > 0.3 && Math.random() < 0.35) return pick([`I love ${what}.`, `Time for my favourite thing.`, `I could do this all day.`]);
  if (l < -0.2 && Math.random() < 0.4) return pick([`Ugh, ${what} again.`, `Not my favourite, but fine.`, `Let’s get this over with.`]);
  return null;
}

const joinList = (a: string[]) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;

/** At dawn: write yesterday's recap, let old feelings fade a little. */
export function endOfDay(day: number, happiness: number) {
  const mood = happiness >= 70 ? 'A good day.' : happiness >= 45 ? 'Not bad.' : happiness >= 25 ? 'A hard day.' : 'A miserable day.';
  log(S.today.length
    ? `Looking back on day ${day}: she ${joinList(S.today.slice(0, 5))}. ${mood}`
    : `Looking back on day ${day}: nothing much happened. ${mood}`);
  S.today = [];
  for (const k in S.likes) S.likes[k as TaskId]! *= 0.85;
}
