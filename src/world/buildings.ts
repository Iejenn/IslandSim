// 3D models for the things she builds herself, plus the woodpile and the
// garden plants. Each project is a list of parts that appear one by one as
// her building progress goes up, so you can watch it take shape.
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, TorusGeometry, Group, IcosahedronGeometry, Shape, SphereGeometry,
  type Material, type Mesh, type Object3D, type Scene, ConeGeometry, DodecahedronGeometry,
} from 'three';
import { HOUSEBOAT_P, HOUSEBOAT_YAW, BARREL_P, TRAP_A, TRAP_P, TREEHOUSE_DECK, TREEHOUSE_P, BOAT_DOCK, COOP_P, DOCK, FENCE_GATES, FENCE_R, FIRE, GARDEN_P, ground, LODGE_P, LODGE_SIZE, LODGE_YAW, LOOKOUT_DECK, LOOKOUT_P, PLOTS, RACK_P, SH, V, WOODPILE_P, yawTo } from '../sim/island';
import type { ProjectKey, SimState } from '../sim/state';
import { M, mat, mesh } from './materials';

const soil = mat('#6B4A33'), withered = mat('#8A7A4E'), fruitRed = mat('#D9452B', { roughness: 0.5 }), hull = mat('#8A5A34');
const WATER_Y = 0.12;
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
    tree.add(mesh(new IcosahedronGeometry(1.7, 0), M.leaf, 0, 5.0, 0));
    tree.add(mesh(new IcosahedronGeometry(1.1, 0), M.leaf2, 0.8, 5.6, -0.4));
    tree.add(mesh(new IcosahedronGeometry(1.0, 0), M.leaf2, -0.9, 4.6, 0.3));
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
  const PARTS: Record<ProjectKey, Object3D[]> = { garden, rack: rack.parts, dock, hut, hearth, lookout, canoe: canoe.parts, lodge: lodge.parts, fence, coop, trap: trap.parts, barrel: barrel.parts, treehouse, houseboat: houseboat.parts };
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
    for (const k of Object.keys(PARTS) as ProjectKey[]) showParts(PARTS[k], S.projects[k].started, S.projects[k].progress, S.projects[k].damaged);
    // the lodge replaces the shelter (and its stone walls) once it's finished
    if (S.projects.lodge.done) for (const p of hut) p.visible = false;
    if (S.projects.lodge.done && inLodge(her.position.x, her.position.z)) for (const r of lodge.roofs) r.visible = false;
    if (S.items.realbed) lodge.bedroll.visible = false;
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
