// The pond's waterfall: a little spring on the hilltop, a stream running down
// to the edge of the hill, and a fall that arcs over the bank into the pond,
// with foam and spray where it lands. The water is a scrolling striped texture
// on simple ribbons, so it costs next to nothing.
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  Points, PointsMaterial, RepeatWrapping, type Scene, Color, RingGeometry,
} from 'three';
import { dirXZ, height, POND_R, SP, WATERFALL, type Pt } from '../sim/island';
import { M, mesh, softDot } from './materials';

/** Streaky white-on-blue texture; scrolling it along the ribbon makes the water flow. */
function waterTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7FD0DE'; g.fillRect(0, 0, 32, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 3, 8 + Math.random() * 30);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** A flat ribbon through the given centre points, `width` wide, its texture running along it. */
function ribbon(points: Pt[], width: (i: number) => number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let along = 0;
  points.forEach((p, i) => {
    const q = points[Math.min(points.length - 1, i + 1)], o = points[Math.max(0, i - 1)];
    const d = dirXZ(o, q), side = { x: -d.z, z: d.x }, w = width(i) / 2;
    if (i) along += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y, p.z - points[i - 1].z);
    pos.push(p.x + side.x * w, p.y, p.z + side.z * w, p.x - side.x * w, p.y, p.z - side.z * w);
    uv.push(0, along / 2, 1, along / 2);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const moonTint = new Color('#3A4A78');

export function createWaterfall(scene: Scene) {
  const tex = waterTexture(), fallTex = tex.clone();
  fallTex.needsUpdate = true;
  const streamMat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false });
  const fallMat = new MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false });
  const { source, top, bottom } = WATERFALL;

  // the stream: from the spring down the hilltop to the lip, hugging the ground
  const stream: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14, x = source.x + (top.x - source.x) * k, z = source.z + (top.z - source.z) * k;
    stream.push({ x, y: height(x, z) + 0.07, z });
  }
  scene.add(new Mesh(ribbon(stream, i => 0.35 + 0.25 * (i / 14)), streamMat));

  // the fall: pours off the lip and drops ever faster into the pond
  const fall: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    fall.push({ x: top.x + (bottom.x - top.x) * k, y: top.y + 0.07 - (top.y + 0.07 - bottom.y) * k * k, z: top.z + (bottom.z - top.z) * k });
  }
  scene.add(new Mesh(ribbon(fall, i => 0.6 + 0.35 * (i / 12)), fallMat));

  // the spring on the hilltop: a few stones round a little pool
  scene.add(mesh(new CylinderGeometry(0.45, 0.5, 0.05, 10), M.spring, source.x, source.y + 0.05, source.z, false));
  // foam where the fall lands, and spray
  const foam = mesh(new CylinderGeometry(0.7, 0.8, 0.03, 14), new MeshBasicMaterial({ color: '#F4FBFC', transparent: true, opacity: 0.7, depthWrite: false }), bottom.x, SP.y + 0.1, bottom.z, false);
  scene.add(foam);
  const N = 40, spray = new BufferGeometry(), seeds = Array.from({ length: N }, () => [Math.random() * 6.3, Math.random(), Math.random()]);
  spray.setAttribute('position', new Float32BufferAttribute(new Float32Array(N * 3), 3));
  const drops = new Points(spray, new PointsMaterial({ color: '#FFFFFF', size: 0.15, map: softDot(), transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  drops.frustumCulled = false;
  scene.add(drops);

  // v2.2: ripples spreading across the pond from where the fall lands, and a paler rim of shallow
  // water that softens the pond's hard edge
  const rippleMat = () => new MeshBasicMaterial({ color: '#E8F7F9', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
  const ripples = [0, 1, 2].map(() => { const r = new Mesh(new RingGeometry(0.92, 1, 28), rippleMat()); r.rotation.x = -Math.PI / 2; r.position.set(bottom.x, SP.y + 0.115, bottom.z); scene.add(r); return r; });
  const rim = new Mesh(new RingGeometry(POND_R - 0.5, POND_R + 0.04, 36), new MeshBasicMaterial({ color: '#CDEFF0', transparent: true, opacity: 0.32, depthWrite: false }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(SP.x, SP.y + 0.105, SP.z); scene.add(rim);
  const lit = [streamMat, fallMat, foam.material as MeshBasicMaterial, rim.material, ...ripples.map(r => r.material)];
  const base = lit.map(m => m.color.clone());

  /** @param t real seconds  @param dry 0…1 how much a drought has dried it up  @param light 0…1 daylight */
  return function updateWaterfall(t: number, dry: number, light = 1) {
    // (these are unlit, so they'd glow white all night: dim them with the daylight, a touch blue by moonlight)
    const k = 0.22 + 0.78 * light;
    lit.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(k).lerp(moonTint, 0.25 * (1 - light)));
    (drops.material as PointsMaterial).opacity = 0.8 * (0.3 + 0.7 * light);
    rim.scale.setScalar(dry ? 0.75 : 1); // (the pond shrinks in a drought)
    ripples.forEach((r, i) => {
      const ph = (t * 0.35 + i / 3) % 1;
      r.scale.setScalar(0.7 + ph * 1.5);
      r.material.opacity = 0.4 * (1 - ph) * (1 - 0.8 * dry);
    });
    tex.offset.y = -t * 0.6; // the stream runs gently…
    fallTex.offset.y = -t * 1.8; // …the fall rushes
    streamMat.opacity = 0.85 * (1 - 0.7 * dry);
    fallMat.opacity = 0.9 * (1 - 0.8 * dry);
    foam.scale.setScalar(1 + 0.08 * Math.sin(t * 5));
    (foam.material as MeshBasicMaterial).opacity = 0.7 * (1 - 0.8 * dry);
    const a = spray.attributes.position.array as Float32Array;
    seeds.forEach(([ang, r, ph], i) => {
      const k = (t * 1.3 + ph) % 1; // each droplet hops up and falls back, over and over
      a.set([bottom.x + Math.cos(ang) * (0.2 + r * 0.6) * k, SP.y + 0.1 + Math.sin(k * Math.PI) * 0.5 * (1 - dry), bottom.z + Math.sin(ang) * (0.2 + r * 0.6) * k], i * 3);
    });
    spray.attributes.position.needsUpdate = true;
  };
}
