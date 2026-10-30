// How the seasons look: forest leaves (fresh green in spring, gold and red in
// autumn, dull in winter), a tint over the whole island's grass and sand, the
// berry bushes, and mushrooms under the forest trees in autumn. Colours blend
// from the previous season over the first days of a new one.
import { Color, ConeGeometry, CylinderGeometry, Group, type Material, type MeshStandardMaterial, type Scene } from 'three';
import { FOREST } from '../sim/island';
import { SEASON_DAYS, SEASONS, seasonIdx, type Season } from '../sim/seasons';
import { dayNum, type SimState } from '../sim/state';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const LOOK: Record<Season, { leaf: string; leaf2: string; ground: string; bush: string }> = {
  spring: { leaf: '#6CBF5C', leaf2: '#55A84E', ground: '#FFFFFF', bush: '#4A9150' },
  summer: { leaf: '#4E9A55', leaf2: '#3E8449', ground: '#FFF7E6', bush: '#3E7F46' },
  autumn: { leaf: '#D9902E', leaf2: '#B8502E', ground: '#EDD9AE', bush: '#6F7A3A' },
  winter: { leaf: '#7D9179', leaf2: '#6B7E6C', ground: '#C8D4D0', bush: '#5B6E5C' },
};
const BLEND_DAYS = 2; // a new season's colours take this long to settle in

export function createSeasons(scene: Scene, terrainMat: Material) {
  const ground = terrainMat as MeshStandardMaterial;
  // mushrooms: a little cluster under every other forest tree, only in autumn
  const capMat = mat('#C2452F'), cap2 = mat('#D9B27A'), stem = mat('#F1EAD8');
  const shrooms = FOREST.filter((_, i) => i % 2 === 0).map(({ pos }, i) => {
    const g = new Group();
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i, r = 0.55 + 0.15 * k;
      g.add(mesh(new CylinderGeometry(0.03, 0.035, 0.12, 5), stem, Math.cos(a) * r, 0.06, Math.sin(a) * r, false));
      g.add(mesh(new ConeGeometry(0.09, 0.07, 6), i % 3 ? capMat : cap2, Math.cos(a) * r, 0.14, Math.sin(a) * r, false));
    }
    g.position.copy(v3(pos));
    g.visible = false;
    scene.add(g);
    return g;
  });

  const a = new Color(), b = new Color();
  const mix = (target: Color, from: string, to: string, t: number) => target.copy(a.set(from)).lerp(b.set(to), t);
  let lastKey = '';

  return function updateSeasons(S: SimState) {
    const day = dayNum(), now = SEASONS[seasonIdx(day)];
    const intoSeason = ((day - 1) % SEASON_DAYS) + (S.min % 1440) / 1440; // days since it began
    const t = Math.min(1, intoSeason / BLEND_DAYS), prev = SEASONS[(seasonIdx(day) + 3) % 4];
    const key = `${now}:${t.toFixed(2)}`;
    if (key !== lastKey) { // only recolour when something changed
      lastKey = key;
      const from = day <= BLEND_DAYS ? LOOK[now] : LOOK[prev]; // (no blending in on day 1)
      mix(M.forestLeaf.color, from.leaf, LOOK[now].leaf, t);
      mix(M.forestLeaf2.color, from.leaf2, LOOK[now].leaf2, t);
      mix(ground.color, from.ground, LOOK[now].ground, t);
      mix(M.bush.color, from.bush, LOOK[now].bush, t);
    }
    const shown = now === 'autumn' ? Math.ceil(S.mushrooms / 6 * shrooms.length) : 0;
    shrooms.forEach((g, i) => { g.visible = i < shown && S.trees[i * 2]?.state === 'tree'; });
  };
}
