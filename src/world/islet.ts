// The bamboo islet out in the bay: clumps of tall canes (fewer while she's
// been cutting, growing back fast), swaying in the wind, and a couple of palms.
import { ConeGeometry, CylinderGeometry, Group, type Object3D, type Scene } from 'three';
import { BAMBOO, ground, ISLET_C, ISLET_R, V } from '../sim/island';
import type { SimState } from '../sim/state';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';

const caneMat = mat('#A9B85A'), nodeMat = mat('#7D8A3A'), bambooLeaf = mat('#6FA34A');

export function createIslet(scene: Scene) {
  const clumps = BAMBOO.map((b, ci) => {
    const g = new Group();
    g.position.set(b.pos.x, b.pos.y - 0.05, b.pos.z);
    const canes: Object3D[] = [];
    for (let i = 0; i < 6; i++) {
      const cane = new Group(), h = 2.6 + ((i * 7 + ci * 3) % 5) * 0.25, a = i * 1.05 + ci, r = 0.12 + (i % 3) * 0.1;
      cane.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      cane.rotation.set((i % 2 ? 1 : -1) * 0.06, 0, ((i * 3) % 5 - 2) * 0.04); // leaning every which way
      cane.add(mesh(new CylinderGeometry(0.045, 0.06, h, 6), caneMat, 0, h / 2, 0));
      for (let y = 0.5; y < h; y += 0.55) cane.add(mesh(new CylinderGeometry(0.06, 0.06, 0.04, 6), nodeMat, 0, y, 0));
      for (let k = 0; k < 4; k++) {
        const leaf = mesh(new ConeGeometry(0.08, 0.6, 3), bambooLeaf, 0, h - 0.2 - k * 0.3, 0);
        leaf.rotation.set(0, k * 1.7, -1.1); leaf.position.x = Math.cos(k * 1.7) * 0.2; leaf.position.z = -Math.sin(k * 1.7) * 0.2;
        cane.add(leaf);
      }
      g.add(cane);
      canes.push(cane);
    }
    scene.add(g);
    pickable(g, S => ({ title: 'Bamboo', lines: [S.bamboo[ci] >= 1 ? `${Math.floor(S.bamboo[ci])} canes ready to cut` : 'Cut back; growing again', 'It grows back in days'] }));
    return { g, canes };
  });
  // a couple of palms on the islet's beach (the same shape as the main island's)
  for (const a of [0.8, 3.9]) {
    const p = ground(V(ISLET_C.x + Math.cos(a) * ISLET_R * 0.75, ISLET_C.z + Math.sin(a) * ISLET_R * 0.75));
    const trunk = mesh(new CylinderGeometry(0.1, 0.14, 3, 6), M.trunk, p.x, p.y + 1.5, p.z);
    trunk.rotation.z = 0.15;
    scene.add(trunk);
    for (let k = 0; k < 6; k++) {
      const leaf = mesh(new ConeGeometry(0.3, 2, 4), k % 2 ? M.leaf : M.leaf2, 0, 0, 0);
      leaf.scale.set(0.35, 1, 1);
      const arm = new Group();
      arm.position.set(p.x + 0.22, p.y + 3, p.z);
      arm.rotation.set(0, k * 1.05, -1.9);
      leaf.position.y = 1;
      arm.add(leaf);
      scene.add(arm);
    }
  }

  /** @param t real seconds (sway) */
  return function updateIslet(S: SimState, t: number, wind: number) {
    clumps.forEach(({ canes }, ci) => {
      const n = Math.floor(S.bamboo[ci] ?? 0);
      canes.forEach((c, i) => {
        c.visible = i < n;
        c.rotation.x = (i % 2 ? 1 : -1) * 0.06 + (0.03 + 0.08 * wind) * Math.sin(t * 1.3 + i + ci);
      });
    });
  };
}
