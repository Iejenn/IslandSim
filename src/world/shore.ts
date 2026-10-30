// The shoreline: the sea rises and falls with the tide (sim/tide.ts), white
// surf rolls up the sand and slides back, and she leaves footprints in the wet
// sand that the next tide washes away.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Points, PointsMaterial, type Scene } from 'three';
import { height, islandR } from '../sim/island';
import { seaLevel } from '../sim/tide';
import type { SimState } from '../sim/state';
import { clamp } from '../sim/util';

const ANGLES = 300, PER = 5, LEVELS = 12, LO = 0.0, HI = 0.26;

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

export function createShore(scene: Scene) {
  /* where the waterline is, around the island, for a range of sea levels (worked out once) */
  const shoreR: Float32Array[] = [];
  for (let i = 0; i < ANGLES; i++) {
    const a = (i / ANGLES) * Math.PI * 2, R = islandR(a), row = new Float32Array(LEVELS);
    for (let l = 0; l < LEVELS; l++) {
      const lvl = LO + (HI - LO) * (l / (LEVELS - 1));
      let t = 0.85;
      while (t < 1.15 && height(Math.cos(a) * R * t, Math.sin(a) * R * t) > lvl) t += 0.002;
      row[l] = R * t;
    }
    shoreR.push(row);
  }
  const shoreAt = (i: number, lvl: number) => {
    const f = clamp((lvl - LO) / (HI - LO), 0, 1) * (LEVELS - 1), l = Math.min(LEVELS - 2, Math.floor(f)), k = f - l;
    return shoreR[i][l] * (1 - k) + shoreR[i][l + 1] * k;
  };

  /* surf: soft white specks along the waterline that wash up the sand and slide back */
  const M = ANGLES * PER, pos = new Float32Array(M * 3), col = new Float32Array(M * 3), seed = new Float32Array(M), jit = new Float32Array(M);
  for (let i = 0; i < M; i++) { seed[i] = Math.random(); jit[i] = (Math.random() - 0.5) * (Math.PI * 2 / ANGLES); }
  const foamGeo = new BufferGeometry();
  foamGeo.setAttribute('position', new BufferAttribute(pos, 3));
  foamGeo.setAttribute('color', new BufferAttribute(col, 3));
  const foam = new Points(foamGeo, new PointsMaterial({ size: 0.85, map: softDot(), vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
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
    // surf
    for (let i = 0; i < M; i++) {
      const ai = Math.floor(i / PER), a = (ai / ANGLES) * Math.PI * 2 + jit[i];
      // each wave: rushes up the sand, then slides back and fades
      const ph = (t * 0.22 + seed[i] * 0.35 + Math.sin(ai * 0.37) * 0.3) % 1;
      const up = ph < 0.4 ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
      const r = shoreAt(ai, sea + 0.04) + 0.15 - 0.55 * up;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 2] = Math.sin(a) * r;
      pos[i * 3 + 1] = Math.max(sea + 0.06, height(pos[i * 3], pos[i * 3 + 2]) + 0.03);
      const b = (0.06 + 0.3 * (ph < 0.4 ? up : up * up)) * (0.15 + 0.85 * light); // (faint in the dark)
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
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
