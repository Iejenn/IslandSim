// 3D models for gifts, built when the sim grants one, with a "beam from the
// sky" pop-in effect. Where she stands to use them is decided in sim/gifts.ts.
import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, type Scene } from 'three';
import { BOOKS_P, FIRE, ground, HAMMOCK_P, PIANO_P, SH, yawTo } from '../sim/island';
import type { GiftKey } from '../sim/state';
import { clamp } from '../sim/util';
import { M, mesh } from './materials';
import { v3 } from './stage';

export function createGiftModels(scene: Scene) {
  const effects: { t: number; run(dt: number): boolean }[] = [];

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
  };

  return {
    build: (k: GiftKey) => BUILD[k](),
    /** Advance pop-in effects (real seconds). */
    update(dt: number) {
      for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].run(dt)) effects.splice(i, 1);
    },
  };
}
