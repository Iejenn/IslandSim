// The night sky: a moon that waxes and wanes (see sim/night.ts), shooting
// stars, two island constellations (the turtle and the canoe), and on some
// summer nights the waves along the shore glow blue.
import {
  AdditiveBlending, BufferAttribute, CanvasTexture, type Camera, Group, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Line, LineBasicMaterial, LineSegments, Mesh, PlaneGeometry,
  Points, PointsMaterial, Quaternion, ShaderMaterial, type DirectionalLight, type Scene, Vector3,
} from 'three';
import { glowingSea, moonAge, moonLight } from '../sim/night';
import { pointAt } from '../sim/island';
import { seaLevel } from '../sim/tide';
import { swell, swellDamp } from './water';
import { clamp } from '../sim/util';

const SKY_R = 140;
/** A soft round dot, so the glowing specks aren't little squares. */
function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}
/** A direction on the sky dome (az, el in radians) at the sky radius. */
const dome = (az: number, el: number, r = SKY_R) => new Vector3(Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r);
/**
 * Where the sun (or the moon) is in the sky at its own hour `hr`: it rises in
 * the east (+x) at 6, is highest at 12 (towards +z) and sets in the west at 18,
 * below the sea in between. The arc is kept low, because the camera can only
 * tilt up a little: what matters is seeing it rise and set.
 */
export const ARC_EL = 0.28;
export function arc(hr: number, r = SKY_R) {
  const a = (hr - 6) / 12 * Math.PI;
  return dome(a, ARC_EL * Math.sin(a), r);
}

// constellations, as little 2D star maps (x, y in degrees) plus which stars are joined
const CONSTELLATIONS: { az: number; el: number; stars: [number, number][]; lines: [number, number][] }[] = [
  { // the turtle: a hexagon shell, a head and four flippers
    az: 2.2, el: 0.15,
    stars: [[0, 4], [3.5, 2], [3.5, -2], [0, -4], [-3.5, -2], [-3.5, 2], [0, 7.5], [6, 4.5], [-6, 4.5], [5.5, -5], [-5.5, -5]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [1, 7], [5, 8], [2, 9], [4, 10]],
  },
  { // the canoe: a curved hull with a paddle sticking up
    az: 4.6, el: 0.12,
    stars: [[-8, 2], [-5, -0.5], [-1.5, -1.5], [2, -1.5], [5.5, -0.5], [8.5, 2], [1, 1], [1.5, 6]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7]],
  },
];

export function createNight(scene: Scene, moonLightSrc: DirectionalLight, camera: Camera) {
  // everything up in the sky travels with the camera, so it always sits at the horizon
  const sky = new Group();
  scene.add(sky);
  /* the moon: a disc whose lit part follows the phase */
  const moonMat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { sun: { value: new Vector3(0, 0, 1) }, opacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 sun; uniform float opacity; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0) discard;
        vec3 n = vec3(p, sqrt(1.0 - r * r));
        // lit from wherever the sun is: full when it's behind us, a crescent when it's near the moon
        float lit = smoothstep(-0.06, 0.06, dot(n, sun));
        float spots = 0.08 * smoothstep(0.35, 0.0, length(p - vec2(-0.3, 0.25))) + 0.06 * smoothstep(0.25, 0.0, length(p - vec2(0.35, -0.3)));
        vec3 col = mix(vec3(0.10, 0.13, 0.22), vec3(0.97, 0.95, 0.86) - spots, lit);
        gl_FragColor = vec4(col, opacity * mix(0.35, 1.0, lit) * smoothstep(1.0, 0.96, r));
      }`,
  });
  const moon = new Mesh(new PlaneGeometry(11, 11), moonMat);
  moon.renderOrder = -1;
  sky.add(moon);

  /* constellations: brighter stars, joined by faint lines */
  const cStars: number[] = [], cLines: number[] = [];
  for (const c of CONSTELLATIONS) {
    const pts = c.stars.map(([x, y]) => dome(c.az + (x * Math.PI / 180) / Math.cos(c.el), c.el + y * Math.PI / 180));
    for (const p of pts) cStars.push(p.x, p.y, p.z);
    for (const [a, b] of c.lines) cLines.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
  }
  const geo = (arr: number[]) => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(arr, 3)); return g; };
  const conStars = new Points(geo(cStars), new PointsMaterial({ color: '#FFF6DD', size: 1.8, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const conLines = new LineSegments(geo(cLines), new LineBasicMaterial({ color: '#9FB6FF', transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(conStars, conLines);

  /* shooting stars: a short streak that races across and fades */
  const streakGeo = geo([0, 0, 0, 0, 0, 0]);
  const streak = new Line(streakGeo, new LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(streak);
  let shoot = -1, nextShoot = 6;
  const sunDir = new Vector3(), inv = new Quaternion();
  const from = new Vector3(), dir = new Vector3(), head = new Vector3(), tail = new Vector3();

  /* the glowing sea: specks along the waterline that pulse in waves */
  const N = 1400, glowPos: number[] = [], glowCol = new Float32Array(N * 3), seed: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.01, p = pointAt(a, 0.975 + Math.random() * Math.random() * 0.07); // (most right at the waterline)
    glowPos.push(p.x, 0.135, p.z);
    seed.push(Math.random() * 6.28, a);
  }
  const glowGeo = geo(glowPos);
  const glowDamp = Float32Array.from({ length: N }, (_, i) => swellDamp(glowPos[i * 3], glowPos[i * 3 + 2]));
  glowGeo.setAttribute('color', new BufferAttribute(glowCol, 3)); // (shares glowCol, which we rewrite each frame)
  const glow = new Points(glowGeo, new PointsMaterial({ size: 0.7, map: softDot(), vertexColors: true, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }));
  glow.visible = false;
  glow.renderOrder = 2; // (after the see-through water)
  scene.add(glow);
  const blue = new Color('#3FE0FF');

  /**
   * @param t real seconds
   * @param h game hour 0–24
   * @param rain 0–1 (clouds hide the sky)
   * @param dt real seconds since last frame
   */
  return function updateNight(t: number, h: number, rain: number, dt: number) {
    const e = Math.sin((h - 6) / 12 * Math.PI), dark = clamp(-e * 3, 0, 1), clear = 1 - rain;
    sky.position.copy(camera.position);
    // the moon follows the same arc as the sun, a little later each day: a new
    // moon travels with the sun, a half moon rises around noon, a full moon
    // rises as the sun sets (so its shape and timing always match)
    const age = moonAge(), mh = h - age * 24;
    const el = Math.sin(((mh - 6) / 12) * Math.PI);
    moon.position.copy(arc(mh));
    moon.lookAt(camera.position);
    sunDir.copy(arc(h, 1)).normalize().applyQuaternion(inv.copy(moon.quaternion).invert());
    moonMat.uniforms.sun.value.copy(sunDir);
    // (by day it's a pale ghost of itself)
    moonMat.uniforms.opacity.value = clamp(el * 6, 0, 1) * (0.35 + 0.65 * clamp(dark * 1.5, 0, 1)) * clear;
    moon.visible = moonMat.uniforms.opacity.value > 0.01;
    // moonlight: only while it's up, bright on a full moon, almost nothing on a new one
    moonLightSrc.position.copy(moon.position).multiplyScalar(0.25).setY(30 * Math.max(0.3, el));
    moonLightSrc.intensity *= (0.25 + 0.75 * moonLight()) * (0.2 + 0.8 * clamp(el * 3, 0, 1));

    const faint = dark * clear * (1 - 0.5 * moonLight()); // a bright moon washes out the faint lines
    (conStars.material as PointsMaterial).opacity = dark * clear;
    (conLines.material as LineBasicMaterial).opacity = 0.22 * faint;

    nextShoot -= dt;
    if (shoot < 0 && nextShoot <= 0 && dark > 0.8 && clear > 0.8) {
      from.copy(dome(Math.random() * 6.28, 0.12 + Math.random() * 0.12));
      dir.set(Math.random() - 0.5, -0.12 - Math.random() * 0.1, Math.random() - 0.5).normalize().multiplyScalar(40);
      shoot = 0; nextShoot = 8 + Math.random() * 20;
    }
    if (shoot >= 0) {
      shoot += dt / 0.9;
      head.copy(from).addScaledVector(dir, shoot);
      tail.copy(from).addScaledVector(dir, Math.max(0, shoot - 0.25));
      streakGeo.attributes.position.setXYZ(0, tail.x, tail.y, tail.z);
      streakGeo.attributes.position.setXYZ(1, head.x, head.y, head.z);
      streakGeo.attributes.position.needsUpdate = true;
      (streak.material as LineBasicMaterial).opacity = Math.sin(Math.min(1, shoot) * Math.PI);
      if (shoot >= 1) { shoot = -1; (streak.material as LineBasicMaterial).opacity = 0; }
    }

    glow.visible = dark > 0.05 && glowingSea();
    if (glow.visible) {
      for (let i = 0; i < N; i++) {
        // waves of light rolling along the shore, each speck twinkling a little
        const wave = Math.max(0, Math.sin(t * 1.2 - seed[i * 2 + 1] * 9 + Math.sin(t * 0.3) * 2));
        const b = dark * (0.15 + 0.85 * wave ** 3) * (0.7 + 0.3 * Math.sin(t * 5 + seed[i * 2]));
        glowCol[i * 3] = blue.r * b; glowCol[i * 3 + 1] = blue.g * b; glowCol[i * 3 + 2] = blue.b * b;
      }
      glowGeo.attributes.color.needsUpdate = true;
      // ride the waves (same swell as world/water.ts), just above the surface
      const pos = glowGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, seaLevel() + 0.08 + swell(x, z, t, glowDamp[i]));
      }
      pos.needsUpdate = true;
    }
  };
}
