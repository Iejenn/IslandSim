// Chickens and sheep. The sim only tracks whether each one is penned (and how
// much wool a sheep has); how they wander is visual and lives here. Wild ones
// stay near their meadow, penned ones potter about inside the fence, and the
// one she's herding home follows her (a chicken gets carried).
import { BoxGeometry, ConeGeometry, Group, type Object3D, type Scene } from 'three';
import { CHICKEN_HOMES, COOP_P, SHEEP_HOMES, SHEEP_PEN_P, type Pt } from '../sim/island';
import { surfaceY } from '../sim/plans';
import type { SimState } from '../sim/state';
import { mat, mesh } from './materials';

const white = mat('#F4F1E8'), red = mat('#C9452F'), beak = mat('#E3A43A'), fleece = mat('#ECE7DA'), face = mat('#3B3530');

function chickenModel() {
  const g = new Group(), body = new Group();
  body.add(mesh(new BoxGeometry(0.18, 0.16, 0.24), white, 0, 0.2, 0));
  body.add(mesh(new BoxGeometry(0.1, 0.12, 0.1), white, 0, 0.32, 0.11)); // head
  body.add(mesh(new BoxGeometry(0.03, 0.05, 0.06), red, 0, 0.4, 0.11)); // comb
  const b = mesh(new ConeGeometry(0.025, 0.06, 4), beak, 0, 0.31, 0.18);
  b.rotation.x = Math.PI / 2;
  body.add(b);
  for (const x of [-0.04, 0.04]) body.add(mesh(new BoxGeometry(0.02, 0.12, 0.02), beak, x, 0.06, 0));
  g.add(body);
  return { g, body };
}

function sheepModel() {
  const g = new Group(), body = new Group();
  const wool = mesh(new BoxGeometry(0.5, 0.36, 0.7), fleece, 0, 0.5, 0);
  body.add(wool);
  body.add(mesh(new BoxGeometry(0.2, 0.22, 0.24), face, 0, 0.6, 0.42)); // head
  const legs = [[-0.15, 0.22], [0.15, 0.22], [-0.15, -0.22], [0.15, -0.22]].map(([x, z]) => {
    const l = new Group();
    l.position.set(x, 0.32, z);
    l.add(mesh(new BoxGeometry(0.08, 0.32, 0.08), face, 0, -0.16, 0));
    body.add(l);
    return l;
  });
  g.add(body);
  return { g, body, wool, legs };
}

interface Critter { g: Group; body: Group; home: Pt; target: { x: number; z: number }; t: number }

export function createLivestock(scene: Scene) {
  const make = <T extends { g: Group; body: Group }>(homes: Pt[], model: () => T) => homes.map(home => {
    const m = model();
    m.g.position.set(home.x, 0, home.z);
    scene.add(m.g);
    return { ...m, home, target: { x: home.x, z: home.z }, t: Math.random() * 3 };
  });
  const chickens = make(CHICKEN_HOMES, chickenModel);
  const sheep = make(SHEEP_HOMES, sheepModel);

  function wander(c: Critter, centre: Pt, radius: number, speed: number, dt: number, t: number, follow: Object3D | null, carried: boolean) {
    if (carried && follow) {
      // tucked under her arm
      c.g.position.set(follow.position.x + Math.sin(follow.rotation.y) * 0.3, follow.position.y + 0.9, follow.position.z + Math.cos(follow.rotation.y) * 0.3);
      c.g.rotation.y = follow.rotation.y;
      return;
    }
    if (follow) {
      c.target.x = follow.position.x - Math.sin(follow.rotation.y) * 1.1;
      c.target.z = follow.position.z - Math.cos(follow.rotation.y) * 1.1;
      speed *= 3;
    } else {
      c.t -= dt;
      if (c.t <= 0) {
        c.t = 2 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
        c.target.x = centre.x + Math.cos(a) * r;
        c.target.z = centre.z + Math.sin(a) * r;
      }
    }
    const dx = c.target.x - c.g.position.x, dz = c.target.z - c.g.position.z, d = Math.hypot(dx, dz);
    if (d > 20) { c.g.position.x = c.target.x; c.g.position.z = c.target.z; } // jumped (e.g. loading a save)
    else if (d > 0.1) {
      const step = Math.min(d, speed * dt);
      c.g.position.x += dx / d * step;
      c.g.position.z += dz / d * step;
      c.g.rotation.y = Math.atan2(dx, dz);
    }
    c.g.position.y = surfaceY(c.g.position.x, c.g.position.z);
    // pecking / grazing: a little head-down bob while standing still
    c.body.rotation.x = d <= 0.1 ? Math.max(0, Math.sin(t * 3 + c.home.x)) * 0.25 : 0;
  }

  /** @param dt real seconds  @param t real seconds since start */
  return function updateLivestock(S: SimState, her: Object3D, dt: number, t: number) {
    const herding = S.task?.id === 'herd' && S.task.animal && S.task.i >= 2 && S.task.i <= 3 ? S.task.animal : null;
    chickens.forEach((c, i) => {
      const penned = S.chickens[i].penned, mine = herding?.kind === 'chicken' && herding.i === i;
      wander(c, penned ? COOP_P : c.home, penned ? 1.8 : 1.6, 0.6, dt, t, mine ? her : null, mine);
    });
    sheep.forEach((s, i) => {
      const penned = S.sheep[i].penned, mine = herding?.kind === 'sheep' && herding.i === i;
      wander(s, penned ? SHEEP_PEN_P : s.home, penned ? 2.2 : 2.5, 0.35, dt, t, mine ? her : null, false);
      // a full fleece makes them visibly fluffier
      const fluff = penned ? 0.8 + 0.35 * S.sheep[i].wool : 1.1;
      s.wool.scale.set(fluff, fluff, 1 + (fluff - 1) * 0.5);
      s.legs.forEach((l, k) => { l.rotation.x = mine ? Math.sin(t * 10 + k * Math.PI) * 0.5 : 0; });
    });
  };
}
