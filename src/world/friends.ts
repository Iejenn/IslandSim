// Her animal friends (sim/friends.ts) in the world: ducks paddling on the pond
// (ducklings in a line behind their mother), and the parrot, high in a forest
// tree while it's wild, then on its perch in camp, or on her shoulder when she
// sits down.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, type Object3D, type Scene } from 'three';
import { FOREST, ground, POND_R, SH, SP, V } from '../sim/island';
import { PARROT_TREE } from '../sim/friends';
import type { SimState } from '../sim/state';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';

const duckBody = mat('#8A6A48'), drake = mat('#2F6B4A'), white = mat('#F2EDE0'), beak = mat('#E3A13A');
const red = mat('#D2382E'), blue = mat('#2F6DB5'), yellow = mat('#F2C230');

export function createFriends(scene: Scene) {
  let gather = 0, lastT = 0; // 0…1: how far the ducks have come over to her while she feeds them
  /* ducks: two grown-ups and up to four ducklings */
  const ducks = Array.from({ length: 6 }, (_, i) => {
    const g = new Group(), s = i < 2 ? 1 : 0.55;
    const body = mesh(new SphereGeometry(0.14, 7, 5), i === 0 ? white : i === 1 ? duckBody : mat('#E8C95A'), 0, 0.05, 0, false); body.scale.set(0.8, 0.6, 1.2); g.add(body);
    g.add(mesh(new SphereGeometry(0.08, 6, 4), i === 0 ? drake : i === 1 ? duckBody : mat('#E8C95A'), 0, 0.17, 0.12, false));
    const bill = mesh(new ConeGeometry(0.03, 0.08, 4), beak, 0, 0.16, 0.22, false); bill.rotation.x = Math.PI / 2; g.add(bill);
    g.scale.setScalar(s);
    g.visible = false;
    scene.add(g);
    pickable(g, S => ({ title: i < 2 ? 'A duck' : 'A duckling', lines: [S.ducks > 2 ? 'One of the pond’s duck family' : 'Settled on her pond'] }));
    return g;
  });

  /* the parrot */
  const parrot = new Group(), wings: Object3D[] = [];
  const pbody = mesh(new SphereGeometry(0.11, 7, 5), red, 0, 0.12, 0, false); pbody.scale.set(0.8, 1.2, 0.8); parrot.add(pbody);
  parrot.add(mesh(new SphereGeometry(0.08, 6, 5), red, 0, 0.27, 0.03, false));
  const pbeak = mesh(new ConeGeometry(0.03, 0.07, 4), yellow, 0, 0.25, 0.1, false); pbeak.rotation.x = Math.PI / 2 + 0.6; parrot.add(pbeak);
  const tail = mesh(new BoxGeometry(0.06, 0.22, 0.02), blue, 0, -0.02, -0.07, false); tail.rotation.x = -0.4; parrot.add(tail);
  for (const s of [-1, 1]) { const w = mesh(new BoxGeometry(0.03, 0.17, 0.12), blue, s * 0.09, 0.13, -0.01, false); parrot.add(w); wings.push(w); }
  parrot.visible = false;
  scene.add(parrot);
  pickable(parrot, S => S.parrot.state === 'friend'
    ? { title: S.parrot.name, lines: ['Her parrot', S.parrot.words.length ? `Knows ${S.parrot.words.length} of her sayings` : 'Still learning to talk'] }
    : { title: 'A wild parrot', lines: [S.parrot.trust > 0 ? 'Getting curious about her' : 'Watches her from the trees'] });
  // its perch in camp, by the shelter
  const perchAt = ground(V(SH.x + 1.3, SH.z + 1.1));
  const perch = new Group();
  perch.add(mesh(new CylinderGeometry(0.035, 0.045, 1.6, 5), M.log, 0, 0.8, 0));
  const bar = mesh(new CylinderGeometry(0.025, 0.025, 0.5, 5), M.log, 0, 1.6, 0); bar.rotation.z = Math.PI / 2; perch.add(bar);
  perch.position.set(perchAt.x, perchAt.y, perchAt.z);
  perch.visible = false;
  scene.add(perch);
  const tree = FOREST[PARROT_TREE].pos;

  /** @param t real seconds  @param her her body (the parrot rides on her shoulder when she sits) */
  return function updateFriends(S: SimState, her: Object3D, t: number) {
    // ducks: the grown-ups paddle slow circles, the ducklings follow their mother in a line
    const n = S.ducks ?? 0;
    // while she's feeding them they paddle over and crowd in front of her, bobbing for the bits she throws
    const st = S.task?.steps[S.task.i], feeding = S.task?.id === 'ducks' && st?.type === 'do' && S.task.started;
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    gather = Math.max(0, Math.min(1, gather + (feeding ? dt / 3 : -dt / 5)));
    const toHer = Math.atan2(her.position.z - SP.z, her.position.x - SP.x), k = gather * gather * (3 - 2 * gather);
    ducks.forEach((d, i) => {
      d.visible = i < n;
      if (!d.visible) return;
      const lead = i < 2 ? i : 1, a = t * 0.12 * (lead ? -1 : 1) + lead * 2.5 - (i >= 2 ? (i - 1) * 0.18 : 0), r = POND_R * (lead ? 0.55 : 0.75);
      // where it'd be paddling round the pond, and where it waits in front of her (a little loose crowd)
      const ax = SP.x + Math.cos(a) * r, az = SP.z + Math.sin(a) * r;
      const fa = toHer + (i - (n - 1) / 2) * 0.22 + 0.05 * Math.sin(t * 1.3 + i), fr = POND_R - 0.55 - (i % 2) * 0.35;
      const fx = SP.x + Math.cos(fa) * fr, fz = SP.z + Math.sin(fa) * fr;
      const peck = k > 0.9 ? Math.max(0, Math.sin(t * 4 + i * 1.7)) * 0.05 : 0; // ducking for the food
      d.position.set(ax + (fx - ax) * k, SP.y + 0.14 + 0.01 * Math.sin(t * 3 + i) - peck, az + (fz - az) * k);
      const paddleYaw = -a + (lead ? Math.PI : 0), faceYaw = Math.atan2(her.position.x - fx, her.position.z - fz);
      d.rotation.y = k > 0.5 ? faceYaw : paddleYaw;
      d.rotation.x = peck * 6;
    });
    // the parrot
    const p = S.parrot;
    parrot.visible = p.state !== 'none';
    perch.visible = p.state === 'friend';
    if (!parrot.visible) return;
    let flap = 0;
    if (p.state === 'wild') {
      parrot.position.set(tree.x + 0.4, tree.y + 3.3, tree.z);
      parrot.rotation.y = t * 0.2;
      flap = Math.sin(t * 0.7) > 0.95 ? Math.sin(t * 30) : 0; // a ruffle now and then
    } else if (S.sitting && Math.hypot(her.position.x - SH.x, her.position.z - SH.z) < 8) {
      // on her shoulder
      const yaw = her.rotation.y;
      parrot.position.set(her.position.x + Math.cos(yaw) * 0.2, her.position.y + 1.05, her.position.z - Math.sin(yaw) * 0.2);
      parrot.rotation.y = yaw;
    } else {
      parrot.position.set(perchAt.x, perchAt.y + 1.63, perchAt.z);
      parrot.rotation.y = Math.sin(t * 0.3) * 1.2; // looking around
      flap = Math.sin(t * 0.9) > 0.97 ? Math.sin(t * 30) : 0;
    }
    wings[0].rotation.z = -0.2 - Math.abs(flap) * 0.9; wings[1].rotation.z = 0.2 + Math.abs(flap) * 0.9;
  };
}
