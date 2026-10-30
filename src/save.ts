// Browser save: the sim state plus the seed that scattered the island's
// palms and rocks, kept in localStorage so a refresh continues the same life.
// Three save slots, so a few islands can live side by side; the active slot
// is the one the page plays (and saves to). Saves can also be exported as a
// file or a code and imported on another device.
const LEGACY_KEY = 'islandsim.save'; // (before slots: moved into slot 1)
const slotKey = (i: number) => `islandsim.save.${i}`;
const ACTIVE_KEY = 'islandsim.slot';
const SKIP_MENU_KEY = 'islandsim.skipMenu'; // set just before a reload that should go straight into the game
export const SLOTS = 3;
// Bump when a change makes old saves unusable; older saves are then ignored
// and a new island starts. (Adding fields does NOT need a bump: missing
// fields are filled with defaults on load.)
const VERSION = 2; // 2: gifts replaced by crafting, forest and rocks

export interface SaveFile { v: number; seed: number; savedAt: number; state: Record<string, unknown> }

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const del = (k: string) => { try { localStorage.removeItem(k); } catch { /* blocked */ } };

/** Checks that something parsed from storage or an import really is a save we can load. */
function valid(d: unknown): d is SaveFile {
  const f = d as SaveFile;
  return !!f && f.v === VERSION && typeof f.seed === 'number' && !!f.state && typeof f.state === 'object';
}
function parse(raw: string | null) {
  if (!raw) return null;
  try { const d = JSON.parse(raw); return valid(d) ? d : null; } catch { return null; }
}

// move a pre-slots save into slot 1 (once)
const legacy = get(LEGACY_KEY);
if (legacy && !get(slotKey(1))) set(slotKey(1), legacy);
if (legacy) del(LEGACY_KEY);

export const activeSlot = () => { const n = Number(get(ACTIVE_KEY)); return n >= 1 && n <= SLOTS ? n : 1; };
export const setActiveSlot = (i: number) => set(ACTIVE_KEY, String(i));
export const readSlot = (i: number) => parse(get(slotKey(i)));
export const clearSlot = (i: number) => del(slotKey(i));

// The island on screen always saves to the slot it was loaded from, even after
// the menu has picked another slot for the next page load (the unload save
// would otherwise copy this island into the new slot).
const loadedSlot = activeSlot();
let leaving = false; // set once we're reloading on purpose: no more saves from this page
export const readSave = () => readSlot(loadedSlot);
export function writeSave(seed: number, state: Record<string, unknown>) {
  // (storage full or blocked: the game keeps running unsaved)
  if (leaving) return;
  set(slotKey(loadedSlot), JSON.stringify({ v: VERSION, seed, savedAt: Date.now(), state } satisfies SaveFile));
}
export const clearSave = () => clearSlot(loadedSlot);

/** Reload the page into the active slot, skipping the start menu (or back to the menu). */
export function playActiveSlot(skipMenu = true) {
  leaving = true; // (whatever was meant to be saved has been; don't undo a delete or an import on the way out)
  if (skipMenu) try { sessionStorage.setItem(SKIP_MENU_KEY, '1'); } catch { /* the menu just shows again */ }
  location.reload();
}
/** Was this page load asked to skip the menu? (clears the request) */
export function takeSkipMenu() {
  try { const v = sessionStorage.getItem(SKIP_MENU_KEY) === '1'; sessionStorage.removeItem(SKIP_MENU_KEY); return v; } catch { return false; }
}

/* ---------- moving a save between devices ---------- */
/** The raw save text of a slot, for a download or a copied code. */
export const exportSlot = (i: number) => get(slotKey(i));
/** Store a pasted code or an imported file in a slot. Returns false if it isn't a usable save. */
export function importSlot(i: number, text: string) {
  const d = parse(text.trim());
  if (!d) return false;
  return set(slotKey(i), JSON.stringify(d));
}

/** Small seeded random generator (mulberry32). */
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run fn with Math.random replaced by a seeded generator, so the same seed builds the same island. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const real = Math.random;
  Math.random = seeded(seed);
  try { return fn(); } finally { Math.random = real; }
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
