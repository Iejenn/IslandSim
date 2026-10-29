// 3D models for the things she builds herself, plus the woodpile and the
// garden plants. Each project is a list of parts that appear one by one as
// her building progress goes up, so you can watch it take shape.
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, IcosahedronGeometry, Shape, SphereGeometry,
  type Material, type Mesh, type Object3D, type Scene, ConeGeometry, DodecahedronGeometry,
} from 'three';
import { BOAT_DOCK, DOCK, FIRE, GARDEN_P, LOOKOUT_DECK, LOOKOUT_P, PLOTS, RACK_P, SH, WOODPILE_P, yawTo } from '../sim/island';
import type { ProjectKey, SimState } from '../sim/state';
import { M, mat, mesh } from './materials';

const soil = mat('#6B4A33'), withered = mat('#8A7A4E'), fruitRed = mat('#D9452B', { roughness: 0.5 }), hull = mat('#8A5A34');
const WATER_Y = 0.12;

export function createBuildings(scene: Scene) {
  /** Adds parts (hidden) and returns them in the order they should appear. */
  function staged(parts: Object3D[]) {
    for (const p of parts) { p.visible = false; scene.add(p); }
    return parts;
  }
  const at = (o: Object3D, x: number, y: number, z: number, yaw = 0) => { o.position.set(x, y, z); o.rotation.y = yaw; return o; };

  /* garden: four soil beds, then a little fence */
  const garden = (() => {
    const parts: Object3D[] = PLOTS.map(p => mesh(new BoxGeometry(1.0, 0.12, 1.0), soil, p.x, p.y + 0.04, p.z));
    const g = GARDEN_P, r = 1.35;
    for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) parts.push(mesh(new CylinderGeometry(0.05, 0.06, 0.7, 5), M.wood, g.x + x, g.y + 0.3, g.z + z));
    for (const [x, z, rot] of [[0, -r, 0], [r, 0, Math.PI / 2], [0, r, 0], [-r, 0, Math.PI / 2]]) {
      const rail = mesh(new BoxGeometry(2.7, 0.06, 0.05), M.wood, g.x + x, g.y + 0.45, g.z + z);
      rail.rotation.y = rot;
      parts.push(rail);
    }
    return staged(parts);
  })();

  /* drying rack: two A-frames, a crossbar */
  const rack = (() => {
    const yaw = yawTo(RACK_P, FIRE) + Math.PI / 2, g = new Group();
    at(g, RACK_P.x, RACK_P.y, RACK_P.z, yaw);
    scene.add(g);
    const parts: Object3D[] = [];
    for (const x of [-0.8, 0.8]) for (const lean of [-0.25, 0.25]) {
      const leg = mesh(new CylinderGeometry(0.04, 0.05, 1.5, 5), M.wood, x, 0.7, lean);
      leg.rotation.x = -lean * 0.8;
      parts.push(leg);
    }
    const bar = mesh(new CylinderGeometry(0.035, 0.035, 1.8, 5), M.wood, 0, 1.38, 0);
    bar.rotation.z = Math.PI / 2;
    parts.push(bar);
    for (const p of parts) { p.visible = false; g.add(p); }
    // fish hanging from the bar, one per dried fish in stock
    const fish = Array.from({ length: 6 }, (_, i) => {
      const f = mesh(new SphereGeometry(0.09, 6, 4), M.rock, -0.6 + i * 0.24, 1.15, 0, false);
      f.scale.set(0.5, 1.8, 0.35);
      f.visible = false;
      g.add(f);
      return f;
    });
    return { parts, fish };
  })();

  /* dock: pairs of posts, then deck planks, walking out to sea */
  const dock = (() => {
    const yaw = Math.atan2(DOCK.dir.x, DOCK.dir.z), n = 9, seg = (DOCK.to - DOCK.from) / n, parts: Object3D[] = [];
    for (let i = 0; i < n; i++) {
      const d = DOCK.from + (i + 0.5) * seg, cx = DOCK.dir.x * d, cz = DOCK.dir.z * d;
      // posts on both sides (offset perpendicular to the dock), every other plank
      if (i % 2 === 0) for (const s of [-1, 1]) {
        const px = cx - DOCK.dir.z * s * DOCK.halfWidth, pz = cz + DOCK.dir.x * s * DOCK.halfWidth;
        parts.push(mesh(new CylinderGeometry(0.07, 0.08, 2.4, 6), M.log, px, DOCK.deckY - 1.2, pz));
      }
      parts.push(at(mesh(new BoxGeometry(DOCK.halfWidth * 2, 0.07, seg * 0.92), M.wood), cx, DOCK.deckY - 0.035, cz, yaw));
    }
    return staged(parts);
  })();

  /* stone walls for the shelter: two sloped side walls, a back wall, and a front with a doorway */
  const hut = (() => {
    const g = new Group();
    at(g, SH.x, SH.y, SH.z, yawTo(SH, FIRE));
    scene.add(g);
    const side = new Shape();
    // profile in (−z, y): follows the roof from the tall front posts to the low back posts
    side.moveTo(-0.72, 0); side.lineTo(0.82, 0); side.lineTo(0.82, 1.32); side.lineTo(-0.72, 2.15); side.lineTo(-0.72, 0);
    const sideGeo = new ExtrudeGeometry(side, { depth: 0.07, bevelEnabled: false });
    sideGeo.rotateY(Math.PI / 2);
    const parts: Object3D[] = [-1.18, 1.11].map(x => mesh(sideGeo, M.rock, x, 0, 0));
    parts.push(mesh(new BoxGeometry(2.3, 1.32, 0.07), M.rock, 0, 0.66, -0.82));
    for (const x of [-0.76, 0.76]) parts.push(mesh(new BoxGeometry(0.7, 2.1, 0.07), M.rock, x, 1.05, 0.72));
    for (const p of parts) { p.visible = false; g.add(p); }
    return parts;
  })();

  /* stone hearth: a ring of big stones and a low wall around the campfire */
  const hearth = (() => {
    const parts: Object3D[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const st = mesh(new DodecahedronGeometry(0.17, 0), M.rock, FIRE.x + Math.cos(a) * 0.72, FIRE.y + 0.1, FIRE.z + Math.sin(a) * 0.72);
      st.scale.set(1.2, 0.8, 1);
      st.rotation.y = a;
      parts.push(st);
    }
    return staged(parts);
  })();

  /* lookout tower: four posts, a ladder, a platform and a railing */
  const lookout = (() => {
    const g = new Group(), H = LOOKOUT_DECK, parts: Object3D[] = [];
    at(g, LOOKOUT_P.x, LOOKOUT_P.y, LOOKOUT_P.z, yawTo(LOOKOUT_P, FIRE));
    scene.add(g);
    // posts run well above the platform so the roof clears her head (she's tall with that hair)
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) parts.push(mesh(new CylinderGeometry(0.07, 0.09, H + 2.2, 6), M.log, x, (H + 2.2) / 2, z));
    for (let i = 0; i < 6; i++) parts.push(mesh(new BoxGeometry(0.5, 0.04, 0.05), M.wood, 0, 0.35 + i * 0.35, 0.75)); // ladder rungs
    parts.push(mesh(new BoxGeometry(1.5, 0.08, 1.5), M.wood, 0, H - 0.04, 0)); // platform
    for (const [x, z, r] of [[0, -0.7, 0], [0.7, 0, Math.PI / 2], [-0.7, 0, Math.PI / 2]]) {
      const rail = mesh(new BoxGeometry(1.45, 0.05, 0.05), M.wood, x, H + 0.55, z);
      rail.rotation.y = r;
      parts.push(rail);
    }
    const roof = mesh(new ConeGeometry(1.15, 0.6, 4), M.thatch, 0, H + 2.45, 0);
    roof.rotation.y = Math.PI / 4;
    parts.push(roof);
    for (const p of parts) { p.visible = false; g.add(p); }
    return parts;
  })();

  /* canoe: built at the dock; moored there, or carrying her while she paddles */
  const canoe = (() => {
    const g = new Group(), parts: Object3D[] = [];
    const body = mesh(new CylinderGeometry(0.38, 0.38, 2.0, 10, 1, false, Math.PI / 2, Math.PI), hull, 0, 0.2, 0); // half log
    body.rotation.x = Math.PI / 2;
    body.scale.set(1, 1, 0.8);
    parts.push(body);
    for (const z of [1.1, -1.1]) {
      const tip = mesh(new ConeGeometry(0.3, 0.45, 6), hull, 0, 0.12, z);
      tip.rotation.x = z > 0 ? Math.PI / 2 : -Math.PI / 2;
      tip.scale.set(1, 1, 0.6);
      parts.push(tip);
    }
    parts.push(mesh(new BoxGeometry(0.6, 0.04, 0.22), M.wood, 0, 0.2, -0.25)); // seat
    const paddle = mesh(new BoxGeometry(0.06, 0.04, 1.3), M.wood, 0.3, 0.28, 0.2);
    paddle.rotation.y = 0.3;
    parts.push(paddle);
    for (const p of parts) { p.visible = false; g.add(p); }
    scene.add(g);
    return { g, parts };
  })();

  /* woodpile: logs stacked in a little pyramid, one per log in stock */
  const woodpile = (() => {
    const g = new Group();
    at(g, WOODPILE_P.x, WOODPILE_P.y, WOODPILE_P.z, yawTo(WOODPILE_P, FIRE));
    scene.add(g);
    const rows = [5, 4, 3, 2, 1], logs: Mesh[] = [];
    rows.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        const l = mesh(new CylinderGeometry(0.11, 0.11, 0.9, 6), M.log, (i - (count - 1) / 2) * 0.23, 0.11 + row * 0.19, 0);
        l.rotation.x = Math.PI / 2;
        l.visible = false;
        g.add(l);
        logs.push(l);
      }
    });
    return logs;
  })();

  /* a plant in each bed: grows with its growth value, fruits when ripe, browns when withered */
  const plants = PLOTS.map(p => {
    const g = new Group();
    at(g, p.x, p.y + 0.1, p.z);
    const leaves = mesh(new IcosahedronGeometry(0.28, 0), M.leaf);
    leaves.position.y = 0.2;
    leaves.scale.set(1, 0.8, 1);
    const fruits = [0, 1, 2].map(i => {
      const f = mesh(new SphereGeometry(0.07, 6, 4), fruitRed, Math.cos(i * 2.1) * 0.2, 0.22, Math.sin(i * 2.1) * 0.2, false);
      g.add(f);
      return f;
    });
    g.add(leaves);
    g.visible = false;
    scene.add(g);
    return { g, leaves, fruits };
  });

  const showParts = (parts: Object3D[], started: boolean, progress: number, damaged = false) => {
    // storm damage knocks some of the later parts off until she repairs it
    const n = started ? Math.max(1, Math.ceil(progress * (damaged ? 0.7 : 1) * parts.length)) : 0;
    parts.forEach((p, i) => { p.visible = i < n; });
  };
  const PARTS: Record<ProjectKey, Object3D[]> = { garden, rack: rack.parts, dock, hut, hearth, lookout, canoe: canoe.parts };

  /**
   * Mirror sim state onto the models (cheap; called every frame).
   * @param her her body, which the canoe follows while she paddles
   * @param t real seconds (bobbing)
   */
  return function updateBuildings(S: SimState, her: Object3D, t: number) {
    for (const k of Object.keys(PARTS) as ProjectKey[]) showParts(PARTS[k], S.projects[k].started, S.projects[k].progress, S.projects[k].damaged);
    if (S.sailing) {
      canoe.g.position.set(her.position.x, WATER_Y, her.position.z);
      canoe.g.rotation.y = her.rotation.y;
    } else {
      canoe.g.position.set(BOAT_DOCK.x, WATER_Y, BOAT_DOCK.z);
      canoe.g.rotation.y = Math.atan2(DOCK.dir.x, DOCK.dir.z);
    }
    canoe.g.position.y += 0.04 * Math.sin(t * 1.6);
    rack.fish.forEach((f, i) => { f.visible = S.projects.rack.done && i < S.stock.fish; });
    woodpile.forEach((l, i) => { l.visible = i < S.stock.wood; });
    plants.forEach(({ g, leaves, fruits }, i) => {
      const p = S.plots[i];
      g.visible = S.projects.garden.done && p.state !== 'empty';
      if (!g.visible) return;
      const size = p.state === 'withered' ? 0.7 : 0.25 + 0.75 * Math.min(1, p.growth);
      g.scale.setScalar(size);
      leaves.material = (p.state === 'withered' ? withered : M.leaf) as Material;
      fruits.forEach(f => { f.visible = p.state === 'ripe'; });
    });
  };
}
