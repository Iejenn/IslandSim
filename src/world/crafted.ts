// Things she has crafted, shown where she keeps them: tools lean against the
// woodpile, the rod against the shelter, the drum by the fire and so on.
// Everything is built up front (hidden) and shown once the sim says she has it.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, TorusGeometry, type Object3D, type Scene } from 'three';
import { FIRE, GARDEN_P, ground, HAMMOCK_P, JOURNAL_P, DRUM_P, SH, WOODPILE_P, yawTo } from '../sim/island';
import type { CraftKey, SimState } from '../sim/state';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const fibre = mat('#B9A26A'), stone = mat('#8E979B'), hide = mat('#E3D3B0', { roughness: 0.7 }), tin = mat('#9C7A52');

/** A stone tool head on a wooden handle (axe or pick), standing upright. */
export function toolModel(kind: 'axe' | 'pick') {
  const g = new Group();
  const handle = mesh(new CylinderGeometry(0.025, 0.03, 0.75, 5), M.log, 0, 0.375, 0);
  g.add(handle);
  if (kind === 'axe') {
    const head = mesh(new BoxGeometry(0.2, 0.12, 0.05), stone, 0.08, 0.68, 0);
    g.add(head);
  } else {
    const head = mesh(new ConeGeometry(0.035, 0.42, 4), stone, 0, 0.7, 0);
    head.rotation.z = Math.PI / 2;
    g.add(head);
  }
  g.add(mesh(new TorusGeometry(0.035, 0.012, 4, 8), fibre, 0, 0.62, 0)); // lashing
  return g;
}

export function createCrafted(scene: Scene) {
  const place = (g: Group, x: number, z: number, yaw = 0) => {
    g.position.copy(v3(ground({ x, y: 0, z })));
    g.rotation.y = yaw;
    g.visible = false;
    scene.add(g);
    return g;
  };
  const pileYaw = yawTo(WOODPILE_P, FIRE);

  const BUILD: Record<CraftKey, () => Group> = {
    axe() {
      const g = toolModel('axe');
      g.rotation.z = 0.25; // leaning
      const holder = new Group();
      holder.add(g);
      return place(holder, WOODPILE_P.x + 0.75, WOODPILE_P.z + 0.35, pileYaw);
    },
    pick() {
      const g = toolModel('pick');
      g.rotation.z = -0.25;
      const holder = new Group();
      holder.add(g);
      return place(holder, WOODPILE_P.x - 0.75, WOODPILE_P.z + 0.35, pileYaw);
    },
    rod() {
      const g = new Group();
      const r = mesh(new CylinderGeometry(0.025, 0.04, 2.4, 5), M.rod, 0, 1.1, 0);
      r.rotation.z = 0.35;
      g.add(r);
      g.add(mesh(new TorusGeometry(0.07, 0.015, 4, 10), fibre, 0.18, 0.5, 0)); // coiled line
      return place(g, SH.x + 1.6, SH.z + 0.6);
    },
    basket() {
      const g = new Group();
      g.add(mesh(new CylinderGeometry(0.22, 0.16, 0.24, 9, 1, true), fibre, 0, 0.12, 0));
      g.add(mesh(new CylinderGeometry(0.16, 0.16, 0.02, 9), fibre, 0, 0.01, 0));
      return place(g, WOODPILE_P.x + 0.2, WOODPILE_P.z - 0.8);
    },
    hammock() {
      const g = new Group();
      for (const x of [-1.4, 1.4]) g.add(mesh(new CylinderGeometry(0.08, 0.1, 1.7, 6), M.wood, x, 0.85, 0));
      const cg = new CylinderGeometry(0.5, 0.5, 2.5, 10, 1, true, Math.PI, Math.PI);
      cg.rotateZ(Math.PI / 2);
      g.add(mesh(cg, fibre, 0, 0.95, 0));
      return place(g, HAMMOCK_P.x, HAMMOCK_P.z, yawTo(HAMMOCK_P, FIRE) + Math.PI / 2);
    },
    bucket() {
      const g = new Group();
      g.add(mesh(new CylinderGeometry(0.16, 0.13, 0.3, 8), tin, 0, 0.15, 0));
      const handle = mesh(new TorusGeometry(0.15, 0.012, 4, 10, Math.PI), fibre, 0, 0.3, 0);
      g.add(handle);
      return place(g, GARDEN_P.x + 1.75, GARDEN_P.z - 0.8);
    },
    drum() {
      const g = new Group();
      g.add(mesh(new CylinderGeometry(0.24, 0.2, 0.5, 10), M.log, 0, 0.25, 0));
      g.add(mesh(new CylinderGeometry(0.25, 0.25, 0.03, 10), hide, 0, 0.51, 0));
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, cord = mesh(new BoxGeometry(0.015, 0.45, 0.015), fibre, Math.cos(a) * 0.23, 0.27, Math.sin(a) * 0.23);
        g.add(cord);
      }
      return place(g, DRUM_P.x, DRUM_P.z);
    },
    journal() {
      const g = new Group();
      [0.04, 0.11, 0.18].forEach((y, i) => {
        const b = mesh(new BoxGeometry(0.4, 0.05, 0.28), i % 2 ? M.wood : M.log, 0, y, 0);
        b.rotation.y = i * 0.3;
        g.add(b);
      });
      return place(g, JOURNAL_P.x + 0.7, JOURNAL_P.z + 0.15);
    },
  };
  const models = {} as Record<CraftKey, Object3D>;
  for (const k of Object.keys(BUILD) as CraftKey[]) models[k] = BUILD[k]();

  /**
   * Show what she owns. Tools in her hands (see character/heldTools.ts) are
   * hidden from where they're normally kept.
   */
  return function updateCrafted(S: SimState, held: CraftKey | null) {
    for (const k of Object.keys(models) as CraftKey[]) models[k].visible = !!S.items[k] && k !== held;
  };
}
