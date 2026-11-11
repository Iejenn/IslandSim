// v2.2: fewer things to draw. A palm used to be 11 separate meshes and a
// clump of bamboo about 60; every one is a draw call (two, with shadows), and
// on a phone that's what makes the frame rate stutter. fuse() bakes all the
// meshes under a group into one (or one per material), keeping the look.
import { BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// one shared material for everything baked with its colours in the vertices
const baked = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });

/**
 * Merge every mesh under `root` into as few meshes as possible (in place).
 * @param bake true: one mesh, each part's colour baked into its vertices (for things whose
 *   materials never change colour); false: one mesh per material (for leaves the seasons recolour).
 */
export function fuse(root: Object3D, bake = true) {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert(), m = new Matrix4();
  const groups = new Map<Material | null, { geos: BufferGeometry[]; cast: boolean }>();
  const meshes: Mesh[] = [];
  root.traverse(o => {
    const me = o as Mesh, mt = me.material as MeshStandardMaterial;
    // (only plain, opaque, untextured standard materials; anything else stays as it is)
    if (!me.isMesh || Array.isArray(me.material) || !mt.isMeshStandardMaterial || mt.transparent || mt.map || !mt.flatShading) return;
    meshes.push(me);
  });
  if (meshes.length < 2) return root;
  for (const me of meshes) {
    const mt = me.material as MeshStandardMaterial;
    const g = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone();
    g.applyMatrix4(m.multiplyMatrices(inv, me.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (bake) {
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = mt.color.r; col[i * 3 + 1] = mt.color.g; col[i * 3 + 2] = mt.color.b; }
      g.setAttribute('color', new BufferAttribute(col, 3));
    }
    const key = bake ? null : mt, e = groups.get(key) ?? { geos: [], cast: false };
    e.geos.push(g); e.cast ||= me.castShadow;
    groups.set(key, e);
    me.removeFromParent();
    me.geometry.dispose();
  }
  for (const [mt, { geos, cast }] of groups) {
    const out = new Mesh(mergeGeometries(geos), mt ?? baked);
    out.castShadow = cast; out.receiveShadow = true;
    root.add(out);
    for (const g of geos) g.dispose();
  }
  return root;
}

/** Tiny things don't need a shadow of their own (nobody can see a berry's): saves a draw call each. */
export function trimShadows(scene: Object3D, minSize = 0.16) {
  scene.traverse(o => {
    const me = o as Mesh;
    if (!me.isMesh || !me.castShadow || (me as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
    if (!me.geometry.boundingSphere) me.geometry.computeBoundingSphere();
    const s = me.getWorldScale(tmp);
    if (me.geometry.boundingSphere!.radius * Math.max(s.x, s.y, s.z) < minSize) me.castShadow = false;
  });
}
import { Vector3 } from 'three';
const tmp = new Vector3();
