// Sun, moon, sky colour, stars and the campfire glow over the day/night cycle.
import { BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, HemisphereLight, Points, PointsMaterial, type Fog, type Mesh, type PointLight, type Scene } from 'three';
import { clamp, smooth } from '../sim/util';

// three r155+ uses physical light units. r147 (legacy mode) silently multiplied
// every light by π, so we do it here to keep the original brightness.
const LEGACY = Math.PI;
// The campfire light's falloff curve also changed; 0.84 together with the
// decay/distance in props.ts approximates the old curve (see createCampfire).
export const FIRE_LIGHT_SCALE = LEGACY * 0.84;

export interface Campfire { flame: Mesh; flame2: Mesh; light: PointLight }

export function createSky(scene: Scene) {
  const hemi = new HemisphereLight('#CFEFFF', '#6B8F4E', 0.6 * LEGACY);
  scene.add(hemi);
  const sun = new DirectionalLight('#FFF1D6', 1.6 * LEGACY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const moon = new DirectionalLight('#9DB8FF', 0);
  moon.position.set(-20, 30, -10);
  scene.add(moon);

  const stars = (() => {
    const p: number[] = [];
    for (let i = 0; i < 400; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3;
      p.push(150 * Math.sin(ph) * Math.cos(th), 150 * Math.cos(ph), 150 * Math.sin(ph) * Math.sin(th));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p, 3));
    const s = new Points(g, new PointsMaterial({ color: '#FFFFFF', size: 0.9, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(s);
    return s;
  })();

  const cDay = new Color('#8FD3E6'), cDusk = new Color('#F3A46B'), cNight = new Color('#0C1B33'), cRain = new Color('#7E8E98'), sky = new Color(), grey = new Color();

  /**
   * @param t real seconds (flame flicker)
   * @param h game hour 0–24
   * @param fire fire level 0–100
   * @param rain rain intensity 0–1 (greys the sky, hides the sun, pulls the fog in)
   */
  return function updateSky(t: number, h: number, fire: number, campfire: Campfire, rain = 0) {
    const ang = (h - 6) / 12 * Math.PI, e = Math.sin(ang); // e: sun elevation, -1..1
    sun.position.set(Math.cos(ang) * 35, Math.max(e, 0.05) * 35, 12);
    sun.intensity = Math.max(0, e) * 1.6 * LEGACY * (1 - 0.7 * rain);
    const day = smooth((e + 0.1) / 0.4);
    if (e > 0.25) sky.copy(cDay);
    else if (e > 0) sky.copy(cDusk).lerp(cDay, e / 0.25);
    else if (e > -0.18) sky.copy(cNight).lerp(cDusk, (e + 0.18) / 0.18);
    else sky.copy(cNight);
    if (rain > 0) sky.lerp(grey.copy(cRain).multiplyScalar(0.2 + 0.8 * day), rain * 0.75);
    (scene.background as Color).copy(sky);
    const fog = scene.fog as Fog;
    fog.color.copy(sky);
    fog.near = 70 - 45 * rain;
    fog.far = 170 - 90 * rain;
    hemi.intensity = (0.18 + 0.45 * day) * LEGACY;
    moon.intensity = 0.35 * (1 - day) * LEGACY;
    (stars.material as PointsMaterial).opacity = clamp(-e * 3, 0, 1) * 0.9 * (1 - rain); // clouds hide the stars

    const { flame, flame2, light } = campfire;
    const lit = fire > 0;
    flame.visible = flame2.visible = lit;
    const f = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3), size = 0.6 + 0.4 * clamp(fire / 60, 0, 1);
    flame.scale.set(size, size * f, size);
    flame2.scale.set(size, size * (2 - f), size);
    light.intensity = lit ? (0.6 + 2.2 * (1 - day)) * f * size * FIRE_LIGHT_SCALE : 0;
  };
}
