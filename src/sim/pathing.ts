// Walking routes that go around things instead of through them: the fire,
// trees and boulders, buildings and furniture, the walls of the shelter and
// lodge (through their doorways), and the fence around her home (through its
// gates). Most walks are a straight line; only when that's blocked does she
// search a small grid around the obstacle (A*) and smooth the result.
import {
  BANDSTAND_P, MARIMBA_P, POND_R, SHED_P, BARREL_P, BATH_P, BOULDERS, COOP_P, DRUM_P, FENCE_GATES, FENCE_R, FIRE, FOREST, GARDEN_P, HIVE_P, KILN_P, LODGE_SIZE,
  lodgeLocal, LOOKOUT_P, OVEN_P, RACK_P, SH, SP, SUNDIAL_P, TABLE_P, V, WARREN_P, WOODPILE_P, yawTo, type Pt,
} from './island';
import { S } from './state';

interface Circle { x: number; z: number; r: number }
interface Wall { ax: number; az: number; bx: number; bz: number }
const WALL_R = 0.18; // half the thickness of a wall, plus a little room for her shoulders
const MARGIN = 0.25; // how close she walks past things

/* ---------- what's in the way right now ---------- */
let cacheKey = '', circles: Circle[] = [], walls: Wall[] = [];

/** A point in a building's own frame (x along its front, z towards the fire) → world. */
function local(p: Pt, yaw: number, lx: number, lz: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c };
}
function wall(a: { x: number; z: number }, b: { x: number; z: number }) { walls.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z }); }

function rebuild() {
  circles = []; walls = [];
  const c = (p: { x: number; z: number }, r: number) => circles.push({ x: p.x, z: p.z, r });
  const done = (k: keyof typeof S.projects) => S.projects[k].done;
  c(FIRE, done('hearth') ? 1.2 : 0.8);
  S.trees.forEach((t, i) => { if (t.state === 'tree' || t.state === 'stump') c(FOREST[i].pos, t.state === 'tree' ? 0.3 : 0.22); });
  S.boulders.forEach((left, i) => { if (left > 0) c(BOULDERS[i].pos, 0.75 * (0.45 + 0.55 * left / 8) + 0.05); });
  c(WOODPILE_P, 0.55); c(SP, POND_R + 0.15); c(WARREN_P, 1.2);
  if (S.items.drum && !S.projects.bandstand.done) c(DRUM_P, 0.25);
  if (S.items.marimba && !S.projects.bandstand.done) c(MARIMBA_P, 0.5);
  if (done('bandstand')) c(BANDSTAND_P, 1.65);
  if (S.items.table) c(TABLE_P, 0.55);
  if (done('rack')) { const y = yawTo(RACK_P, FIRE) + Math.PI / 2; wall(local(RACK_P, y, -0.9, 0), local(RACK_P, y, 0.9, 0)); }
  if (done('coop')) c(COOP_P, 0.75);
  if (done('barrel')) c(BARREL_P, 0.42);
  if (done('shed')) c(SHED_P, 1.0);
  if (done('kiln')) c(KILN_P, 0.95);
  if (done('oven')) c(OVEN_P, 0.75);
  if (done('beehive')) c(HIVE_P, 0.45);
  if (done('sundial')) c(SUNDIAL_P, 0.35);
  if (done('bathhouse')) c(BATH_P, 0.85);
  if (done('lookout')) c(LOOKOUT_P, 0.85);
  if (done('garden')) { // the little fence around the beds (open on the side she works from)
    const g = GARDEN_P, r = 1.35;
    wall(V(g.x - r, g.z - r), V(g.x + r, g.z - r)); wall(V(g.x + r, g.z - r), V(g.x + r, g.z + r)); wall(V(g.x - r, g.z + r), V(g.x - r, g.z - r));
  }
  if (S.projects.lodge.done) {
    // outer walls with a doorway at the front, and the two walls between the rooms
    const hw = LODGE_SIZE.w / 2, hd = LODGE_SIZE.d / 2, L = (x: number, z: number) => lodgeLocal(x, z);
    wall(L(-hw, -hd), L(hw, -hd)); wall(L(-hw, -hd), L(-hw, hd)); wall(L(hw, -hd), L(hw, hd));
    wall(L(-hw, hd), L(-0.6, hd)); wall(L(0.6, hd), L(hw, hd));
    for (const x of [-1.1, 1.1]) wall(L(x, -hd), L(x, 0.8));
  } else if (done('hut')) {
    // stone walls around the shelter, open at the front between the two front pieces
    const y = yawTo(SH, FIRE), P = (x: number, z: number) => local(SH, y, x, z);
    wall(P(-1.18, -0.82), P(1.11, -0.82)); wall(P(-1.18, -0.82), P(-1.18, 0.72)); wall(P(1.11, -0.82), P(1.11, 0.72));
    wall(P(-1.18, 0.72), P(-0.41, 0.72)); wall(P(0.41, 0.72), P(1.11, 0.72));
  }
  if (done('fence')) { // the ring of posts, with gaps at the gates
    const n = 40, gate = (a: number) => FENCE_GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.14);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2;
      if (gate(a) || gate(a2)) continue;
      wall(V(Math.cos(a) * FENCE_R, Math.sin(a) * FENCE_R), V(Math.cos(a2) * FENCE_R, Math.sin(a2) * FENCE_R));
    }
  }
}
function refresh() {
  const key = Object.values(S.projects).map(p => p.done ? 1 : 0).join('') + S.trees.map(t => t.state[1]).join('') + S.boulders.map(b => b > 0 ? 1 : 0).join('')
    + (S.items.drum ? 'd' : '') + (S.items.table ? 't' : '');
  if (key !== cacheKey) { cacheKey = key; rebuild(); }
}

/* ---------- geometry ---------- */
function segPointDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
function segSegDist(a: Wall, b: Wall) {
  // (two segments either cross, or their closest points include an endpoint)
  const cross = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const A = [a.ax, a.az], B = [a.bx, a.bz], C = [b.ax, b.az], D = [b.bx, b.bz];
  if (cross(A, B, C) * cross(A, B, D) < 0 && cross(C, D, A) * cross(C, D, B) < 0) return 0;
  return Math.min(segPointDist(a.ax, a.az, a.bx, a.bz, b.ax, b.az), segPointDist(a.ax, a.az, a.bx, a.bz, b.bx, b.bz),
    segPointDist(b.ax, b.az, b.bx, b.bz, a.ax, a.az), segPointDist(b.ax, b.az, b.bx, b.bz, a.bx, a.bz));
}
/** Obstacles she's standing in (or walking to) don't count: she's sitting at the fire, in the tub, at a tree… */
const inside = (o: Circle, p: Pt) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + MARGIN + 0.05;
function clear(a: Pt, b: Pt, from: Pt, to: Pt) {
  for (const o of circles) {
    if (inside(o, from) || inside(o, to)) continue;
    if (segPointDist(a.x, a.z, b.x, b.z, o.x, o.z) < o.r + MARGIN) return false;
  }
  const s = { ax: a.x, az: a.z, bx: b.x, bz: b.z };
  for (const w of walls) if (segSegDist(s, w) < WALL_R) return false;
  return true;
}

/* ---------- A* on a small grid around the blocked stretch ---------- */
const CELL = 0.5;
function search(a: Pt, b: Pt): Pt[] | null {
  const pad = 7, x0 = Math.min(a.x, b.x) - pad, z0 = Math.min(a.z, b.z) - pad;
  const W = Math.ceil((Math.max(a.x, b.x) + pad - x0) / CELL), H = Math.ceil((Math.max(a.z, b.z) + pad - z0) / CELL);
  if (W * H > 40000) return null; // (a very long walk: don't bother)
  const cx = (i: number) => x0 + (i + 0.5) * CELL, cz = (j: number) => z0 + (j + 0.5) * CELL;
  const blocked = new Uint8Array(W * H);
  for (const o of circles) {
    if (inside(o, a) || inside(o, b)) continue;
    const r = o.r + MARGIN;
    for (let j = Math.max(0, Math.floor((o.z - r - z0) / CELL)); j <= Math.min(H - 1, Math.floor((o.z + r - z0) / CELL)); j++)
      for (let i = Math.max(0, Math.floor((o.x - r - x0) / CELL)); i <= Math.min(W - 1, Math.floor((o.x + r - x0) / CELL)); i++)
        if (Math.hypot(cx(i) - o.x, cz(j) - o.z) < r) blocked[j * W + i] = 1;
  }
  for (const w of walls) {
    const minX = Math.min(w.ax, w.bx) - WALL_R, maxX = Math.max(w.ax, w.bx) + WALL_R, minZ = Math.min(w.az, w.bz) - WALL_R, maxZ = Math.max(w.az, w.bz) + WALL_R;
    for (let j = Math.max(0, Math.floor((minZ - z0) / CELL)); j <= Math.min(H - 1, Math.floor((maxZ - z0) / CELL)); j++)
      for (let i = Math.max(0, Math.floor((minX - x0) / CELL)); i <= Math.min(W - 1, Math.floor((maxX - x0) / CELL)); i++)
        if (segPointDist(w.ax, w.az, w.bx, w.bz, cx(i), cz(j)) < WALL_R + CELL * 0.5) blocked[j * W + i] = 1;
  }
  const idx = (p: Pt) => Math.max(0, Math.min(H - 1, Math.floor((p.z - z0) / CELL))) * W + Math.max(0, Math.min(W - 1, Math.floor((p.x - x0) / CELL)));
  const start = idx(a), goal = idx(b);
  blocked[start] = 0; blocked[goal] = 0;
  const g = new Float32Array(W * H).fill(Infinity), came = new Int32Array(W * H).fill(-1), shut = new Uint8Array(W * H);
  const gx = goal % W, gz = Math.floor(goal / W), h = (k: number) => Math.hypot(k % W - gx, Math.floor(k / W) - gz);
  const open: number[] = [start], f = new Float32Array(W * H).fill(Infinity);
  g[start] = 0; f[start] = h(start);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    if (cur === goal) break;
    if (shut[cur]) continue;
    shut[cur] = 1;
    const i = cur % W, j = Math.floor(cur / W);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (blocked[n] || shut[n]) continue;
      if (di && dj && (blocked[j * W + ni] || blocked[nj * W + i])) continue; // no cutting corners
      const ng = g[cur] + (di && dj ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; f[n] = ng + h(n); came[n] = cur; open.push(n); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const cells: Pt[] = [];
  for (let k = goal; k !== start && k >= 0; k = came[k]) cells.unshift(V(cx(k % W), cz(Math.floor(k / W))));
  // smooth: skip ahead to the furthest point she can walk to in a straight line
  const out: Pt[] = [];
  let from = a, k = 0;
  const pts = [...cells.slice(0, -1), b];
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (clear(from, pts[m], a, b)) { far = m; break; }
    out.push(pts[far]);
    from = pts[far];
    k = far + 1;
  }
  return out;
}

/* ---------- the fence: in and out through the gates ---------- */
function viaGates(a: Pt, b: Pt): Pt[] {
  if (!S.projects.fence.done) return [b];
  const ra = Math.hypot(a.x, a.z), rb = Math.hypot(b.x, b.z), inA = ra < FENCE_R, inB = rb < FENCE_R;
  const gin = (g: number) => V(Math.cos(g) * (FENCE_R - 0.9), Math.sin(g) * (FENCE_R - 0.9));
  const gout = (g: number) => V(Math.cos(g) * (FENCE_R + 0.9), Math.sin(g) * (FENCE_R + 0.9));
  const best = (cost: (g: number) => number) => FENCE_GATES.reduce((x, y) => cost(y) < cost(x) ? y : x);
  const d = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.z - q.z);
  if (inA && !inB) { const g = best(g => d(a, gin(g)) + d(gout(g), b)); return [gin(g), gout(g), b]; }
  if (!inA && inB) { const g = best(g => d(a, gout(g)) + d(gin(g), b)); return [gout(g), gin(g), b]; }
  if (!inA && !inB && segPointDist(a.x, a.z, b.x, b.z, 0, 0) < FENCE_R) {
    // the straight line cuts across her home: in at one gate, out at another
    const g1 = best(g => d(a, gout(g))), g2 = best(g => d(gout(g), b));
    return g1 === g2 ? [gout(g1), b] : [gout(g1), gin(g1), gin(g2), gout(g2), b];
  }
  return [b];
}

/** Waypoints from a to b (b last) that go around whatever is in the way. */
export function route(a: Pt, b: Pt): Pt[] {
  refresh();
  const legs = viaGates(a, b), out: Pt[] = [];
  let from = a;
  for (const to of legs) {
    if (clear(from, to, from, to)) out.push(to);
    else out.push(...(search(from, to) ?? [to]));
    from = to;
  }
  return out;
}
