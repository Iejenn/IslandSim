// Runs the sim with no graphics for many islands and prints how their lives
// went. Possible because src/sim has no three.js/DOM dependencies.
//
//   npm run simulate                 20 islands × 20 days
//   npm run simulate -- 50 30        50 islands × 30 days
import { updateNeeds } from '../src/sim/needs';
import { runTask, settleHeight } from '../src/sim/runner';
import { comfort } from '../src/sim/plans';
import { initState } from '../src/sim/state';

const [runs = 20, days = 20] = process.argv.slice(2, 4).map(Number);
const DT = 0.1, SPEED = 10, DM = DT * 4 * SPEED; // same per-frame step as the game at 10× (capped dt)

const rows: string[] = [];
const totals = { died: 0, built: 0, crafted: 0, furniture: 0, felled: 0, standing: 0, meals: 0, stews: 0, fireOutHours: 0, dogFriend: 0, storms: 0, repairs: 0, broken: 0, comfort: 0 };
const FURNITURE = ['chair', 'table', 'bed', 'shelf', 'rocker'];
for (let r = 0; r < runs; r++) {
  const S = initState();
  const made: string[] = [];
  let fireOutMin = 0;
  while (!S.dead && S.min < 420 + days * 1440) {
    S.min += DM;
    updateNeeds(DM);
    if (!S.dead) runTask(DT * 6, DM);
    settleHeight();
    if (S.fire <= 0) fireOutMin += DM;
    for (const [k, p] of Object.entries(S.projects)) if (p.done && !made.includes(k)) made.push(k);
    for (const k of Object.keys(S.items)) if (!made.includes(k)) made.push(k);
  }
  const day = Math.floor(S.min / 1440) + 1, built = Object.values(S.projects).filter(p => p.done).length;
  const standing = S.trees.filter(t => t.state === 'tree').length;
  const likes = Object.entries(S.likes).sort((a, b) => b[1]! - a[1]!).slice(0, 2).map(([k, v]) => `${k} ${v!.toFixed(2)}`).join(', ');
  rows.push(`${S.name.padEnd(6)} ${S.traits.join('+').padEnd(22)} ${S.dead ? `DIED day ${day}` : `alive d${day}`}  made: ${made.join(' ') || '-'}  ` +
    `trees ${standing}/${S.trees.length} (felled ${S.stats.treesFelled})  meals ${S.stats.meals}  fire out ${(fireOutMin / 60).toFixed(0)}h  dog ${S.dog.state}  comfort ${comfort()}  likes: ${likes}`);
  if (S.dead) totals.died++;
  totals.built += built;
  totals.crafted += Object.keys(S.items).length;
  totals.felled += S.stats.treesFelled;
  totals.standing += standing;
  totals.meals += S.stats.meals;
  totals.furniture += FURNITURE.filter(k => S.items[k as keyof typeof S.items]).length;
  totals.stews += S.feelingsNoted.includes('dish:fish stew') ? 1 : 0;
  totals.dogFriend += S.dog.state === 'friend' ? 1 : 0;
  totals.storms += S.stats.storms;
  totals.repairs += S.stats.repairs;
  totals.broken += Object.values(S.projects).filter(p => p.damaged).length;
  totals.comfort += comfort();
  totals.fireOutHours += fireOutMin / 60;
}
const avg = (v: number) => (v / runs).toFixed(1);
console.log(rows.join('\n'));
console.log(`\n${runs} islands × ${days} days: ${totals.died} died · avg ${avg(totals.built)}/7 built · ${avg(totals.crafted - totals.furniture)}/8 tools & things · ${avg(totals.furniture)}/5 furniture · ` +
  `${avg(totals.felled)} trees felled, ${avg(totals.standing)} trees standing · ${avg(totals.meals)} cooked meals (${totals.stews} islands had stew) · fire out ${avg(totals.fireOutHours)}h\n` +
  `dog befriended on ${totals.dogFriend}/${runs} · ${avg(totals.storms)} storms, ${avg(totals.repairs)} repairs, ${avg(totals.broken)} still broken at the end · home comfort ${avg(totals.comfort)}/10`);
