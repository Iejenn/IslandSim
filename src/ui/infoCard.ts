// The little card that pops up when you tap something on the island
// (see world/inspect.ts). It fades away by itself after a while.
import type { Info } from '../world/inspect';

export function createInfoCard() {
  const el = document.getElementById('info')!, title = document.getElementById('infoTitle')!, lines = document.getElementById('infoLines')!;
  let timer = 0;
  const hide = () => { el.hidden = true; clearTimeout(timer); };
  return {
    hide,
    /** @param x, y where it was tapped (screen pixels) */
    show(info: Info, x: number, y: number) {
      title.textContent = info.title;
      lines.innerHTML = '';
      for (const l of info.lines) { const li = document.createElement('li'); li.textContent = l; lines.appendChild(li); }
      el.hidden = false;
      // next to the tap, but always fully on screen
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x + 14))}px`;
      el.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y - h - 14))}px`;
      clearTimeout(timer);
      timer = window.setTimeout(hide, 6000);
    },
  };
}
