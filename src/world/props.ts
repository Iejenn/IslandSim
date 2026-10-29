// Static island props: campfire, shelter, spring, bushes, trees and the
// randomly scattered decoration. Positions come from sim/island.ts so the
// sim and the visuals always agree on where things are.
import {
  BoxGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry,
  PointLight, SphereGeometry, TubeGeometry, Vector3, type Mesh, type Scene,
} from 'three';
import { BUSHES, FIRE, FISH_A, SEATS, SH, SP, V, clearOf, ground, pointAt, yawTo, type Pt } from '../sim/island';
import { rand } from '../sim/util';
import { flameMat, flameMat2, M, mesh } from './materials';
import { FIRE_LIGHT_SCALE, type Campfire } from './sky';
import { v3 } from './stage';

export function createProps(scene: Scene) {
  const palms: Group[] = []; // their tops sway in the wind
  function palm(p: Pt, s = 1) {
    const g = new Group(), lean = rand(0.4, 1.1);
    const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(lean * 0.15, 1.2, 0), new Vector3(lean * 0.5, 2.4, 0), new Vector3(lean, 3.3, 0)]);
    g.add(mesh(new TubeGeometry(curve, 6, 0.13, 6), M.trunk));
    const top = new Group();
    top.position.set(lean, 3.3, 0);
    for (let i = 0; i < 7; i++) {
      const lg = new ConeGeometry(0.32, 2.4, 4);
      lg.translate(0, 1.2, 0);
      lg.scale(0.35, 1, 1);
      const leaf = mesh(lg, i % 2 ? M.leaf : M.leaf2);
      leaf.rotation.z = -(Math.PI / 2 + rand(0.15, 0.45));
      const h = new Group();
      h.rotation.y = i / 7 * Math.PI * 2 + rand(-0.2, 0.2);
      h.add(leaf);
      top.add(h);
    }
    for (let i = 0; i < 3; i++) top.add(mesh(new SphereGeometry(0.12, 6, 5), M.coco, Math.cos(i * 2.1) * 0.18, -0.12, Math.sin(i * 2.1) * 0.18));
    g.add(top);
    g.position.copy(v3(ground({ ...p })));
    g.rotation.y = rand(0, Math.PI * 2);
    g.scale.setScalar(s);
    scene.add(g);
    palms.push(g);
  }
  function rock(p: Pt, r: number) {
    const o = mesh(new DodecahedronGeometry(r, 0), M.rock);
    o.scale.set(1, rand(0.6, 0.9), rand(0.8, 1.2));
    o.rotation.set(rand(0, 1), rand(0, 6), rand(0, 1));
    o.position.copy(v3(ground({ ...p })));
    o.position.y += r * 0.25;
    scene.add(o);
  }

  /* campfire at the centre */
  const fireG = new Group();
  fireG.position.copy(v3(FIRE));
  scene.add(fireG);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    fireG.add(mesh(new DodecahedronGeometry(0.16, 0), M.rock, Math.cos(a) * 0.48, 0.08, Math.sin(a) * 0.48));
  }
  for (let i = 0; i < 2; i++) {
    const l = mesh(new CylinderGeometry(0.07, 0.07, 0.9, 5), M.log, 0, 0.1, 0);
    l.rotation.z = Math.PI / 2;
    l.rotation.y = i ? 0.8 : -0.8;
    fireG.add(l);
  }
  const flame = mesh(new ConeGeometry(0.28, 0.85, 6), flameMat, 0, 0.5, 0, false), flame2 = mesh(new ConeGeometry(0.15, 0.5, 6), flameMat2, 0, 0.36, 0, false);
  fireG.add(flame, flame2);
  // r147 used distance 11 / decay 2 with a linear-to-cutoff falloff; modern
  // physical falloff with distance 8.8 / decay 0.42 traces the same curve.
  const fireLight = new PointLight('#FF9A3C', FIRE_LIGHT_SCALE, 8.8, 0.42);
  fireLight.position.set(0, 0.9, 0);
  fireG.add(fireLight);
  const campfire: Campfire = { flame, flame2, light: fireLight };

  /* log seats around the fire */
  for (const { p } of SEATS) {
    const out = new Vector3(p.x, 0, p.z).normalize();
    const log = mesh(new CylinderGeometry(0.17, 0.17, 1.1, 6), M.log);
    log.rotation.z = Math.PI / 2;
    const g = new Group();
    g.add(log);
    g.position.copy(v3(p)).addScaledVector(out, 0.45);
    g.position.y += 0.12;
    g.rotation.y = Math.atan2(out.x, out.z) + Math.PI / 2;
    scene.add(g);
  }

  /* shelter */
  {
    const g = new Group();
    g.position.copy(v3(SH));
    g.rotation.y = yawTo(SH, FIRE);
    // Tall enough (roof ~2.25 at the front, ~1.35 at the back) for her big
    // cartoon head when she sits or sleeps underneath; it used to poke through.
    for (const x of [-1.1, 1.1]) {
      g.add(mesh(new CylinderGeometry(0.07, 0.08, 2.3, 5), M.wood, x, 1.15, 0.7));
      g.add(mesh(new CylinderGeometry(0.07, 0.08, 1.4, 5), M.wood, x, 0.7, -0.8));
    }
    const roof = mesh(new BoxGeometry(2.6, 0.08, 2.1), M.thatch, 0, 1.79, -0.05);
    roof.rotation.x = -0.505;
    g.add(roof);
    g.add(mesh(new BoxGeometry(1.5, 0.1, 0.9), M.bed, 0, 0.05, 0));
    scene.add(g);
  }

  /* spring */
  {
    scene.add(mesh(new CylinderGeometry(1.15, 1.2, 0.06, 10), M.spring, SP.x, SP.y + 0.04, SP.z, false));
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3;
      rock(V(SP.x + Math.cos(a) * 1.35, SP.z + Math.sin(a) * 1.35), rand(0.18, 0.32));
    }
  }

  /* berry bushes: berry meshes are shown/hidden to match sim state */
  const berryMeshes: Mesh[][] = BUSHES.map(({ pos }) => {
    const g = new Group();
    const b = mesh(new IcosahedronGeometry(0.62, 0), M.bush, 0, 0.45, 0);
    b.scale.set(1, 0.75, 1);
    g.add(b);
    const meshes: Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + rand(-0.3, 0.3);
      const m = mesh(new SphereGeometry(0.085, 6, 4), M.berry, Math.cos(a) * 0.58, 0.38 + rand(0, 0.22), Math.sin(a) * 0.58, false);
      meshes.push(m);
      g.add(m);
    }
    g.position.copy(v3(pos));
    scene.add(g);
    return meshes;
  });

  /* decoration: palms on the beach ring and small rocks inland, kept clear of key spots (the forest lives in forest.ts) */
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2 + rand(-0.12, 0.12);
    if (Math.abs(((a - FISH_A + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35) continue; // keep the fishing spot open
    const p = pointAt(a, rand(0.7, 0.84));
    if (clearOf(p, 2)) palm(p, rand(0.85, 1.15));
  }
  for (let n = 0, tries = 0; n < 16 && tries < 160; tries++) {
    const p = pointAt(rand(0, 6.3), rand(0.45, 0.95));
    if (clearOf(p, 1.6)) { rock(p, rand(0.2, 0.5)); n++; }
  }

  return {
    campfire,
    /** Palms lean and sway with the wind (0 calm … 1 storm). @param t real seconds */
    sway(wind: number, t: number) {
      palms.forEach((g, i) => {
        const w = 0.015 + wind * 0.12;
        g.rotation.x = Math.sin(t * (1.2 + wind * 2) + i) * w;
        g.rotation.z = Math.cos(t * (1.0 + wind * 2) + i * 1.3) * w + wind * 0.08;
      });
    },
    /** Show as many berries on each bush as the sim says are left. */
    syncBerries(counts: number[]) {
      berryMeshes.forEach((meshes, b) => meshes.forEach((m, i) => { m.visible = i < counts[b]; }));
    },
  };
}
