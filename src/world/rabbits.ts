// The rabbit warren deep in the forest: a mound with burrows, and as many
// rabbits hopping around it as the sim says live there. Where each rabbit
// hops is purely visual; the sim only keeps the head count.
import { BoxGeometry, CylinderGeometry, Group, SphereGeometry, type Scene } from 'three';
import { BURROWS, ground, V, WARREN_P } from '../sim/island';
import type { SimState } from '../sim/state';
import { pickable } from './inspect';
import { mat, mesh } from './materials';

const furs = [mat('#A88B6C'), mat('#8C7258'), mat('#C9B8A0')], tail = mat('#F2EEE6'), hole = mat('#2E2219'), mound = mat('#7C6A4A');
const SHOWN = 10; // at most this many on screen at once

function rabbitModel(i: number) {
  const g = new Group(), body = new Group(), fur = furs[i % furs.length];
  body.add(mesh(new SphereGeometry(0.13, 6, 5), fur, 0, 0.13, 0));
  body.add(mesh(new SphereGeometry(0.08, 6, 5), fur, 0, 0.22, 0.12)); // head
  for (const x of [-0.035, 0.035]) body.add(mesh(new BoxGeometry(0.03, 0.14, 0.02), fur, x, 0.33, 0.1)); // ears
  body.add(mesh(new SphereGeometry(0.04, 5, 4), tail, 0, 0.15, -0.13, false));
  body.scale.set(1, 1, 1.15);
  g.add(body);
  return { g, body };
}

export function createRabbits(scene: Scene) {
  // the warren: a low earth mound with dark burrow openings
  const m = mesh(new CylinderGeometry(1.0, 1.5, 0.3, 9), mound, WARREN_P.x, WARREN_P.y + 0.05, WARREN_P.z);
  scene.add(m);
  pickable(m, S => ({ title: 'The rabbit warren', lines: [S.rabbits >= 10 ? 'Lots of rabbits live here' : S.rabbits >= 4 ? 'A few rabbits live here' : 'Hardly any rabbits left'] }));
  for (const b of BURROWS) {
    const h = mesh(new CylinderGeometry(0.22, 0.22, 0.04, 8), hole, b.x, b.y + 0.03, b.z, false);
    scene.add(h);
  }
  const rabbits = Array.from({ length: SHOWN }, (_, i) => {
    const r = rabbitModel(i);
    r.g.visible = false;
    r.g.position.set(WARREN_P.x + Math.cos(i * 2.4) * 2.5, WARREN_P.y, WARREN_P.z + Math.sin(i * 2.4) * 2.5);
    scene.add(r.g);
    return { ...r, target: { x: WARREN_P.x, z: WARREN_P.z }, hop: Math.random() * 3, wait: Math.random() * 2 };
  });

  /** @param dt real seconds */
  return function updateRabbits(S: SimState, dt: number) {
    const n = Math.min(SHOWN, Math.round(S.rabbits));
    rabbits.forEach((r, i) => {
      r.g.visible = i < n;
      if (!r.g.visible) return;
      // hop to a new spot around the warren every few seconds
      r.wait -= dt;
      if (r.wait <= 0) {
        const a = Math.random() * Math.PI * 2, d = 1.6 + Math.random() * 2.6; // around the mound, not on it
        r.target = { x: WARREN_P.x + Math.cos(a) * d, z: WARREN_P.z + Math.sin(a) * d };
        r.wait = 1.5 + Math.random() * 4;
      }
      const p = r.g.position, dx = r.target.x - p.x, dz = r.target.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, dt * 1.6);
        p.x += dx / d * step; p.z += dz / d * step;
        r.g.rotation.y = Math.atan2(dx, dz);
        r.hop += dt * 9;
        r.body.position.y = Math.abs(Math.sin(r.hop)) * 0.12;
      } else r.body.position.y = 0;
      p.y = ground(V(p.x, p.z)).y;
    });
  };
}
