// Small math helpers shared by the sim and the world builders.
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/**
 * Copy saved values over fresh defaults, recursing into plain objects, so a
 * save from an older version still gets any fields added since.
 */
export function mergeInto(target: Record<string, unknown>, src: Record<string, unknown>) {
  for (const k of Object.keys(src)) {
    const t = target[k], v = src[k];
    const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
    if (isObj(t) && isObj(v)) mergeInto(t, v);
    else if (v !== undefined) target[k] = v;
  }
}
export const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
