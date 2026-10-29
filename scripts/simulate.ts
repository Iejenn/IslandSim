// Runs the sim with no graphics for many islands and prints how their lives
// went. Possible because src/sim has no three.js/DOM dependencies.
//
//   npm run simulate                 20 islands × 20 days, gifts given when wished for
//   npm run simulate -- 50 30        50 islands × 30 days
//   npm run simulate -- 20 20 nogifts
import { grant } from '../src/sim/gifts';
import { updateNeeds } from '../src/sim/needs';
import { runTask, settleHeight } from '../src/sim/runner';
import { initState, type GiftKey } from '../src/sim/state';

const [runs = 20, days = 20] = process.argv.slice(2, 4).map(Number);
const giveGifts = !process.argv.includes('nogifts');
const DT = 0.1, SPEED = 10, DM = DT * 4 * SPEED; // same per-frame step as the game at 10× (capped dt)

const rows: string[] = [];
const totals = { died: 0, projects: 0, harvests: 0, fish: 0, gifts: 0 };
for (let r = 0; r < runs; r++) {
  const S = initState();
  const wishedAt: Partial<Record<GiftKey, number>> = {};
  const finished: string[] = [];
  while (!S.dead && S.min < 420 + days * 1440) {
    S.min += DM;
    updateNeeds(DM);
    if (!S.dead) runTask(DT * 6, DM);
    settleHeight();
    // play the "player": grant each wish about half a day after she makes it
    for (const k of S.wishes) {
      wishedAt[k] ??= S.min;
      if (giveGifts && S.min - wishedAt[k]! > 720) grant(k);
    }
    for (const [k, p] of Object.entries(S.projects)) if (p.done && !finished.some(f => f.startsWith(k))) finished.push(`${k}@d${Math.floor(S.min / 1440) + 1}`);
  }
  const day = Math.floor(S.min / 1440) + 1;
  const likes = Object.entries(S.likes).sort((a, b) => b[1]! - a[1]!).slice(0, 2).map(([k, v]) => `${k} ${v!.toFixed(2)}`).join(', ');
  rows.push(`${S.name.padEnd(6)} ${S.traits.join('+').padEnd(22)} ${S.dead ? `DIED day ${day}` : `alive d${day}`}  built: ${finished.join(' ') || '-'}  ` +
    `harvests ${S.stats.harvests}  fish ${S.stats.fishCaught}  rain ${S.stats.rainsSeen}  gifts ${Object.keys(S.items).length}  likes: ${likes}`);
  if (S.dead) totals.died++;
  totals.projects += finished.length;
  totals.harvests += S.stats.harvests;
  totals.fish += S.stats.fishCaught;
  totals.gifts += Object.keys(S.items).length;
}
console.log(rows.join('\n'));
console.log(`\n${runs} islands × ${days} days: ${totals.died} died · avg ${(totals.projects / runs).toFixed(1)}/4 projects · ` +
  `${(totals.harvests / runs).toFixed(1)} harvests · ${(totals.fish / runs).toFixed(1)} fish · ${(totals.gifts / runs).toFixed(1)}/8 gifts`);
