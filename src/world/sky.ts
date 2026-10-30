// Sun, moon, sky colour, stars and the campfire glow over the day/night cycle.
// The sky is a dome around the camera: a gradient from the horizon up, warmed
// around the sun at sunrise and sunset, with the sun's disc rising and setting.
import { AdditiveBlending, BackSide, Group, Mesh, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3, type Camera, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, HemisphereLight, Points, PointsMaterial, type Fog, type PointLight, type Scene } from 'three';
import { clamp, smooth } from '../sim/util';
import { arc, createNight } from './night';
import { season } from '../sim/seasons';
import { S } from '../sim/state';

// three r155+ uses physical light units. r147 (legacy mode) silently multiplied
// every light by π, so we do it here to keep the original brightness.
const LEGACY = Math.PI;
// The campfire light's falloff curve also changed; 0.84 together with the
// decay/distance in props.ts approximates the old curve (see createCampfire).
export const FIRE_LIGHT_SCALE = LEGACY * 0.84;

export interface Campfire { flame: Mesh; flame2: Mesh; light: PointLight }

export function createSky(scene: Scene, camera: Camera) {
  const hemi = new HemisphereLight('#CFEFFF', '#6B8F4E', 0.6 * LEGACY);
  scene.add(hemi);
  const sun = new DirectionalLight('#FFF1D6', 1.6 * LEGACY);
  sun.castShadow = true;
  // shadows have to cover the whole island; a bigger map keeps them crisp at this size
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 150 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const moon = new DirectionalLight('#9DB8FF', 0);
  moon.position.set(-20, 30, -10);
  scene.add(moon);
  const updateNight = createNight(scene, moon, camera); // moon phases, constellations, shooting stars, glowing sea

  const stars = (() => {
    const p: number[] = [];
    for (let i = 0; i < 900; i++) {
      // (the camera only tilts up a little, so most stars sit low over the sea)
      const th = Math.random() * Math.PI * 2, ph = i < 300 ? Math.random() * 1.3 : Math.PI / 2 - 0.02 - Math.random() * Math.random() * 0.5;
      p.push(150 * Math.sin(ph) * Math.cos(th), 150 * Math.cos(ph), 150 * Math.sin(ph) * Math.sin(th));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p, 3));
    const s = new Points(g, new PointsMaterial({ color: '#FFFFFF', size: 0.9, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(s);
    return s;
  })();

  /* the sky dome (drawn behind everything, travels with the camera) */
  const dome = new Group();
  scene.add(dome);
  const skyMat = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new Color() }, horizon: { value: new Color() }, glowCol: { value: new Color('#FF9A55') }, glow: { value: 0 }, sunDir: { value: new Vector3(1, 0, 0) } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top, horizon, glowCol, sunDir; uniform float glow; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(horizon, top, smoothstep(-0.02, 0.32, d.y));
        // a warm wash low in the sky on the sun's side, and a brighter halo right around it
        float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
        float band = pow(toward, 3.0) * (1.0 - smoothstep(0.0, 0.3, d.y));
        float halo = pow(max(dot(d, sunDir), 0.0), 24.0);
        col += glowCol * glow * (0.75 * band + 0.6 * halo);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const skyBall = new Mesh(new SphereGeometry(300, 32, 16), skyMat);
  skyBall.renderOrder = -10;
  dome.add(skyBall);
  /* the sun's disc: white-gold up high, big and orange near the horizon */
  const sunMat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending,
    uniforms: { col: { value: new Color('#FFF3D0') }, opacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 col; uniform float opacity; varying vec2 vUv;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float a = smoothstep(0.3, 0.27, r) + 0.45 * pow(max(1.0 - r, 0.0), 2.5);
        gl_FragColor = vec4(col * a * opacity, 1.0);
      }`,
  });
  const sunDisc = new Mesh(new PlaneGeometry(26, 26), sunMat);
  sunDisc.renderOrder = -9;
  dome.add(sunDisc);
  const hDay = new Color('#CBEBF2'), hDusk = new Color('#F4B07C'), hNight = new Color('#1A2D50'), horizon = new Color();
  const sunHigh = new Color('#FFF3D0'), sunLow = new Color('#FF9545');
  const sunWarm = new Color('#FFB066'), sunWhite = new Color('#FFF1D6'), haze = new Color('#F2EAD3'), crispBlue = new Color('#A9D8F0');
  const glowWarm = new Color('#FF9A55'), glowRed = new Color('#E2402E');

  const cDay = new Color('#8FD3E6'), cDusk = new Color('#D99A86'), cTwilight = new Color('#2E3460'), cNight = new Color('#0C1B33'), cRain = new Color('#7E8E98'), sky = new Color(), grey = new Color();

  /**
   * @param t real seconds (flame flicker)
   * @param h game hour 0–24
   * @param fire fire level 0–100
   * @param rain rain intensity 0–1 (greys the sky, hides the sun, pulls the fog in)
   */
  let flash = 0, nextFlash = 2; // lightning
  return function updateSky(t: number, h: number, fire: number, campfire: Campfire, rain = 0, storm = false, dt = 0) {
    const ang = (h - 6) / 12 * Math.PI, e = Math.sin(ang); // e: sun elevation, -1..1
    // clouds gathering before a shower dim the day a little (and a storm's turn the sunset red)
    const w = S.weather, gather = !w.raining && w.coming ? clamp(1 - (w.coming - S.min) / 100, 0, 1) : 0;
    const gloom = Math.max(rain, 0.55 * gather), angry = w.comingStorm && !w.raining ? gather : 0;
    // a low sun: warm golden light and long shadows (it comes from the same side as the sun's disc)
    sun.position.set(Math.cos(ang) * 35, Math.max(e, 0.05) * 35, 6 + 10 * Math.sin(ang));
    sun.intensity = clamp((e + 0.04) / 0.12, 0, 1) * (0.45 + 1.15 * Math.max(0, e)) * LEGACY * (1 - 0.7 * gloom);
    sun.color.copy(sunWarm).lerp(sunWhite, clamp(e / 0.3, 0, 1));
    const day = smooth((e + 0.1) / 0.4);
    if (e > 0.25) sky.copy(cDay);
    else if (e > 0) sky.copy(cDusk).lerp(cDay, e / 0.25);
    // (overhead goes rose → violet twilight → night; the orange stays low, on the horizon)
    else if (e > -0.08) sky.copy(cTwilight).lerp(cDusk, (e + 0.08) / 0.08);
    else if (e > -0.18) sky.copy(cNight).lerp(cTwilight, (e + 0.18) / 0.1);
    else sky.copy(cNight);
    if (gloom > 0) sky.lerp(grey.copy(cRain).multiplyScalar((storm ? 0.1 : 0.2) + (storm ? 0.55 : 0.8) * day), gloom * (storm || angry ? 0.9 : 0.75));
    // lightning: a brief white flash every few seconds during a storm
    nextFlash -= dt;
    if (storm && rain > 0.5 && nextFlash <= 0) { flash = 1; nextFlash = 2 + Math.random() * 6; }
    flash = Math.max(0, flash - dt * 6);
    if (flash > 0) sky.lerp(grey.set('#EEF3FF'), flash * 0.8);
    (scene.background as Color).copy(sky);
    // the horizon: pale by day, glowing peach at sunrise and sunset, deep blue at night
    if (e > 0.25) horizon.copy(hDay);
    else if (e > 0) horizon.copy(hDusk).lerp(hDay, e / 0.25);
    else if (e > -0.18) horizon.copy(hNight).lerp(hDusk, (e + 0.18) / 0.18);
    else horizon.copy(hNight);
    if (gloom > 0) horizon.lerp(grey.copy(cRain).multiplyScalar((storm ? 0.12 : 0.25) + (storm ? 0.55 : 0.8) * day), gloom * (storm ? 0.9 : 0.75));
    // a scorching day: a pale, hazy horizon; a clear winter day: crisp and blue
    const hot = w.hot ? day : 0, crisp = season() === 'winter' && !rain ? day * (1 - gather) : 0;
    if (hot) horizon.lerp(haze, 0.45 * hot);
    if (crisp) horizon.lerp(crispBlue, 0.3 * crisp);
    if (flash > 0) horizon.lerp(grey.set('#EEF3FF'), flash * 0.8);
    dome.position.copy(camera.position);
    skyMat.uniforms.top.value.copy(sky);
    skyMat.uniforms.horizon.value.copy(horizon);
    const sunPos = arc(h);
    skyMat.uniforms.sunDir.value.copy(sunPos).normalize();
    const dusk = clamp(1 - Math.abs(e) / 0.3, 0, 1); // 1 right at sunrise/sunset
    skyMat.uniforms.glow.value = (dusk + 0.15 * day) * (1 - rain) * (1 + 0.6 * angry);
    (skyMat.uniforms.glowCol.value as Color).copy(glowWarm).lerp(glowRed, angry); // red sky: a storm's coming
    // the disc itself: above the horizon only, hidden by cloud
    const up = sunPos.y / 140;
    sunDisc.visible = up > -0.03 && rain < 0.9;
    sunDisc.position.copy(sunPos);
    sunDisc.lookAt(camera.position);
    sunDisc.scale.setScalar(1 + 0.4 * dusk);
    (sunMat.uniforms.col.value as Color).copy(sunLow).lerp(sunHigh, clamp(up / 0.12, 0, 1));
    sunMat.uniforms.opacity.value = clamp((up + 0.03) / 0.05, 0, 1) * (1 - 0.85 * gloom);
    const fog = scene.fog as Fog;
    fog.color.copy(sky).lerp(horizon, 0.6); // (so the far sea melts into the horizon)
    fog.near = (120 - 75 * rain) * (1 - 0.4 * hot) + 40 * crisp;
    fog.far = (260 - 140 * rain) * (1 - 0.25 * hot) + 80 * crisp;
    hemi.intensity = (0.18 + 0.45 * day + flash * 1.5) * LEGACY;
    moon.intensity = 0.35 * (1 - day) * LEGACY;
    updateNight(t, h, rain, dt); // (scales the moonlight by the phase)
    stars.position.copy(camera.position);
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
