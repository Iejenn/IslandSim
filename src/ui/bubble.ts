// Comic-style thought bubble that floats above her head for a few seconds
// after she says something.
import { Vector3, type Camera, type Object3D } from 'three';
import { S } from '../sim/state';

const SHOW_MS = 7000;

export function createBubble(her: Object3D, camera: Camera) {
  const bubble = document.getElementById('bubble')!, headV = new Vector3();
  let until = 0;
  return {
    /** Call whenever she says something (wired to the sim's onSay hook). */
    show() { until = performance.now() + SHOW_MS; },
    update(now: number, ready: boolean) {
      if (!ready || now > until || !S.thought) { bubble.classList.remove('on'); return; }
      headV.copy(her.position);
      headV.y += 2.1;
      headV.project(camera);
      if (headV.z > 1) { bubble.classList.remove('on'); return; } // behind the camera
      bubble.textContent = S.thought;
      bubble.classList.add('on');
      // keep it on screen: inside the edges, and below the top bar (where it would hide behind the buttons)
      const w = bubble.offsetWidth, h = bubble.offsetHeight, top = (document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 0) + 8;
      const x = Math.min(innerWidth - w / 2 - 8, Math.max(w / 2 + 8, (headV.x * 0.5 + 0.5) * innerWidth));
      const y = Math.max(top + h + 14, (-headV.y * 0.5 + 0.5) * innerHeight);
      bubble.style.transform = `translate(${x}px,${y}px) translate(-50%,calc(-100% - 14px))`;
    },
  };
}
