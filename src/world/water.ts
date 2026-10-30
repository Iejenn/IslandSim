// Animated sea plane (vertex waves), riding on the tide. The swell calms down
// near the island, so the water's edge only creeps up and down the beach a
// little instead of sliding metres back and forth.
import { Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import { islandR } from '../sim/island';
import { seaLevel } from '../sim/tide';
import { clamp } from '../sim/util';

/** How much of the open-sea swell is left at (x, z): 0.35 on the beach, the full swell ~12 units out. */
export function swellDamp(x: number, z: number) {
  const out = Math.hypot(x, z) - islandR(Math.atan2(z, x));
  const k = clamp(out / 12, 0, 1);
  return 0.35 + 0.65 * k * k * (3 - 2 * k);
}
/** The swell's height at (x, z) at time t (add seaLevel() for the water surface). */
export const swell = (x: number, z: number, t: number, damp = swellDamp(x, z)) =>
  damp * (0.07 * Math.sin(x * 0.35 + t * 1.1) + 0.05 * Math.cos(z * 0.4 + t * 0.8));

export function createWater(scene: Scene) {
  const wg = new PlaneGeometry(320, 320, 72, 72);
  wg.rotateX(-Math.PI / 2);
  const wBase = wg.attributes.position.array.slice();
  const damp = new Float32Array(wBase.length / 3).map((_, i) => swellDamp(wBase[i * 3], wBase[i * 3 + 2]));
  const water = new Mesh(wg, new MeshStandardMaterial({ color: '#2FA3B5', transparent: true, opacity: 0.8, roughness: 0.3, metalness: 0.1, flatShading: true }));
  water.position.y = 0.12;
  water.receiveShadow = true;
  scene.add(water);

  /** @param t real seconds since start */
  return function animateWater(t: number) {
    water.position.y = seaLevel(); // (the tide)
    const a = wg.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) a[i + 1] = swell(wBase[i], wBase[i + 2], t, damp[i / 3]);
    wg.attributes.position.needsUpdate = true;
    wg.computeVertexNormals();
  };
}
