// Smoke curling up from the campfire: soft grey puffs that rise, spread and
// fade, leaning with the wind. More (and paler, like steam) when rain hits it.
import { CanvasTexture, Sprite, SpriteMaterial, type Scene } from 'three';
import { FIRE } from '../sim/island';
import type { SimState } from '../sim/state';

const N = 34;

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function createSmoke(scene: Scene) {
  const tex = puffTexture();
  const puffs = Array.from({ length: N }, () => {
    const s = new Sprite(new SpriteMaterial({ map: tex, color: '#7C7C78', transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    return { s, age: 1, life: 1, vx: 0, vz: 0 };
  });
  let next = 0;

  /**
   * @param dt game-scaled seconds (stops when paused)
   * @param wind 0…1 (storms push the smoke sideways)
   * @param light 0…1 (smoke is barely visible in the dark)
   */
  return function updateSmoke(S: SimState, dt: number, rain: number, wind: number, light: number) {
    const burning = S.fire > 0;
    next -= dt;
    if (burning && next <= 0) {
      const p = puffs.find(q => q.age >= q.life);
      if (p) {
        p.age = 0; p.life = 3 + Math.random() * 2;
        p.vx = 0.15 + wind * 1.2 + (Math.random() - 0.5) * 0.15; p.vz = 0.05 + (Math.random() - 0.5) * 0.15;
        p.s.position.set(FIRE.x + (Math.random() - 0.5) * 0.2, FIRE.y + 0.5, FIRE.z + (Math.random() - 0.5) * 0.2);
        p.s.visible = true;
      }
      // a big fire smokes steadily; a low one only now and then; rain makes it steam
      next = (0.35 - 0.2 * Math.min(1, S.fire / 60)) / (1 + 2 * rain);
    }
    for (const p of puffs) {
      if (p.age >= p.life) { p.s.visible = false; continue; }
      p.age += dt;
      const k = p.age / p.life;
      p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt;
      p.s.position.y += (0.95 - 0.35 * k) * dt;
      p.s.scale.setScalar(0.4 + 1.7 * k);
      (p.s.material as SpriteMaterial).opacity = Math.sin(Math.min(1, k) * Math.PI) * (0.55 + 0.2 * rain) * (0.25 + 0.75 * light);
      (p.s.material as SpriteMaterial).color.set(rain > 0.3 ? '#C8CCCF' : '#7C7C78');
    }
  };
}
