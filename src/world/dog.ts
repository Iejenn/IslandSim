// The stray dog. The sim only knows whether it exists, where it washed up and
// whether it trusts her; how it behaves is purely visual and lives here.
// A wary dog wanders near its spot. A friend has a life of its own: it trots
// after her a lot of the time, but also wanders off to sniff around, dig in the
// sand, chase a crab, roll on its back, drink at the pond, nap in the shade on
// hot afternoons and bark at the waves. It lies down beside her when she sits,
// bounds around her when they play, and curls up by the fire at night.
import { BoxGeometry, ConeGeometry, Group, SphereGeometry, type Object3D, type Scene } from 'three';
import { DOCK_START, FIRE, FOREST, height, islandR, POND_R, SP, V } from '../sim/island';
import { route } from '../sim/pathing';
import { surfaceY } from '../sim/plans';
import type { SimState } from '../sim/state';
import { seaLevel } from '../sim/tide';
import { pickable } from './inspect';
import { mat, mesh } from './materials';

const fur = mat('#C99A5B'), dark = mat('#5A3E28'), crabMat = mat('#D45B3A');

type Act = 'heel' | 'sniff' | 'dig' | 'crab' | 'roll' | 'drink' | 'nap' | 'bark' | 'fire' | 'beside';
const DOING: Record<Act, string> = {
  heel: 'Trotting after her', sniff: 'Sniffing around', dig: 'Digging a hole', crab: 'Chasing a crab', roll: 'Rolling in the sand',
  drink: 'Lapping at the pond', nap: 'Napping in the shade', bark: 'Barking at the waves', fire: 'Curled up by the fire', beside: 'Lying beside her',
};

/** Barks for the sound to pick up (n goes up by one per woof). */
export const dogBarks = { n: 0, x: 0, z: 0 };
/** What the dog's up to (for the dev console and tests). */
export const dogNow = { doing: '' };

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

  // the crab it plays with (its own, scuttling about on the beach)
  const crab = new Group();
  crab.add(mesh(new BoxGeometry(0.16, 0.06, 0.11), crabMat, 0, 0.04, 0));
  for (const s of [-1, 1]) crab.add(mesh(new SphereGeometry(0.035, 5, 4), crabMat, s * 0.1, 0.05, 0.06));
  crab.visible = false;
  scene.add(crab);

  // the stick she throws for it
  const stick = mesh(new BoxGeometry(0.5, 0.04, 0.04), mat('#7A5A3A'), 0, 0, 0, false);
  stick.visible = false;
  scene.add(stick);

  let act: Act = 'heel', actLeft = 0;
  pickable(dog, S => S.dog.state === 'friend'
    ? { title: S.dog.name, lines: [S.dog.since ? `Her friend since day ${S.dog.since}` : 'Her best friend', DOING[act]] }
    : { title: 'A stray dog', lines: [S.dog.trust > 0.5 ? 'Warming up to her' : 'Still wary of her'] });

  let wanderAngle = 0, wanderT = 0, repath = 0, nextBark = 0, nudge = 0;
  const target = { x: 0, z: 0 }, spot = { x: 0, z: 0 };
  // the dog uses the same route-finding as her (sim/pathing.ts), refreshed a few times a second
  let path: { x: number; z: number }[] = [];

  const onLand = (x: number, z: number) => height(x, z) > seaLevel() + 0.05;
  /** A random spot on land within r of (x, z), or null. */
  const near = (x: number, z: number, r: number) => {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = r * (0.4 + 0.6 * Math.random()), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (onLand(px, pz)) return { x: px, z: pz };
    }
    return null;
  };
  /** The waterline closest to her, a little up the sand (frac < 1) or right at the water. */
  const beachBy = (x: number, z: number, frac: number) => {
    const a = Math.atan2(z, x), R = islandR(a) * frac;
    return { x: Math.cos(a) * R, z: Math.sin(a) * R };
  };

  /** Pick what to do next (a friend dog, while she's busy or walking about). */
  function choose(S: SimState, her: Object3D, h: number) {
    const hx = her.position.x, hz = her.position.z;
    const options: [Act, number][] = [['heel', 3], ['sniff', 2], ['roll', 0.6]];
    const toBeach = Math.hypot(hx, hz) - islandR(Math.atan2(hz, hx)) * 0.93;
    if (Math.abs(toBeach) < 9) options.push(['dig', 1], ['bark', 0.7], ['crab', h > 7 && h < 19 ? 1.2 : 0]);
    else options.push(['dig', 0.5]);
    if (Math.hypot(hx - SP.x, hz - SP.z) < 16) options.push(['drink', 0.7]);
    if (h > 11.5 && h < 16.5) options.push(['nap', S.weather.hot ? 3 : 1.4]);
    let r = Math.random() * options.reduce((s, o) => s + o[1], 0);
    act = options.find(o => (r -= o[1]) < 0)?.[0] ?? 'heel';
    actLeft = act === 'heel' ? 15 + Math.random() * 25 : act === 'nap' ? 60 + Math.random() * 60 : 12 + Math.random() * 16;
    // where to do it
    let p: { x: number; z: number } | null = null;
    if (act === 'sniff' || act === 'roll' || act === 'dig') p = near(hx, hz, act === 'roll' ? 3 : 6);
    else if (act === 'bark') p = beachBy(hx, hz, 0.97);
    else if (act === 'crab') p = beachBy(hx, hz, 0.93);
    else if (act === 'drink') { const a = Math.atan2(hz - SP.z, hx - SP.x); p = { x: SP.x + Math.cos(a) * (POND_R + 0.25), z: SP.z + Math.sin(a) * (POND_R + 0.25) }; }
    else if (act === 'nap') {
      // the shade of the nearest standing tree
      let best = -1, bd = 12;
      S.trees.forEach((t, i) => { const d = Math.hypot(FOREST[i].pos.x - hx, FOREST[i].pos.z - hz); if (t.state === 'tree' && d < bd) { bd = d; best = i; } });
      if (best >= 0) p = { x: FOREST[best].pos.x + 0.7, z: FOREST[best].pos.z + 0.5 };
    }
    if (act !== 'heel' && !p) act = 'heel';
    if (p) { spot.x = p.x; spot.z = p.z; }
    if (act === 'crab') { crab.visible = true; crab.position.set(spot.x + 0.8, surfaceY(spot.x + 0.8, spot.z), spot.z); }
  }

  /**
   * @param dt real seconds  @param t real seconds since start
   * @param her her body (position + facing)
   */
  return function updateDog(S: SimState, her: Object3D, dt: number, t: number) {
    const d = S.dog;
    dog.visible = d.state !== 'none';
    if (!dog.visible) { crab.visible = false; return; }
    const gdt = dt * (S.speed > 0 ? Math.min(S.speed, 6) : 0); // (it lives at the island's pace, and stops when paused)
    const h = (S.min / 60) % 24;
    let lying = false, speed = 1.6, playing = false, curled = false;
    // reset the pose each frame; the activity below bends it
    body.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.position.y = 0.52; tail.rotation.set(0.7, 0, 0);
    if (d.state === 'wild') {
      // wander a couple of steps around where it washed up; lie down at night
      wanderT -= gdt;
      if (wanderT <= 0) { wanderT = 3 + Math.random() * 4; wanderAngle = Math.random() * Math.PI * 2; }
      target.x = d.home.x + Math.cos(wanderAngle) * 1.2;
      target.z = d.home.z + Math.sin(wanderAngle) * 1.2;
      lying = h >= 21 || h < 6;
      speed = 0.8;
    } else if (S.sailing) {
      target.x = DOCK_START.x; target.z = DOCK_START.z; // waits on the shore
      lying = true;
    } else if (S.task?.id === 'play') {
      playing = true;
      speed = 5;
      const ha = Math.atan2(her.position.z, her.position.x), atShore = Math.hypot(her.position.x, her.position.z) > islandR(ha) * 0.86;
      if (atShore) {
        // she throws the stick into the sea: out it bounds (and swims), then back to her
        const ph = (t * 0.3) % 1, out = ph < 0.5 ? ph / 0.5 : 1 - (ph - 0.5) / 0.5;
        target.x = her.position.x + Math.cos(ha) * (0.8 + 3.2 * out); target.z = her.position.z + Math.sin(ha) * (0.8 + 3.2 * out);
        stick.visible = true;
        stick.position.set(her.position.x + Math.cos(ha) * 4, seaLevel() + 0.02, her.position.z + Math.sin(ha) * 4);
        if (ph >= 0.5) { stick.position.set(dog.position.x + Math.sin(dog.rotation.y) * 0.4, dog.position.y + 0.48, dog.position.z + Math.cos(dog.rotation.y) * 0.4); stick.rotation.y = dog.rotation.y + Math.PI / 2; } // (in its mouth)
        repath = 1; path = []; // (straight out and back, through the water)
      } else {
        // bound around her in wide circles, as if chasing a stick
        target.x = her.position.x + Math.cos(t * 1.4) * 2.4;
        target.z = her.position.z + Math.sin(t * 1.4) * 2.4;
      }
    } else {
      const asleep = S.task?.id === 'sleep', night = h >= 21.5 || h < 6;
      const a = her.rotation.y, far = Math.hypot(her.position.x - dog.position.x, her.position.z - dog.position.z);
      if (asleep && night && S.fire > 0) act = 'fire';
      else if (S.sitting && !S.lift && act !== 'nap') act = 'beside';
      else if (act === 'fire' || act === 'beside') { act = 'heel'; actLeft = 10; }
      else {
        actLeft -= gdt;
        if (actLeft <= 0) choose(S, her, h);
        if (act !== 'heel' && act !== 'nap' && far > 14) { act = 'heel'; actLeft = 20; } // she's wandered off: catch up
        if (act === 'nap' && far > 25) { act = 'heel'; actLeft = 20; }
      }
      if (act !== 'crab') crab.visible = false;
      speed = 4.5;
      if (act === 'heel' || (asleep && act !== 'fire')) {
        // heel: a little behind and to the side of her (or lie by her bed while she sleeps)
        target.x = her.position.x - Math.sin(a) * 1.0 + Math.cos(a) * 0.6;
        target.z = her.position.z - Math.cos(a) * 1.0 - Math.sin(a) * 0.6;
        lying = asleep;
      } else if (act === 'beside') {
        // right beside her, at her right hand, where she can stroke it
        target.x = her.position.x - Math.cos(a) * 0.62 + Math.sin(a) * 0.05;
        target.z = her.position.z + Math.sin(a) * 0.62 + Math.cos(a) * 0.05;
        lying = true;
      } else if (act === 'fire') {
        target.x = FIRE.x + 1.25; target.z = FIRE.z - 0.6; // its warm spot
        lying = curled = true;
      } else {
        target.x = spot.x; target.z = spot.z;
        speed = act === 'crab' || act === 'bark' ? 4 : 2.2;
        // sniffing: little hops from smell to smell
        if (act === 'sniff') { nudge -= gdt; if (nudge <= 0) { nudge = 2.5; const p = near(spot.x, spot.z, 1.2); if (p) { spot.x = p.x; spot.z = p.z; } } }
      }
    }
    const dist = Math.hypot(target.x - dog.position.x, target.z - dog.position.z);
    repath -= dt;
    if (repath <= 0) {
      repath = 0.4;
      path = dist > 0.3 ? route(V(dog.position.x, dog.position.z), V(target.x, target.z)) : [];
    }
    while (path.length > 1 && Math.hypot(path[0].x - dog.position.x, path[0].z - dog.position.z) < 0.3) path.shift();
    const next = path[0] ?? target, dx = next.x - dog.position.x, dz = next.z - dog.position.z, leg = Math.hypot(dx, dz);
    if (dist > 30) { dog.position.x = target.x; dog.position.z = target.z; path = []; } // e.g. after loading a save
    else if (leg > 0.05) {
      const step = Math.min(leg, speed * gdt * Math.min(1, dist)); // slows down as it arrives
      dog.position.x += dx / leg * step;
      dog.position.z += dz / leg * step;
      if (dist > 0.3 || playing) dog.rotation.y = Math.atan2(dx, dz);
    }
    const arrived = dist < 0.3;
    if (arrived && act === 'beside') dog.rotation.y = her.rotation.y; // settled beside her, facing the same way
    if (arrived && act === 'fire') dog.rotation.y = Math.atan2(FIRE.x - dog.position.x, FIRE.z - dog.position.z) + 1.4;
    // (in the sea it swims, head and back above the water)
    dog.position.y = Math.max(surfaceY(dog.position.x, dog.position.z), seaLevel() - 0.28);
    if (S.task?.id !== 'play') stick.visible = false;
    const moving = !arrived;
    const doing = d.state === 'friend' && arrived && !lying ? act : null;
    dogNow.doing = d.state === 'friend' ? DOING[act] : 'wild';

    /* the activities' poses, once it's there */
    let bounce = 0, frontPaddle = false;
    if (doing === 'sniff' || doing === 'drink') {
      head.rotation.x = 0.6 + (doing === 'drink' ? 0.1 * Math.abs(Math.sin(t * 9)) : 0.05 * Math.sin(t * 14)); // nose down
      if (doing === 'drink') dog.rotation.y = Math.atan2(SP.x - dog.position.x, SP.z - dog.position.z);
    } else if (doing === 'dig') {
      head.rotation.x = 0.7; body.rotation.x = 0.18; frontPaddle = true;
    } else if (doing === 'crab') {
      // play-bow at the crab, then a pounce; the crab scuttles sideways and finally escapes into the sea
      const c = (t * 0.8) % 2;
      crab.position.x = spot.x + 0.7 * Math.cos(t * 0.9); crab.position.z = spot.z + 0.7 * Math.sin(t * 1.3);
      crab.position.y = surfaceY(crab.position.x, crab.position.z);
      crab.rotation.y = t * 0.9;
      dog.rotation.y = Math.atan2(crab.position.x - dog.position.x, crab.position.z - dog.position.z);
      if (c < 1.2) body.rotation.x = 0.35; else bounce = Math.sin((c - 1.2) / 0.8 * Math.PI) * 0.25;
      if (actLeft < 1) crab.visible = false;
    } else if (doing === 'roll') {
      lying = true;
      body.rotation.z = (1 - Math.cos(t * 2.5)) / 2 * 2.8; // over onto its back and back again
    } else if (doing === 'bark') {
      const a = Math.atan2(dog.position.z, dog.position.x);
      dog.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); // facing out to sea
      const pulse = (t * 2) % 1;
      head.rotation.x = pulse < 0.15 ? -0.4 : 0;
      if (S.speed > 0 && t > nextBark && pulse < 0.15) { nextBark = t + 0.45; dogBarks.n++; dogBarks.x = dog.position.x; dogBarks.z = dog.position.z; }
      if (S.speed > 0 && Math.random() < 0.002) actLeft = 0; // (gets bored of it)
    } else if (d.state === 'friend' && arrived && act === 'nap') lying = true;

    // lying down: body lowered, legs tucked (curled up: head round to its tail)
    const breathe = lying && !moving ? 0.015 * Math.sin(t * 2) : 0;
    body.position.y += ((lying && !moving ? -0.2 : 0) + bounce + breathe - body.position.y) * Math.min(1, dt * 6);
    if (curled && !moving) { head.rotation.y = 1.1; head.rotation.x = 0.3; head.position.y = 0.45; tail.rotation.set(0.2, 1.3, 0); }
    if (lying && !moving && act === 'nap') { head.rotation.x = 0.35; head.position.y = 0.46; }
    legs.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6
        : frontPaddle && i < 2 ? Math.sin(t * 22 + i * Math.PI) * 0.9
        : lying && body.rotation.z < 1 ? (i < 2 ? -1.4 : 1.4) : 0;
    });
    // a friend wags a lot more (but not in its sleep)
    if (!(curled || act === 'nap') || moving) tail.rotation.y = Math.sin(t * (d.state === 'friend' ? (doing === 'crab' ? 22 : 14) : 4)) * 0.5;
  };
}
