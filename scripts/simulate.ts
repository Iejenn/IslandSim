// Runs the sim with no graphics for many islands and prints how their lives
// went. Possible because src/sim has no three.js/DOM dependencies.
//
//   npm run simulate                 20 islands × 20 days
//   npm run simulate -- 50 30        50 islands × 30 days
import { updateNeeds } from '../src/sim/needs';
import { runTask, settleHeight } from '../src/sim/runner';
import { comfort } from '../src/sim/plans';
import { initState } from '../src/sim/state';
import { strongest } from '../src/sim/taste';

const [runs = 20, days = 20] = process.argv.slice(2, 4).map(Number);
const DT = 0.1, SPEED = 10, DM = DT * 4 * SPEED; // same per-frame step as the game at 10× (capped dt)

const rows: string[] = [];
// variety between islands: what each made first, its first three things, and everything it made
const firsts: Record<string, number> = {}, openings = new Set<string>(), camps: Set<string>[] = [];
let dreams = 0, dreamsMet = 0, idle = 0;
const totals = { salvaged: 0, hatched: 0, gullPet: 0, treasure: 0, kiln: 0, clayItems: 0, rareBuilt: 0, rareAllowed: 0, present: 0, spear: 0, snare: 0, hunted: 0, freed: 0, rabbitsLeft: 0, houseboat: 0, lodge: 0, fence: 0, coop: 0, penned: 0, eggs: 0, wool: 0, lodgeFurniture: 0, died: 0, built: 0, crafted: 0, furniture: 0, felled: 0, standing: 0, meals: 0, stews: 0, fireOutHours: 0, dogFriend: 0, storms: 0, repairs: 0, broken: 0, comfort: 0 };
const FURNITURE = ['chair', 'table', 'bed', 'shelf', 'rocker'], LODGE_FURNITURE = ['realbed', 'sofa', 'kitchen'], WOOL_ITEMS = ['blanket', 'sweater'];
for (let r = 0; r < runs; r++) {
  const S = initState();
  const made: string[] = [];
  let fireOutMin = 0;
  const dream = S.dream, passion = strongest(S.taste);
  while (!S.dead && S.min < 420 + days * 1440) {
    S.min += DM;
    updateNeeds(DM);
    if (!S.dead) runTask(DT * 6, DM);
    settleHeight();
    if (S.fire <= 0) fireOutMin += DM;
    for (const [k, p] of Object.entries(S.projects)) if (p.done && !made.includes(k)) made.push(k);
    for (const k of Object.keys(S.items)) if (!made.includes(k)) made.push(k);
  }
  if (made.length < 2) idle++;
  firsts[made[0] ?? '-'] = (firsts[made[0] ?? '-'] ?? 0) + 1;
  openings.add(made.slice(0, 3).join(' > '));
  camps.push(new Set(made));
  if (dream) { dreams++; if (made.includes(dream)) dreamsMet++; }
  const day = Math.floor(S.min / 1440) + 1, built = Object.values(S.projects).filter(p => p.done).length;
  const standing = S.trees.filter(t => t.state === 'tree').length;
  const likes = Object.entries(S.likes).sort((a, b) => b[1]! - a[1]!).slice(0, 2).map(([k, v]) => `${k} ${v!.toFixed(2)}`).join(', ');
  rows.push(`${['spring', 'summer', 'autumn', 'winter'][S.island.seasonStart].padEnd(6)} ${(S.quirk ?? '-').padEnd(9)} ${S.name.padEnd(6)} ${S.traits.join('+').padEnd(22)} ${passion.padEnd(9)} dream ${(dream ?? '-').padEnd(9)} ${S.dead ? `DIED day ${day}` : `alive d${day}`}  made: ${made.join(' ') || '-'}  ` +
    `trees ${standing}/${S.trees.length} (felled ${S.stats.treesFelled})  meals ${S.stats.meals}  fire out ${(fireOutMin / 60).toFixed(0)}h  dog ${S.dog.state}  comfort ${comfort()}  likes: ${likes}`);
  if (S.dead) totals.died++;
  totals.built += built;
  totals.crafted += Object.keys(S.items).filter(k => !LODGE_FURNITURE.includes(k) && !WOOL_ITEMS.includes(k)).length;
  totals.felled += S.stats.treesFelled;
  totals.standing += standing;
  totals.meals += S.stats.meals;
  totals.furniture += FURNITURE.filter(k => S.items[k as keyof typeof S.items]).length;
  totals.stews += S.feelingsNoted.includes('dish:a stew') ? 1 : 0;
  totals.dogFriend += S.dog.state === 'friend' ? 1 : 0;
  totals.storms += S.stats.storms;
  totals.repairs += S.stats.repairs;
  totals.broken += Object.values(S.projects).filter(p => p.damaged).length;
  totals.comfort += comfort();
  totals.lodge += S.projects.lodge.done ? 1 : 0;
  totals.houseboat += S.projects.houseboat.done ? 1 : 0;
  totals.spear += S.items.spear ? 1 : 0; totals.snare += S.items.snare ? 1 : 0;
  totals.hunted += S.stats.hunted; totals.freed += S.stats.freed; totals.rabbitsLeft += S.rabbits;
  totals.fence += S.projects.fence.done ? 1 : 0;
  totals.coop += S.projects.coop.done ? 1 : 0;
  totals.salvaged += S.wreck.state === 'salvaged' ? 1 : 0;
  totals.hatched += S.turtle.state === 'hatched' && S.turtle.visits >= 2 ? 1 : 0;
  totals.gullPet += S.gull.state === 'pet' ? 1 : 0;
  totals.treasure += S.treasure.spots.length && S.treasure.found >= S.treasure.spots.length ? 1 : 0;
  totals.kiln += S.projects.kiln.done ? 1 : 0;
  totals.clayItems += ['pots', 'jug', 'tiles'].filter(k => S.items[k as keyof typeof S.items]).length + (S.projects.oven.done ? 1 : 0);
  totals.rareBuilt += S.rare.filter(k => S.projects[k].done).length;
  totals.rareAllowed += S.rare.length;
  totals.present += S.chickens.filter(c => !c.away).length + S.sheep.filter(c => !c.away).length;
  totals.penned += S.chickens.filter(c => c.penned).length + S.sheep.filter(c => c.penned).length;
  totals.eggs += S.stats.eggs;
  totals.wool += S.stats.shorn;
  totals.lodgeFurniture += LODGE_FURNITURE.filter(k => S.items[k as keyof typeof S.items]).length;
  totals.fireOutHours += fireOutMin / 60;
}
const avg = (v: number) => (v / runs).toFixed(1);
console.log(rows.join('\n'));
console.log(`\n${runs} islands × ${days} days: ${totals.died} died · avg ${avg(totals.built)}/20 built · ${avg(totals.crafted - totals.furniture)}/13 tools & things · ${avg(totals.furniture)}/5 furniture · ` +
  `${avg(totals.felled)} trees felled, ${avg(totals.standing)} trees standing · ${avg(totals.meals)} cooked meals (${totals.stews} islands had stew) · fire out ${avg(totals.fireOutHours)}h\n` +
  `dog befriended on ${totals.dogFriend}/${runs} · ${avg(totals.storms)} storms, ${avg(totals.repairs)} repairs, ${avg(totals.broken)} still broken at the end · home comfort ${avg(totals.comfort)}/16\n` +
  `fence on ${totals.fence}/${runs}, coop on ${totals.coop}/${runs}, lodge on ${totals.lodge}/${runs} · ${avg(totals.penned)}/7 animals home (of ${avg(totals.present)}) · ${avg(totals.eggs)} eggs, sheared ${avg(totals.wool)}× · ${avg(totals.lodgeFurniture)}/3 lodge furniture\n` +
  `rabbits: hunted ${avg(totals.hunted)}, let go ${avg(totals.freed)}, ${avg(totals.rabbitsLeft)} left in the warren · houseboat on ${totals.houseboat}/${runs} · spear on ${totals.spear}/${runs}, snares on ${totals.snare}/${runs}\n` +
  `events: wreck salvaged on ${totals.salvaged}, turtles seen hatching on ${totals.hatched}, gull stayed on ${totals.gullPet}, treasure found on ${totals.treasure} · kiln on ${totals.kiln}/${runs}, ${avg(totals.clayItems)}/4 clay things · rare projects ${totals.rareBuilt}/${totals.rareAllowed} built`);
// how different two finished camps are: 0 = made exactly the same things, 1 = nothing in common
let diff = 0, pairs = 0;
for (let i = 0; i < camps.length; i++) for (let j = i + 1; j < camps.length; j++) {
  const a = camps[i], b = camps[j], both = [...a].filter(k => b.has(k)).length, any = new Set([...a, ...b]).size;
  diff += any ? 1 - both / any : 0; pairs++;
}
console.log(`variety: first made ${Object.entries(firsts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')} · ` +
  `${openings.size}/${runs} different first-three openings · camps differ ${(diff / Math.max(1, pairs) * 100).toFixed(0)}% on average · dream came true on ${dreamsMet}/${dreams} · ${idle} islands made fewer than 2 things`);
