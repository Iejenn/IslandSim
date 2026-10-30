// The pond's waterfall: a little spring on the hilltop, a stream running down
// to the edge of the hill, and a fall that arcs over the bank into the pond,
// with foam and spray where it lands. The water is a scrolling striped texture
// on simple ribbons, so it costs next to nothing.
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  Points, PointsMaterial, RepeatWrapping, type Scene,
} from 'three';
import { dirXZ, height, SP, WATERFALL, type Pt } from '../sim/island';
import { M, mesh } from './materials';

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
  const drops = new Points(spray, new PointsMaterial({ color: '#FFFFFF', size: 0.09, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  drops.frustumCulled = false;
  scene.add(drops);

  /** @param t real seconds  @param dry 0…1 how much a drought has dried it up */
  return function updateWaterfall(t: number, dry: number) {
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
