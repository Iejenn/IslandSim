// Wildflowers: they spread around the camp the longer she lives on the
// island, bloom in spring and summer (a few in autumn, none in winter), and
// don't grow on her trodden paths. Drawn as two instanced meshes (stems and
// heads) so hundreds of them cost almost nothing.
import { Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, Object3D, type Scene } from 'three';
import { clearOf, ground, tAt, V, type Pt } from '../sim/island';
import { cellKey } from '../sim/paths';
import { season } from '../sim/seasons';
import type { SimState } from '../sim/state';
import { mat } from './materials';

const N = 260;
const COLOURS = ['#F2C94C', '#F5F1E6', '#E58FB0', '#B48CD9', '#F08A4B', '#7FB3E8'].map(c => new Color(c));
const BLOOM = { spring: 1, summer: 0.75, autumn: 0.2, winter: 0 };

export function createFlowers(scene: Scene) {
  // fixed spots on the grass around camp (a tiny seeded generator, so they don't move between visits)
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spots: { p: Pt; s: number; c: Color; key: string }[] = [];
  for (let tries = 0; spots.length < N && tries < 6000; tries++) {
    const a = rnd() * Math.PI * 2, r = 2.5 + Math.pow(rnd(), 0.7) * 16, p = V(Math.cos(a) * r, Math.sin(a) * r);
    if (tAt(p.x, p.z) > 0.56 || !clearOf(p, 1.1)) continue;
    // little clusters: the next few flowers sit close to this one
    const n = 1 + Math.floor(rnd() * 4), c = COLOURS[Math.floor(rnd() * COLOURS.length)];
    for (let k = 0; k < n && spots.length < N; k++) {
      const q = ground(V(p.x + (rnd() - 0.5) * 0.9, p.z + (rnd() - 0.5) * 0.9));
      if (clearOf(q, 0.9)) spots.push({ p: q, s: 0.7 + rnd() * 0.6, c, key: cellKey(q.x, q.z) });
    }
  }

  const stems = new InstancedMesh(new CylinderGeometry(0.015, 0.018, 0.2, 4).translate(0, 0.1, 0), mat('#4F8A3E'), N);
  const heads = new InstancedMesh(new ConeGeometry(0.11, 0.07, 6).rotateX(Math.PI).translate(0, 0.22, 0), mat('#FFFFFF', { roughness: 0.6 }), N);
  for (const m of [stems, heads]) { m.instanceMatrix.setUsage(DynamicDrawUsage); m.count = 0; m.castShadow = false; scene.add(m); }
  const o = new Object3D(), mtx = new Matrix4();
  let lastKey = '';

  return function updateFlowers(S: SimState) {
    // how many have spread so far, and how many of those are in bloom this season
    const days = S.min / 1440, spread = Math.min(N, Math.floor(12 + days * 5));
    const shown = Math.floor(spread * BLOOM[season()]);
    const key = `${shown}:${S.wearVersion >> 4}`; // (re-check paths every so often, not every step)
    if (key === lastKey) return;
    lastKey = key;
    let n = 0;
    for (let i = 0; i < shown; i++) {
      const f = spots[i];
      if ((S.wear[f.key] ?? 0) > 0.25) continue; // trampled
      o.position.set(f.p.x, f.p.y, f.p.z);
      o.rotation.set(0, i * 2.4, 0);
      o.scale.setScalar(f.s);
      o.updateMatrix();
      mtx.copy(o.matrix);
      stems.setMatrixAt(n, mtx);
      heads.setMatrixAt(n, mtx);
      heads.setColorAt(n, f.c);
      n++;
    }
    stems.count = heads.count = n;
    stems.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  };
}
