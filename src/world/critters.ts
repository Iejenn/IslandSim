// Small life around her: butterflies over the meadow in spring and summer,
// fish circling in the pond, frogs on the stones at the pond's edge, and now
// and then a curious crab that wanders up from the beach into her camp.
// Purely visual (the frogs also croak, see audio/sound.ts).
import { BoxGeometry, ConeGeometry, DoubleSide, Group, Mesh, PlaneGeometry, SphereGeometry, type Scene } from 'three';
import { FIRE, ground, pointAt, POND_R, SP, V, WATERFALL } from '../sim/island';
import { season } from '../sim/seasons';
import { hour, type SimState } from '../sim/state';
import { pickable } from './inspect';
import { mat, mesh } from './materials';

const hash = (n: number) => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };

export function createCritters(scene: Scene) {
  /* butterflies: a body and two wings that flap, drifting between spots on the meadow */
  const wingCols = ['#F2C94C', '#F5F1E6', '#7FB3E8', '#E58FB0', '#F08A4B'].map(c => mat(c, { side: DoubleSide }));
  const flies = Array.from({ length: 10 }, (_, i) => {
    const g = new Group(), wings: Mesh[] = [];
    for (const s of [-1, 1]) {
      const w = new Mesh(new PlaneGeometry(0.1, 0.08).translate(s * 0.05, 0, 0), wingCols[i % wingCols.length]);
      wings.push(w); g.add(w);
    }
    g.add(mesh(new BoxGeometry(0.015, 0.015, 0.07), mat('#3A2E28'), 0, 0, 0, false));
    g.visible = false;
    scene.add(g);
    const p = pointAt(i * 0.63, 0.2 + (i % 4) * 0.06);
    return { g, wings, x: p.x, z: p.z, tx: p.x, tz: p.z, wait: 0 };
  });

  /* fish in the pond */
  const fishMat = mat('#E08A3C', { roughness: 0.5 });
  const fish = [0, 1, 2].map(i => {
    const g = new Group();
    g.add(mesh(new SphereGeometry(0.07, 6, 4), fishMat, 0, 0, 0, false));
    (g.children[0] as Mesh).scale.set(0.6, 0.5, 1.4);
    const tail = mesh(new ConeGeometry(0.05, 0.08, 4), fishMat, 0, 0, -0.12, false);
    tail.rotation.x = -Math.PI / 2;
    g.add(tail);
    scene.add(g);
    pickable(g, () => ({ title: 'Pond fish', lines: ['Little orange fish, circling in the cool water'] }));
    return { g, r: 0.6 + i * 0.5, speed: 0.35 + i * 0.12, phase: i * 2.1 };
  });

  /* frogs on the stones at the edge of the pond, on the waterfall side */
  const frogMat = mat('#5E9A43'), eye = mat('#1E2420');
  const toFall = Math.atan2(WATERFALL.bottom.z - SP.z, WATERFALL.bottom.x - SP.x);
  const frogs = [-0.7, 0.8].map(k => {
    const g = new Group();
    const body = mesh(new SphereGeometry(0.08, 6, 5), frogMat, 0, 0.06, 0);
    body.scale.set(1, 0.7, 1.2);
    g.add(body);
    for (const x of [-0.04, 0.04]) g.add(mesh(new SphereGeometry(0.018, 5, 4), eye, x, 0.12, 0.06, false));
    const at = ground(V(SP.x + Math.cos(toFall + k) * (POND_R + 0.25), SP.z + Math.sin(toFall + k) * (POND_R + 0.25)));
    g.position.set(at.x, at.y + 0.18, at.z);
    g.rotation.y = Math.atan2(SP.x - at.x, SP.z - at.z);
    scene.add(g);
    pickable(g, () => ({ title: 'A little frog', lines: ['Sits on the stones by the waterfall', 'Croaks in the evenings'] }));
    return { g, base: at.y + 0.18, hop: Math.random() * 6 };
  });

  /* a visiting crab */
  const crabMat = mat('#D45B3A');
  const crab = new Group();
  crab.add(mesh(new BoxGeometry(0.2, 0.07, 0.14), crabMat, 0, 0.05, 0));
  for (const s of [-1, 1]) crab.add(mesh(new SphereGeometry(0.04, 5, 4), crabMat, s * 0.13, 0.06, 0.07));
  crab.visible = false;
  scene.add(crab);
  pickable(crab, () => ({ title: 'A curious crab', lines: ['Wandered up from the beach to see what she’s up to'] }));

  /** @param dt real seconds  @param t real seconds since start */
  return function updateCritters(S: SimState, dt: number, t: number) {
    const h = hour(), s = season(), day = Math.floor(S.min / 1440), rainy = S.weather.raining;

    // butterflies: by day in spring and summer, flitting from spot to spot
    const nFlies = !rainy && h > 8 && h < 18.5 ? (s === 'spring' ? 10 : s === 'summer' ? 7 : 0) : 0;
    flies.forEach((f, i) => {
      f.g.visible = i < nFlies;
      if (!f.g.visible) return;
      f.wait -= dt;
      if (f.wait <= 0) { const p = pointAt(Math.random() * 6.3, 0.15 + Math.random() * 0.35); f.tx = p.x; f.tz = p.z; f.wait = 4 + Math.random() * 6; }
      const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { f.x += dx / d * dt * 0.9; f.z += dz / d * dt * 0.9; }
      f.g.position.set(f.x + Math.sin(t * 2 + i) * 0.3, ground(V(f.x, f.z)).y + 0.6 + Math.sin(t * 3.1 + i) * 0.25, f.z + Math.cos(t * 1.7 + i) * 0.3);
      f.g.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(t * 22 + i) * 1.1;
      f.wings[0].rotation.z = flap; f.wings[1].rotation.z = -flap;
    });

    // fish: slow circles just under the surface (a smaller pool in a drought)
    fish.forEach(f => {
      const a = t * f.speed + f.phase, r = f.r * (S.min < S.droughtUntil ? 0.7 : 1);
      f.g.position.set(SP.x + Math.cos(a) * r, SP.y + 0.02, SP.z + Math.sin(a) * r);
      f.g.rotation.y = -a; // swimming along the circle
    });

    // frogs: out from spring to autumn, the odd little hop
    frogs.forEach((f, i) => {
      f.g.visible = s !== 'winter';
      f.hop -= dt;
      const k = f.hop < 0 ? Math.min(1, -f.hop / 0.35) : 0;
      f.g.position.y = f.base + Math.sin(k * Math.PI) * 0.15;
      if (f.hop < -0.35) f.hop = 4 + Math.random() * 8 + i;
    });

    // a crab visits around midday on some days: up from the beach to near the fire and back
    const visit = hash(day) < 0.45 && h > 11 && h < 14;
    crab.visible = visit;
    if (visit) {
      const from = ground(pointAt(hash(day + 7) * 6.3, 0.88)), to = ground(V(FIRE.x + 2.2, FIRE.z + 1.4));
      const k = (h - 11) / 3, there = k < 0.5 ? k * 2 : (1 - k) * 2; // walks in, then back out
      const x = from.x + (to.x - from.x) * there, z = from.z + (to.z - from.z) * there;
      crab.position.set(x, ground(V(x, z)).y, z);
      crab.rotation.y = Math.atan2(to.x - from.x, to.z - from.z) + Math.PI / 2 + Math.sin(t * 8) * 0.05; // (crabs walk sideways)
    }
  };
}
