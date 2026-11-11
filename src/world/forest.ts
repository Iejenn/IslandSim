// The forest she cuts and replants, and the rocky area she mines. Each forest
// tree has a full tree, a stump and a sapling model; the sim's state picks
// which one shows. Boulders shrink as she breaks stones off them.
import { CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material, type Mesh, type Scene } from 'three';
import { BOULDERS, FOREST, FOREST_START, SCREE_P, TREEHOUSE_TREE } from '../sim/island';
import { pickable } from './inspect';
import type { SimState } from '../sim/state';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const stumpTop = mat('#C9A27A'), boulderMat = mat('#8C9599'), pebble = mat('#A3ABAE');

export function createForest(scene: Scene) {
  // a fixed per-tree variation, so the forest doesn't look cloned
  const vary = (i: number) => 0.85 + ((i * 37) % 10) / 30;
  // v2.2: every tree, stump and sapling in the forest is drawn in nine instanced batches instead of
  // three to seven meshes per tree (that was ~400 draw calls with shadows; now it's 18)
  const N = FOREST.length;
  const batch = (g: BufferGeometry, m: Material) => { const im = new InstancedMesh(g, m, N); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
  const trunk = batch(new CylinderGeometry(0.13, 0.2, 1.8, 6).translate(0, 0.9, 0), M.trunk);
  // (odd and even trees swap the two leaf greens, so each crown part needs a batch per green)
  const bigG = new IcosahedronGeometry(1.15, 0).translate(0, 2.4, 0), smallG = new IcosahedronGeometry(0.8, 0).translate(0.45, 3.0, 0.2);
  const big = [batch(bigG, M.forestLeaf2), batch(bigG, M.forestLeaf)], small = [batch(smallG, M.forestLeaf), batch(smallG, M.forestLeaf2)];
  const stump = batch(new CylinderGeometry(0.2, 0.24, 0.3, 7).translate(0, 0.15, 0), M.trunk), stumpCut = batch(new CylinderGeometry(0.19, 0.19, 0.02, 7).translate(0, 0.31, 0), stumpTop);
  const sapTrunk = batch(new CylinderGeometry(0.03, 0.05, 0.6, 5).translate(0, 0.3, 0), M.trunk), sapLeaf = batch(new IcosahedronGeometry(0.3, 0).translate(0, 0.7, 0), M.forestLeaf);
  const all = [trunk, ...big, ...small, stump, stumpCut, sapTrunk, sapLeaf];
  const mtx = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), sc = new Vector3(), ps = new Vector3(), ZERO = new Matrix4().makeScale(0, 0, 0);
  /** Where tree i stands, at a given size (0 = not shown). */
  const place = (im: InstancedMesh, i: number, size: number) => {
    if (size <= 0) { im.setMatrixAt(i, ZERO); return; }
    const p = FOREST[i].pos;
    im.setMatrixAt(i, mtx.compose(ps.set(p.x, p.y, p.z), q.setFromAxisAngle(up, i * 1.7), sc.setScalar(size)));
  };
  // tap to look: whose tree is it?
  const story = (S: SimState, i = -1) => {
    const t = S.trees[i];
    if (!t || (i === TREEHOUSE_TREE && S.projects.treehouse.started)) return null; // (the treehouse has its own card)
    if (t.state === 'stump') return { title: 'A stump', lines: ['She felled this tree', 'It may sprout again, or she could plant a sapling here'] };
    const planted = t.planted ? `She planted it on day ${t.planted}` : i >= FOREST_START ? 'It seeded itself from the forest nearby' : 'One of the island’s old trees';
    return { title: t.state === 'sapling' ? 'A young tree' : 'A tree', lines: [planted, ...(t.state === 'sapling' ? [`About ${Math.round(t.growth * 100)}% grown`] : [])] };
  };
  for (const im of all) pickable(im, story);
  const shown: string[] = []; // what each tree looked like last time (only changed trees are touched)

  const boulders = BOULDERS.map(({ pos }, i) => {
    const b = mesh(new DodecahedronGeometry(0.75, 0), boulderMat);
    b.position.copy(v3(pos));
    b.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    scene.add(b);
    pickable(b, S => ({ title: 'A boulder', lines: [S.boulders[i] >= 8 ? 'Untouched' : `About ${S.boulders[i]} stones left in it`] }));
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
    let changed = false;
    for (let i = 0; i < N; i++) {
      const t = S.trees[i], s = vary(i);
      // the treehouse brings its own (taller) version of this tree
      const hidden = i === TREEHOUSE_TREE && S.projects.treehouse.started;
      const key = hidden ? 'x' : t.state === 'sapling' ? `s${Math.round(t.growth * 40)}` : t.state;
      if (shown[i] === key) continue;
      shown[i] = key; changed = true;
      const full = !hidden && t.state === 'tree' ? s : 0;
      place(trunk, i, full); place(big[i % 2], i, full); place(big[1 - (i % 2)], i, 0); place(small[i % 2], i, full); place(small[1 - (i % 2)], i, 0);
      const st = !hidden && t.state === 'stump' ? s : 0;
      place(stump, i, st); place(stumpCut, i, st);
      const sap = !hidden && t.state === 'sapling' ? s * (0.5 + 1.5 * t.growth) : 0; // grows into a small tree
      place(sapTrunk, i, sap); place(sapLeaf, i, sap);
    }
    if (changed) for (const im of all) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } // (the sphere is for taps)
    boulders.forEach((b, i) => {
      const left = S.boulders[i];
      b.visible = left > 0;
      b.scale.setScalar(0.45 + 0.55 * left / 8);
    });
    scree.forEach((p, i) => { p.visible = i < Math.floor(S.loose); });
  };
}
