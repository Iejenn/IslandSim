// "Tap to look": world builders register the things you can tap (buildings,
// trees, animals, things she made…) with a function that describes them from
// the sim state. main.ts raycasts on a tap and shows the first hit's card.
import type { Object3D, Raycaster } from 'three';
import type { SimState } from '../sim/state';

export interface Info { title: string; lines: string[] }
type Describe = (S: SimState) => Info | null;

const things = new Map<Object3D, Describe>();
/** Make an object (and everything under it) tappable. */
export function pickable(o: Object3D, describe: Describe) { things.set(o, describe); }

function shown(o: Object3D | null) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** What's under the ray, if it's something with a story. */
export function inspect(ray: Raycaster, S: SimState): Info | null {
  const hits = ray.intersectObjects([...things.keys()].filter(shown), true);
  for (const h of hits) {
    if (!shown(h.object)) continue;
    let o: Object3D | null = h.object;
    while (o && !things.has(o)) o = o.parent;
    const info = o && things.get(o)!(S);
    if (info) return info;
  }
  return null;
}

/* ---------- small helpers for writing the cards ---------- */
export const onDay = (d: number | undefined, verb: string) => d ? `${verb} on day ${d}` : `${verb} a while ago`;
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
