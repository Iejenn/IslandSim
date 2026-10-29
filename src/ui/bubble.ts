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
      bubble.style.transform = `translate(${(headV.x * 0.5 + 0.5) * innerWidth}px,${(-headV.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,calc(-100% - 14px))`;
    },
  };
}
