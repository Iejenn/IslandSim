// What island events leave lying around: a wrecked boat with crates, a turtle
// nest (and its hatchlings scrambling to the sea), the hurt seagull (later her
// pet, following her about), holes she dug for the treasure, and the clay pit
// by the pond. The sim decides what exists; this only shows it.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, type Mesh, type Object3D, type Scene } from 'three';
import { CLAY_P, ground, pointAt, V } from '../sim/island';
import type { SimState } from '../sim/state';
import { digPos, GULL_P, nestPos, wreckPos } from '../sim/tasks';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';
import { v3 } from './stage';

const shell = mat('#6E7F4A'), skin = mat('#8E9D6A'), sand = mat('#CDB27F'), clay = mat('#B86A43'), gullWhite = mat('#F3F1EA'), gullGrey = mat('#9AA3AA'), beak = mat('#E3A43A'), hole = mat('#A88B5C');

function turtle(s: number) {
  const g = new Group();
  const back = mesh(new SphereGeometry(0.5 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0.02, 0);
  back.scale.set(1, 0.55, 1.2);
  g.add(back);
  g.add(mesh(new SphereGeometry(0.15 * s, 6, 5), skin, 0, 0.1 * s, 0.62 * s)); // head
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const f = mesh(new BoxGeometry(0.28 * s, 0.04, 0.12 * s), skin, x * 0.45 * s, 0.03, z * 0.35 * s);
    f.rotation.y = x * z * 0.5;
    g.add(f);
  }
  return g;
}
function gull() {
  const g = new Group();
  g.add(mesh(new SphereGeometry(0.13, 7, 5), gullWhite, 0, 0.16, 0));
  g.add(mesh(new SphereGeometry(0.08, 6, 5), gullWhite, 0, 0.27, 0.1));
  const b = mesh(new ConeGeometry(0.025, 0.09, 4), beak, 0, 0.26, 0.2);
  b.rotation.x = Math.PI / 2;
  g.add(b);
  for (const x of [-1, 1]) {
    const w = mesh(new BoxGeometry(0.05, 0.03, 0.22), gullGrey, x * 0.13, 0.19, -0.02);
    w.rotation.z = x * 0.3;
    g.add(w);
  }
  g.scale.set(1.2, 1.2, 1.2);
  return g;
}

export function createEvents(scene: Scene) {
  const add = <T extends Object3D>(o: T) => { o.visible = false; scene.add(o); return o; };

  // the wreck: a broken hull on its side and three crates
  const wreck = add(new Group());
  const hull = mesh(new BoxGeometry(1.4, 0.7, 3.2), M.log, 0, 0.25, 0);
  hull.rotation.set(0.1, 0, 0.5);
  wreck.add(hull, mesh(new BoxGeometry(0.06, 1.6, 0.06), M.wood, -0.3, 0.9, 0.4)); // snapped mast
  const crates = [[1.2, 0.6], [1.5, -0.5], [-1.3, 1.2]].map(([x, z]) => mesh(new BoxGeometry(0.5, 0.45, 0.5), M.wood, x, 0.22, z));
  crates.forEach(c => wreck.add(c));

  // the turtle nest: a mound of sand, the mother on the first day, then hatchlings
  const nest = add(mesh(new CylinderGeometry(0.4, 0.7, 0.18, 9), sand));
  const mother = add(turtle(1.4));
  const babies = Array.from({ length: 8 }, () => add(turtle(0.18)));

  // the gull: hurt (hopping by the fire), then perhaps her pet
  const bird = add(gull());
  pickable(wreck, S => ({ title: 'A shipwreck', lines: [S.wreck.state === 'ashore' ? 'Crates still waiting to be opened' : 'She salvaged what she could'] }));
  pickable(nest, () => ({ title: 'A turtle nest', lines: ['Eggs buried in the warm sand', 'She keeps an eye on it'] }));
  pickable(bird, S => S.gull.state === 'pet' ? { title: 'Captain', lines: ['A seagull she nursed back to health', 'Decided to stay'] } : { title: 'A hurt seagull', lines: ['She’s nursing its wing'] });

  // dug holes for the treasure, and the clay pit (always there)
  const holes: Mesh[] = [0, 1, 2].map(() => add(mesh(new CylinderGeometry(0.35, 0.3, 0.04, 8), hole)));
  const pit = mesh(new CylinderGeometry(0.75, 0.85, 0.05, 9), clay, CLAY_P.x, CLAY_P.y + 0.02, CLAY_P.z, false);
  pit.receiveShadow = true;
  scene.add(pit);
  pickable(pit, () => ({ title: 'Clay pit', lines: ['Sticky orange clay for her pottery'] }));

  /** @param her her body @param t real seconds */
  return function updateEvents(S: SimState, her: Object3D, t: number) {
    wreck.visible = S.wreck.state !== 'none';
    if (wreck.visible) {
      const p = wreckPos();
      wreck.position.copy(v3(p));
      wreck.rotation.y = S.wreck.a;
      crates.forEach(c => { c.visible = S.wreck.state === 'ashore'; });
    }

    nest.visible = S.turtle.state === 'nest';
    const np = S.turtle.state !== 'none' ? nestPos() : null;
    if (np) nest.position.copy(v3(np));
    // the mother turtle is only there the morning the nest appears
    mother.visible = !!np && S.turtle.state === 'nest' && S.min - (S.turtle.hatchAt - 10 * 1440) < 12 * 60;
    if (mother.visible && np) { mother.position.set(np.x + 0.9, np.y, np.z); mother.rotation.y = S.turtle.a + Math.PI / 2; }
    // hatchlings scramble down to the sea for half a day after hatching
    const since = S.min - S.turtle.hatchAt;
    babies.forEach((b, i) => {
      b.visible = S.turtle.state === 'hatched' && since < 12 * 60 && !!np;
      if (!b.visible || !np) return;
      // a scattered little crowd, each at its own pace
      const k = Math.min(1, since / (200 + (i * 37) % 90)), sea = pointAt(S.turtle.a + (i - 4) * 0.012, 1.05);
      const jx = Math.sin(i * 2.3) * 0.35, jz = Math.cos(i * 1.7) * 0.35;
      b.position.set(np.x + jx + (sea.x - np.x - jx) * k, 0, np.z + jz + (sea.z - np.z - jz) * k);
      b.position.y = ground(V(b.position.x, b.position.z)).y;
      b.rotation.y = Math.atan2(sea.x - np.x, sea.z - np.z);
    });

    bird.visible = S.gull.state === 'hurt' || S.gull.state === 'pet';
    if (S.gull.state === 'hurt') {
      bird.position.set(GULL_P.x + Math.sin(t * 0.4) * 0.5, GULL_P.y + Math.abs(Math.sin(t * 3)) * 0.05, GULL_P.z);
      bird.rotation.y = Math.sin(t * 0.4) > 0 ? 1.4 : -1.4;
    } else if (S.gull.state === 'pet') {
      // perched near her, or circling above when she's on the move
      const a = t * 0.8;
      bird.position.set(her.position.x + Math.cos(a) * 1.4, her.position.y + 2.2 + Math.sin(t * 1.3) * 0.2, her.position.z + Math.sin(a) * 1.4);
      bird.rotation.y = -a;
    }

    holes.forEach((h, i) => {
      const a = S.treasure.spots[i];
      h.visible = a !== undefined && i < S.treasure.found;
      if (h.visible) { const p = digPos(a); h.position.set(p.x, p.y + 0.01, p.z); }
    });
  };
}
