// Wildlife for atmosphere only (nothing here touches the sim): crabs
// scuttling along the beach, seagulls circling overhead, and fish that now
// and then jump out of the shallows.
import { BoxGeometry, ConeGeometry, Group, type Mesh, type Scene } from 'three';
import { height, pointAt } from '../sim/island';
import { mat, mesh } from './materials';

const crabMat = mat('#D45B3A'), gullMat = mat('#F3F1EA'), gullTip = mat('#3A3F45'), fishMat = mat('#8FB6C4', { roughness: 0.4, metalness: 0.2 });
const WATER_Y = 0.12;

export function createAnimals(scene: Scene) {
  /* crabs: wander sideways along the shoreline, pausing now and then */
  const crabs = Array.from({ length: 6 }, (_, i) => {
    const g = new Group();
    g.add(mesh(new BoxGeometry(0.2, 0.07, 0.14), crabMat, 0, 0.05, 0));
    for (const x of [-0.13, 0.13]) g.add(mesh(new BoxGeometry(0.06, 0.04, 0.06), crabMat, x, 0.06, 0.08)); // claws
    scene.add(g);
    return { g, a: i / 6 * Math.PI * 2 + 0.3, dir: i % 2 ? 1 : -1, pause: 0 };
  });

  /* seagulls: two wings that flap, circling at different heights */
  const gulls = Array.from({ length: 5 }, (_, i) => {
    const g = new Group();
    g.add(mesh(new BoxGeometry(0.1, 0.08, 0.35), gullMat, 0, 0, 0, false));
    const wings = [-1, 1].map(s => {
      const w = new Group();
      w.add(mesh(new BoxGeometry(0.55, 0.02, 0.18), gullMat, s * 0.28, 0, 0, false));
      w.add(mesh(new BoxGeometry(0.15, 0.021, 0.18), gullTip, s * 0.5, 0, 0, false));
      g.add(w);
      return { w, s };
    });
    scene.add(g);
    return { g, wings, r: 14 + i * 4, h: 9 + (i % 3) * 2.5, speed: 0.12 + i * 0.02, phase: i * 1.7 };
  });

  /* a fish that leaps out of the water every few seconds */
  const fish = mesh(new ConeGeometry(0.08, 0.35, 5), fishMat, 0, 0, 0, false) as Mesh;
  fish.visible = false;
  scene.add(fish);
  let jump = { t: -1, x: 0, z: 0, dx: 0, dz: 0, wait: 3 };

  /** @param dt real seconds  @param t real seconds since start  @param night crabs and gulls rest at night */
  return function updateAnimals(dt: number, t: number, night: boolean) {
    for (const c of crabs) {
      c.g.visible = !night;
      c.pause -= dt;
      if (c.pause <= 0 && Math.random() < dt * 0.3) c.pause = 1 + Math.random() * 2;
      if (c.pause <= 0) c.a += c.dir * dt * 0.02;
      if (Math.random() < dt * 0.05) c.dir *= -1;
      const p = pointAt(c.a, 0.97);
      c.g.position.set(p.x, Math.max(height(p.x, p.z), WATER_Y - 0.05), p.z);
      c.g.rotation.y = c.a; // sideways to the direction it walks, like a crab
    }
    for (const g of gulls) {
      g.g.visible = !night;
      const a = t * g.speed + g.phase;
      g.g.position.set(Math.cos(a) * g.r, g.h + Math.sin(t * 0.7 + g.phase) * 0.6, Math.sin(a) * g.r);
      g.g.rotation.y = -a; // facing along the circle
      const flap = Math.sin(t * 7 + g.phase) * 0.45;
      for (const { w, s } of g.wings) w.rotation.z = s * flap;
    }
    if (jump.t < 0) {
      jump.wait -= dt;
      fish.visible = false;
      if (jump.wait <= 0) {
        const a = Math.random() * Math.PI * 2, p = pointAt(a, 1.15 + Math.random() * 0.25);
        jump = { t: 0, x: p.x, z: p.z, dx: Math.cos(a + 1.57), dz: Math.sin(a + 1.57), wait: 4 + Math.random() * 6 };
      }
    } else {
      jump.t += dt;
      const k = jump.t / 0.9; // a 0.9 s arc
      if (k >= 1) { jump.t = -1; return; }
      fish.visible = true;
      fish.position.set(jump.x + jump.dx * k * 1.2, WATER_Y + Math.sin(k * Math.PI) * 0.9, jump.z + jump.dz * k * 1.2);
      fish.rotation.set(0, Math.atan2(jump.dx, jump.dz), Math.PI / 2 + (k - 0.5) * 2); // nose up, then down
    }
  };
}
