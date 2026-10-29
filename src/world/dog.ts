// The stray dog. The sim only knows whether it exists, where it washed up and
// whether it trusts her; how it moves is purely visual and lives here:
// a wary dog wanders near its spot, a friend trots after her, lies down when
// she sits, and bounds around her while they play fetch.
import { BoxGeometry, ConeGeometry, Group, type Object3D, type Scene } from 'three';
import { DOCK_START } from '../sim/island';
import { surfaceY } from '../sim/plans';
import type { SimState } from '../sim/state';
import { mat, mesh } from './materials';

const fur = mat('#C99A5B'), dark = mat('#5A3E28');

export function createDog(scene: Scene) {
  const dog = new Group(), body = new Group();
  body.add(mesh(new BoxGeometry(0.26, 0.24, 0.55), fur, 0, 0.36, 0));
  const head = new Group();
  head.position.set(0, 0.52, 0.32);
  head.add(mesh(new BoxGeometry(0.22, 0.2, 0.22), fur));
  head.add(mesh(new BoxGeometry(0.12, 0.1, 0.14), fur, 0, -0.04, 0.16)); // snout
  head.add(mesh(new BoxGeometry(0.05, 0.04, 0.03), dark, 0, -0.01, 0.24)); // nose
  for (const x of [-0.08, 0.08]) {
    const ear = mesh(new ConeGeometry(0.05, 0.12, 4), dark, x, 0.13, -0.03);
    ear.rotation.z = x * 2;
    head.add(ear);
  }
  body.add(head);
  const tail = mesh(new BoxGeometry(0.05, 0.05, 0.25), fur, 0, 0.46, -0.34);
  tail.rotation.x = 0.7;
  body.add(tail);
  const legs = [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]].map(([x, z]) => {
    const leg = new Group();
    leg.position.set(x, 0.26, z);
    leg.add(mesh(new BoxGeometry(0.07, 0.26, 0.07), fur, 0, -0.13, 0));
    body.add(leg);
    return leg;
  });
  dog.add(body);
  dog.visible = false;
  scene.add(dog);

  let wanderAngle = 0, wanderT = 0;
  const target = { x: 0, z: 0 };

  /**
   * @param dt real seconds  @param t real seconds since start
   * @param her her body (position + facing)
   */
  return function updateDog(S: SimState, her: Object3D, dt: number, t: number) {
    const d = S.dog;
    dog.visible = d.state !== 'none';
    if (!dog.visible) return;
    let lying = false, speed = 1.6, playing = false;
    if (d.state === 'wild') {
      // wander a couple of steps around where it washed up; lie down at night
      wanderT -= dt;
      if (wanderT <= 0) { wanderT = 3 + Math.random() * 4; wanderAngle = Math.random() * Math.PI * 2; }
      target.x = d.home.x + Math.cos(wanderAngle) * 1.2;
      target.z = d.home.z + Math.sin(wanderAngle) * 1.2;
      const h = (S.min / 60) % 24;
      lying = h >= 21 || h < 6;
      speed = 0.8;
    } else if (S.sailing) {
      target.x = DOCK_START.x; target.z = DOCK_START.z; // waits on the shore
      lying = true;
    } else if (S.task?.id === 'play') {
      // bound around her in wide circles, as if chasing a stick
      playing = true;
      target.x = her.position.x + Math.cos(t * 1.4) * 2.4;
      target.z = her.position.z + Math.sin(t * 1.4) * 2.4;
      speed = 5;
    } else {
      // heel: a little behind and to the side of her
      const a = her.rotation.y;
      target.x = her.position.x - Math.sin(a) * 1.0 + Math.cos(a) * 0.6;
      target.z = her.position.z - Math.cos(a) * 1.0 - Math.sin(a) * 0.6;
      lying = S.sitting;
      speed = 4.5;
    }
    const dx = target.x - dog.position.x, dz = target.z - dog.position.z, dist = Math.hypot(dx, dz);
    if (dist > 15) { dog.position.x = target.x; dog.position.z = target.z; } // e.g. after loading a save
    else if (dist > 0.05) {
      const step = Math.min(dist, speed * dt * Math.min(1, dist)); // slows down as it arrives
      dog.position.x += dx / dist * step;
      dog.position.z += dz / dist * step;
      if (dist > 0.3 || playing) dog.rotation.y = Math.atan2(dx, dz);
    }
    dog.position.y = surfaceY(dog.position.x, dog.position.z);
    const moving = dist > 0.3;
    // lying down: body lowered, legs tucked
    body.position.y += ((lying && !moving ? -0.2 : 0) - body.position.y) * Math.min(1, dt * 6);
    legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : lying ? (i < 2 ? -1.4 : 1.4) : 0; });
    tail.rotation.y = Math.sin(t * (d.state === 'friend' ? 14 : 4)) * 0.5; // a friend wags a lot more
  };
}
