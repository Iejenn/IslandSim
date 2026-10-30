// Things she has crafted, shown where she keeps them: tools lean against the
// woodpile, the rod against the shelter, the drum by the fire and so on.
// Everything is built up front (hidden) and shown once the sim says she has it.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, TorusGeometry, type Object3D, type Scene } from 'three';
import { KILN_P, BURROWS, WARREN_P, CHAIR_P, FIRE, LODGE_YAW, lodgeLocal, GARDEN_P, ground, HAMMOCK_P, JOURNAL_P, DRUM_P, LOOKOUT_DECK, LOOKOUT_P, SH, SHELF_P, TABLE_P, WOODPILE_P, yawTo } from '../sim/island';
import type { CraftKey, SimState } from '../sim/state';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const potMat = mat('#B8643E');
const SEATS_JUG = { x: -0.9, z: 2.3 }; // beside the log seat by the fire
const wool = M.cushion, fibre = mat('#B9A26A'), stone = mat('#8E979B'), hide = mat('#E3D3B0', { roughness: 0.7 }), tin = mat('#9C7A52');

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

/** A sharpened pole with a stone tip, built pointing up from the origin. */
export function spearModel() {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.022, 0.028, 1.7, 5), M.log, 0, 0.85, 0));
  g.add(mesh(new ConeGeometry(0.045, 0.2, 4), stone, 0, 1.8, 0));
  g.add(mesh(new TorusGeometry(0.03, 0.01, 4, 8), fibre, 0, 1.68, 0)); // lashing
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
      g.add(mesh(cg, M.hammock, 0, 0.95, 0));
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
    spear() {
      const g = spearModel();
      g.rotation.z = -0.3; // leaning against the shelter
      const holder = new Group();
      holder.add(g);
      return place(holder, SH.x + 1.9, SH.z + 0.1);
    },
    snare() {
      // three little loops on stakes by the burrows
      const g = new Group();
      for (const b of BURROWS) {
        const s = new Group();
        s.position.set(b.x - WARREN_P.x, b.y - WARREN_P.y, b.z - WARREN_P.z + 0.45);
        s.add(mesh(new CylinderGeometry(0.015, 0.015, 0.3, 4), M.log, 0, 0.15, 0));
        const loop = mesh(new TorusGeometry(0.09, 0.008, 4, 10), fibre, 0, 0.12, 0.1);
        s.add(loop);
        g.add(s);
      }
      return place(g, WARREN_P.x, WARREN_P.z);
    },
    /* ---------- fired in the kiln ---------- */
    pots() {
      const g = new Group();
      [[0, 0, 0.22], [0.32, 0.1, 0.17], [-0.28, 0.12, 0.19]].forEach(([x, z, r]) => {
        g.add(mesh(new SphereGeometry(r, 8, 6), potMat, x, r * 0.9, z));
        g.add(mesh(new CylinderGeometry(r * 0.45, r * 0.5, r * 0.4, 8), potMat, x, r * 1.8, z));
      });
      return place(g, WOODPILE_P.x - 0.4, WOODPILE_P.z - 1.0);
    },
    jug() {
      const g = new Group();
      g.add(mesh(new SphereGeometry(0.2, 8, 6), potMat, 0, 0.2, 0));
      g.add(mesh(new CylinderGeometry(0.07, 0.1, 0.22, 8), potMat, 0, 0.45, 0));
      const handle = mesh(new TorusGeometry(0.09, 0.02, 4, 8, Math.PI), potMat, 0.17, 0.35, 0);
      handle.rotation.z = -Math.PI / 2;
      g.add(handle);
      const p = SEATS_JUG;
      return place(g, p.x, p.z);
    },
    tiles() {
      // a few spare tiles stacked by the kiln (the rest are on the roof)
      const g = new Group();
      for (let i = 0; i < 4; i++) g.add(mesh(new BoxGeometry(0.35, 0.04, 0.25), potMat, 0, 0.03 + i * 0.045, 0));
      return place(g, KILN_P.x - 1.1, KILN_P.z + 0.5);
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

    /* ---------- furniture ---------- */
    chair() {
      const g = new Group();
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.42, 5), M.log, x, 0.21, z));
      g.add(mesh(new BoxGeometry(0.52, 0.05, 0.48), M.wood, 0, 0.44, 0)); // seat
      g.add(mesh(new BoxGeometry(0.52, 0.5, 0.05), M.wood, 0, 0.72, -0.24)); // back, away from the fire
      return place(g, CHAIR_P.x, CHAIR_P.z, yawTo(CHAIR_P, FIRE));
    },
    table() {
      const g = new Group();
      for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.68, 5), M.log, x, 0.34, z));
      g.add(mesh(new BoxGeometry(1.1, 0.06, 0.75), M.wood, 0, 0.7, 0));
      g.add(mesh(new CylinderGeometry(0.12, 0.08, 0.06, 8), tin, 0.15, 0.76, 0.05)); // a bowl
      return place(g, TABLE_P.x, TABLE_P.z, yawTo(TABLE_P, FIRE));
    },
    bed() {
      // a raised frame under her sleeping mat, inside the shelter
      const g = new Group();
      for (const [x, z] of [[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]]) g.add(mesh(new BoxGeometry(0.08, 0.2, 0.08), M.log, x, 0.1, z));
      for (const z of [-0.47, 0.47]) g.add(mesh(new BoxGeometry(1.6, 0.08, 0.06), M.log, 0, 0.16, z));
      for (const x of [-0.77, 0.77]) g.add(mesh(new BoxGeometry(0.06, 0.08, 1.0), M.log, x, 0.16, 0));
      return place(g, SH.x, SH.z, yawTo(SH, FIRE));
    },
    shelf() {
      const g = new Group();
      for (const x of [-0.5, 0.5]) g.add(mesh(new BoxGeometry(0.06, 1.0, 0.3), M.log, x, 0.5, 0));
      for (const y of [0.35, 0.75]) g.add(mesh(new BoxGeometry(1.06, 0.04, 0.3), M.wood, 0, y, 0));
      return place(g, SHELF_P.x, SHELF_P.z, yawTo(SHELF_P, FIRE));
    },
    /* ---------- in the lodge ---------- */
    realbed() {
      const g = new Group();
      g.add(mesh(new BoxGeometry(1.5, 0.3, 2.1), M.log, 0, 0.15, 0)); // frame
      g.add(mesh(new BoxGeometry(1.4, 0.16, 2.0), wool, 0, 0.38, 0)); // wool mattress
      g.add(mesh(new BoxGeometry(0.9, 0.12, 0.35), wool, 0, 0.5, -0.78)); // pillow
      g.add(mesh(new BoxGeometry(1.5, 0.8, 0.1), M.log, 0, 0.4, -1.05)); // headboard
      const p = lodgeLocal(-2.2, -0.9);
      return place(g, p.x, p.z, LODGE_YAW);
    },
    sofa() {
      const g = new Group();
      g.add(mesh(new BoxGeometry(1.6, 0.4, 0.75), M.log, 0, 0.2, 0));
      g.add(mesh(new BoxGeometry(1.5, 0.14, 0.65), wool, 0, 0.46, 0.03)); // cushion
      g.add(mesh(new BoxGeometry(1.6, 0.55, 0.18), wool, 0, 0.67, -0.3)); // back
      for (const x of [-0.78, 0.78]) g.add(mesh(new BoxGeometry(0.14, 0.55, 0.75), M.log, x, 0.42, 0)); // arms
      const p = lodgeLocal(-0.1, -1.55);
      return place(g, p.x, p.z, LODGE_YAW);
    },
    kitchen() {
      const g = new Group();
      g.add(mesh(new BoxGeometry(0.9, 0.85, 0.7), M.rock, -0.45, 0.42, 0)); // stone stove
      g.add(mesh(new BoxGeometry(0.5, 0.05, 0.4), M.ebony, -0.45, 0.87, 0)); // hotplate
      g.add(mesh(new BoxGeometry(0.9, 0.85, 0.7), M.wood, 0.5, 0.42, 0)); // counter
      g.add(mesh(new CylinderGeometry(0.14, 0.11, 0.18, 8), tin, 0.45, 0.94, 0.05)); // a pot
      const p = lodgeLocal(2.2, -1.75);
      return place(g, p.x, p.z, LODGE_YAW);
    },
    blanket() {
      const g = new Group();
      g.add(mesh(new BoxGeometry(1.2, 0.05, 1.1), M.blanket, 0, 0, 0));
      g.add(mesh(new BoxGeometry(1.2, 0.051, 0.12), M.blanketStripe, 0, 0, 0.3)); // stripe
      return place(g, SH.x, SH.z, yawTo(SH, FIRE));
    },
    sweater() {
      return place(new Group(), 0, 0); // she wears it; nothing to show around camp
    },
    rocker() {
      // on the lookout platform, facing out to sea
      const g = new Group();
      for (const x of [-0.22, 0.22]) {
        const runner = mesh(new TorusGeometry(0.5, 0.025, 4, 12, 1.2), M.log, x, 0.5, 0);
        runner.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.6);
        runner.rotation.order = 'YXZ';
        g.add(runner);
        g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.4, 5), M.log, x, 0.25, 0.15));
        g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.4, 5), M.log, x, 0.25, -0.15));
      }
      g.add(mesh(new BoxGeometry(0.5, 0.05, 0.45), M.wood, 0, 0.44, 0));
      g.add(mesh(new BoxGeometry(0.5, 0.55, 0.05), M.wood, 0, 0.74, -0.22));
      place(g, LOOKOUT_P.x, LOOKOUT_P.z, yawTo(FIRE, LOOKOUT_P));
      g.position.y += LOOKOUT_DECK;
      return g;
    },
  };
  // shells on the shelf: one per shell in her collection
  const shells = Array.from({ length: 8 }, (_, i) => {
    const sh = mesh(new ConeGeometry(0.05, 0.08, 6), i % 2 ? mat('#F2D8C9') : mat('#E9B8A0'), -0.4 + (i % 4) * 0.25, i < 4 ? 0.41 : 0.81, 0.02, false);
    sh.rotation.x = Math.PI / 2;
    return sh;
  });
  const models = {} as Record<CraftKey, Object3D>;
  for (const k of Object.keys(BUILD) as CraftKey[]) models[k] = BUILD[k]();
  shells.forEach(sh => models.shelf.add(sh));

  /**
   * Show what she owns. Tools in her hands (see character/heldTools.ts) are
   * hidden from where they're normally kept.
   */
  return function updateCrafted(S: SimState, held: CraftKey | null) {
    for (const k of Object.keys(models) as CraftKey[]) models[k].visible = !!S.items[k] && k !== held;
    // moving house: once the lodge stands, the shelf comes inside, the old bed frame goes with the shelter,
    // and the blanket lies on whichever bed she's using
    const lodge = S.projects.lodge.done;
    if (lodge) {
      models.bed.visible = false;
      const shelfIn = lodgeLocal(0.6, -1.95);
      models.shelf.position.set(shelfIn.x, shelfIn.y, shelfIn.z);
      models.shelf.rotation.y = LODGE_YAW;
      const b = lodgeLocal(-2.2, -0.6);
      models.blanket.position.set(b.x, b.y + (S.items.realbed ? 0.5 : 0.2), b.z);
      models.blanket.rotation.y = LODGE_YAW;
    } else {
      models.blanket.position.set(SH.x, SH.y + (S.items.bed ? 0.25 : 0.12), SH.z);
    }
    shells.forEach((sh, i) => { sh.visible = i < S.stock.shells; });
  };
}
