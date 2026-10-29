// The forest she cuts and replants, and the rocky area she mines. Each forest
// tree has a full tree, a stump and a sapling model; the sim's state picks
// which one shows. Boulders shrink as she breaks stones off them.
import { CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry, type Mesh, type Scene } from 'three';
import { BOULDERS, FOREST, SCREE_P, TREEHOUSE_TREE } from '../sim/island';
import type { SimState } from '../sim/state';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const stumpTop = mat('#C9A27A'), boulderMat = mat('#8C9599'), pebble = mat('#A3ABAE');

export function createForest(scene: Scene) {
  // a fixed per-tree variation, so the forest doesn't look cloned
  const vary = (i: number) => 0.85 + ((i * 37) % 10) / 30;
  const trees = FOREST.map(({ pos }, i) => {
    const s = vary(i), yaw = i * 1.7;
    const full = new Group();
    full.add(mesh(new CylinderGeometry(0.13, 0.2, 1.8, 6), M.trunk, 0, 0.9, 0));
    full.add(mesh(new IcosahedronGeometry(1.15, 0), i % 2 ? M.leaf : M.leaf2, 0, 2.4, 0));
    full.add(mesh(new IcosahedronGeometry(0.8, 0), i % 2 ? M.leaf2 : M.leaf, 0.45, 3.0, 0.2));
    full.scale.setScalar(s);
    const stump = new Group();
    stump.add(mesh(new CylinderGeometry(0.2, 0.24, 0.3, 7), M.trunk, 0, 0.15, 0));
    stump.add(mesh(new CylinderGeometry(0.19, 0.19, 0.02, 7), stumpTop, 0, 0.31, 0));
    const sapling = new Group();
    sapling.add(mesh(new CylinderGeometry(0.03, 0.05, 0.6, 5), M.trunk, 0, 0.3, 0));
    sapling.add(mesh(new IcosahedronGeometry(0.3, 0), M.leaf, 0, 0.7, 0));
    for (const g of [full, stump, sapling]) {
      g.position.copy(v3(pos));
      g.rotation.y = yaw;
      scene.add(g);
    }
    return { full, stump, sapling, s };
  });

  const boulders = BOULDERS.map(({ pos }, i) => {
    const b = mesh(new DodecahedronGeometry(0.75, 0), boulderMat);
    b.position.copy(v3(pos));
    b.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    scene.add(b);
    return b;
  });

  // loose stones lying around the rocky area (one per stone in the pool)
  const scree: Mesh[] = Array.from({ length: 10 }, (_, i) => {
    const a = i * 2.4, r = 0.25 + (i % 4) * 0.18;
    const p = mesh(new DodecahedronGeometry(0.09 + (i % 3) * 0.03, 0), pebble, SCREE_P.x + Math.cos(a) * r, SCREE_P.y + 0.05, SCREE_P.z + Math.sin(a) * r);
    scene.add(p);
    return p;
  });

  return function updateForest(S: SimState) {
    trees.forEach(({ full, stump, sapling, s }, i) => {
      const t = S.trees[i];
      full.visible = t.state === 'tree';
      stump.visible = t.state === 'stump';
      sapling.visible = t.state === 'sapling';
      // the treehouse brings its own (taller) version of this tree
      if (i === TREEHOUSE_TREE && S.projects.treehouse.started) full.visible = stump.visible = sapling.visible = false;
      if (t.state === 'sapling') sapling.scale.setScalar(s * (0.5 + 1.5 * t.growth)); // grows into a small tree
    });
    boulders.forEach((b, i) => {
      const left = S.boulders[i];
      b.visible = left > 0;
      b.scale.setScalar(0.45 + 0.55 * left / 8);
    });
    scree.forEach((p, i) => { p.visible = i < Math.floor(S.loose); });
  };
}
