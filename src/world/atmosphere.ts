// Little moments of weather and life: morning mist on some days, a rainbow
// after some showers, fireflies on summer nights, leaves drifting down from the
// forest in autumn, and songbirds flitting between the trees (more of them as
// the island stays green). All visual; the sim only provides the conditions.
import {
  AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  Object3D, PlaneGeometry, Points, PointsMaterial, SphereGeometry, TorusGeometry, type Fog, type Scene,
} from 'three';
import { FOREST, pointAt } from '../sim/island';
import { season } from '../sim/seasons';
import { hour, type SimState } from '../sim/state';
import { mat } from './materials';

/** A stable 0…1 number for a given integer (so a given day is always misty, or not). */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createAtmosphere(scene: Scene) {
  /* rainbow: seven thin arcs far out over the sea */
  const rainbow = new Object3D();
  ['#E8414B', '#F08A3E', '#F2D24B', '#6CC06A', '#4AA6E0', '#5464C9', '#8B5CC4'].forEach((c, i) => {
    const m = new Mesh(new TorusGeometry(52 - i * 1.1, 0.55, 4, 48, Math.PI), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false, side: DoubleSide }));
    rainbow.add(m);
  });
  rainbow.position.y = -6;
  scene.add(rainbow);

  /* fireflies: three twinkling groups that drift over the meadow */
  const flies = [0, 1, 2].map(k => {
    const n = 25, g = new BufferGeometry(), base: number[] = [];
    for (let i = 0; i < n; i++) { const p = pointAt(Math.random() * 6.3, 0.25 + Math.random() * 0.35); base.push(p.x, 0.6 + Math.random() * 1.2, p.z); }
    g.setAttribute('position', new Float32BufferAttribute(base.slice(), 3));
    const pts = new Points(g, new PointsMaterial({ color: '#D8FF7A', size: 0.22, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    return { pts, base, k };
  });

  /* falling leaves */
  const LEAVES = 90, leafMat = mat('#D9902E', { side: DoubleSide });
  const leaves = new InstancedMesh(new PlaneGeometry(0.16, 0.11), leafMat, LEAVES);
  leaves.count = 0;
  scene.add(leaves);
  const leaf = Array.from({ length: LEAVES }, () => ({ x: 0, y: -10, z: 0, vx: 0, vz: 0, spin: Math.random() * 6, c: new Color() }));
  const leafColours = ['#D9902E', '#B8502E', '#E3B23C', '#A8632B'].map(c => new Color(c));

  /* songbirds */
  const birdMat = mat('#5B4636');
  const birds = Array.from({ length: 10 }, () => {
    const m = new Mesh(new SphereGeometry(0.09, 6, 4), birdMat);
    m.scale.set(1, 0.8, 1.5);
    m.visible = false;
    scene.add(m);
    return { m, from: 0, to: 0, t: Math.random() * 5, perch: Math.random() * 4 };
  });

  const o = new Object3D(), mtx = new Matrix4(), mistColour = new Color('#E8EEF0');
  let rainbowA = 0;

  /**
   * @param fog the scene fog (already set by the sky this frame; mist tightens it)
   * @param rain rain intensity 0…1, @param dt real seconds, @param t real seconds since start
   */
  return function updateAtmosphere(S: SimState, fog: Fog, rain: number, dt: number, t: number) {
    const h = hour(), day = Math.floor(S.min / 1440), s = season();
    const standing = S.trees.map((tr, i) => tr.state === 'tree' ? i : -1).filter(i => i >= 0);

    // morning mist: some days (more in autumn), thickest around dawn, gone by mid-morning
    const mistChance = s === 'autumn' ? 0.5 : s === 'spring' ? 0.35 : 0.15;
    if (hash(day * 3 + S.island.seasonStart) < mistChance && rain < 0.2) {
      const k = h < 5 || h > 10 ? 0 : h < 6.5 ? (h - 5) / 1.5 : 1 - (h - 6.5) / 3.5;
      if (k > 0) {
        fog.near = fog.near + (8 - fog.near) * k;
        fog.far = fog.far + (65 - fog.far) * k;
        fog.color.lerp(mistColour, 0.5 * k);
      }
    }

    // rainbow: after some daytime showers, opposite the sun, fading over an hour and a half
    const since = S.min - S.weather.clearedAt, sunAng = (h - 6) / 12 * Math.PI;
    const want = !S.weather.raining && since < 90 && h > 7.5 && h < 17.5 && hash(S.weather.clearedAt) < 0.6 ? Math.min(1, since / 15) * (1 - since / 90) : 0;
    rainbowA += (want - rainbowA) * Math.min(1, dt * 1.5);
    rainbow.visible = rainbowA > 0.01;
    if (rainbow.visible) {
      const dx = -Math.cos(sunAng), dz = -12 / 35, l = Math.hypot(dx, dz);
      rainbow.position.set(dx / l * 70, -6, dz / l * 70);
      rainbow.lookAt(0, -6, 0);
      rainbow.children.forEach(m => { ((m as Mesh).material as MeshBasicMaterial).opacity = 0.32 * rainbowA; });
    }

    // fireflies: warm, dry nights (summer, late spring)
    const nightK = h >= 21 || h < 4.5 ? 1 : h >= 20 ? h - 20 : 0;
    const flyK = (s === 'summer' ? 1 : s === 'spring' ? 0.5 : 0) * nightK * (1 - rain);
    for (const f of flies) {
      (f.pts.material as PointsMaterial).opacity = flyK * (0.5 + 0.5 * Math.sin(t * 2.2 + f.k * 2.1));
      f.pts.visible = flyK > 0.01;
      if (!f.pts.visible) continue;
      const a = f.pts.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        a[i] = f.base[i] + Math.sin(t * 0.5 + i) * 0.6;
        a[i + 1] = f.base[i + 1] + Math.sin(t * 0.8 + i * 0.3) * 0.3;
        a[i + 2] = f.base[i + 2] + Math.cos(t * 0.45 + i * 0.7) * 0.6;
      }
      f.pts.geometry.attributes.position.needsUpdate = true;
    }

    // falling leaves in autumn: each drifts down from a random tree's crown, then starts again
    const leafCount = s === 'autumn' && standing.length ? LEAVES : 0;
    leaves.count = leafCount;
    for (let i = 0; i < leafCount; i++) {
      const L = leaf[i];
      if (L.y <= 0.05) {
        const tr = FOREST[standing[Math.floor(Math.random() * standing.length)]].pos;
        Object.assign(L, { x: tr.x + (Math.random() - 0.5) * 2, y: tr.y + 2 + Math.random() * 1.5, z: tr.z + (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4 });
        leaves.setColorAt(i, leafColours[i % leafColours.length]);
        if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      }
      L.y -= dt * (0.35 + 0.15 * Math.sin(t + i));
      L.x += (L.vx + Math.sin(t * 1.3 + i) * 0.3) * dt; L.z += L.vz * dt;
      L.spin += dt * 2;
      o.position.set(L.x, L.y, L.z);
      o.rotation.set(L.spin, L.spin * 0.7, 0);
      o.updateMatrix();
      leaves.setMatrixAt(i, mtx.copy(o.matrix));
    }
    if (leafCount) leaves.instanceMatrix.needsUpdate = true;

    // songbirds by day: more of them the greener the island has stayed and the longer she's lived there
    const nBirds = h > 6 && h < 19.5 && rain < 0.4 && s !== 'winter' ? Math.min(birds.length, Math.floor(standing.length / 8 + day / 10)) : 0;
    birds.forEach((b, i) => {
      b.m.visible = i < nBirds && standing.length > 1;
      if (!b.m.visible) return;
      if (!standing.includes(b.from)) b.from = standing[i % standing.length];
      if (b.perch > 0) {
        b.perch -= dt;
        const p = FOREST[b.from].pos;
        b.m.position.set(p.x + 0.4, p.y + 3.1 + Math.abs(Math.sin(t * 6 + i)) * 0.03, p.z + 0.3);
        if (b.perch <= 0) { b.to = standing[Math.floor(Math.random() * standing.length)]; b.t = 0; }
        return;
      }
      b.t += dt / 2.5;
      const p = FOREST[b.from].pos, q = FOREST[b.to].pos, k = Math.min(1, b.t);
      b.m.position.set(p.x + (q.x - p.x) * k + 0.4, p.y + 3.1 + Math.sin(k * Math.PI) * 2.5, p.z + (q.z - p.z) * k + 0.3);
      b.m.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      if (k >= 1) { b.from = b.to; b.perch = 2 + Math.random() * 6; }
    });
  };
}
