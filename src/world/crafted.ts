// Things she has crafted, shown where she keeps them: tools lean against the
// woodpile, the rod against the shelter, the drum by the fire and so on.
// Everything is built up front (hidden) and shown once the sim says she has it.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, TorusGeometry, type Object3D, type Scene } from 'three';
import { addScaled, BAND_SPOTS, BANDSTAND_FLOOR, BANDSTAND_YAW, dirXZ, MARIMBA_P, SHED_P, V, KILN_P, BURROWS, WARREN_P, CHAIR_P, FIRE, LODGE_YAW, lodgeLocal, GARDEN_P, ground, HAMMOCK_P, JOURNAL_P, DRUM_P, LOOKOUT_DECK, LOOKOUT_P, SH, SHELF_P, TABLE_P, WOODPILE_P, yawTo } from '../sim/island';
import { PLANS } from '../sim/plans';
import type { CraftKey, SimState, Style } from '../sim/state';
import { cap, onDay, pickable } from './inspect';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const potMat = mat('#B8643E');
const SEATS_JUG = { x: -0.9, z: 2.3 }; // beside the log seat by the fire
// (tool heads share one material, so flint tools can darken them all, in her hands too)
export const toolHead = mat('#8E979B');
const wool = M.cushion, fibre = mat('#B9A26A'), stone = mat('#8E979B'), hide = mat('#E3D3B0', { roughness: 0.7 }), tin = mat('#9C7A52');

/** A stone tool head on a wooden handle (axe or pick), standing upright. */
export function toolModel(kind: 'axe' | 'pick') {
  const g = new Group();
  const handle = mesh(new CylinderGeometry(0.025, 0.03, 0.75, 5), M.log, 0, 0.375, 0);
  g.add(handle);
  if (kind === 'axe') {
    const head = mesh(new BoxGeometry(0.2, 0.12, 0.05), toolHead, 0.08, 0.68, 0);
    g.add(head);
  } else {
    const head = mesh(new ConeGeometry(0.035, 0.42, 4), toolHead, 0, 0.7, 0);
    head.rotation.z = Math.PI / 2;
    g.add(head);
  }
  g.add(mesh(new TorusGeometry(0.035, 0.012, 4, 8), fibre, 0, 0.62, 0)); // lashing
  return g;
}

/* ---------- furniture in three styles: wood, bamboo or stone ---------- */
const bambooCane = mat('#C9B26B'), rockMat = M.rock;
/** A bamboo cane from a to b (both [x, y, z]). */
function cane(g: Group, r: number, a: number[], b: number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz);
  const c = mesh(new CylinderGeometry(r, r, l, 6), bambooCane, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  c.lookAt(c.position.x + dx, c.position.y + dy, c.position.z + dz);
  c.rotateX(Math.PI / 2);
  g.add(c);
}
const FURNITURE: Record<'chair' | 'table' | 'bed' | 'shelf', Record<Style, (g: Group) => void>> = {
  chair: {
    wood(g) {
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.42, 5), M.log, x, 0.21, z));
      g.add(mesh(new BoxGeometry(0.52, 0.05, 0.48), M.wood, 0, 0.44, 0)); // seat
      g.add(mesh(new BoxGeometry(0.52, 0.5, 0.05), M.wood, 0, 0.72, -0.24)); // back, away from the fire
    },
    bamboo(g) {
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) cane(g, 0.03, [x, 0, z], [x, 0.44, z]);
      for (let i = 0; i < 6; i++) cane(g, 0.035, [-0.26, 0.45, -0.2 + i * 0.08], [0.26, 0.45, -0.2 + i * 0.08]); // slatted seat
      for (const x of [-0.22, 0.22]) cane(g, 0.03, [x, 0.44, -0.24], [x, 0.98, -0.27]);
      for (const y of [0.62, 0.78, 0.94]) cane(g, 0.025, [-0.24, y, -0.25], [0.24, y, -0.26]);
    },
    stone(g) {
      g.add(mesh(new BoxGeometry(0.55, 0.42, 0.48), rockMat, 0, 0.21, 0)); // a stone seat
      g.add(mesh(new BoxGeometry(0.55, 0.5, 0.12), rockMat, 0, 0.66, -0.2)); // and a slab for a back
    },
  },
  table: {
    wood(g) {
      for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.68, 5), M.log, x, 0.34, z));
      g.add(mesh(new BoxGeometry(1.1, 0.06, 0.75), M.wood, 0, 0.7, 0));
    },
    bamboo(g) {
      for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) cane(g, 0.035, [x, 0, z], [x, 0.68, z]);
      for (let i = 0; i < 9; i++) cane(g, 0.04, [-0.56, 0.71, -0.34 + i * 0.085], [0.56, 0.71, -0.34 + i * 0.085]);
    },
    stone(g) {
      for (const x of [-0.38, 0.38]) g.add(mesh(new BoxGeometry(0.24, 0.64, 0.55), rockMat, x, 0.32, 0));
      g.add(mesh(new BoxGeometry(1.15, 0.1, 0.8), rockMat, 0, 0.69, 0)); // one big flat slab
    },
  },
  bed: {
    // (lengthwise under her mat, like the mat itself)
    wood(g) {
      for (const [x, z] of [[-0.45, -0.9], [0.45, -0.9], [-0.45, 0.6], [0.45, 0.6]]) g.add(mesh(new BoxGeometry(0.08, 0.2, 0.08), M.log, x, 0.1, z));
      for (const x of [-0.47, 0.47]) g.add(mesh(new BoxGeometry(0.06, 0.08, 1.6), M.log, x, 0.16, -0.15));
      for (const z of [-0.92, 0.62]) g.add(mesh(new BoxGeometry(1.0, 0.08, 0.06), M.log, 0, 0.16, z));
    },
    bamboo(g) {
      for (const x of [-0.47, 0.47]) cane(g, 0.045, [x, 0.14, -0.98], [x, 0.14, 0.68]);
      for (const z of [-0.92, 0.62]) cane(g, 0.04, [-0.5, 0.1, z], [0.5, 0.1, z]);
      for (const [x, z] of [[-0.45, -0.9], [0.45, -0.9], [-0.45, 0.6], [0.45, 0.6]]) cane(g, 0.04, [x, 0, z], [x, 0.18, z]);
    },
    stone(g) {
      g.add(mesh(new BoxGeometry(1.0, 0.18, 1.75), rockMat, 0, 0.09, -0.15)); // a low stone platform
    },
  },
  shelf: {
    wood(g) {
      for (const x of [-0.5, 0.5]) g.add(mesh(new BoxGeometry(0.06, 1.0, 0.3), M.log, x, 0.5, 0));
      for (const y of [0.35, 0.75]) g.add(mesh(new BoxGeometry(1.06, 0.04, 0.3), M.wood, 0, y, 0));
    },
    bamboo(g) {
      for (const x of [-0.5, 0.5]) for (const z of [-0.1, 0.1]) cane(g, 0.03, [x, 0, z], [x, 1.0, z]);
      for (const y of [0.35, 0.75]) for (let i = 0; i < 4; i++) cane(g, 0.03, [-0.53, y, -0.11 + i * 0.075], [0.53, y, -0.11 + i * 0.075]);
    },
    stone(g) {
      // stacked stones for sides, with wooden boards between
      for (const x of [-0.5, 0.5]) for (let i = 0; i < 3; i++) g.add(mesh(new BoxGeometry(0.16, 0.3, 0.3), rockMat, x + (i % 2 ? 0.01 : -0.01), 0.16 + i * 0.31, 0));
      for (const y of [0.35, 0.75]) g.add(mesh(new BoxGeometry(1.0, 0.04, 0.3), M.wood, 0, y, 0));
    },
  },
};

/* ---------- instruments (also used for the ones in her hands, see character/perform.ts) ---------- */
const bamboo = mat('#C9B26B'), node = mat('#8A7A3E'), dark = mat('#2B211A');
/** A bamboo flute lying along x, centred on the origin. */
export function fluteModel() {
  const g = new Group(), tube = mesh(new CylinderGeometry(0.018, 0.018, 0.5, 6), bamboo);
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
  for (const x of [-0.12, 0.08]) { const n = mesh(new CylinderGeometry(0.021, 0.021, 0.015, 6), node, x, 0, 0); n.rotation.z = Math.PI / 2; g.add(n); }
  for (let i = 0; i < 4; i++) g.add(mesh(new SphereGeometry(0.006, 4, 3), dark, -0.05 - i * 0.04, 0.016, 0, false)); // finger holes
  return g;
}
/** A ukulele: body at the origin, neck towards +x, face towards +z. */
export function ukuleleModel() {
  const g = new Group(), wood = mat('#B9814A'), neckWood = mat('#7A5638');
  const lower = mesh(new SphereGeometry(0.1, 10, 6), wood, -0.03, 0, 0); lower.scale.set(1, 1, 0.35);
  const upper = mesh(new SphereGeometry(0.075, 10, 6), wood, 0.08, 0, 0); upper.scale.set(1, 1, 0.35);
  g.add(lower, upper);
  g.add(mesh(new CylinderGeometry(0.022, 0.022, 0.005, 10), dark, 0.02, 0, 0.036, false)); // sound hole
  (g.children[g.children.length - 1] as Object3D).rotation.x = Math.PI / 2;
  g.add(mesh(new BoxGeometry(0.24, 0.028, 0.02), neckWood, 0.26, 0, 0.01));
  g.add(mesh(new BoxGeometry(0.05, 0.04, 0.02), neckWood, 0.4, 0, 0.005)); // headstock
  return g;
}
/** A marimba: wooden bars on a frame, the player's side towards -z, bar tops 0.8 up. */
export function marimbaModel() {
  const g = new Group();
  for (const x of [-0.48, 0.48]) for (const z of [-0.14, 0.14]) g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.74, 5), M.log, x, 0.37, z));
  for (const z of [-0.14, 0.14]) g.add(mesh(new BoxGeometry(1.0, 0.04, 0.04), M.log, 0, 0.74, z));
  const bars = ['#C98B4E', '#B9783F', '#D39A5C', '#A86B37'].map(c => mat(c));
  for (let i = 0; i < 9; i++) {
    const len = 0.34 - i * 0.017, x = -0.42 + i * 0.105;
    g.add(mesh(new BoxGeometry(0.085, 0.03, len), bars[i % bars.length], x, 0.78, 0));
    g.add(mesh(new CylinderGeometry(0.025, 0.025, 0.2 + (8 - i) * 0.03, 6), M.log, x, 0.62 - (8 - i) * 0.015, 0.02)); // resonators
  }
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
  // a holder with all three styles of a piece of furniture (the update shows the right one)
  const pendingStyled: [CraftKey, Record<Style, Group>][] = [];
  function styledModel(k: 'chair' | 'table' | 'bed' | 'shelf') {
    const holder = new Group(), v = {} as Record<Style, Group>;
    for (const st of ['wood', 'bamboo', 'stone'] as Style[]) { v[st] = new Group(); FURNITURE[k][st](v[st]); holder.add(v[st]); }
    if (k === 'table') holder.add(mesh(new CylinderGeometry(0.12, 0.08, 0.06, 8), tin, 0.15, 0.76, 0.05)); // a bowl
    if (k === 'bed') holder.add(mesh(new BoxGeometry(0.9, 0.08, 1.75), M.bed, 0, 0.22, -0.15)); // her mat, now up on the frame
    pendingStyled.push([k, v]);
    return holder;
  }

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
      // (a slim drum she can sit right up against; her hands are calibrated to its skin)
      g.add(mesh(new CylinderGeometry(0.2, 0.17, 0.5, 10), M.log, 0, 0.25, 0));
      g.add(mesh(new CylinderGeometry(0.21, 0.21, 0.03, 10), hide, 0, 0.51, 0));
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, cord = mesh(new BoxGeometry(0.015, 0.45, 0.015), fibre, Math.cos(a) * 0.19, 0.27, Math.sin(a) * 0.19);
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
    flute() {
      const g = new Group(), f = fluteModel();
      f.position.y = 0.03;
      g.add(f);
      return place(g, DRUM_P.x + 0.5, DRUM_P.z + 0.3); // lying by the drum
    },
    ukulele() {
      const g = new Group(), u = ukuleleModel();
      u.rotation.set(0.15, 0, 1.2); // leaning, neck up
      u.position.y = 0.2;
      g.add(u);
      return place(g, DRUM_P.x - 0.45, DRUM_P.z + 0.15, yawTo(DRUM_P, FIRE)); // leaning by the drum
    },
    marimba() {
      const g = marimbaModel(), player = ground(addScaled(MARIMBA_P, dirXZ(FIRE, MARIMBA_P), 0.38));
      return place(g, MARIMBA_P.x, MARIMBA_P.z, yawTo(player, MARIMBA_P));
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

    /* ---------- furniture (in her style: see FURNITURE below) ---------- */
    chair: () => place(styledModel('chair'), CHAIR_P.x, CHAIR_P.z, yawTo(CHAIR_P, FIRE)),
    table: () => place(styledModel('table'), TABLE_P.x, TABLE_P.z, yawTo(TABLE_P, FIRE)),
    bed: () => place(styledModel('bed'), SH.x, SH.z, yawTo(SH, FIRE)), // a raised frame under her sleeping mat, inside the shelter
    shelf: () => place(styledModel('shelf'), SHELF_P.x, SHELF_P.z, yawTo(SHELF_P, FIRE)),
    flinttools: () => new Group(), // (not a thing of its own: her axe and pick get flint heads)
    rework: () => new Group(), // (remakes another piece; see the styled holders)
    chimes() {
      // bamboo tubes and a shell on strings, hung from a little post by the shelter
      const g = new Group();
      g.add(mesh(new CylinderGeometry(0.035, 0.04, 1.9, 5), M.log, 0, 0.95, 0));
      g.add(mesh(new BoxGeometry(0.5, 0.04, 0.04), M.log, 0.22, 1.85, 0));
      const tubes = new Group();
      tubes.position.set(0.38, 1.83, 0);
      [0.34, 0.28, 0.24, 0.3, 0.2].forEach((l, i) => {
        const x = (i - 2) * 0.06;
        tubes.add(mesh(new CylinderGeometry(0.004, 0.004, 0.12, 3), fibre, x, -0.06, 0, false));
        tubes.add(mesh(new CylinderGeometry(0.022, 0.022, l, 6), bamboo, x, -0.12 - l / 2, 0));
      });
      tubes.add(mesh(new ConeGeometry(0.04, 0.06, 6), mat('#F2D8C9'), 0, -0.5, 0, false)); // the shell, as a clapper
      tubes.name = 'tubes';
      g.add(tubes);
      return place(g, SH.x - 1.4, SH.z + 1.3);
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
    lanterns() {
      return place(new Group(), 0, 0); // (they stand along her paths: see world/joys.ts)
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
  // tap to look: what it is, when she made it, and what she said
  for (const k of Object.keys(models) as CraftKey[]) pickable(models[k], S => ({
    title: cap(PLANS[k].name),
    lines: [onDay(S.madeAt[k], 'Made'), ...(k === 'shelf' && S.stock.shells ? [`${S.stock.shells} shells on display`] : []), `“${PLANS[k].done}”`],
  }));

  /**
   * Show what she owns. Tools in her hands (see character/heldTools.ts) are
   * hidden from where they're normally kept.
   */
  // Once the tool shed stands, her tools hang on its back wall (in this order, along the rail)
  // instead of lying around camp; a tool in use leaves an empty hook.
  const SHED_TOOLS: CraftKey[] = ['axe', 'pick', 'spear', 'rod', 'bucket', 'basket'];
  const shedYaw = yawTo(SHED_P, FIRE);
  const shedSpot = (lx: number, lz: number) => {
    const c = Math.cos(shedYaw), s = Math.sin(shedYaw);
    return ground(V(SHED_P.x + lx * c + lz * s, SHED_P.z - lx * s + lz * c));
  };
  let inShed = false;
  // once the bandstand stands, her instruments live on it
  let onStage = false;
  function moveToBandstand() {
    for (const k of ['drum', 'marimba', 'flute', 'ukulele'] as const) {
      const s = BAND_SPOTS[k], m = models[k];
      m.position.set(s.at.x, s.at.y + BANDSTAND_FLOOR, s.at.z);
      m.rotation.y = k === 'marimba' ? yawTo(s.player, s.at) : BANDSTAND_YAW;
    }
    onStage = true;
  }
  function moveToShed() {
    SHED_TOOLS.forEach((k, i) => {
      const m = models[k], lx = -0.8 + i * 0.32;
      // long tools stand leaning on the rail; the bucket and basket go on the shelf
      const onShelf = k === 'bucket' || k === 'basket', p = shedSpot(lx, onShelf ? -0.45 : -0.2);
      m.position.set(p.x, p.y + (onShelf ? 0.77 : 0.06), p.z);
      // the models lean sideways (axe and rod one way, pick and spear the other); turn each so it leans back against the wall
      const leansLeft = k === 'axe' || k === 'rod';
      m.rotation.set(0, onShelf ? shedYaw : shedYaw + (leansLeft ? -1 : 1) * Math.PI / 2, 0);
      m.scale.setScalar(onShelf ? 0.7 : k === 'rod' ? 0.75 : 1);
    });
    inShed = true;
  }

  return function updateCrafted(S: SimState, held: CraftKey | null) {
    if (!inShed && S.projects.shed.done) moveToShed();
    if (!onStage && S.projects.bandstand.done) moveToBandstand();
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
      models.blanket.position.set(SH.x, SH.y + (S.items.bed ? 0.28 : 0.12), SH.z);
    }
    shells.forEach((sh, i) => { sh.visible = i < S.stock.shells; });
    // each styled piece holds all three versions; only the one she made it from shows
    for (const [k, v] of pendingStyled) {
      const st = S.madeStyle[k] ?? 'wood';
      for (const s of ['wood', 'bamboo', 'stone'] as Style[]) v[s].visible = s === st;
    }
    toolHead.color.set(S.items.flinttools ? '#3A3D44' : '#8E979B'); // dark, glassy flint
    const tubes = models.chimes.getObjectByName('tubes');
    if (tubes) tubes.rotation.z = 0.06 * Math.sin(performance.now() / 700) * Math.sin(performance.now() / 1900); // stirring in the breeze
  };
}
