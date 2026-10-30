// Island terrain mesh, shaped by the same height() the sim uses for walking.
import { Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import { BOULDERS, FOREST, FOREST_START, forestness, height, tAt } from '../sim/island';
import { smooth } from '../sim/util';

export function createTerrain(scene: Scene) {
  const g = new PlaneGeometry(200, 200, 300, 300); // big enough for the island (lobes included) plus its shallow shelf
  g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position, cols: number[] = [];
  const g1 = new Color('#62A65A'), g2 = new Color('#4B8D4D'), sand = new Color('#EAD7A4'), wet = new Color('#C8AD78'), deep = new Color('#2C7E86');
  const c = new Color(), gc = new Color();
  // darker forest floor around the forest, grey stony ground around the boulders
  const forestFloor = new Color('#3E7343'), stony = new Color('#9C9B8C');
  const near = (x: number, z: number, pts: { pos: { x: number; z: number } }[], r: number) =>
    pts.reduce((m, p) => Math.max(m, 1 - Math.hypot(p.pos.x - x, p.pos.z - z) / r), 0);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), t0 = tAt(x, z);
    pa.setY(i, height(x, z));
    // colour by a "t" pulled inwards on the forest headland, so the forest stands on grass, not sand
    const t = t0 < 0.97 ? t0 * (1 - 0.2 * forestness(Math.atan2(z, x))) : t0;
    // grass → sand → wet sand → deep water, by distance from the centre
    gc.copy(g1).lerp(g2, 0.5 + 0.5 * Math.sin(x * 0.7 + z * 0.5));
    if (t < 0.97) gc.lerp(forestFloor, 0.75 * smooth(near(x, z, FOREST.slice(0, FOREST_START), 2.6)));
    if (t < 0.6) c.copy(gc);
    else if (t < 0.68) c.copy(gc).lerp(sand, smooth((t - 0.6) / 0.08));
    else if (t < 0.97) c.copy(sand);
    else if (t < 1.1) c.copy(sand).lerp(wet, smooth((t - 0.97) / 0.13));
    else c.copy(wet).lerp(deep, smooth((t - 1.1) / 0.45));
    if (t < 0.97) c.lerp(stony, 0.8 * smooth(near(x, z, BOULDERS, 2.4)));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const terrain = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  // (the material's colour tints the whole island per season, see world/seasons.ts;
  // the geometry's vertex colours get trodden paths painted in, see world/paths.ts)
  return { material: terrain.material, geometry: g, baseColors: Float32Array.from(cols), size: 200, segments: 300 };
}
