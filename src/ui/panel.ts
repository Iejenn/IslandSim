// Observer panel: her name/traits/activity, vitals, needs, skills, gifts and
// diary tabs, plus the death overlay. Reads sim state; only writes to it via
// grant() when the player gives a gift.
import { GIFTS, grant } from '../sim/gifts';
import { happiness } from '../sim/needs';
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

export function createPanel(onGiftGiven: () => void) {
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
  $('restart').addEventListener('click', () => location.reload());

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

      // piano and reading skills only show up once she has the gift
      const shown = (Object.keys(SKILLS) as SkillKey[]).filter(k => (k !== 'music' || S.items.piano) && (k !== 'reading' || S.items.books));
      skillsEl.innerHTML = shown.map(k => {
        const s = S.skills[k], p = s.lvl >= 10 ? 100 : s.xp / xpNeed(s.lvl) * 100;
        return `<div class="skill"><span>${SKILLS[k]}</span><div class="m-track"><i style="width:${p}%"></i></div><span class="lvl">Lv ${s.lvl}</span></div>`;
      }).join('');

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
