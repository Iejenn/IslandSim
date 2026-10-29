// Browser save: the sim state plus the seed that scattered the island's
// palms and rocks, kept in localStorage so a refresh continues the same life.
const KEY = 'islandsim.save';
// Bump when a change makes old saves unusable; older saves are then ignored
// and a new island starts. (Adding fields does NOT need a bump: missing
// fields are filled with defaults on load.)
const VERSION = 2; // 2: gifts replaced by crafting, forest and rocks

export interface SaveFile { v: number; seed: number; savedAt: number; state: Record<string, unknown> }

export function readSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveFile;
    if (d?.v !== VERSION || typeof d.seed !== 'number' || !d.state || typeof d.state !== 'object') return null;
    return d;
  } catch {
    return null; // storage blocked (private mode) or corrupt: just start fresh
  }
}

export function writeSave(seed: number, state: Record<string, unknown>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, seed, savedAt: Date.now(), state } satisfies SaveFile));
  } catch { /* storage full or blocked: the game keeps running unsaved */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
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
