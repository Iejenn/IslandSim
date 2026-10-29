// Observer panel: her name/traits/activity, vitals, needs, skills, gifts and
// diary tabs, plus the death overlay. Reads sim state; only writes to it via
// grant() when the player gives a gift.
import { GIFTS, grant } from '../sim/gifts';
import { freePlots, growingPlots, ripePlots } from '../sim/garden';
import { happiness } from '../sim/needs';
import { PROJECTS, woodNeeded } from '../sim/projects';
import { xpNeed } from '../sim/skills';
import { dayNum, NEEDS, S, SKILLS, TRAITS, type GiftKey, type NeedKey, type SkillKey } from '../sim/state';

const $ = (id: string) => document.getElementById(id)!;
const level = (v: number) => v < 25 ? 'low' : v < 50 ? 'mid' : 'ok';

function setVital(id: string, v: number, word: string) {
  const el = $(id);
  el.dataset.level = level(v);
  el.querySelector('.num')!.textContent = String(Math.round(v));
  el.querySelector('.word')!.textContent = word;
  el.querySelector<HTMLElement>('i')!.style.width = v + '%';
}

/** "Goal: build a dock · wood 3/8" — only her current goal, never the full list. */
function renderGoal() {
  const el = $('goal'), k = S.goal;
  el.hidden = !k;
  if (!k) return;
  const p = S.projects[k], d = PROJECTS[k];
  const status = p.started ? `${Math.round(p.progress * 100)}% built` : woodNeeded() > 0 ? `wood ${S.stock.wood}/${d.wood}` : 'ready to start';
  el.innerHTML = `Goal: <b>build ${d.a}</b> · ${status}`;
}

/** Camp section: only lists things that exist on her island so far. */
function renderCamp() {
  const rows: [string, string][] = [];
  const anyProject = Object.values(S.projects).some(p => p.started);
  if (S.stock.wood > 0 || anyProject) rows.push(['Woodpile', `${S.stock.wood} log${S.stock.wood === 1 ? '' : 's'}`]);
  if (S.projects.rack.done) rows.push(['Dried fish', String(S.stock.fish)]);
  if (S.projects.garden.done) {
    const seeds = S.stock.seeds + S.stock.fine;
    rows.push(['Seeds', String(seeds)]);
    const growing = growingPlots().length, ripe = ripePlots().length, dead = S.plots.filter(p => p.state === 'withered').length;
    const parts = [growing && `${growing} growing`, ripe && `${ripe} ripe`, dead && `${dead} withered`].filter(Boolean);
    rows.push(['Garden', parts.length ? parts.join(' · ') : freePlots().length ? 'empty beds' : '']);
  }
  const built = (Object.keys(S.projects) as (keyof typeof S.projects)[]).filter(k => S.projects[k].done).map(k => PROJECTS[k].name);
  if (built.length) rows.push(['Built', built.map(b => b[0].toUpperCase() + b.slice(1)).join(', ')]);
  $('campTitle').hidden = !rows.length;
  $('camp').innerHTML = rows.map(([a, b]) => `<div class="camp-row"><span>${a}</span><span>${b}</span></div>`).join('');
}

export function createPanel(onGiftGiven: () => void, onNewIsland: () => void) {
  const needsEl = $('needs'), skillsEl = $('skills'), panel = $('panel'), toggle = $('sheetToggle');
  needsEl.innerHTML = Object.entries(NEEDS).map(([k, l]) =>
    `<div class="meter" data-k="${k}" data-level="ok"><span>${l}</span><div class="m-track"><i></i></div><span class="m-val">0</span></div>`).join('');

  $('gifts').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-gift]');
    if (b) { grant(b.dataset.gift as GiftKey); onGiftGiven(); }
  });
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    ['status', 'gifts', 'diary'].forEach(t => { $('tab-' + t).hidden = t !== b.dataset.tab; });
  }));

  // on phones the panel is a bottom sheet that starts collapsed
  toggle.addEventListener('click', () => {
    const c = panel.classList.toggle('collapsed');
    toggle.textContent = c ? 'Show' : 'Hide';
    toggle.setAttribute('aria-expanded', String(!c));
  });
  if (innerWidth <= 760) {
    panel.classList.add('collapsed');
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-expanded', 'false');
  }
  $('restart').addEventListener('click', onNewIsland);
  $('startOver').addEventListener('click', () => {
    if (confirm(`Leave ${S.name} and start over on a new island? This can’t be undone.`)) onNewIsland();
  });

  return {
    expand() {
      panel.classList.remove('collapsed');
      toggle.textContent = 'Hide';
    },
    showDeath() {
      $('deathTitle').textContent = `${S.name} didn’t make it`;
      $('deathText').textContent = `She survived ${dayNum()} day${dayNum() > 1 ? 's' : ''} on the island.`;
      $('death').hidden = false;
    },
    render() {
      $('name').textContent = S.name;
      if (!$('traits').childElementCount) $('traits').innerHTML = S.traits.map(t => `<li>${TRAITS[t]}</li>`).join('');
      $('doing').innerHTML = `<strong>${S.activity}</strong>`;
      renderGoal();
      $('thought').textContent = S.thought ? `“${S.thought}”` : '';

      const hp = S.health, hap = happiness();
      setVital('v-health', hp, hp >= 80 ? 'Healthy' : hp >= 50 ? 'Worn down' : hp >= 20 ? 'Sick' : 'Critical');
      setVital('v-happy', hap, hap >= 80 ? 'Content' : hap >= 60 ? 'Okay' : hap >= 40 ? 'Restless' : hap >= 20 ? 'Unhappy' : 'Miserable');
      for (const el of Array.from(needsEl.children) as HTMLElement[]) {
        const v = S.needs[el.dataset.k as NeedKey];
        el.dataset.level = level(v);
        el.querySelector<HTMLElement>('i')!.style.width = v + '%';
        el.querySelector('.m-val')!.textContent = String(Math.round(v));
      }

      // gift- and project-based skills only show up once they're part of her life
      const shown = (Object.keys(SKILLS) as SkillKey[]).filter(k => (k !== 'music' || S.items.piano) && (k !== 'reading' || S.items.books)
        && (k !== 'building' || Object.values(S.projects).some(p => p.started)) && (k !== 'gardening' || S.projects.garden.done));
      skillsEl.innerHTML = shown.map(k => {
        const s = S.skills[k], p = s.lvl >= 10 ? 100 : s.xp / xpNeed(s.lvl) * 100;
        return `<div class="skill"><span>${SKILLS[k]}</span><div class="m-track"><i style="width:${p}%"></i></div><span class="lvl">Lv ${s.lvl}</span></div>`;
      }).join('');

      renderCamp();
      if (S.giftsDirty) {
        S.giftsDirty = false;
        // Only show what she has asked for (or already received), so players
        // never see the full list of what could be unlocked.
        const known = (Object.entries(GIFTS) as [GiftKey, (typeof GIFTS)[GiftKey]][]).filter(([k]) => S.wishes.includes(k) || S.items[k]);
        $('gifts').innerHTML = known.length
          ? known.map(([k, g]) =>
            `<div class="gift"><b>${g.name}</b>${S.wishes.includes(k) ? `<span class="wish">She wishes for this</span>` : ''}<p>${g.desc}</p>
      <button data-gift="${k}" ${S.items[k] || S.dead ? 'disabled' : ''}>${S.items[k] ? 'Given' : 'Give'}</button></div>`).join('')
          : `<p class="hint">She hasn’t asked for anything yet. Listen to her thoughts.</p>`;
        const wb = $('wishBadge');
        wb.hidden = !S.wishes.length;
        wb.textContent = String(S.wishes.length);
      }
      if (S.diaryDirty) {
        S.diaryDirty = false;
        $('diary').innerHTML = S.diary.map(d => `<li><time>${d.t}</time><span>${d.text}</span></li>`).join('');
      }
    },
  };
}
