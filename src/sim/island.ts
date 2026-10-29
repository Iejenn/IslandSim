// Island geometry and the fixed layout of everything she interacts with.
// Pure math on plain {x,y,z} points so the sim never depends on Three.js;
// the world/ modules build meshes at these same coordinates.
import { lerp, smooth } from './util';

export interface Pt { x: number; y: number; z: number }

export const V = (x: number, z: number): Pt => ({ x, y: 0, z });
export const copy = (p: Pt): Pt => ({ x: p.x, y: p.y, z: p.z });
export const addScaled = (p: Pt, d: Pt, s: number): Pt => ({ x: p.x + d.x * s, y: p.y + d.y * s, z: p.z + d.z * s });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** Horizontal unit vector from a to b (y ignored). */
export function dirXZ(a: Pt, b: Pt): Pt {
  const x = b.x - a.x, z = b.z - a.z, l = Math.hypot(x, z);
  return { x: x / l, y: 0, z: z / l };
}

/* ---------- island shape: one height function drives terrain AND walking ---------- */
// Overall island size. Everything placed relative to the coast (forest, rocks,
// beach walks, the fishing spot, dock and canoe route) scales with it; the camp
// around the fire keeps its fixed positions so her daily walks stay short.
export const ISLAND_SCALE = 1.45;
// Two broad lobes stick out of the main island: the forest to the west and
// the rocky area to the east, so each has room of its own.
export const FOREST_A = 2.4, ROCKS_A = -0.875; // directions (radians) of the lobes
// How much faster she moves than on the original island, so the longer walks
// out to the lobes don't eat her whole day.
export const PACE = ISLAND_SCALE * 1.15;
const lobe = (a: number, centre: number, width: number, size: number) => {
  const d = Math.atan2(Math.sin(a - centre), Math.cos(a - centre)); // shortest angle difference
  return size * Math.exp(-(d * d) / (2 * width * width));
};
export function islandR(a: number) {
  const lobes = lobe(a, FOREST_A, 0.4, 14) + lobe(a, ROCKS_A, 0.36, 11);
  // a big smooth bump makes a squarish headland; ragged it up so the coast looks natural
  const ragged = (lobes / 12) * (1.6 * Math.sin(7 * a + 1.3) + 1.0 * Math.sin(11 * a + 0.4) + 0.7 * Math.sin(17 * a + 2.2));
  return ISLAND_SCALE * (13.5 + 1.1 * Math.sin(3 * a + 0.5) + 0.6 * Math.sin(5 * a + 2.1) + 0.4 * Math.sin(7 * a)) + lobes + ragged;
}
export function tAt(x: number, z: number) {
  return Math.hypot(x, z) / islandR(Math.atan2(z, x));
}
export function height(x: number, z: number) {
  const t = tAt(x, z);
  let h: number;
  if (t < 0.6) h = 0.8 + 0.18 * (1 - t / 0.6);
  else if (t < 1.02) h = lerp(0.8, 0.02, smooth((t - 0.6) / 0.42));
  else h = 0.02 - Math.min(2.4, (t - 1.02) * 7);
  if (t < 0.95) h += 0.05 * Math.sin(x * 1.3) * Math.cos(z * 1.1) * (1 - smooth((t - 0.8) / 0.15));
  return h;
}
export function pointAt(a: number, t: number) {
  const R = islandR(a);
  return V(Math.cos(a) * R * t, Math.sin(a) * R * t);
}
/** Snaps a point onto the terrain (mutates and returns it). */
export function ground(p: Pt) {
  p.y = height(p.x, p.z);
  return p;
}
/** A grounded spot d units from pos, on the side facing `from` (default: island centre). */
export function standNear(pos: Pt, d: number, from?: Pt) {
  const f = from || V(0, 0);
  let dir: Pt = { x: f.x - pos.x, y: 0, z: f.z - pos.z };
  const l = Math.hypot(dir.x, dir.z);
  if (l * l < 1e-4) dir = { x: 0, y: 0, z: 1 };
  else dir = { x: dir.x / l, y: 0, z: dir.z / l };
  return ground(addScaled(pos, dir, d));
}
/** Y rotation that makes an object at `from` face `to` (same convention as Object3D.rotation.y). */
export const yawTo = (from: Pt, to: Pt) => Math.atan2(to.x - from.x, to.z - from.z);

/* ---------- key spots (decoration is scattered around these) ---------- */
const KEY: Pt[] = [];
export const reserve = (...p: Pt[]) => { KEY.push(...p); };
export function clearOf(p: Pt, d: number) {
  return KEY.every(k => Math.hypot(k.x - p.x, k.z - p.z) > d);
}

export interface Spot { spot: Pt; face: Pt; lift?: number }

/* campfire at the centre, with two log seats */
export const FIRE = ground(V(0, 0));
export const SEATS = [V(1.7, 0.9), V(-0.5, 1.9)].map(raw => {
  const p = ground(raw);
  reserve(p);
  return { p, face: FIRE };
});
reserve(FIRE);

/* shelter */
export const SH = ground(V(-3.4, -2.4));
export const SHELTER: Spot = (() => {
  const dir = dirXZ(SH, FIRE);
  // towards the tall front of the shelter, so she fits under the sloped roof
  return { spot: ground(addScaled(SH, dir, 0.3)), face: addScaled(SH, dir, 3) };
})();
reserve(SH);

/* spring */
export const SP = ground(V(-6.2, -3.4));
export const SPRING: Spot = { spot: standNear(SP, 1.45), face: SP };
reserve(SP);

/* berry bushes (berry counts live in sim state) */
export const BUSHES = [V(5.2, 2.4), V(3.4, -5.4), V(-4.4, 4.4)].map(raw => {
  const pos = ground(raw);
  reserve(pos);
  return { pos, stand: standNear(pos, 1.0) };
});

/* fishing spot on the north beach */
export const FISH_A = Math.PI / 2;
export const FISH: Spot = { spot: ground(pointAt(FISH_A, 0.9)), face: pointAt(FISH_A, 1.4) };
reserve(FISH.spot);

/* where crafted things end up */
export const DRUM_P = ground(V(2.5, -1.5)); // near the fire, so she drums by firelight
export const HAMMOCK_P = ground(V(-4.2, -6.0));
export const JOURNAL_P = copy(SEATS[1].p);
reserve(DRUM_P, HAMMOCK_P);
// furniture she makes once she's handy enough
export const CHAIR_P = ground(V(1.1, -1.7)); // by the fire, facing it
export const TABLE_P = ground(V(0.9, -2.95)); // next to the chair
export const SHELF_P = ground(V(-1.9, -3.6)); // beside the shelter, for her shells and story boards
reserve(CHAIR_P, TABLE_P, SHELF_P);

/* ---------- things she builds herself (spots are reserved up front so decoration stays clear) ---------- */
export const WOODPILE_P = ground(V(-2.0, 0.6));
export const RACK_P = ground(V(4.0, 0.0));
export const GARDEN_P = ground(V(2.6, 5.0));
// 2×2 beds around the garden centre
export const PLOTS = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].map(([dx, dz]) => ground(V(GARDEN_P.x + dx, GARDEN_P.z + dz)));
export const GARDEN_STAND = standNear(GARDEN_P, 1.6);
reserve(WOODPILE_P, RACK_P, GARDEN_P, ...PLOTS);

// The dock runs straight out to sea from the fishing spot.
const dockDir = { x: Math.cos(FISH_A), y: 0, z: Math.sin(FISH_A) };
const dockPerp = { x: -dockDir.z, y: 0, z: dockDir.x };
const fishR = islandR(FISH_A);
export const DOCK = {
  dir: dockDir,
  from: fishR * 0.84, // distance from the island centre where the deck starts…
  to: fishR * 1.14, // …and ends
  deckY: 0.38,
  halfWidth: 0.55,
};
export const DOCK_START = { ...pointAt(FISH_A, 0.84), y: DOCK.deckY };
export const DOCK_END = { ...addScaled(V(0, 0), dockDir, DOCK.to - 0.35), y: DOCK.deckY };
export const DOCK_FACE = pointAt(FISH_A, 1.6);
// where the boat is moored, alongside the end of the dock
export const BOAT_DOCK = { ...addScaled(DOCK_END, dockPerp, 0.95), y: 0 };
/** Boat trip: a loop around part of the coast, then back to the mooring. */
export const SAIL_ROUTE = [1, 2, 3, 4].map(k => pointAt(FISH_A + k * 0.33, 1.32));
reserve(DOCK_START, pointAt(FISH_A, 0.74));

// lookout tower on the south beach; she climbs up to watch the sea and the stars
export const LOOKOUT_P = ground(pointAt(-1.2, 0.78));
export const LOOKOUT_STAND = standNear(LOOKOUT_P, 0.95);
export const LOOKOUT_DECK = 2.2; // platform height above the ground
reserve(LOOKOUT_P);

/* ---------- forest (north-west) and rocky area (south-east) ----------
   Scattered with a fixed seed, after every key spot above is reserved, so
   each island has the same layout and saves can refer to trees/boulders by index. */
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scatter(seed: number, n: number, a0: number, a1: number, t0: number, t1: number, gap: number, keyGap: number) {
  const r = seeded(seed), out: Pt[] = [];
  for (let tries = 0; out.length < n && tries < 3000; tries++) {
    const p = pointAt(a0 + r() * (a1 - a0), t0 + r() * (t1 - t0));
    if (!clearOf(p, keyGap) || out.some(o => Math.hypot(o.x - p.x, o.z - p.z) < gap)) continue;
    out.push(ground(p));
  }
  return out;
}
export const FOREST = scatter(7, 22, FOREST_A - 0.5, FOREST_A + 0.5, 0.34, 0.66, 2.7, 1.9).map(pos => ({ pos, stand: standNear(pos, 0.95) }));
reserve(...FOREST.map(t => t.pos));
export const BOULDERS = scatter(11, 9, ROCKS_A - 0.42, ROCKS_A + 0.42, 0.45, 0.85, 2.5, 1.8).map(pos => ({ pos, stand: standNear(pos, 1.0) }));
reserve(...BOULDERS.map(b => b.pos));
// where loose stones lie around, in the middle of the rocky area
export const SCREE_P = scatter(13, 1, ROCKS_A - 0.35, ROCKS_A + 0.35, 0.5, 0.75, 0, 1.6)[0];
export const SCREE_STAND = standNear(SCREE_P, 0.6);
reserve(SCREE_P);

/* where she wakes up */
export const START = ground(V(1.4, 2.6));
