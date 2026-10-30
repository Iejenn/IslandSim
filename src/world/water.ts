// Animated sea plane (vertex waves).
import { Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';

export function createWater(scene: Scene) {
  const wg = new PlaneGeometry(320, 320, 72, 72);
  wg.rotateX(-Math.PI / 2);
  const wBase = wg.attributes.position.array.slice();
  const water = new Mesh(wg, new MeshStandardMaterial({ color: '#2FA3B5', transparent: true, opacity: 0.8, roughness: 0.3, metalness: 0.1, flatShading: true }));
  water.position.y = 0.12;
  water.receiveShadow = true;
  scene.add(water);

  /** @param t real seconds since start */
  return function animateWater(t: number) {
    const a = wg.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = wBase[i], z = wBase[i + 2];
      a[i + 1] = 0.07 * Math.sin(x * 0.35 + t * 1.1) + 0.05 * Math.cos(z * 0.4 + t * 0.8);
    }
    wg.attributes.position.needsUpdate = true;
    wg.computeVertexNormals();
  };
}
