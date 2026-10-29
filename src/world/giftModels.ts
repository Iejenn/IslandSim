// 3D models for gifts, built when the sim grants one, with a "beam from the
// sky" pop-in effect. Where she stands to use them is decided in sim/gifts.ts.
import { BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Object3D, type Scene } from 'three';
import { BOAT_DOCK, BOOKS_P, DOCK, FIRE, GARDEN_P, ground, HAMMOCK_P, PIANO_P, SH, TELESCOPE_P, yawTo } from '../sim/island';
import type { GiftKey, SimState } from '../sim/state';
import { clamp } from '../sim/util';
import { M, mat, mesh } from './materials';

const sack = mat('#C9A86A'), tin = mat('#7FA7A8', { roughness: 0.4, metalness: 0.3 }), hull = mat('#B5653A'), brass = mat('#C79A3B', { roughness: 0.35, metalness: 0.5 });
const WATER_Y = 0.12;
import { v3 } from './stage';

export function createGiftModels(scene: Scene) {
  const effects: { t: number; run(dt: number): boolean }[] = [];
  let boat: Group | null = null;

  function popIn(g: Group) {
    g.scale.setScalar(0.01);
    scene.add(g);
    const beam = new Mesh(new CylinderGeometry(0.9, 0.9, 14, 16, 1, true), new MeshBasicMaterial({ color: '#FFE9A8', transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false }));
    beam.position.copy(g.position);
    beam.position.y += 7;
    scene.add(beam);
    effects.push({
      t: 0,
      run(dt) {
        this.t += dt;
        const k = clamp(this.t / 1.1, 0, 1);
        const e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k) * Math.cos(k * Math.PI * 3); // springy overshoot
        g.scale.setScalar(Math.max(0.01, e));
        beam.material.opacity = 0.5 * (1 - clamp(this.t / 2.5, 0, 1));
        if (this.t > 2.5) { scene.remove(beam); return false; }
        return true;
      },
    });
  }

  const BUILD: Record<GiftKey, () => void> = {
    piano() {
      const g = new Group();
      g.position.copy(v3(PIANO_P));
      g.rotation.y = yawTo(PIANO_P, FIRE);
      g.add(mesh(new BoxGeometry(1.6, 1.15, 0.6), M.pianoBody, 0, 0.68, 0));
      g.add(mesh(new BoxGeometry(1.66, 0.06, 0.66), M.pianoBody, 0, 1.28, 0));
      g.add(mesh(new BoxGeometry(1.5, 0.08, 0.34), M.ivory, 0, 0.82, 0.46));
      for (let i = 0; i < 10; i++) g.add(mesh(new BoxGeometry(0.06, 0.05, 0.2), M.ebony, -0.62 + i * 0.14, 0.88, 0.38));
      for (const x of [-0.7, 0.7]) g.add(mesh(new BoxGeometry(0.08, 0.8, 0.08), M.pianoBody, x, 0.4, 0.55));
      g.add(mesh(new BoxGeometry(0.9, 0.08, 0.36), M.pianoBody, 0, 0.46, 1.05)); // bench
      for (const x of [-0.38, 0.38]) g.add(mesh(new BoxGeometry(0.06, 0.44, 0.3), M.pianoBody, x, 0.22, 1.05));
      popIn(g);
    },
    rod() {
      const g = new Group();
      g.position.copy(v3(ground({ x: SH.x + 1.6, y: SH.y, z: SH.z + 0.6 })));
      const r = mesh(new CylinderGeometry(0.025, 0.04, 2.4, 5), M.rod, 0, 1.1, 0);
      r.rotation.z = 0.35;
      g.add(r);
      g.add(mesh(new CylinderGeometry(0.08, 0.08, 0.06, 8), M.rock, 0.18, 0.5, 0));
      popIn(g);
    },
    hammock() {
      const g = new Group();
      g.position.copy(v3(HAMMOCK_P));
      g.rotation.y = yawTo(HAMMOCK_P, FIRE) + Math.PI / 2;
      for (const x of [-1.4, 1.4]) g.add(mesh(new CylinderGeometry(0.08, 0.1, 1.7, 6), M.wood, x, 0.85, 0));
      const cg = new CylinderGeometry(0.5, 0.5, 2.5, 10, 1, true, Math.PI, Math.PI);
      cg.rotateZ(Math.PI / 2);
      g.add(mesh(cg, M.cloth, 0, 0.95, 0));
      popIn(g);
    },
    books() {
      const g = new Group();
      g.position.copy(v3(ground({ x: BOOKS_P.x + 0.7, y: BOOKS_P.y, z: BOOKS_P.z + 0.15 })));
      ([[M.book1, 0.04], [M.book2, 0.13], [M.book3, 0.22]] as const).forEach(([m, y], i) => {
        const b = mesh(new BoxGeometry(0.42, 0.09, 0.3), m, 0, y, 0);
        b.rotation.y = i * 0.35;
        g.add(b);
      });
      popIn(g);
    },
    seeds() {
      const g = new Group();
      g.position.copy(v3(ground({ x: GARDEN_P.x + 1.75, y: 0, z: GARDEN_P.z - 1.2 })));
      const bag = mesh(new SphereGeometry(0.2, 7, 5), sack, 0, 0.18, 0);
      bag.scale.set(1, 1.2, 0.8);
      g.add(bag, mesh(new ConeGeometry(0.1, 0.14, 6), sack, 0, 0.44, 0));
      popIn(g);
    },
    can() {
      const g = new Group();
      g.position.copy(v3(ground({ x: GARDEN_P.x + 1.75, y: 0, z: GARDEN_P.z - 0.6 })));
      g.add(mesh(new CylinderGeometry(0.14, 0.16, 0.3, 10), tin, 0, 0.15, 0));
      const spout = mesh(new CylinderGeometry(0.02, 0.03, 0.36, 5), tin, 0.2, 0.25, 0);
      spout.rotation.z = -0.9;
      g.add(spout);
      const handle = mesh(new BoxGeometry(0.04, 0.04, 0.24), tin, -0.05, 0.36, 0);
      g.add(handle);
      popIn(g);
    },
    boat() {
      const g = new Group();
      g.add(mesh(new BoxGeometry(0.85, 0.28, 1.7), hull, 0, 0.06, 0)); // hull
      const bow = mesh(new ConeGeometry(0.6, 0.7, 4), hull, 0, 0.06, 1.18);
      bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      bow.scale.set(1, 1, 0.45);
      g.add(bow);
      g.add(mesh(new BoxGeometry(0.85, 0.05, 0.25), M.wood, 0, 0.18, -0.2)); // seat
      g.position.set(BOAT_DOCK.x, WATER_Y, BOAT_DOCK.z);
      g.rotation.y = Math.atan2(DOCK.dir.x, DOCK.dir.z);
      boat = g;
      popIn(g);
    },
    telescope() {
      const g = new Group();
      g.position.copy(v3(TELESCOPE_P));
      g.rotation.y = yawTo(FIRE, TELESCOPE_P); // pointing out to sea
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2, leg = mesh(new CylinderGeometry(0.025, 0.025, 1.2, 4), M.wood, Math.cos(a) * 0.22, 0.56, Math.sin(a) * 0.22);
        leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        g.add(leg);
      }
      const tube = mesh(new CylinderGeometry(0.06, 0.09, 0.9, 10), brass, 0, 1.22, 0.1);
      tube.rotation.x = 0.9; // tilted up at the sky
      g.add(tube);
      popIn(g);
    },
  };

  return {
    build: (k: GiftKey) => BUILD[k](),
    /**
     * Advance pop-in effects and move the boat: moored at the dock, or under
     * her while she's sailing.
     * @param dt real seconds  @param t real seconds since start (bobbing)
     */
    update(dt: number, t: number, S: SimState, her: Object3D) {
      for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].run(dt)) effects.splice(i, 1);
      if (!boat) return;
      if (S.sailing) {
        boat.position.set(her.position.x, WATER_Y, her.position.z);
        boat.rotation.y = her.rotation.y;
      } else {
        boat.position.set(BOAT_DOCK.x, WATER_Y, BOAT_DOCK.z);
        boat.rotation.y = Math.atan2(DOCK.dir.x, DOCK.dir.z);
      }
      boat.position.y += 0.04 * Math.sin(t * 1.6);
    },
  };
}
