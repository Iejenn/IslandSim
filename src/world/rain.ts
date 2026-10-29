// Falling rain streaks around the camera's focus point. The returned
// intensity (0–1) fades in/out smoothly and also greys the sky in sky.ts.
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, type Scene, type Vector3 } from 'three';

const DROPS = 1400, AREA = 44, TOP = 22, LEN = 0.55, SPEED = 26;

export function createRain(scene: Scene) {
  const pos = new Float32Array(DROPS * 6);
  const offs = Array.from({ length: DROPS }, () => [Math.random() * AREA - AREA / 2, Math.random() * TOP, Math.random() * AREA - AREA / 2]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const material = new LineBasicMaterial({ color: '#C8DCE6', transparent: true, opacity: 0, depthWrite: false });
  const lines = new LineSegments(geo, material);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  let intensity = 0;

  /**
   * @param dt real seconds
   * @param raining whether the sim says it's raining
   * @param center where the camera is looking (rain only needs to cover the view)
   */
  return function updateRain(dt: number, raining: boolean, center: Vector3) {
    intensity += ((raining ? 1 : 0) - intensity) * Math.min(1, dt * 0.6);
    lines.visible = intensity > 0.01;
    if (!lines.visible) return intensity;
    material.opacity = 0.55 * intensity;
    const a = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < DROPS; i++) {
      const o = offs[i];
      o[1] -= SPEED * dt;
      if (o[1] < 0) o[1] += TOP;
      const x = center.x + o[0], y = o[1], z = center.z + o[2];
      a.set([x, y, z, x + 0.06, y + LEN, z], i * 6); // slight slant
    }
    geo.attributes.position.needsUpdate = true;
    return intensity;
  };
}
