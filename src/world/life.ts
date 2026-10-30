// What a castaway has to show for her mastery (sim/life.ts): totem poles from a
// master carver, a record fish mounted on a board, a carved welcome sign by the
// dock gate, a prize giant pumpkin by the garden, and her finished book.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, type Object3D, type Scene } from 'three';
import { FENCE_R, FIRE, GARDEN_P, ground, JOURNAL_P, RACK_P, TOTEM_SPOTS, V, yawTo } from '../sim/island';
import type { SimState } from '../sim/state';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';

const paints = ['#C2553A', '#2E7D8C', '#E3B23C', '#F1E6D0'].map(c => mat(c, { roughness: 0.8 })), fishMat = mat('#6F9FB0', { roughness: 0.4, metalness: 0.2 });
const pumpkinMat = mat('#E07B24', { roughness: 0.6 }), bookMat = mat('#8B3A2E');

export function createLifeProps(scene: Scene) {
  const place = (o: Object3D, p: { x: number; y: number; z: number }, yaw = 0) => { o.position.set(p.x, p.y, p.z); o.rotation.y = yaw; o.visible = false; scene.add(o); return o; };

  /* totem poles: a carved, painted post with an animal at the top */
  const totems = TOTEM_SPOTS.map((p, i) => {
    const g = new Group();
    g.add(mesh(new CylinderGeometry(0.2, 0.24, 2.2, 8), M.log, 0, 1.1, 0));
    for (let k = 0; k < 4; k++) g.add(mesh(new CylinderGeometry(0.23, 0.23, 0.12, 8), paints[(i + k) % paints.length], 0, 0.45 + k * 0.42, 0)); // painted bands
    for (const s of [-1, 1]) { const wing = mesh(new BoxGeometry(0.5, 0.08, 0.16), paints[(i + 2) % 4], s * 0.35, 1.75, 0); wing.rotation.z = s * 0.3; g.add(wing); }
    const head = [() => mesh(new SphereGeometry(0.28, 8, 5), paints[1], 0, 2.35, 0), () => mesh(new ConeGeometry(0.22, 0.45, 6), paints[0], 0, 2.42, 0), () => mesh(new BoxGeometry(0.42, 0.32, 0.42), paints[2], 0, 2.36, 0)][i % 3]();
    g.add(head);
    pickable(g, () => ({ title: 'Totem pole', lines: ['Carved by the island’s master carver'] }));
    return place(g, p, yawTo(p, FIRE));
  });

  /* her record fish, mounted on a board on a post by the drying rack */
  const trophy = (() => {
    const g = new Group(), p = ground(V(RACK_P.x + 0.3, RACK_P.z - 1.4));
    g.add(mesh(new CylinderGeometry(0.05, 0.06, 1.5, 6), M.log, 0, 0.75, 0));
    g.add(mesh(new BoxGeometry(0.9, 0.4, 0.05), M.wood, 0, 1.45, 0.06));
    const body = mesh(new SphereGeometry(0.16, 8, 5), fishMat, 0, 1.45, 0.12); body.scale.set(2.3, 0.85, 0.5); g.add(body);
    const tail = mesh(new ConeGeometry(0.12, 0.22, 4), fishMat, 0.42, 1.45, 0.12); tail.rotation.z = Math.PI / 2; g.add(tail);
    pickable(g, S => ({ title: 'Her record catch', lines: [`${S.recordFish} kg, mounted with pride`] }));
    return place(g, p, yawTo(p, FIRE));
  })();

  /* a carved welcome sign beside the dock gate */
  const sign = (() => {
    const g = new Group(), p = ground(V(1.3, FENCE_R + 0.8));
    for (const x of [-0.55, 0.55]) g.add(mesh(new CylinderGeometry(0.05, 0.06, 1.3, 6), M.log, x, 0.65, 0));
    g.add(mesh(new BoxGeometry(1.4, 0.45, 0.06), M.wood, 0, 1.15, 0));
    for (let k = 0; k < 5; k++) g.add(mesh(new BoxGeometry(0.16, 0.05, 0.02), paints[k % 2 ? 0 : 1], -0.4 + k * 0.2, 1.17, 0.04)); // the carved letters
    pickable(g, S => ({ title: 'A carved sign', lines: [`“Welcome to ${S.islandName}”`, 'Carved by her own hand'] }));
    return place(g, p, yawTo(p, V(0, 40)));
  })();

  /* the prize pumpkin, too big to eat, by the garden */
  const pumpkin = (() => {
    const g = new Group(), p = ground(V(GARDEN_P.x - 2.0, GARDEN_P.z + 0.2));
    const b = mesh(new SphereGeometry(0.55, 12, 8), pumpkinMat, 0, 0.42, 0); b.scale.set(1, 0.75, 1); g.add(b);
    g.add(mesh(new CylinderGeometry(0.05, 0.07, 0.2, 5), M.log, 0, 0.88, 0));
    pickable(g, () => ({ title: 'Prize pumpkin', lines: ['Grown by the island’s green thumb', 'Far too beautiful to eat'] }));
    return place(g, p);
  })();

  /* her finished book, beside her journal */
  const book = (() => {
    const g = new Group(), p = ground(V(JOURNAL_P.x - 0.6, JOURNAL_P.z + 0.3));
    g.add(mesh(new BoxGeometry(0.32, 0.12, 0.24), bookMat, 0, 0.06, 0));
    g.add(mesh(new BoxGeometry(0.3, 0.1, 0.22), paints[3], 0.01, 0.06, 0));
    pickable(g, S => ({ title: `“${S.book}”`, lines: ['Her book about life on the island'] }));
    return place(g, p, 0.4);
  })();

  return function updateLifeProps(S: SimState) {
    totems.forEach((t, i) => { t.visible = i < (S.totems ?? 0); });
    trophy.visible = !!S.recordFish;
    sign.visible = !!S.islandName;
    pumpkin.visible = !!S.mastery?.gardening;
    book.visible = !!S.book;
  };
}
