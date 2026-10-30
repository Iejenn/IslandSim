// Her camp decorations (sim/decor.ts), each built once and shown in the spot
// she put it in: flower planters, bunting, painted stones, nets and floats, a
// bird feeder, a driftwood bench, a carved statue, a stone border, a kennel for
// her dog and a shell garland.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, TorusGeometry, type Object3D, type Scene } from 'three';
import { DECOR_SPOTS, FIRE, yawTo } from '../sim/island';
import { DECOR, type DecorKey } from '../sim/decor';
import type { SimState } from '../sim/state';
import { cap, onDay, pickable } from './inspect';
import { M, mat, mesh } from './materials';

const paints = ['#C2553A', '#2E7D8C', '#E3B23C', '#F1E6D0', '#7A5BA8', '#5E9E4E'].map(c => mat(c, { roughness: 0.8 }));
const net = mat('#B9A26A', { roughness: 1 }), float = mat('#E8643C'), shell = mat('#F2D8C9'), drift = mat('#BDB2A0');

const BUILD: Record<DecorKey, () => Group> = {
  planters() {
    const g = new Group();
    for (const [x, z] of [[-0.35, 0], [0.35, 0.1]]) {
      g.add(mesh(new BoxGeometry(0.5, 0.35, 0.4), M.wood, x, 0.17, z));
      for (let i = 0; i < 4; i++) g.add(mesh(new SphereGeometry(0.07, 5, 4), paints[(i + (x > 0 ? 2 : 0)) % 5], x + (i % 2 - 0.5) * 0.22, 0.42, z + (i > 1 ? 0.1 : -0.1), false));
    }
    return g;
  },
  bunting() {
    const g = new Group();
    for (const x of [-1, 1]) g.add(mesh(new CylinderGeometry(0.04, 0.05, 1.9, 5), M.log, x, 0.95, 0));
    const line = mesh(new CylinderGeometry(0.008, 0.008, 2, 3), net, 0, 1.75, 0, false); line.rotation.z = Math.PI / 2; g.add(line); // (the string, not the whole group)
    for (let i = 0; i < 8; i++) { const f = mesh(new ConeGeometry(0.08, 0.18, 3), paints[i % 6], -0.85 + i * 0.24, 1.62 - 0.08 * Math.sin((i / 7) * Math.PI), 0, false); f.rotation.z = Math.PI; g.add(f); }
    return g;
  },
  stones() {
    const g = new Group();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const s = mesh(new SphereGeometry(0.11, 6, 4), paints[i % 6], Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55); s.scale.y = 0.6; g.add(s); }
    return g;
  },
  nets() {
    const g = new Group();
    for (const x of [-0.6, 0.6]) g.add(mesh(new CylinderGeometry(0.04, 0.05, 1.5, 5), M.log, x, 0.75, 0));
    const n = mesh(new BoxGeometry(1.2, 0.9, 0.02), net, 0, 0.85, 0); g.add(n);
    for (let i = 0; i < 4; i++) g.add(mesh(new SphereGeometry(0.07, 6, 4), float, -0.45 + i * 0.3, 0.45 + (i % 2) * 0.3, 0.04, false));
    return g;
  },
  feeder() {
    const g = new Group();
    g.add(mesh(new CylinderGeometry(0.04, 0.05, 1.4, 5), M.log, 0, 0.7, 0));
    g.add(mesh(new BoxGeometry(0.4, 0.04, 0.4), M.wood, 0, 1.4, 0));
    const roof = mesh(new ConeGeometry(0.32, 0.22, 4), M.thatch, 0, 1.62, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
    for (let i = 0; i < 5; i++) g.add(mesh(new SphereGeometry(0.025, 4, 3), net, (i - 2) * 0.06, 1.44, (i % 2) * 0.06, false)); // seeds
    return g;
  },
  bench() {
    const g = new Group();
    const seat = mesh(new CylinderGeometry(0.13, 0.15, 1.4, 7), drift, 0, 0.4, 0); seat.rotation.z = Math.PI / 2; g.add(seat);
    for (const x of [-0.5, 0.5]) g.add(mesh(new BoxGeometry(0.2, 0.3, 0.35), M.rock, x, 0.15, 0));
    return g;
  },
  statue() {
    const g = new Group();
    g.add(mesh(new BoxGeometry(0.45, 0.35, 0.45), M.rock, 0, 0.17, 0));
    const body = mesh(new SphereGeometry(0.25, 8, 6), M.wood, 0, 0.62, 0); body.scale.set(1, 1.2, 0.8); g.add(body); // a carved owl
    g.add(mesh(new SphereGeometry(0.17, 8, 6), M.wood, 0, 0.98, 0));
    for (const x of [-0.07, 0.07]) g.add(mesh(new SphereGeometry(0.04, 5, 4), paints[2], x, 1.0, 0.14, false));
    return g;
  },
  border() {
    const g = new Group();
    for (let i = 0; i < 10; i++) { const a = -0.8 + i * 0.18; const s = mesh(new BoxGeometry(0.28, 0.16, 0.2), M.rock, Math.cos(a) * 1.0, 0.08, Math.sin(a) * 1.0 - 0.6); s.rotation.y = -a; g.add(s); }
    for (let i = 0; i < 5; i++) g.add(mesh(new SphereGeometry(0.06, 5, 4), paints[i % 5], (i - 2) * 0.2, 0.06, -0.2, false)); // flowers inside
    return g;
  },
  kennel() {
    const g = new Group();
    g.add(mesh(new BoxGeometry(0.8, 0.55, 0.9), M.wood, 0, 0.28, 0));
    for (const s of [-1, 1]) { const r = mesh(new BoxGeometry(0.55, 0.05, 1.0), M.thatch, s * 0.22, 0.68, 0); r.rotation.z = -s * 0.65; g.add(r); }
    g.add(mesh(new BoxGeometry(0.32, 0.36, 0.02), mat('#2B211A'), 0, 0.2, 0.46)); // the doorway
    return g;
  },
  garland() {
    const g = new Group();
    for (const x of [-0.7, 0.7]) g.add(mesh(new CylinderGeometry(0.04, 0.05, 1.6, 5), M.log, x, 0.8, 0));
    // shells hanging along a gently sagging string
    for (let i = 0; i < 7; i++) { const x = -0.54 + i * 0.18, s = mesh(new ConeGeometry(0.05, 0.08, 6), shell, x, 1.5 - 0.18 * Math.sqrt(1 - (x / 0.7) ** 2) - 0.06, 0, false); s.rotation.x = Math.PI / 2; g.add(s); }
    const string = mesh(new TorusGeometry(0.7, 0.006, 3, 16, Math.PI), net, 0, 1.5, 0, false); string.rotation.z = Math.PI; string.scale.y = 0.26; g.add(string);
    return g;
  },
};

export function createDecor(scene: Scene) {
  // one of each, moved to whichever spot she used for it
  const models = {} as Record<DecorKey, Object3D>;
  for (const k of Object.keys(BUILD) as DecorKey[]) {
    const m = BUILD[k]();
    m.visible = false;
    scene.add(m);
    pickable(m, S => {
      const d = S.decor.find(x => x.key === k);
      return { title: cap(k === 'kennel' && S.dog.state === 'friend' ? `${S.dog.name}’s kennel` : DECOR[k].name.replace(/^an? /, '')), lines: [d ? onDay(d.at, 'Made') : '', 'To make her camp feel like home'].filter(Boolean) };
    });
    models[k] = m;
  }
  let shown = -1;
  return function updateDecor(S: SimState) {
    const n = S.decor?.length ?? 0;
    if (n === shown) return; // (only changes when she makes something)
    shown = n;
    for (const k of Object.keys(models) as DecorKey[]) models[k].visible = false;
    for (const d of S.decor ?? []) {
      const m = models[d.key], p = DECOR_SPOTS[d.spot];
      if (!m || !p) continue;
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = yawTo(p, FIRE); // (facing the fire, the heart of camp)
      m.visible = true;
    }
  };
}
