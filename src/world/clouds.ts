// Clouds over the sea. They sit out on the horizon (the camera only tilts up a
// little, so that's where you see the sky) and drift slowly around the island.
// A few fair-weather clouds most days, none on a scorching one; they gather and
// darken for an hour or two before a shower, and storm clouds drag grey
// curtains of rain beneath them.
import { CanvasTexture, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Scene, Color } from 'three';
import { season } from '../sim/seasons';
import type { SimState } from '../sim/state';
import { clamp } from '../sim/util';

const N = 18;

/** A vertical fade (solid at the top, gone at the bottom) for the rain curtains. */
function fadeDown() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.6, '#888'); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  return new CanvasTexture(c);
}

export function createClouds(scene: Scene) {
  const white = new Color('#FFFFFF'), stormGrey = new Color('#5E666E'), rainGrey = new Color('#8E979E');
  const cloudMat = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, flatShading: true, emissive: '#1A2230', emissiveIntensity: 0.25, fog: false }); // (out past the fog, but still part of the sky)
  const curtainMat = new MeshBasicMaterial({ color: '#56606A', transparent: true, opacity: 0, alphaMap: fadeDown(), depthWrite: false, side: DoubleSide, fog: false });
  const puff = new IcosahedronGeometry(1, 1);
  const clouds = Array.from({ length: N }, (_, i) => {
    const g = new Group();
    const n = 6 + Math.floor(Math.random() * 4), len = 22 + Math.random() * 22;
    for (let k = 0; k < n; k++) {
      // big puffs in the middle, smaller towards the ends; flat-bottomed like real cumulus
      const p = new Mesh(puff, cloudMat), r = (5 + Math.random() * 4) * (1.3 - Math.abs(k / (n - 1) - 0.5) * 1.2);
      p.position.set((k / (n - 1) - 0.5) * len, r * 0.25 + Math.random() * 1.5, (Math.random() - 0.5) * 6);
      p.scale.set(r, r * 0.6, r * 0.8);
      g.add(p);
    }
    // its rain curtain (only shown under the first half of the clouds, in rain)
    const curtain = new Mesh(new CylinderGeometry(len * 0.4, len * 0.5, 1, 12, 1, true), curtainMat);
    curtain.visible = i < N / 2;
    g.add(curtain);
    scene.add(g);
    return {
      g, curtain, order: (i + 0.5) / N, // clouds show in this order as the sky fills up
      a: Math.random() * Math.PI * 2, r: 120 + Math.random() * 60, y: 11 + Math.random() * 9, drift: 0.6 + Math.random() * 0.8,
      size: 0,
    };
  });
  // shuffle the order a little, so the sky fills up all around rather than on one side
  clouds.sort(() => Math.random() - 0.5).forEach((c, i) => { c.order = (i + 0.5) / N; });
  const fair = 0.2 + Math.random() * 0.3; // how cloudy this island's fair days are

  /**
   * @param dt game-scaled seconds (clouds stop when paused)
   * @param rain 0…1, how hard it's raining
   */
  return function updateClouds(S: SimState, dt: number, rain: number) {
    const w = S.weather, gather = !w.raining && w.coming ? clamp(1 - (w.coming - S.min) / 100, 0, 1) : 0;
    const stormy = w.raining ? w.storm : w.comingStorm;
    // how much of the sky is cloud: a few on fair days, none on a scorcher, all before and during rain
    let cover = w.hot ? 0.06 : season() === 'winter' ? fair * 0.6 : fair;
    cover = Math.max(cover, gather, w.raining ? 1 : 0);
    const dark = Math.max(rain, gather) * (stormy ? 1 : 0.6);
    cloudMat.color.copy(white).lerp(stormy ? stormGrey : rainGrey, dark);
    curtainMat.opacity = 0.3 * Math.max(rain, stormy ? gather * 0.8 : 0);
    for (const c of clouds) {
      const want = cover >= c.order ? 1 : 0;
      c.size += (want - c.size) * clamp(dt * 0.15, 0, 1);
      c.g.visible = c.size > 0.02;
      if (!c.g.visible) continue;
      c.a += dt * 0.0012 * c.drift * (stormy ? 2.5 : 1); // drifting round the island (faster in a storm)
      c.g.position.set(Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r);
      c.g.rotation.y = Math.PI / 2 - c.a; // (long side along the horizon, as seen from the island)
      c.g.scale.set(c.size, c.size * (1 + 0.3 * dark), c.size);
      // the curtain hangs from the cloud down into the sea
      c.curtain.scale.y = (c.y + 2) / c.g.scale.y; // (in the cloud's own, scaled units)
      c.curtain.position.y = -c.curtain.scale.y / 2;
    }
  };
}
