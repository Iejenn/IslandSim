// 3D models for the things she builds herself, plus the woodpile and the
// garden plants. Each project is a list of parts that appear one by one as
// her building progress goes up, so you can watch it take shape.
import {
  BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, TorusGeometry, type MeshStandardMaterial, Group, IcosahedronGeometry, Shape, SphereGeometry,
  type Material, type Mesh, type Object3D, type Scene, ConeGeometry, DodecahedronGeometry,
} from 'three';
import { ORCHARD, ORCHARD_P, BANDSTAND_FLOOR, BANDSTAND_P, SHED_P, BATH_P, HIVE_P, KILN_P, MOSAIC_P, OVEN_P, SP, SUNDIAL_P, HOUSEBOAT_P, HOUSEBOAT_YAW, BARREL_P, TRAP_A, TRAP_P, TREEHOUSE_DECK, TREEHOUSE_P, BOAT_DOCK, COOP_P, DOCK, FENCE_GATES, FENCE_R, FIRE, GARDEN_P, ground, LODGE_P, LODGE_SIZE, LODGE_YAW, LOOKOUT_DECK, LOOKOUT_P, PLOTS, RACK_P, SH, V, WOODPILE_P, yawTo } from '../sim/island';
import { PLANS } from '../sim/plans';
import type { Crop, FruitKind, ProjectKey, SimState } from '../sim/state';
import { cap, onDay, pickable } from './inspect';
import { M, mat, mesh } from './materials';

const soil = mat('#6B4A33'), withered = mat('#8A7A4E'), fruitRed = mat('#D9452B', { roughness: 0.5 }), hull = mat('#8A5A34');
const WATER_Y = 0.12;
const terracotta = mat('#B8643E'), clayMat = mat('#C47A4E'), honeyMat = mat('#E3A63A', { roughness: 0.5 }), hiveWood = mat('#D9B77A');
const cornGold = mat('#E8C547', { roughness: 0.6 }), pumpkinMat = mat('#E07B24', { roughness: 0.6 }), stalkMat = mat('#9BB05A');
const PETALS = ['#E85C8A', '#F2D14B', '#FFFFFF', '#B07CE0', '#F08A3C'].map(c => mat(c, { roughness: 0.6 }));
const FRUIT_MAT: Record<FruitKind, ReturnType<typeof mat>> = { mango: mat('#F0A030', { roughness: 0.5 }), banana: mat('#F2DB4A', { roughness: 0.5 }), lemon: mat('#F5E65A', { roughness: 0.4 }) };
const trapFishMat = mat('#8FB6C4', { roughness: 0.4, metalness: 0.2 }), rainwater = mat('#5FB8C9', { roughness: 0.2 });

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

  /* the lodge: floor, outer walls with a doorway, three rooms, a gable roof.
     The roof hides while she's inside so you can see her in the rooms. */
  const lodge = (() => {
    const g = new Group(), { w, d, h } = LODGE_SIZE, hw = w / 2, hd = d / 2, parts: Object3D[] = [];
    at(g, LODGE_P.x, LODGE_P.y, LODGE_P.z, LODGE_YAW);
    scene.add(g);
    const wall = (len: number, x: number, z: number, rot = 0, height = h) => {
      const m = mesh(new BoxGeometry(len, height, 0.14), M.log, x, height / 2, z);
      m.rotation.y = rot;
      return m;
    };
    parts.push(mesh(new BoxGeometry(w, 0.12, d), M.wood, 0, 0.06, 0)); // floor
    parts.push(wall(w, 0, -hd)); // back
    parts.push(wall(d, -hw, 0, Math.PI / 2), wall(d, hw, 0, Math.PI / 2)); // sides
    parts.push(wall(hw - 0.6, -(hw + 0.6) / 2, hd), wall(hw - 0.6, (hw + 0.6) / 2, hd)); // front, with a doorway in the middle
    parts.push(wall(1.2, 0, hd, 0, 0.5)); // lintel over the door
    (parts[parts.length - 1] as Mesh).position.y = h - 0.25;
    for (const x of [-2.2, 2.2]) parts.push(mesh(new BoxGeometry(0.7, 0.5, 0.16), M.ebony, x, 1.5, hd)); // windows
    // interior walls between the rooms, open towards the front so she can walk through
    for (const x of [-1.1, 1.1]) parts.push(wall(d - 1.4, x, -0.7, Math.PI / 2));
    parts.push(mesh(new BoxGeometry(1.4, 0.06, 1.9), M.bed, -2.2, 0.15, -0.8)); // bedroll (until she makes a real bed)
    const roofs: Object3D[] = [];
    for (const s of [-1, 1]) {
      const r = mesh(new BoxGeometry(w + 0.6, 0.12, hd * 1.25), M.thatch, 0, h + 0.55, s * hd * 0.55);
      r.rotation.x = s * 0.48;
      roofs.push(r);
    }
    const chimney = mesh(new BoxGeometry(0.45, 1.4, 0.45), M.rock, 2.4, h + 0.6, -1.4);
    roofs.push(chimney);
    parts.push(...roofs);
    for (const p of parts) { p.visible = false; g.add(p); }
    const bedroll = parts[parts.length - 4];
    return { g, parts, roofs, bedroll };
  })();

  /* fence: a ring of posts and rails around her home, with gaps for gates */
  const fence = (() => {
    const parts: Object3D[] = [], n = 40;
    const isGate = (a: number) => FENCE_GATES.some(gA => Math.abs(Math.atan2(Math.sin(a - gA), Math.cos(a - gA))) < 0.12);
    const pt = (a: number) => ground(V(Math.cos(a) * FENCE_R, Math.sin(a) * FENCE_R));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2;
      if (isGate(a)) continue;
      const p = pt(a);
      parts.push(mesh(new CylinderGeometry(0.06, 0.07, 1.0, 5), M.log, p.x, p.y + 0.45, p.z));
      if (isGate(a2)) continue;
      const q = pt(a2), len = Math.hypot(q.x - p.x, q.z - p.z);
      for (const y of [0.45, 0.8]) {
        const rail = mesh(new BoxGeometry(len, 0.05, 0.05), M.wood, (p.x + q.x) / 2, (p.y + q.y) / 2 + y, (p.z + q.z) / 2);
        rail.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
        parts.push(rail);
      }
    }
    return staged(parts);
  })();

  /* chicken coop: a little house on stilts with a ramp */
  const coop = (() => {
    const g = new Group(), parts: Object3D[] = [];
    at(g, COOP_P.x, COOP_P.y, COOP_P.z, yawTo(COOP_P, FIRE));
    scene.add(g);
    for (const [x, z] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) parts.push(mesh(new CylinderGeometry(0.04, 0.04, 0.4, 5), M.log, x, 0.2, z));
    parts.push(mesh(new BoxGeometry(1.2, 0.7, 0.9), M.wood, 0, 0.75, 0));
    const roof = mesh(new ConeGeometry(0.95, 0.5, 4), M.thatch, 0, 1.35, 0);
    roof.rotation.y = Math.PI / 4;
    parts.push(roof);
    const ramp = mesh(new BoxGeometry(0.3, 0.03, 0.8), M.log, 0, 0.22, 0.75);
    ramp.rotation.x = 0.55;
    parts.push(ramp, mesh(new BoxGeometry(0.25, 0.3, 0.02), M.ebony, 0, 0.6, 0.46)); // ramp and little door
    for (const p of parts) { p.visible = false; g.add(p); }
    return parts;
  })();

  /* fish trap: a ring of stakes in the shallows with a woven funnel; caught fish show inside */
  const trap = (() => {
    const g = new Group(), parts: Object3D[] = [];
    at(g, TRAP_P.x, 0, TRAP_P.z, -TRAP_A);
    scene.add(g);
    const top = WATER_Y + 0.35;
    for (let i = 0; i < 10; i++) {
      if (i === 2) continue; // the mouth of the trap, towards the beach
      const a = i / 10 * Math.PI * 2, x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75;
      const base = Math.min(WATER_Y, ground(V(TRAP_P.x + x, TRAP_P.z + z)).y) - 0.1;
      parts.push(mesh(new CylinderGeometry(0.035, 0.045, top - base, 5), M.log, x, (top + base) / 2, z));
    }
    const ring = mesh(new TorusGeometry(0.75, 0.025, 4, 20), M.hammock, 0, WATER_Y + 0.18, 0);
    ring.rotation.x = Math.PI / 2;
    parts.push(ring);
    const funnel = mesh(new ConeGeometry(0.3, 0.6, 8, 1, true), M.hammock, 0, WATER_Y + 0.05, 0);
    funnel.rotation.z = Math.PI / 2;
    parts.push(funnel);
    for (const p of parts) { p.visible = false; g.add(p); }
    const fish = [0, 1, 2].map(i => {
      const f = mesh(new ConeGeometry(0.06, 0.26, 4), trapFishMat, Math.cos(i * 2.1) * 0.35, WATER_Y + 0.03, Math.sin(i * 2.1) * 0.35, false);
      f.rotation.z = Math.PI / 2;
      f.visible = false;
      g.add(f);
      return f;
    });
    return { parts, fish };
  })();

  /* rain barrel by the woodpile: a few stones, the barrel, hoops, a funnel on top */
  const barrel = (() => {
    const g = new Group(), parts: Object3D[] = [];
    at(g, BARREL_P.x, BARREL_P.y, BARREL_P.z);
    scene.add(g);
    for (let i = 0; i < 4; i++) parts.push(mesh(new DodecahedronGeometry(0.16, 0), M.rock, Math.cos(i * 1.6) * 0.3, 0.06, Math.sin(i * 1.6) * 0.3));
    parts.push(mesh(new CylinderGeometry(0.34, 0.3, 0.8, 10, 1, true), M.wood, 0, 0.5, 0));
    parts.push(mesh(new CylinderGeometry(0.3, 0.3, 0.04, 10), M.wood, 0, 0.12, 0)); // bottom
    for (const y of [0.25, 0.75]) {
      const hoop = mesh(new TorusGeometry(0.33, 0.02, 4, 14), M.log, 0, y, 0);
      hoop.rotation.x = Math.PI / 2;
      parts.push(hoop);
    }
    parts.push(mesh(new ConeGeometry(0.5, 0.25, 10, 1, true), M.tarp, 0, 1.0, 0)); // catches the rain (a scrap of tarp)
    (parts[parts.length - 1] as Mesh).rotation.x = Math.PI;
    for (const p of parts) { p.visible = false; g.add(p); }
    const water = mesh(new CylinderGeometry(0.3, 0.3, 0.02, 10), rainwater, 0, 0.2, 0, false);
    water.visible = false;
    g.add(water);
    return { parts, water };
  })();

  /* treehouse in the big tree by camp: the tree itself (grown taller), a deck,
     railings, a ladder and an A-frame roof of tarp */
  const treehouse = (() => {
    const g = new Group(), parts: Object3D[] = [], H = TREEHOUSE_DECK;
    at(g, TREEHOUSE_P.x, TREEHOUSE_P.y, TREEHOUSE_P.z, yawTo(TREEHOUSE_P, FIRE));
    scene.add(g);
    const tree = new Group(); // replaces the forest tree while she builds
    tree.add(mesh(new CylinderGeometry(0.2, 0.3, 4.6, 7), M.trunk, 0, 2.3, 0));
    tree.add(mesh(new IcosahedronGeometry(1.7, 0), M.forestLeaf, 0, 5.0, 0));
    tree.add(mesh(new IcosahedronGeometry(1.1, 0), M.forestLeaf2, 0.8, 5.6, -0.4));
    tree.add(mesh(new IcosahedronGeometry(1.0, 0), M.forestLeaf2, -0.9, 4.6, 0.3));
    parts.push(tree);
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const beam = mesh(new CylinderGeometry(0.05, 0.05, 1.3, 5), M.log, x * 0.6, H - 0.55, z * 0.6);
      beam.rotation.set(z * 0.5, 0, -x * 0.5);
      parts.push(beam);
    }
    parts.push(mesh(new BoxGeometry(2.4, 0.1, 2.4), M.wood, 0, H, 0)); // deck
    for (let i = 0; i < 7; i++) parts.push(mesh(new BoxGeometry(0.5, 0.04, 0.05), M.wood, 0, 0.3 + i * 0.3, 1.32)); // ladder rungs
    for (const x of [-0.25, 0.25]) parts.push(mesh(new BoxGeometry(0.05, H, 0.05), M.log, x, H / 2, 1.32));
    for (const [x, z, rot, len] of [[0, -1.17, 0, 2.4], [-1.17, 0, Math.PI / 2, 2.4], [1.17, 0, Math.PI / 2, 2.4]] as const) {
      const rail = mesh(new BoxGeometry(len, 0.05, 0.05), M.wood, x, H + 0.55, z);
      rail.rotation.y = rot;
      parts.push(rail);
    }
    // A-frame: ridge 1.9 above the deck, eaves at 0.6, so she fits underneath
    for (const sd of [-1, 1]) {
      const r = mesh(new BoxGeometry(1.75, 0.05, 2.2), M.tarp, sd * 0.57, H + 1.25, 0);
      r.rotation.z = -sd * Math.atan2(1.3, 1.15);
      parts.push(r);
    }
    for (const p of parts) { p.visible = false; g.add(p); }
    return parts;
  })();

  /* houseboat: a log raft with a deck, a little cabin with a tarp roof, a bedroll
     under it and a rail at the bow. Bobs on the water next to the dock. */
  const houseboat = (() => {
    const g = new Group(), parts: Object3D[] = [];
    at(g, HOUSEBOAT_P.x, WATER_Y, HOUSEBOAT_P.z, HOUSEBOAT_YAW); // local z points out to sea
    scene.add(g);
    for (let i = 0; i < 6; i++) { // raft logs
      const l = mesh(new CylinderGeometry(0.19, 0.19, 4.4, 7), M.log, -0.95 + i * 0.38, -0.02, 0);
      l.rotation.x = Math.PI / 2;
      parts.push(l);
    }
    parts.push(mesh(new BoxGeometry(2.3, 0.06, 4.2), M.wood, 0, 0.12, 0)); // deck (her feet at ~0.24 when aboard)
    for (const [x, z] of [[-1.05, -1.8], [1.05, -1.8], [-1.05, 0.2], [1.05, 0.2]]) parts.push(mesh(new CylinderGeometry(0.05, 0.05, 1.7, 5), M.log, x, 1.0, z));
    parts.push(mesh(new BoxGeometry(2.2, 0.9, 0.08), M.wood, 0, 0.6, -1.85)); // back wall of the cabin
    parts.push(mesh(new BoxGeometry(1.4, 0.06, 1.9), M.bed, 0, 0.17, -0.9)); // bedroll
    for (const sd of [-1, 1]) {
      const r = mesh(new BoxGeometry(1.35, 0.05, 2.4), M.tarp, sd * 0.6, 2.0, -0.8);
      r.rotation.z = -sd * 0.45;
      parts.push(r);
    }
    const rail = mesh(new BoxGeometry(2.2, 0.05, 0.05), M.wood, 0, 0.6, 2.0); // bow rail
    parts.push(rail);
    for (const x of [-1.05, 1.05]) parts.push(mesh(new BoxGeometry(0.05, 0.5, 0.05), M.wood, x, 0.4, 2.0));
    for (const p of parts) { p.visible = false; g.add(p); }
    return { g, parts };
  })();

  /** A group at a spot, facing the fire, whose parts appear as it's built. */
  function site(p: { x: number; y: number; z: number }, build: (parts: Object3D[]) => void) {
    const g = new Group(), parts: Object3D[] = [];
    at(g, p.x, p.y, p.z, yawTo(p, FIRE));
    scene.add(g);
    build(parts);
    for (const o of parts) { o.visible = false; g.add(o); }
    return parts;
  }

  /* bandstand: a raised octagonal stage with eight posts, a railing (open at
     the front, with steps) and a pointed roof */
  const bandstand = site(BANDSTAND_P, parts => {
    const R = 1.6, H = BANDSTAND_FLOOR;
    parts.push(mesh(new CylinderGeometry(R, R + 0.05, H, 8), M.rock, 0, H / 2, 0)); // stone base
    parts.push(mesh(new CylinderGeometry(R - 0.05, R - 0.05, 0.06, 8), M.wood, 0, H + 0.03, 0)); // floorboards
    const post = (i: number) => { const a = (i + 0.5) / 8 * Math.PI * 2; return [Math.sin(a) * (R - 0.15), Math.cos(a) * (R - 0.15)]; };
    for (let i = 0; i < 8; i++) { const [x, z] = post(i); parts.push(mesh(new CylinderGeometry(0.06, 0.07, 2.2, 6), M.log, x, H + 1.1, z)); }
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 7) continue; // (open at the front, towards the fire)
      const [x1, z1] = post(i), [x2, z2] = post(i + 1), rail = mesh(new BoxGeometry(Math.hypot(x2 - x1, z2 - z1), 0.05, 0.05), M.wood, (x1 + x2) / 2, H + 0.6, (z1 + z2) / 2);
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      parts.push(rail);
    }
    for (let s = 0; s < 2; s++) parts.push(mesh(new BoxGeometry(0.9, 0.12, 0.3), M.wood, 0, 0.06 + s * 0.12, R + 0.3 - s * 0.25)); // steps
    const roof = mesh(new ConeGeometry(R + 0.45, 1.0, 8), M.thatch, 0, H + 2.7, 0);
    roof.rotation.y = Math.PI / 8;
    parts.push(roof);
    parts.push(mesh(new SphereGeometry(0.08, 6, 4), M.log, 0, H + 3.25, 0)); // finial
  });

  /* tool shed: a lean-to open towards the fire, with a rail on the back wall
     for her tools (crafted.ts hangs them there) and a shelf */
  const shed = site(SHED_P, parts => {
    parts.push(mesh(new BoxGeometry(2.1, 0.08, 1.3), M.wood, 0, 0.04, 0)); // floor
    parts.push(mesh(new BoxGeometry(2.1, 2.0, 0.08), M.wood, 0, 1.0, -0.62)); // back wall
    for (const x of [-1.03, 1.03]) {
      const side = mesh(new BoxGeometry(0.08, 1.8, 1.3), M.wood, x, 0.9, 0);
      parts.push(side);
    }
    for (const x of [-1.03, 1.03]) parts.push(mesh(new CylinderGeometry(0.05, 0.05, 1.7, 5), M.log, x, 0.85, 0.62)); // front posts
    parts.push(mesh(new BoxGeometry(1.9, 0.05, 0.05), M.log, 0, 1.45, -0.55)); // tool rail
    parts.push(mesh(new BoxGeometry(1.9, 0.04, 0.28), M.wood, 0, 0.75, -0.45)); // shelf
    const roof = mesh(new BoxGeometry(2.4, 0.07, 1.65), M.tarp, 0, 1.95, 0.02);
    roof.rotation.x = 0.22; // sloping down to the front
    parts.push(roof);
  });

  /* kiln: a clay dome on a stone base, with a chimney and a dark mouth */
  const kiln = site(KILN_P, parts => {
    parts.push(mesh(new CylinderGeometry(0.8, 0.9, 0.3, 9), M.rock, 0, 0.15, 0));
    const dome = mesh(new SphereGeometry(0.75, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), clayMat, 0, 0.3, 0);
    parts.push(dome);
    parts.push(mesh(new CylinderGeometry(0.12, 0.15, 0.6, 7), clayMat, 0.2, 1.1, -0.2));
    parts.push(mesh(new BoxGeometry(0.4, 0.35, 0.1), M.ebony, 0, 0.5, 0.7));
  });
  /* bread oven: a smaller dome on a stone table */
  const oven = site(OVEN_P, parts => {
    parts.push(mesh(new BoxGeometry(1.1, 0.6, 1.0), M.rock, 0, 0.3, 0));
    parts.push(mesh(new SphereGeometry(0.5, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), clayMat, 0, 0.6, 0));
    parts.push(mesh(new BoxGeometry(0.3, 0.25, 0.1), M.ebony, 0, 0.72, 0.47));
  });
  /* beehive: a box on legs with a sloped lid; honey shows at the entrance when it's full */
  const hiveHoney = mesh(new BoxGeometry(0.3, 0.05, 0.05), honeyMat, 0, 0.62, 0.27);
  const beehive = site(HIVE_P, parts => {
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) parts.push(mesh(new CylinderGeometry(0.03, 0.03, 0.5, 5), M.log, x, 0.25, z));
    for (let i = 0; i < 3; i++) parts.push(mesh(new BoxGeometry(0.62, 0.22, 0.5), hiveWood, 0, 0.6 + i * 0.23, 0));
    const lid = mesh(new BoxGeometry(0.72, 0.06, 0.6), M.wood, 0, 1.33, 0);
    lid.rotation.x = 0.12;
    parts.push(lid);
  });
  beehive[0].parent!.add(hiveHoney);
  hiveHoney.visible = false;
  /* sundial: a round stone face on a plinth, with a slanted gnomon */
  const sundial = site(SUNDIAL_P, parts => {
    parts.push(mesh(new CylinderGeometry(0.22, 0.3, 0.7, 7), M.rock, 0, 0.35, 0));
    parts.push(mesh(new CylinderGeometry(0.5, 0.5, 0.06, 14), M.rock, 0, 0.73, 0));
    const gnomon = mesh(new BoxGeometry(0.03, 0.35, 0.4), M.log, 0, 0.88, 0);
    gnomon.rotation.x = -0.6;
    parts.push(gnomon);
  });
  /* shell mosaic: a low stone slab set with rings of coloured shells */
  const mosaic = site(MOSAIC_P, parts => {
    parts.push(mesh(new BoxGeometry(1.6, 0.12, 1.6), M.rock, 0, 0.06, 0));
    const cols = [mat('#F2D8C9'), mat('#E9B8A0'), mat('#3F79A8'), mat('#F5EFE0'), mat('#D2304A')];
    for (let ring = 0; ring < 3; ring++) {
      const n = 6 + ring * 6, r = 0.15 + ring * 0.22;
      const g = new Group();
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        g.add(mesh(new SphereGeometry(0.06, 5, 3), cols[(ring * 2 + i) % cols.length], Math.cos(a) * r, 0.13, Math.sin(a) * r, false));
      }
      parts.push(g);
    }
  });
  /* bathhouse: a round stone tub of steaming water by the pond, behind a wooden screen */
  const bathWater = mesh(new CylinderGeometry(0.62, 0.62, 0.04, 12), M.spring, 0, 0.42, 0, false);
  const bathhouse = (() => {
    const parts: Object3D[] = [], g = new Group();
    at(g, BATH_P.x, BATH_P.y, BATH_P.z, yawTo(BATH_P, SP));
    scene.add(g);
    parts.push(mesh(new CylinderGeometry(0.8, 0.85, 0.45, 12, 1, true), M.rock, 0, 0.22, 0));
    parts.push(mesh(new CylinderGeometry(0.8, 0.8, 0.05, 12), M.rock, 0, 0.02, 0));
    parts.push(bathWater);
    for (const x of [-0.9, 0, 0.9]) parts.push(mesh(new CylinderGeometry(0.05, 0.05, 1.5, 5), M.log, x, 0.75, -1.0));
    parts.push(mesh(new BoxGeometry(1.9, 1.1, 0.06), M.wood, 0, 0.85, -1.0)); // screen
    parts.push(mesh(new CylinderGeometry(0.25, 0.3, 0.25, 7), clayMat, 1.05, 0.12, 0.2)); // little stove under the tub
    for (const o of parts) { o.visible = false; g.add(o); }
    return parts;
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

  /* a plant in each bed, shaped by what she sowed there: grows with its growth
     value, fruits (or blooms) when ripe, browns when withered */
  const plants = PLOTS.map(p => {
    const g = new Group();
    at(g, p.x, p.y + 0.1, p.z);
    const crops = {} as Record<Crop, { g: Group; leaves: Mesh[]; ripe: Object3D[] }>;
    const kit = (crop: Crop) => { const c = { g: new Group(), leaves: [] as Mesh[], ripe: [] as Object3D[] }; g.add(c.g); crops[crop] = c; return c; };
    const leafBall = (c: ReturnType<typeof kit>, r: number, x: number, y: number, z: number, sy = 0.8) => {
      const l = mesh(new IcosahedronGeometry(r, 0), M.leaf, x, y, z); l.scale.set(1, sy, 1); c.g.add(l); c.leaves.push(l); return l;
    };
    // greens: a few leafy heads, no fruit
    const greens = kit('greens');
    for (let i = 0; i < 3; i++) leafBall(greens, 0.17, Math.cos(i * 2.1) * 0.22, 0.12, Math.sin(i * 2.1) * 0.22, 0.7);
    // tomatoes: a bush with red fruit
    const tomato = kit('tomato');
    leafBall(tomato, 0.28, 0, 0.2, 0);
    for (let i = 0; i < 3; i++) { const f = mesh(new SphereGeometry(0.07, 6, 4), fruitRed, Math.cos(i * 2.1) * 0.2, 0.22, Math.sin(i * 2.1) * 0.2, false); tomato.g.add(f); tomato.ripe.push(f); }
    // corn: tall stalks with golden cobs
    const corn = kit('corn');
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 - 0.5) * 0.4, z = (Math.floor(i / 2) - 0.5) * 0.4;
      const s = mesh(new CylinderGeometry(0.025, 0.035, 0.9, 5), stalkMat, x, 0.45, z); corn.g.add(s); corn.leaves.push(s);
      const cob = mesh(new CylinderGeometry(0.045, 0.035, 0.18, 6), cornGold, x + 0.05, 0.55, z, false); cob.rotation.z = -0.4; corn.g.add(cob); corn.ripe.push(cob);
    }
    // pumpkins: low sprawling leaves and one big orange pumpkin
    const pumpkin = kit('pumpkin');
    for (let i = 0; i < 4; i++) leafBall(pumpkin, 0.16, Math.cos(i * 1.6) * 0.3, 0.06, Math.sin(i * 1.6) * 0.3, 0.4);
    const pk = mesh(new SphereGeometry(0.2, 10, 6), pumpkinMat, 0.02, 0.14, 0); pk.scale.set(1, 0.75, 1); pumpkin.g.add(pk); pumpkin.ripe.push(pk);
    // flowers: green tufts that burst into colour
    const flowers = kit('flowers');
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + (p.x * 7) % 1, r = 0.12 + (i % 3) * 0.1, x = Math.cos(a) * r, z = Math.sin(a) * r;
      leafBall(flowers, 0.08, x, 0.1, z, 1.4);
      const bloom = mesh(new SphereGeometry(0.06, 6, 4), PETALS[(i + Math.round(p.z * 3)) % PETALS.length], x, 0.24, z, false);
      bloom.scale.set(1, 0.5, 1); flowers.g.add(bloom); flowers.ripe.push(bloom);
    }
    g.visible = false;
    scene.add(g);
    return { g, crops };
  });

  /* orchard: a stake by each planting spot and a little sign, then the trees she plants there */
  const orchard = staged([
    ...ORCHARD.map(o => mesh(new CylinderGeometry(0.03, 0.03, 0.7, 5), M.wood, o.pos.x + 0.35, o.pos.y + 0.35, o.pos.z)),
    at(mesh(new BoxGeometry(0.5, 0.3, 0.04), M.wood, 0, 0, 0), ORCHARD_P.x, ORCHARD_P.y + 0.7, ORCHARD_P.z, yawTo(ORCHARD_P, FIRE)),
    mesh(new CylinderGeometry(0.03, 0.03, 0.75, 5), M.wood, ORCHARD_P.x, ORCHARD_P.y + 0.37, ORCHARD_P.z),
  ]);
  // one tree per spot: trunk + canopy (a shape per kind), and fruit hanging when there's some to pick
  const fruitTrees = ORCHARD.map((o, i) => {
    const g = new Group();
    at(g, o.pos.x, o.pos.y, o.pos.z, i * 1.3);
    const trunk = mesh(new CylinderGeometry(0.07, 0.11, 1.4, 6), M.log, 0, 0.7, 0);
    const kinds = {} as Record<FruitKind, { canopy: Group; fruit: Mesh[] }>;
    for (const kind of ['mango', 'banana', 'lemon'] as FruitKind[]) {
      const canopy = new Group(), fruit: Mesh[] = [];
      if (kind === 'banana') {
        // big drooping leaves fanning out from the top
        for (let k = 0; k < 6; k++) {
          const leaf = mesh(new BoxGeometry(0.34, 0.02, 0.95), M.leaf, 0, 0, 0.42); const arm = new Group();
          arm.position.y = 1.4; arm.rotation.set(0.5, k * 1.05, 0); arm.add(leaf); canopy.add(arm);
        }
        for (let k = 0; k < 4; k++) fruit.push(mesh(new CylinderGeometry(0.03, 0.02, 0.2, 5), FRUIT_MAT.banana, Math.cos(k * 1.6) * 0.1, 1.2, Math.sin(k * 1.6) * 0.1, false));
      } else {
        const r = kind === 'mango' ? 0.75 : 0.55;
        const c = mesh(new IcosahedronGeometry(r, 1), M.leaf, 0, 1.4 + r * 0.5, 0); c.scale.set(1, 0.8, 1); canopy.add(c);
        for (let k = 0; k < 4; k++) {
          const a = k * 1.6 + 0.3;
          const f = mesh(new SphereGeometry(kind === 'mango' ? 0.09 : 0.07, 6, 4), FRUIT_MAT[kind], Math.cos(a) * r * 0.85, 1.25 + (k % 2) * 0.2, Math.sin(a) * r * 0.85, false);
          if (kind === 'mango') f.scale.set(0.8, 1.2, 0.8);
          fruit.push(f);
        }
      }
      for (const f of fruit) canopy.add(f);
      g.add(canopy);
      kinds[kind] = { canopy, fruit };
    }
    g.add(trunk);
    g.visible = false;
    scene.add(g);
    pickable(trunk, S => {
      const t = S.orchard[i];
      if (!t.kind) return null;
      const lines = [onDay(t.planted, 'Planted')];
      lines.push(t.growth < 1 ? `Still growing · ${Math.round(t.growth * 100)}%` : t.fruit >= 1 ? `${Math.floor(t.fruit)} ripe ${t.kind}${t.fruit >= 2 ? 's' : ''} to pick` : 'Fully grown');
      return { title: `${cap(t.kind)} tree`, lines };
    });
    return { g, kinds };
  });

  const showParts = (parts: Object3D[], started: boolean, progress: number, damaged = false) => {
    // storm damage knocks some of the later parts off until she repairs it
    const n = started ? Math.max(1, Math.ceil(progress * (damaged ? 0.7 : 1) * parts.length)) : 0;
    parts.forEach((p, i) => { p.visible = i < n; });
  };
  const PARTS: Record<ProjectKey, Object3D[]> = { garden, rack: rack.parts, dock, hut, hearth, lookout, canoe: canoe.parts, lodge: lodge.parts, fence, coop, trap: trap.parts, barrel: barrel.parts, treehouse, houseboat: houseboat.parts, shed, bandstand, kiln, oven, beehive, sundial, mosaic, bathhouse, orchard };
  /* ---------- weathering: wood greys, stone gathers moss, fabric fades ---------- */
  // Each building gets its own copies of the shared materials (made on the
  // first update, after the island's colours are applied), which drift towards
  // a weathered colour over WEATHER_DAYS.
  const WEATHER_DAYS = 30;
  const greyWood = new Color('#77736A'), moss = new Color('#6E8463'), faded = new Color('#D8D2BC');
  const weatherTo = new Map<Material, Color>([[M.wood, greyWood], [M.log, greyWood], [hull, greyWood], [hiveWood, greyWood], [M.rock, moss], [clayMat, moss], [M.tarp, faded], [M.thatch, faded]]);
  let aging: { k: ProjectKey; mat: MeshStandardMaterial; from: Color; to: Color }[] | null = null;
  function setupAging() {
    aging = [];
    for (const k of Object.keys(PARTS) as ProjectKey[]) {
      if (k === 'lodge') continue; // (its roof swaps to tiles; its walls weather via logs below)
      const clones = new Map<Material, MeshStandardMaterial>();
      for (const part of PARTS[k]) part.traverse(o => {
        const m = o as Mesh, mat = m.material as MeshStandardMaterial;
        const to = m.isMesh ? weatherTo.get(mat) : undefined;
        if (!to) return;
        let cl = clones.get(mat);
        if (!cl) { cl = mat.clone(); clones.set(mat, cl); aging!.push({ k, mat: cl, from: mat.color.clone(), to }); }
        m.material = cl;
      });
    }
    // the lodge's walls and floor (not the roof, which swaps to tiles)
    const lodgeClones = new Map<Material, MeshStandardMaterial>();
    for (const part of lodge.parts) {
      if (lodge.roofs.includes(part)) continue;
      const m = part as Mesh, mat = m.material as MeshStandardMaterial, to = weatherTo.get(mat);
      if (!to) continue;
      let cl = lodgeClones.get(mat);
      if (!cl) { cl = mat.clone(); lodgeClones.set(mat, cl); aging.push({ k: 'lodge', mat: cl, from: mat.color.clone(), to }); }
      m.material = cl;
    }
  }
  let lastAging = -1;
  function weather(S: SimState) {
    if (!aging) setupAging();
    if (S.min - lastAging < 30) return; // every half game hour is plenty
    lastAging = S.min;
    for (const a of aging!) {
      const p = S.projects[a.k];
      const days = p.done ? (S.min - (p.builtAt ?? 0)) / 1440 : 0;
      a.mat.color.copy(a.from).lerp(a.to, 0.55 * Math.min(1, days / WEATHER_DAYS));
    }
  }

  /* ---------- tap to look: what each building is, and its story ---------- */
  const extra: Partial<Record<ProjectKey, (S: SimState) => string | null>> = {
    garden: S => {
      const crops = [...new Set(S.plots.filter(p => p.state !== 'empty' && p.crop).map(p => p.crop!))];
      return `${S.plots.filter(p => p.state === 'growing').length} beds growing, ${S.plots.filter(p => p.state === 'ripe').length} ripe${crops.length ? ` · ${crops.join(', ')}` : ''}`;
    },
    orchard: S => { const n = S.orchard.filter(t => t.kind).length; return n ? `${n} of ${S.orchard.length} trees planted` : 'Waiting for its first tree'; },
    coop: S => { const n = S.chickens.filter(c => c.penned).length + S.bredHens; return n ? `Home to ${n} hen${n > 1 ? 's' : ''}${S.young.some(y => y.kind === 'chick') ? ' and their chicks' : ''}` : 'Waiting for its first hens'; },
    fence: S => { const n = S.chickens.filter(c => c.penned).length + S.sheep.filter(c => c.penned).length + S.bredHens + S.bredSheep.length; return n ? `Keeps ${n} animal${n > 1 ? 's' : ''} safe` : 'No animals inside yet'; },
    trap: S => S.trapFish >= 1 ? `${Math.floor(S.trapFish)} fish waiting` : 'Empty for now',
    barrel: S => S.barrel >= 1 ? `${Math.floor(S.barrel)} drinks of rainwater` : 'Waiting for rain',
    beehive: S => S.hive >= 1 ? 'Heavy with honey' : 'The bees are busy',
    lodge: S => (['realbed', 'sofa', 'kitchen'] as const).filter(k => S.items[k]).length + ' of 3 rooms furnished',
    hut: S => S.items.tiles ? 'Under a tiled roof' : null,
  };
  for (const k of Object.keys(PARTS) as ProjectKey[]) {
    const describe = (S: SimState) => {
      const p = S.projects[k];
      const lines = [p.done ? onDay(S.madeAt[k], 'Built') : `Being built · ${Math.round(p.progress * 100)}%`];
      if (p.damaged) lines.push('Storm-damaged, waiting for repairs');
      const more = p.done ? extra[k]?.(S) : null;
      if (more) lines.push(more);
      if (p.done && (S.min - (p.builtAt ?? 0)) / 1440 > 20) lines.push('Weathered by sun and rain');
      if (p.done) lines.push(`“${PLANS[k].done}”`);
      return { title: cap(PLANS[k].name), lines };
    };
    for (const part of PARTS[k]) pickable(part, describe);
  }

  /** Is this world point inside the lodge's walls? */
  const inLodge = (x: number, z: number) => {
    const dx = x - LODGE_P.x, dz = z - LODGE_P.z, c = Math.cos(LODGE_YAW), s = Math.sin(LODGE_YAW);
    return Math.abs(dx * c - dz * s) < LODGE_SIZE.w / 2 && Math.abs(dx * s + dz * c) < LODGE_SIZE.d / 2;
  };

  /**
   * Mirror sim state onto the models (cheap; called every frame).
   * @param her her body, which the canoe follows while she paddles
   * @param t real seconds (bobbing)
   */
  return function updateBuildings(S: SimState, her: Object3D, t: number) {
    weather(S);
    for (const k of Object.keys(PARTS) as ProjectKey[]) showParts(PARTS[k], S.projects[k].started, S.projects[k].progress, S.projects[k].damaged);
    // the lodge replaces the shelter (and its stone walls) once it's finished
    if (S.projects.lodge.done) for (const p of hut) p.visible = false;
    if (S.projects.lodge.done && inLodge(her.position.x, her.position.z)) for (const r of lodge.roofs) r.visible = false;
    if (S.items.realbed) lodge.bedroll.visible = false;
    // fired roof tiles on the lodge
    for (const r of lodge.roofs.slice(0, 2)) (r as Mesh).material = S.items.tiles ? terracotta : M.thatch;
    hiveHoney.visible = S.projects.beehive.done && S.hive >= 1;
    bathWater.position.y = 0.42 + 0.01 * Math.sin(t * 2);
    if (S.sailing) {
      canoe.g.position.set(her.position.x, WATER_Y, her.position.z);
      canoe.g.rotation.y = her.rotation.y;
    } else {
      canoe.g.position.set(BOAT_DOCK.x, WATER_Y, BOAT_DOCK.z);
      canoe.g.rotation.y = Math.atan2(DOCK.dir.x, DOCK.dir.z);
    }
    canoe.g.position.y += 0.04 * Math.sin(t * 1.6);
    houseboat.g.position.y = WATER_Y + 0.03 * Math.sin(t * 1.2 + 1);
    houseboat.g.rotation.z = 0.015 * Math.sin(t * 0.9);
    rack.fish.forEach((f, i) => { f.visible = S.projects.rack.done && i < S.stock.fish; });
    woodpile.forEach((l, i) => { l.visible = i < S.stock.wood; });
    trap.fish.forEach((f, i) => { f.visible = S.projects.trap.done && i < Math.floor(S.trapFish); f.rotation.y = Math.sin(t * 2 + i * 2) * 0.6; });
    barrel.water.visible = S.projects.barrel.done && S.barrel >= 0.5;
    barrel.water.position.y = 0.15 + 0.08 * Math.min(8, S.barrel);
    plants.forEach(({ g, crops }, i) => {
      const p = S.plots[i];
      g.visible = S.projects.garden.done && p.state !== 'empty';
      if (!g.visible) return;
      const size = p.state === 'withered' ? 0.7 : 0.25 + 0.75 * Math.min(1, p.growth);
      g.scale.setScalar(size);
      const crop = p.crop ?? 'tomato'; // (beds sown before crops existed were tomatoes)
      for (const [k, c] of Object.entries(crops) as [Crop, typeof crops[Crop]][]) {
        c.g.visible = k === crop;
        if (k !== crop) continue;
        for (const l of c.leaves) l.material = (p.state === 'withered' ? withered : k === 'corn' ? stalkMat : M.leaf) as Material;
        for (const f of c.ripe) f.visible = p.state === 'ripe';
      }
    });
    fruitTrees.forEach(({ g, kinds }, i) => {
      const tr = S.orchard[i];
      g.visible = !!tr.kind;
      if (!tr.kind) return;
      g.scale.setScalar(0.3 + 0.7 * Math.min(1, tr.growth)); // sapling → tree
      for (const [k, v] of Object.entries(kinds) as [FruitKind, typeof kinds[FruitKind]][]) {
        v.canopy.visible = k === tr.kind;
        v.fruit.forEach((f, j) => { f.visible = j < Math.floor(tr.fruit); });
      }
    });
  };
}
