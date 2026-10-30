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
export const ISLAND_SCALE = 1.55;
// Broad lobes stick out of the main island: the forest to the west, the rocky
// area to the east and the pond meadow to the north, so each has room of its own.
export const FOREST_A = 2.6, ROCKS_A = -0.875, POND_A = -2.3; // directions (radians) of the lobes
// How much faster she moves than on the original island, so the longer walks
// out to the lobes don't eat her whole day.
export const PACE = ISLAND_SCALE * 1.15;
const lobe = (a: number, centre: number, width: number, size: number) => {
  const d = Math.atan2(Math.sin(a - centre), Math.cos(a - centre)); // shortest angle difference
  return size * Math.exp(-(d * d) / (2 * width * width));
};
export function islandR(a: number) {
  // the forest is a big, wide headland of its own (with a rabbit warren deep inside)
  const lobes = lobe(a, FOREST_A, 0.45, 27) + lobe(a, ROCKS_A, 0.36, 11) + lobe(a, POND_A, 0.45, 14);
  // a big smooth bump makes a squarish headland; ragged it up so the coast looks natural
  // (capped, or the much bigger forest headland would get a wildly jagged coast)
  const ragged = (Math.min(lobes, 14) / 12) * (1.6 * Math.sin(7 * a + 1.3) + 1.0 * Math.sin(11 * a + 0.4) + 0.7 * Math.sin(17 * a + 2.2));
  return ISLAND_SCALE * (13.5 + 1.1 * Math.sin(3 * a + 0.5) + 0.6 * Math.sin(5 * a + 2.1) + 0.4 * Math.sin(7 * a)) + lobes + ragged;
}
/** 0…1: how much this direction lies in the forest headland (its grass reaches further out). */
export function forestness(a: number) {
  const d = Math.atan2(Math.sin(a - FOREST_A), Math.cos(a - FOREST_A));
  return Math.exp(-(d * d) / (2 * 0.45 * 0.45));
}
export function tAt(x: number, z: number) {
  return Math.hypot(x, z) / islandR(Math.atan2(z, x));
}
/* ---------- the land's shape: rolling hills, a rocky ridge, and the pond under its hill ---------- */
// The pond sits in a basin at the foot of a hill on the pond headland; a
// stream runs off the hilltop and drops into it as a small waterfall.
export const POND_C = pointAt(POND_A, 0.4);
export const POND_R = 2.4, POND_LEVEL = 0.72; // water radius, and the basin floor (the water sits a little above)
export const HILL_C = pointAt(POND_A, 0.58);
const HILL_H = 4.2, HILL_S = 3.0;
const RIDGE_C = pointAt(ROCKS_A, 0.62);
const bump = (x: number, z: number, c: Pt, s: number) => Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * s * s));

export function height(x: number, z: number) {
  const t = tAt(x, z);
  let h: number;
  if (t < 0.6) h = 0.8 + 0.18 * (1 - t / 0.6);
  else if (t < 1.02) h = lerp(0.8, 0.02, smooth((t - 0.6) / 0.42));
  else h = 0.02 - Math.min(2.4, (t - 1.02) * 7);
  if (t < 0.95) h += 0.05 * Math.sin(x * 1.3) * Math.cos(z * 1.1) * (1 - smooth((t - 0.8) / 0.15));
  // gentle rolling hills inland, fading out towards the camp (kept flat) and the beaches
  const inland = smooth((Math.hypot(x, z) - 11) / 7) * (1 - smooth((t - 0.55) / 0.3));
  h += inland * (0.45 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.23 - 0.4) + 0.3 * Math.sin(x * 0.09 - z * 0.12 + 2));
  // a rocky ridge in the stone area, and the pond's hill
  h += 1.3 * bump(x, z, RIDGE_C, 7) * (1 - smooth((t - 0.75) / 0.25));
  h += HILL_H * bump(x, z, HILL_C, HILL_S) * (1 - smooth((t - 0.85) / 0.15));
  // the pond: a flat basin (with a steep bank where it meets the hill)
  const dp = Math.hypot(x - POND_C.x, z - POND_C.z);
  if (dp < POND_R + 1.6) h = lerp(h, POND_LEVEL - (dp < POND_R ? 0.15 : 0), smooth(1 - (dp - POND_R) / 1.6));
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
// Sleeping spots: she lies down on her back with her feet at `spot` and her
// head towards `face` (her body ends up about 1.4 long in that direction).
const shelterDir = dirXZ(SH, FIRE);
export const SHELTER_BED: Spot = { spot: ground(addScaled(SH, shelterDir, 0.65)), face: addScaled(SH, shelterDir, -4) }; // head under the low back of the roof

/* the pond (her spring) out on the north meadow, ringed by berry bushes */
export const SP: Pt = { x: POND_C.x, y: POND_LEVEL, z: POND_C.z };
export const SPRING: Spot = { spot: standNear(SP, POND_R + 0.35), face: SP };
reserve(SP, ...[0, 1.5, 3, 4.5].map(a => V(SP.x + Math.cos(a) * POND_R, SP.z + Math.sin(a) * POND_R)));

/* berry bushes around the camp side of the pond (berry counts live in sim state) */
const toCamp = Math.atan2(-SP.z, -SP.x); // direction from the pond back towards the camp
export const BUSHES = [-1.45, -0.87, -0.29, 0.29, 0.87, 1.45].map(k => {
  const pos = ground(V(SP.x + Math.cos(toCamp + k) * (POND_R + 1.5), SP.z + Math.sin(toCamp + k) * (POND_R + 1.5)));
  reserve(pos);
  return { pos, stand: standNear(pos, 1.0) };
});

/* the waterfall: from the hilltop spring, a stream runs down to the edge of the hill and falls into the pond */
const toHill = dirXZ(SP, HILL_C), hillDist = Math.hypot(HILL_C.x - SP.x, HILL_C.z - SP.z);
export const WATERFALL = {
  source: ground(addScaled(SP, toHill, hillDist - 0.4)), // near the hilltop
  top: ground(addScaled(SP, toHill, POND_R + 1.5)), // where it tips over the bank
  bottom: { ...addScaled(SP, toHill, POND_R - 0.5), y: POND_LEVEL + 0.07 }, // splashing into the pond
};
reserve(WATERFALL.source, WATERFALL.top, ground(addScaled(SP, toHill, (hillDist + POND_R) / 2)));

// clay at the pond's edge between two bushes; a bathhouse could stand just outside the ring of bushes
// (both on the flat camp side: the far side rises into the hill)
export const CLAY_P = ground(V(SP.x + Math.cos(toCamp + 1.16) * (POND_R + 0.6), SP.z + Math.sin(toCamp + 1.16) * (POND_R + 0.6)));
export const CLAY_STAND = standNear(CLAY_P, 0.8);
export const BATH_P = ground(V(SP.x + Math.cos(toCamp - 1.16) * (POND_R + 3.2), SP.z + Math.sin(toCamp - 1.16) * (POND_R + 3.2)));
reserve(CLAY_P, BATH_P);

/* fishing spot on the north beach */
export const FISH_A = Math.PI / 2;
export const FISH: Spot = { spot: ground(pointAt(FISH_A, 0.9)), face: pointAt(FISH_A, 1.4) };
reserve(FISH.spot);

/* where crafted things end up */
export const DRUM_P = ground(V(2.5, -1.5)); // near the fire, so she drums by firelight
export const HAMMOCK_P = ground(V(-0.6, -6.6)); // (clear of where the lodge will stand)
export const JOURNAL_P = copy(SEATS[1].p);
reserve(DRUM_P, HAMMOCK_P);
const hammockDir = dirXZ(HAMMOCK_P, FIRE); // the hammock hangs along this line
export const HAMMOCK_BED: Spot = { spot: ground(addScaled(HAMMOCK_P, hammockDir, 0.7)), face: addScaled(HAMMOCK_P, hammockDir, -4), lift: 0.5 };
// furniture she makes once she's handy enough
export const CHAIR_P = ground(V(1.1, -1.7)); // by the fire, facing it
export const TABLE_P = ground(V(0.9, -2.95)); // next to the chair
export const SHELF_P = ground(V(-1.9, -3.6)); // beside the shelter, for her shells and story boards
reserve(CHAIR_P, TABLE_P, SHELF_P);

/* ---------- the lodge: the shelter rebuilt into a house with three rooms ---------- */
// It stands just behind the old shelter, facing the fire. Local x runs along
// the front (bedroom | living room | kitchen), local z points at the fire.
const lodgeDir = dirXZ(SH, FIRE);
export const LODGE_P = ground(addScaled(SH, lodgeDir, -1.0));
export const LODGE_YAW = yawTo(LODGE_P, FIRE);
export const LODGE_SIZE = { w: 6.6, d: 4.4, h: 2.6 };
/** A point inside the lodge, from lodge-local coordinates. */
export function lodgeLocal(lx: number, lz: number) {
  const c = Math.cos(LODGE_YAW), s = Math.sin(LODGE_YAW);
  return ground(V(LODGE_P.x + lx * c + lz * s, LODGE_P.z - lx * s + lz * c));
}
export const LODGE_DOOR = lodgeLocal(0, 2.9);
export const LODGE_BED: Spot = { spot: lodgeLocal(-2.2, 0.1), face: lodgeLocal(-2.2, -3) }; // feet at the foot of the bed, head on the pillow
export const LODGE_SOFA: Spot = { spot: lodgeLocal(-0.1, -1.25), face: lodgeLocal(-0.1, 2) };
export const LODGE_KITCHEN: Spot = { spot: lodgeLocal(2.2, -0.7), face: lodgeLocal(2.2, -2.2) };
reserve(LODGE_P, lodgeLocal(-2.6, 0), lodgeLocal(2.6, 0));

/* ---------- animals: a fence around the home area, a coop inside it ---------- */
export const FENCE_R = 9.2;
// openings in the fence towards the dock and each headland
export const FENCE_GATES = [Math.PI / 2, FOREST_A, ROCKS_A, POND_A];
export const COOP_P = ground(V(5.0, 3.4));
export const SHEEP_PEN_P = ground(V(-5.6, 4.0)); // where her sheep graze inside the fence
reserve(COOP_P, SHEEP_PEN_P);

/* ---------- things she builds herself (spots are reserved up front so decoration stays clear) ---------- */
export const WOODPILE_P = ground(V(-2.0, 0.6));
export const BARREL_P = ground(V(-3.0, 1.7)); // rain barrel, by the woodpile
reserve(BARREL_P);
// working with clay, and the rare projects only some islands get
export const KILN_P = ground(V(4.6, -3.4));
export const OVEN_P = ground(V(2.6, -4.6));
export const HIVE_P = ground(V(5.2, 6.4));
export const SUNDIAL_P = ground(V(-1.4, 4.6));
export const MOSAIC_P = ground(V(6.6, -0.8));
reserve(KILN_P, OVEN_P, HIVE_P, SUNDIAL_P, MOSAIC_P);
export const SHED_P = ground(V(-5.2, 2.0)); // tool shed, between the woodpile and the sheep pen
reserve(SHED_P);

/* ---------- music: where she plays each instrument ---------- */
// (each spot: where she sits or stands, what she faces, and how high she is)
export type Instrument = 'drum' | 'flute' | 'ukulele' | 'marimba';
export const MARIMBA_P = ground(V(1.3, 2.5)); // by the fire, opposite the log seats
reserve(MARIMBA_P);
// The bandstand: a raised, roofed platform south of the camp; once it's built
// she keeps her instruments there and plays them on it.
export const BANDSTAND_P = ground(V(2.5, -7.0));
export const BANDSTAND_YAW = yawTo(BANDSTAND_P, FIRE);
export const BANDSTAND_FLOOR = 0.35;
reserve(BANDSTAND_P);
/** A point on the bandstand from its own frame (x along the front, z towards the fire). */
export function bandLocal(lx: number, lz: number): Pt {
  const c = Math.cos(BANDSTAND_YAW), s = Math.sin(BANDSTAND_YAW);
  return ground(V(BANDSTAND_P.x + lx * c + lz * s, BANDSTAND_P.z - lx * s + lz * c));
}
// where each instrument stands on the bandstand, and where she plays it from
export const BAND_SPOTS: Record<Instrument, { at: Pt; player: Pt }> = {
  drum: { at: bandLocal(-0.75, 0.25), player: bandLocal(-0.75, 0.03) },
  marimba: { at: bandLocal(0.6, 0.35), player: bandLocal(0.6, -0.03) },
  flute: { at: bandLocal(0.95, -0.95), player: bandLocal(0, -0.1) },
  ukulele: { at: bandLocal(-1.0, -0.9), player: bandLocal(0, -0.4) },
};
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

// a fish trap in the shallows a little way along the beach from the dock (the
// other side from the canoe route)
export const TRAP_A = FISH_A - 0.5;
export const TRAP_P = ground(pointAt(TRAP_A, 1.04));
export const TRAP_STAND = ground(pointAt(TRAP_A, 0.93));
reserve(TRAP_STAND);
// she wades out to spear fish just beside the fishing spot
export const SPEAR_SPOT: Spot = { spot: ground(pointAt(FISH_A - 0.3, 1.01)), face: pointAt(FISH_A - 0.3, 1.5) };
// a houseboat moored on the other side of the dock from the canoe
export const HOUSEBOAT_P = { ...addScaled(V(0, 0), dockDir, fishR * 1.06), y: 0 };
HOUSEBOAT_P.x -= dockPerp.x * 2.3; HOUSEBOAT_P.z -= dockPerp.z * 2.3;
export const HOUSEBOAT_YAW = Math.atan2(dockDir.x, dockDir.z);
export const HOUSEBOAT_BED = { ...addScaled(HOUSEBOAT_P, dockDir, 0.05) }; // feet here, lying back onto the bedroll under the cabin roof

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
// the rabbit warren: a clearing deep in the forest (reserved before the trees are scattered)
export const WARREN_P = ground(pointAt(FOREST_A + 0.08, 0.7));
export const BURROWS = [0, 2.1, 4.2].map(a => ground(V(WARREN_P.x + Math.cos(a) * 1.6, WARREN_P.z + Math.sin(a) * 1.6)));
export const WARREN_STAND = standNear(WARREN_P, 4.2); // where she waits, on the camp side of the clearing
reserve(WARREN_P, ...BURROWS, ...[0.7, 2.8, 4.9].map(a => V(WARREN_P.x + Math.cos(a) * 2.6, WARREN_P.z + Math.sin(a) * 2.6)));
// The first FOREST_START spots start as trees; the rest are open ground at the
// forest's edge (towards camp) where trees can seed themselves over time.
export const FOREST_START = 46;
const deep = scatter(7, FOREST_START, FOREST_A - 0.62, FOREST_A + 0.62, 0.32, 0.86, 2.6, 1.9);
reserve(...deep);
const edge = scatter(23, 24, FOREST_A - 0.75, FOREST_A + 0.75, 0.2, 0.36, 2.6, 2.2);
export const FOREST = [...deep, ...edge].map(pos => ({ pos, stand: standNear(pos, 0.95) }));
reserve(...edge);
// the forest tree closest to camp: the one she'd build a treehouse in (so she never fells it)
export const TREEHOUSE_TREE = FOREST.slice(0, FOREST_START).reduce((b, t, i) => Math.hypot(t.pos.x, t.pos.z) < Math.hypot(FOREST[b].pos.x, FOREST[b].pos.z) ? i : b, 0);
export const TREEHOUSE_P = FOREST[TREEHOUSE_TREE].pos;
export const TREEHOUSE_DECK = 2.3; // platform height
// lying across the deck beside the trunk (not into it)
const thIn = dirXZ(TREEHOUSE_P, V(0, 0)), thSide = { x: -thIn.z, y: 0, z: thIn.x };
const thFeet = ground(addScaled(addScaled(TREEHOUSE_P, thIn, 0.75), thSide, 0.7));
export const TREEHOUSE_BED: Spot = { spot: thFeet, face: addScaled(thFeet, thSide, -3), lift: TREEHOUSE_DECK + 0.1 };
export const BOULDERS = scatter(11, 9, ROCKS_A - 0.42, ROCKS_A + 0.42, 0.45, 0.85, 2.5, 1.8).map(pos => ({ pos, stand: standNear(pos, 1.0) }));
reserve(...BOULDERS.map(b => b.pos));
// where loose stones lie around, in the middle of the rocky area
export const SCREE_P = scatter(13, 1, ROCKS_A - 0.35, ROCKS_A + 0.35, 0.5, 0.75, 0, 1.6)[0];
export const SCREE_STAND = standNear(SCREE_P, 0.6);
reserve(SCREE_P);

/* where she wakes up */
export const START = ground(V(1.4, 2.6));

/* where the wild animals roam until she brings them home: chickens on the
   south meadow, sheep on the pond meadow, all outside the fence */
const outsideFence = (pts: Pt[]) => pts.filter(p => Math.hypot(p.x, p.z) > FENCE_R + 1.2);
export const CHICKEN_HOMES = outsideFence(scatter(17, 8, 0.3, 1.5, 0.48, 0.66, 1.4, 1.6)).slice(0, 4);
export const SHEEP_HOMES = outsideFence(scatter(19, 8, POND_A - 0.55, POND_A + 0.55, 0.5, 0.7, 2.0, 1.8)).slice(0, 3);
reserve(...CHICKEN_HOMES, ...SHEEP_HOMES);
