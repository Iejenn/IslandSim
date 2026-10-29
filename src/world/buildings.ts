// 3D models for the things she builds herself, plus the woodpile and the
// garden plants. Each project is a list of parts that appear one by one as
// her building progress goes up, so you can watch it take shape.
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, IcosahedronGeometry, Shape, SphereGeometry,
  type Material, type Mesh, type Object3D, type Scene,
} from 'three';
import { DOCK, FIRE, GARDEN_P, PLOTS, RACK_P, SH, WOODPILE_P, yawTo } from '../sim/island';
import type { ProjectKey, SimState } from '../sim/state';
import { M, mat, mesh } from './materials';

const soil = mat('#6B4A33'), withered = mat('#8A7A4E'), fruitRed = mat('#D9452B', { roughness: 0.5 }), fruitGold = mat('#E8A33A', { roughness: 0.5 });

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

  /* walls for the shelter: two sloped side walls, a back wall, and a front with a doorway */
  const hut = (() => {
    const g = new Group();
    at(g, SH.x, SH.y, SH.z, yawTo(SH, FIRE));
    scene.add(g);
    const side = new Shape();
    // profile in (−z, y): follows the roof from the tall front posts to the low back posts
    side.moveTo(-0.72, 0); side.lineTo(0.82, 0); side.lineTo(0.82, 0.3); side.lineTo(-0.72, 1.55); side.lineTo(-0.72, 0);
    const sideGeo = new ExtrudeGeometry(side, { depth: 0.07, bevelEnabled: false });
    sideGeo.rotateY(Math.PI / 2);
    const parts: Object3D[] = [-1.18, 1.11].map(x => mesh(sideGeo, M.wood, x, 0, 0));
    parts.push(mesh(new BoxGeometry(2.3, 0.36, 0.07), M.wood, 0, 0.18, -0.82));
    for (const x of [-0.76, 0.76]) parts.push(mesh(new BoxGeometry(0.7, 1.5, 0.07), M.wood, x, 0.75, 0.72));
    for (const p of parts) { p.visible = false; g.add(p); }
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

  const showParts = (parts: Object3D[], started: boolean, progress: number) => {
    const n = started ? Math.max(1, Math.ceil(progress * parts.length)) : 0;
    parts.forEach((p, i) => { p.visible = i < n; });
  };
  const PARTS: Record<ProjectKey, Object3D[]> = { garden, rack: rack.parts, dock, hut };

  /** Mirror sim state onto the models (cheap; called every frame). */
  return function updateBuildings(S: SimState) {
    for (const k of Object.keys(PARTS) as ProjectKey[]) showParts(PARTS[k], S.projects[k].started, S.projects[k].progress);
    rack.fish.forEach((f, i) => { f.visible = S.projects.rack.done && i < S.stock.fish; });
    woodpile.forEach((l, i) => { l.visible = i < S.stock.wood; });
    plants.forEach(({ g, leaves, fruits }, i) => {
      const p = S.plots[i];
      g.visible = S.projects.garden.done && p.state !== 'empty';
      if (!g.visible) return;
      const size = p.state === 'withered' ? 0.7 : 0.25 + 0.75 * Math.min(1, p.growth);
      g.scale.setScalar(size);
      leaves.material = (p.state === 'withered' ? withered : M.leaf) as Material;
      fruits.forEach(f => { f.visible = p.state === 'ripe'; f.material = p.fine ? fruitGold : fruitRed; });
    });
  };
}
