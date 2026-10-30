// The start menu: shown over the (blurred) island on startup and from the
// HUD's Menu button. Continue, three save slots, moving a save to another
// device, and what's new.
import { SEASON_DAYS, SEASONS } from '../sim/seasons';
import { activeSlot, clearSlot, exportSlot, importSlot, playActiveSlot, readSlot, setActiveSlot, SLOTS, type SaveFile } from '../save';
import { UPDATES } from './updates';

const $ = (id: string) => document.getElementById(id)!;

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
/** Name, day and season of a saved island, for its slot row. */
function summary(f: SaveFile) {
  const st = f.state as { name?: string; min?: number; island?: { seasonStart?: number } };
  const day = Math.floor((st.min ?? 0) / 1440) + 1;
  const season = SEASONS[((st.island?.seasonStart ?? 0) + Math.floor((day - 1) / SEASON_DAYS)) % 4];
  return { name: st.name ?? 'Castaway', day, season };
}

export interface MenuHooks {
  /** Close the menu and carry on with the island on screen. */
  play(): void;
  /** Save the island on screen now (before switching away from it). */
  saveNow(): void;
  /** Has the island on screen been played yet? (an unplayed fresh island isn't worth saving) */
  started(): boolean;
  /** The menu opened or closed (pause the sim, turn the camera, hide the HUD). */
  onToggle(open: boolean): void;
}

export function createMenu(h: MenuHooks) {
  const menu = $('menu');
  const view = (which: 'main' | 'import') => { $('menuMain').hidden = which !== 'main'; $('menuImport').hidden = which !== 'import'; };
  let importTo = 1;

  /** Switch to slot i: save this island first, then reload into that one. */
  function goTo(i: number) {
    if (h.started()) h.saveNow();
    setActiveSlot(i);
    playActiveSlot();
  }

  function render() {
    const active = activeSlot(), here = readSlot(active);
    const cont = $('menuContinue');
    cont.textContent = here || h.started() ? 'Continue' : 'Start your island';

    const list = $('slots');
    list.replaceChildren();
    for (let i = 1; i <= SLOTS; i++) {
      const f = readSlot(i), isHere = i === active;
      const li = document.createElement('li');
      li.className = 'slot' + (isHere ? ' here' : '');
      const info = document.createElement('div');
      info.className = 'slot-info';
      const btns = document.createElement('div');
      btns.className = 'slot-btns';
      const btn = (label: string, fn: (e: Event) => void, cls = '') => {
        const b = document.createElement('button');
        b.textContent = label; b.className = cls;
        b.addEventListener('click', fn);
        btns.append(b);
      };
      if (f) {
        const s = summary(f);
        info.innerHTML = `<b></b><span></span>`;
        info.querySelector('b')!.textContent = s.name;
        info.querySelector('span')!.textContent = `Day ${s.day} · ${s.season} · ${isHere ? 'on screen' : ago(f.savedAt)}`;
        if (isHere) btn('Playing', () => close(), 'quiet');
        else btn('Play', () => goTo(i), 'go');
        btn('Export', () => exportFile(i, s.name, s.day));
        btn('Copy code', e => copyCode(i, e));
        btn('Delete', () => {
          if (!confirm(`Delete ${s.name}’s island? This can’t be undone.`)) return;
          clearSlot(i);
          if (isHere) playActiveSlot(false); // (back to the menu, with a fresh island in this slot)
          else render();
        }, 'danger');
      } else {
        info.innerHTML = `<b>Empty</b><span>${isHere ? 'A new island is waiting' : 'Room for another island'}</span>`;
        btn(isHere ? 'Start here' : 'New island', () => { if (isHere) close(); else goTo(i); }, 'go');
        btn('Import', () => { importTo = i; ($('importText') as HTMLTextAreaElement).value = ''; $('importError').hidden = true; view('import'); });
      }
      li.append(info, btns);
      list.append(li);
    }
  }

  function exportFile(i: number, name: string, day: number) {
    const text = exportSlot(i);
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `island-${name.toLowerCase()}-day${day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // (the code is the save itself, so pasting it on another device brings the island over)
  function copyCode(i: number, e: Event) {
    const text = exportSlot(i), b = e.target as HTMLButtonElement;
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => { b.textContent = 'Copied!'; setTimeout(() => { b.textContent = 'Copy code'; }, 1600); },
      () => { b.textContent = 'Couldn’t copy'; });
  }

  // importing: paste a code or pick a file
  $('importFile').addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) ($('importText') as HTMLTextAreaElement).value = await file.text();
  });
  $('importGo').addEventListener('click', () => {
    if (!importSlot(importTo, ($('importText') as HTMLTextAreaElement).value)) { $('importError').hidden = false; return; }
    if (importTo === activeSlot()) playActiveSlot(); // (it replaces the fresh island on screen)
    else { view('main'); render(); }
  });
  $('importCancel').addEventListener('click', () => view('main'));

  // what's new
  $('news').replaceChildren(...UPDATES.map(u => {
    const li = document.createElement('li');
    const b = document.createElement('b'); b.textContent = u.title;
    const p = document.createElement('span'); p.textContent = u.text;
    li.append(b, p);
    return li;
  }));

  $('menuContinue').addEventListener('click', () => close());

  function open() {
    if (h.started()) h.saveNow();
    view('main');
    render();
    menu.hidden = false;
    h.onToggle(true);
  }
  function close() {
    menu.hidden = true;
    h.onToggle(false);
    h.play();
  }
  return { open, close, get isOpen() { return !menu.hidden; } };
}
