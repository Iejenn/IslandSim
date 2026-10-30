// The shoreline: the sea rises and falls with the tide (sim/tide.ts), white
// surf rolls up the sand and slides back, and she leaves footprints in the wet
// sand that the next tide washes away.
import { BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Points, PointsMaterial, type Scene } from 'three';
import { BAR_ENDS, BAR_TOP, barDist, height, islandR, ISLET_C, ISLET_R } from '../sim/island';
import { seaLevel } from '../sim/tide';
import { swell, swellDamp } from './water';
import type { SimState } from '../sim/state';
import { clamp } from '../sim/util';

const MAIN = 300, ISLET = 70, ANGLES = MAIN + ISLET, PER = 5, BAR_K = 60, BAR_PER = 4, LEVELS = 12, LO = 0.0, HI = 0.26;

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

export function createShore(scene: Scene) {
  /* where the waterline is, around the island and around the bamboo islet, for a range of
     sea levels (worked out once): each slot is a direction out from one of their middles */
  const cx = new Float32Array(ANGLES), cz = new Float32Array(ANGLES), ang = new Float32Array(ANGLES);
  for (let i = 0; i < ANGLES; i++) {
    const islet = i >= MAIN, k = islet ? i - MAIN : i, n = islet ? ISLET : MAIN;
    ang[i] = (k / n) * Math.PI * 2; cx[i] = islet ? ISLET_C.x : 0; cz[i] = islet ? ISLET_C.z : 0;
  }
  const shoreR: Float32Array[] = [];
  for (let i = 0; i < ANGLES; i++) {
    const a = ang[i], R = i >= MAIN ? ISLET_R : islandR(a), row = new Float32Array(LEVELS);
    for (let l = 0; l < LEVELS; l++) {
      const lvl = LO + (HI - LO) * (l / (LEVELS - 1));
      let t = 0.85;
      while (t < 1.15 && height(cx[i] + Math.cos(a) * R * t, cz[i] + Math.sin(a) * R * t) > lvl) t += 0.002;
      row[l] = R * t;
    }
    shoreR.push(row);
  }
  const shoreAt = (i: number, lvl: number) => {
    const f = clamp((lvl - LO) / (HI - LO), 0, 1) * (LEVELS - 1), l = Math.min(LEVELS - 2, Math.floor(f)), k = f - l;
    return shoreR[i][l] * (1 - k) + shoreR[i][l + 1] * k;
  };

  /* the sandbar has its own surf along both edges (the islands' surf, worked out straight out
     from their middles, would land in lumps on top of it): for each spot along it, how far out
     to each side the water starts, per sea level (-1: it's under water there, -2: no edge, all land) */
  const bA = BAR_ENDS.a, bB = BAR_ENDS.b, bL = Math.hypot(bB.x - bA.x, bB.z - bA.z);
  const bdx = (bB.x - bA.x) / bL, bdz = (bB.z - bA.z) / bL, bpx = bdz, bpz = -bdx;
  const barEdge: Float32Array[] = [];
  for (let k = 0; k < BAR_K; k++) for (const side of [-1, 1]) {
    const f = (k + 0.5) / BAR_K, mx = bA.x + (bB.x - bA.x) * f, mz = bA.z + (bB.z - bA.z) * f, row = new Float32Array(LEVELS);
    for (let l = 0; l < LEVELS; l++) {
      const lvl = LO + (HI - LO) * (l / (LEVELS - 1));
      if (height(mx, mz) <= lvl) { row[l] = -1; continue; }
      let d = 0;
      while (d < 3.2 && height(mx + bpx * side * d, mz + bpz * side * d) > lvl) d += 0.04;
      row[l] = d >= 3.2 ? -2 : d;
    }
    barEdge.push(row);
  }
  const barEdgeAt = (j: number, lvl: number) => {
    const fl = clamp((lvl - LO) / (HI - LO), 0, 1) * (LEVELS - 1), l = Math.min(LEVELS - 2, Math.floor(fl)), k = fl - l, a = barEdge[j][l], b = barEdge[j][l + 1];
    return a < 0 || b < 0 ? (k < 0.5 ? a : b) : a * (1 - k) + b * k;
  };

  /* surf: soft white specks along the waterline that wash up the sand and slide back */
  const RING = ANGLES * PER, M = RING + BAR_K * 2 * BAR_PER;
  const pos = new Float32Array(M * 3), col = new Float32Array(M * 4).fill(1), seed = new Float32Array(M), jit = new Float32Array(M);
  for (let i = 0; i < M; i++) { seed[i] = Math.random(); jit[i] = i >= RING ? Math.random() - 0.5 : (Math.random() - 0.5) * (Math.PI * 2 / (Math.floor(i / PER) >= MAIN ? ISLET : MAIN)); }
  // the swell where each stretch of shore meets the sea (worked out at mid-tide; it hardly changes over a metre or two)
  const edgeX = new Float32Array(ANGLES), edgeZ = new Float32Array(ANGLES), edgeDamp = new Float32Array(ANGLES);
  for (let i = 0; i < ANGLES; i++) {
    const r = shoreAt(i, 0.12);
    edgeX[i] = cx[i] + Math.cos(ang[i]) * r; edgeZ[i] = cz[i] + Math.sin(ang[i]) * r; edgeDamp[i] = swellDamp(edgeX[i], edgeZ[i]);
  }
  const foamGeo = new BufferGeometry();
  foamGeo.setAttribute('position', new BufferAttribute(pos, 3));
  foamGeo.setAttribute('color', new BufferAttribute(col, 4)); // (white, with the brightness as its alpha)
  const foam = new Points(foamGeo, new PointsMaterial({ size: 0.85, map: softDot(), vertexColors: true, transparent: true, depthWrite: false }));
  foam.renderOrder = 2; // (after the see-through water)
  foam.frustumCulled = false;
  scene.add(foam);

  /* footprints in the wet sand */
  const MAX = 70;
  const printGeo = new CircleGeometry(0.055, 7);
  printGeo.rotateX(-Math.PI / 2);
  const prints = new InstancedMesh(printGeo, new MeshBasicMaterial({ color: '#6E5E44', transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), MAX);
  prints.frustumCulled = false;
  prints.count = 0;
  scene.add(prints);
  const steps: { x: number; z: number; y: number; yaw: number; at: number }[] = [];
  let lastX = 0, lastZ = 0, left = false;
  const dummy = new Object3D();

  /**
   * @param t real seconds (the surf)  @param light 0…1 how bright it is (surf is faint at night)
   */
  return function updateShore(S: SimState, her: Object3D, t: number, light: number) {
    const sea = seaLevel();
    // surf: anchored where the water really meets the sand right now (tide + swell)
    const level = new Float32Array(ANGLES);
    for (let i = 0; i < ANGLES; i++) level[i] = sea + swell(edgeX[i], edgeZ[i], t, edgeDamp[i]);
    for (let i = 0; i < RING; i++) {
      const ai = Math.floor(i / PER), a = ang[ai] + jit[i];
      // each wave: rushes up the sand, then slides back and fades
      const ph = (t * 0.22 + seed[i] * 0.35 + Math.sin(ai * 0.37) * 0.3) % 1;
      const up = ph < 0.4 ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
      const r = shoreAt(ai, level[ai]) + 0.12 - 0.5 * up;
      pos[i * 3] = cx[ai] + Math.cos(a) * r; pos[i * 3 + 2] = cz[ai] + Math.sin(a) * r;
      pos[i * 3 + 1] = Math.max(level[ai] + 0.03, height(pos[i * 3], pos[i * 3 + 2]) + 0.03);
      // (none on the sandbar: it has its own, below)
      const b = barDist(pos[i * 3], pos[i * 3 + 2]) < 2.8 ? 0 : (0.06 + 0.3 * (ph < 0.4 ? up : up * up)) * (0.15 + 0.85 * light); // (faint in the dark)
      col[i * 4 + 3] = b * 2;
    }
    // the sandbar: surf washing up both its sides; when it's only just under water, waves break over its top
    for (let i = RING; i < M; i++) {
      const j = Math.floor((i - RING) / BAR_PER), k = Math.floor(j / 2), side = j % 2 ? 1 : -1;
      const f = (k + 0.5 + jit[i] * 0.9) / BAR_K, mx = bA.x + (bB.x - bA.x) * f, mz = bA.z + (bB.z - bA.z) * f;
      const lvl = sea + swell(mx, mz, t);
      const ph = (t * 0.22 + seed[i] * 0.35 + Math.sin(k * 0.5 + side) * 0.3) % 1;
      const up = ph < 0.4 ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
      const edge = barEdgeAt(j, lvl);
      let b = 0, off = 0;
      if (edge >= 0) { off = Math.max(0, edge + 0.12 - 0.45 * up); b = 0.06 + 0.3 * (ph < 0.4 ? up : up * up); }
      else if (edge === -1 && lvl - BAR_TOP < 0.07) { off = (seed[i] - 0.5) * 1.2; b = (0.05 + 0.25 * up * up) * (1 - (lvl - BAR_TOP) / 0.07); }
      const x = mx + bpx * side * off, z = mz + bpz * side * off;
      pos[i * 3] = x; pos[i * 3 + 2] = z;
      pos[i * 3 + 1] = Math.max(lvl + 0.03, height(x, z) + 0.03);
      col[i * 4 + 3] = b * 2 * (0.15 + 0.85 * light);
    }
    foamGeo.attributes.position.needsUpdate = true;
    foamGeo.attributes.color.needsUpdate = true;

    // footprints: a new one every step she takes on wet sand (just above the water)
    const hx = her.position.x, hz = her.position.z, moved = Math.hypot(hx - lastX, hz - lastZ);
    if (moved > 2) { lastX = hx; lastZ = hz; } // (teleported, e.g. a save loading)
    else if (moved > 0.38 && !S.sailing) {
      const gy = height(hx, hz), yaw = Math.atan2(hx - lastX, hz - lastZ);
      lastX = hx; lastZ = hz;
      if (gy > sea + 0.01 && gy < sea + 0.32) {
        left = !left;
        const side = left ? 0.08 : -0.08;
        const x = hx + Math.cos(yaw) * side, z = hz - Math.sin(yaw) * side;
        steps.push({ x, z, y: height(x, z) + 0.012, yaw, at: S.min });
        if (steps.length > MAX) steps.shift();
      }
    }
    // the rising tide (or a day's wind) wipes them away
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].y < sea + 0.04 || S.min - steps[i].at > 1440) steps.splice(i, 1);
    steps.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, s.yaw, 0);
      dummy.scale.set(1, 1, 1.7);
      dummy.updateMatrix();
      prints.setMatrixAt(i, dummy.matrix);
    });
    prints.count = steps.length;
    prints.instanceMatrix.needsUpdate = true;
  };
}
