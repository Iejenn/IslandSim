// Traces of the little things she does for joy: stone stacks on the beach, a
// sandcastle (until the tide takes it), wildflowers in a pot on her table,
// wooden animals she whittled, and lanterns along her most-worn paths that
// glow at night.
import { Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, SphereGeometry, type MeshStandardMaterial, type Scene } from 'three';
import { FIRE, ground, pointAt, SEATS, SH, TABLE_P, V } from '../sim/island';
import { PATH_CELL } from '../sim/paths';
import { hour, type SimState } from '../sim/state';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const sand = mat('#E3CC93'), vase = mat('#B8643E'), carved = mat('#C9A06E');
const petals = ['#F2C94C', '#E58FB0', '#F5F1E6', '#B48CD9', '#F08A4B'].map(c => mat(c));
const LANTERNS = 8;

export function createJoys(scene: Scene) {
  /* stone stacks: up to six, each a different little tower */
  const cairns = Array.from({ length: 6 }, (_, i) => {
    const g = new Group();
    let y = 0;
    for (let k = 0; k < 4 + (i % 3); k++) {
      const r = 0.22 - k * 0.03;
      const s = mesh(new DodecahedronGeometry(r, 0), M.rock, (k % 2 ? 0.03 : -0.02), y + r * 0.6, 0);
      s.scale.set(1, 0.5, 1);
      g.add(s);
      y += r * 0.95;
    }
    g.visible = false;
    scene.add(g);
    return g;
  });

  /* a sandcastle: a keep, four towers and a wall */
  const castle = new Group();
  castle.add(mesh(new CylinderGeometry(0.55, 0.6, 0.12, 12), sand, 0, 0.06, 0));
  castle.add(mesh(new CylinderGeometry(0.2, 0.24, 0.45, 8), sand, 0, 0.3, 0));
  castle.add(mesh(new ConeGeometry(0.2, 0.2, 8), sand, 0, 0.62, 0));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4;
    castle.add(mesh(new CylinderGeometry(0.1, 0.12, 0.28, 7), sand, Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4));
  }
  castle.visible = false;
  scene.add(castle);

  /* flowers in a clay pot, on her table (or by the shelter) */
  const bouquet = new Group();
  bouquet.add(mesh(new CylinderGeometry(0.08, 0.06, 0.16, 8), vase, 0, 0.08, 0));
  const heads = Array.from({ length: 7 }, (_, i) => {
    const a = i * 2.4, r = i ? 0.07 : 0;
    const stem = mesh(new CylinderGeometry(0.006, 0.006, 0.22, 3), M.leaf, Math.cos(a) * r * 0.5, 0.25, Math.sin(a) * r * 0.5, false);
    const h = mesh(new SphereGeometry(0.035, 5, 4), petals[i % petals.length], Math.cos(a) * r, 0.36 + (i % 3) * 0.02, Math.sin(a) * r, false);
    bouquet.add(stem, h);
    return h;
  });
  bouquet.visible = false;
  scene.add(bouquet);

  /* wooden animals by her fire seat */
  const seat = SEATS[0].p;
  const carvings = Array.from({ length: 6 }, (_, i) => {
    const g = new Group();
    g.add(mesh(new SphereGeometry(0.05, 5, 4), carved, 0, 0.05, 0));
    g.add(mesh(new SphereGeometry(0.03, 5, 4), carved, 0, 0.09, 0.04));
    const out = ground(V(seat.x + 0.75 + (i % 3) * 0.14, seat.z - 0.45 + Math.floor(i / 3) * 0.14));
    g.position.copy(v3(out));
    g.rotation.y = i * 1.3;
    g.visible = false;
    scene.add(g);
    return g;
  });

  /* lanterns on posts beside her busiest paths */
  const glow = mat('#FFD27A', { emissive: new Color('#FFB347'), emissiveIntensity: 0 }) as MeshStandardMaterial;
  const lanterns = Array.from({ length: LANTERNS }, () => {
    const g = new Group();
    g.add(mesh(new CylinderGeometry(0.03, 0.035, 1.1, 5), M.log, 0, 0.55, 0));
    g.add(mesh(new CylinderGeometry(0.09, 0.07, 0.16, 6), glow, 0, 1.15, 0, false));
    g.add(mesh(new ConeGeometry(0.11, 0.08, 6), M.log, 0, 1.27, 0));
    g.visible = false;
    scene.add(g);
    return g;
  });
  let lanternKey = '';
  cairns.forEach(g => pickable(g, () => ({ title: 'A stack of stones', lines: ['She balanced these herself', 'Storms sometimes knock them over'] })));
  pickable(castle, () => ({ title: 'A sandcastle', lines: ['The tide will take it by tomorrow'] }));
  pickable(bouquet, S => ({ title: 'Wildflowers', lines: [S.min - S.bouquetAt > 2 * 1440 ? 'Starting to wilt' : 'Freshly picked'] }));
  carvings.forEach(g => pickable(g, () => ({ title: 'A little wooden animal', lines: ['She whittled it by the fire'] })));
  lanterns.forEach(l => pickable(l, () => ({ title: 'A path lantern', lines: ['Lights her way home at night'] })));
  /** Pick spots beside the most-worn path cells, spread out, not right at the fire. */
  function placeLanterns(S: SimState) {
    const cells = Object.entries(S.wear).filter(([, w]) => w > 0.45).sort((a, b) => b[1] - a[1]).map(([k]) => k.split(',').map(Number));
    const chosen: { x: number; z: number }[] = [];
    for (const [cx, cz] of cells) {
      const x = (cx + 0.5) * PATH_CELL + 0.6, z = (cz + 0.5) * PATH_CELL + 0.3;
      if (Math.hypot(x - FIRE.x, z - FIRE.z) < 3.5 || chosen.some(c => Math.hypot(c.x - x, c.z - z) < 4)) continue;
      chosen.push({ x, z });
      if (chosen.length === LANTERNS) break;
    }
    lanterns.forEach((l, i) => {
      const c = chosen[i];
      l.visible = !!c;
      if (c) l.position.copy(v3(ground(V(c.x, c.z))));
    });
  }

  return function updateJoys(S: SimState) {
    cairns.forEach((g, i) => {
      const a = S.cairns[i];
      g.visible = a !== undefined;
      if (g.visible) g.position.copy(v3(ground(pointAt(a, 0.83))));
    });
    castle.visible = !!S.sandcastle;
    if (S.sandcastle) {
      castle.position.copy(v3(ground(pointAt(S.sandcastle.a, 0.9))));
      // the tide wears it down over the day
      castle.scale.setScalar(1 - 0.6 * Math.min(1, (S.min - S.sandcastle.at) / (18 * 60)));
    }
    const age = S.min - S.bouquetAt;
    bouquet.visible = S.bouquetAt > 0 && age < 3 * 1440;
    if (bouquet.visible) {
      const at = S.items.table ? TABLE_P : SH;
      bouquet.position.set(at.x + 0.25, at.y + (S.items.table ? 0.73 : 0), at.z + (S.items.table ? -0.1 : 0.9));
      heads.forEach(h => { h.scale.setScalar(age > 2 * 1440 ? 0.7 : 1); h.position.y = age > 2 * 1440 ? 0.3 : 0.36; }); // wilting
    }
    carvings.forEach((g, i) => { g.visible = i < S.carvings; });

    if (S.items.lanterns) {
      const key = `${Math.floor(S.min / 1440)}`; // move them at most once a day, as her paths change
      if (key !== lanternKey) { lanternKey = key; placeLanterns(S); }
      const h = hour();
      glow.emissiveIntensity = h >= 19.5 || h < 6 ? 2.2 : 0;
    } else lanterns.forEach(l => { l.visible = false; });
  };
}
