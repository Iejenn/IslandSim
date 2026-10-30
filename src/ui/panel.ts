// Observer panel: her name/traits/activity and goal, then Status (vitals,
// needs, skills), Camp (what she has and has made) and Diary tabs, plus the
// death overlay. The player only watches; this never changes sim state.
import { freePlots, growingPlots, ripePlots } from '../sim/garden';
import { happiness } from '../sim/needs';
import { missing, PLANS } from '../sim/plans';
import { xpNeed } from '../sim/skills';
import { season, SEASON_DAYS } from '../sim/seasons';
import { dayNum, NEEDS, S, SKILLS, TRAITS, type DiaryEntry, type CraftKey, type NeedKey, type ProjectKey, type Resource, type SkillKey } from '../sim/state';

const $ = (id: string) => document.getElementById(id)!;
const level = (v: number) => v < 25 ? 'low' : v < 50 ? 'mid' : 'ok';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function setVital(id: string, v: number, word: string) {
  const el = $(id);
  el.dataset.level = level(v);
  el.querySelector('.num')!.textContent = String(Math.round(v));
  el.querySelector('.word')!.textContent = word;
  el.querySelector<HTMLElement>('i')!.style.width = v + '%';
}

/** "Goal: make a fishing rod · fibre 1/2" — only her current goal, never the full list. */
function renderGoal() {
  const el = $('goal'), k = S.goal;
  el.hidden = !k;
  if (!k) return;
  const d = PLANS[k], p = d.kind === 'build' ? S.projects[k as ProjectKey] : S.crafting;
  const short = (Object.entries(missing()) as [Resource, number][]).filter(([, n]) => n > 0);
  const status = p.started ? `${Math.round(p.progress * 100)}% ${d.kind === 'build' ? 'built' : 'done'}`
    : short.length ? short.map(([r]) => `${r} ${Math.min(S.stock[r], d.cost[r] ?? 0)}/${d.cost[r]}`).join(', ') : 'ready to start';
  el.innerHTML = `Goal: <b>${d.kind === 'craft' ? 'make' : 'build'} ${d.a}</b> · ${status}`;
}

/** Camp tab: only lists things that exist on her island so far, to keep the mystery. */
function renderCamp() {
  const section = (title: string, rows: [string, string][]) => rows.length
    ? `<h2>${title}</h2>` + rows.map(([a, b]) => `<div class="camp-row"><span>${a}</span><span>${b}</span></div>`).join('') : '';
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

  const stock: [string, string][] = [];
  stock.push(['Woodpile', n(S.stock.wood, 'log', 'logs')]);
  if (S.stock.stone || S.items.pick) stock.push(['Stones', String(S.stock.stone)]);
  if (S.stock.fibre) stock.push(['Plant fibre', String(S.stock.fibre)]);
  if (S.stock.saplings) stock.push(['Saplings', String(S.stock.saplings)]);
  if (S.stock.raw) stock.push(['Fresh fish', `${S.stock.raw} (needs cooking)`]);
  if (S.stock.meat) stock.push(['Rabbit', `${S.stock.meat} (needs cooking)`]);
  if (S.stock.veg) stock.push(['Vegetables', String(S.stock.veg)]);
  if (S.stock.shells) stock.push(['Shells collected', String(S.stock.shells)]);
  if (S.stock.clay) stock.push(['Clay', String(S.stock.clay)]);
  if (S.stock.bamboo || S.isletFound) stock.push(['Bamboo', String(S.stock.bamboo)]);
  if (S.stock.flint || S.projects.cave.done) stock.push(['Flint', String(S.stock.flint)]);
  if (S.stock.honey || S.projects.beehive.done) stock.push(['Honey', S.stock.honey ? n(S.stock.honey, 'jar', 'jars') : 'none yet']);
  if (S.stock.fruit || S.orchard.some(t => t.kind)) stock.push(['Fruit', S.stock.fruit ? n(S.stock.fruit, 'piece', 'pieces') : 'none ripe yet']);
  if (S.stock.eggs || S.projects.coop.done) stock.push(['Eggs', String(S.stock.eggs)]);
  if (S.stock.wool || S.stats.shorn) stock.push(['Wool', String(S.stock.wool)]);
  if (S.projects.rack.done) stock.push(['Dried food', String(S.stock.fish)]);
  if (S.projects.trap.done) stock.push(['Fish trap', S.trapFish >= 1 ? n(Math.floor(S.trapFish), 'fish waiting', 'fish waiting') : 'empty']);
  if (S.projects.barrel.done) stock.push(['Rain barrel', S.barrel >= 1 ? n(Math.floor(S.barrel), 'drink', 'drinks') + ' of rainwater' : 'empty']);
  if (S.projects.garden.done) stock.push(['Seeds', String(S.stock.seeds)]);
  stock.push(['Campfire', S.fire > 0 ? (S.fire < 20 ? 'burning low' : 'burning') : 'out']);

  // (styled things say what she made them from)
  const made = (Object.keys(S.items) as CraftKey[]).filter(k => S.items[k]).map(k => [cap(PLANS[k].name), S.madeStyle[k] ?? ''] as [string, string]);
  const built = (Object.keys(S.projects) as ProjectKey[]).filter(k => S.projects[k].done).map(k => [cap(PLANS[k].name), S.projects[k].damaged ? 'storm-damaged' : S.madeStyle[k] ?? ''] as [string, string]);
  if (S.projects.garden.done) {
    const growing = growingPlots().length, ripe = ripePlots().length, dead = S.plots.filter(p => p.state === 'withered').length;
    const parts = [growing && `${growing} growing`, ripe && `${ripe} ripe`, dead && `${dead} withered`].filter(Boolean);
    const g = built.find(([name]) => name === 'Garden');
    if (g) g[1] = parts.length ? parts.join(' · ') : freePlots().length ? 'empty beds' : '';
  }

  const trees = S.trees.filter(t => t.state === 'tree').length, stumps = S.trees.filter(t => t.state === 'stump').length, saplings = S.trees.filter(t => t.state === 'sapling').length;
  const island: [string, string][] = [];
  if (stumps || saplings) island.push(['Forest', [n(trees, 'tree', 'trees'), stumps && n(stumps, 'stump', 'stumps'), saplings && n(saplings, 'young tree', 'young trees')].filter(Boolean).join(' · ')]);
  const mined = S.boulders.filter(b => b < 8).length;
  if (mined) island.push(['Boulders', `${S.boulders.filter(b => b > 0).length} left`]);
  if (S.isletFound) island.push(['Bamboo islet', `${S.bamboo.reduce((a, b) => a + Math.floor(b), 0)} canes · ${S.projects.bridge.done ? 'bridged' : 'reached at low tide'}`]);
  if (S.min > 1440 * 1.5) island.push(['She likes building with', S.style ?? 'wood']);

  const friends: [string, string][] = [];
  if (S.dog.state === 'wild') friends.push(['A stray dog', S.dog.trust > 0.5 ? 'warming up to her' : S.dog.trust > 0 ? 'still wary' : 'keeps its distance']);
  if (S.dog.state === 'friend') friends.push([S.dog.name, 'her dog']);
  if (S.gull.state === 'hurt') friends.push(['A hurt seagull', 'she’s nursing it']);
  if (S.gull.state === 'pet') friends.push(['Captain', 'her seagull']);
  const hens = S.chickens.filter(c => c.penned).length, flock = S.sheep.filter(c => c.penned).length;
  if (hens) friends.push(['Chickens', `${hens} at home`]);
  if (flock) friends.push(['Sheep', `${flock} at home${S.sheep.some(s => s.penned && s.wool >= 1) ? ' · ready to shear' : ''}`]);

  $('camp').innerHTML = section('Supplies', stock) + section('Made by hand', made) + section('Built', built) + section('Company', friends) + section('The island', island);
}

/**
 * Diary grouped by day, newest first: a heading with the season, that day's
 * recap as a summary, then what happened (big moments highlighted).
 */
function renderDiary() {
  const days = new Map<number, { recap?: string; items: DiaryEntry[] }>();
  for (const d of S.diary) {
    // (entries from older saves have the day inside the time: "Day 3, 07:00")
    const m = /^Day (\d+), (.*)$/.exec(d.t), day = d.day ?? (m ? +m[1] : dayNum()), t = m ? m[2] : d.t;
    if (!days.has(day)) days.set(day, { items: [] });
    const g = days.get(day)!;
    if (d.kind === 'recap' || d.text.startsWith('Looking back on day')) g.recap = d.text.replace(/^Looking back on day \d+: /, '');
    else g.items.push({ ...d, t });
  }
  return [...days.entries()].sort((a, b) => b[0] - a[0]).map(([day, g]) => {
    const s = season(day);
    return `<li class="day"><h3>Day ${day} <span>${cap(s)}${day === dayNum() ? ' · today' : ''}</span></h3>`
      + (g.recap ? `<p class="recap">${g.recap}</p>` : '')
      + `<ol>${g.items.map(d => `<li${d.kind === 'big' ? ' class="big"' : ''}><time>${d.t}</time><span>${d.text}</span></li>`).join('')}</ol></li>`;
  }).join('');
}

/**
 * Her story: a summary of her life so far, then the big moments in order,
 * in chapters, one per season she's lived through.
 */
function renderStory() {
  const day = dayNum(), built = Object.values(S.projects).filter(p => p.done).length, made = Object.values(S.items).filter(Boolean).length;
  const planted = S.trees.filter(t => t.planted).length, home = S.chickens.filter(c => c.penned).length + S.sheep.filter(c => c.penned).length + S.bredHens + S.bredSheep.length;
  const facts = [
    `${day} day${day > 1 ? 's' : ''} on the island`,
    built && `${built} thing${built > 1 ? 's' : ''} built`, made && `${made} made by hand`,
    S.stats.fishCaught && `${S.stats.fishCaught} fish caught`, planted && `${planted} tree${planted > 1 ? 's' : ''} planted`,
    S.dog.state === 'friend' && `best friends with ${S.dog.name}`, S.gull.state === 'pet' && 'a seagull called Captain', home && `${home} animals at home`,
  ].filter(Boolean);
  const dream = S.feelingsNoted.includes('dream') ? (S.dream ? `<p class="story-dream">Still dreaming of ${PLANS[S.dream].a}.</p>` : '') : '';
  const chapters = new Map<number, { day: number; text: string }[]>();
  for (const e of S.story) {
    const c = Math.floor((e.day - 1) / SEASON_DAYS);
    if (!chapters.has(c)) chapters.set(c, []);
    chapters.get(c)!.push(e);
  }
  const body = [...chapters.entries()].map(([c, es]) => {
    const first = c * SEASON_DAYS + 1, last = Math.min(day, first + SEASON_DAYS - 1);
    return `<li class="chapter"><h3>${cap(season(first))} <span>days ${first}–${last}</span></h3><ol>`
      + es.map(e => `<li><time>Day ${e.day}</time><span>${e.text}</span></li>`).join('') + '</ol></li>';
  }).join('');
  return `<div class="story-head"><h2>${S.name}</h2><p>${facts.join(' · ')}</p>${dream}</div>`
    + (body ? `<ol class="story">${body}</ol>` : '<p class="story-empty">Her story is just beginning.</p>');
}

export function createPanel(onNewIsland: () => void) {
  const needsEl = $('needs'), skillsEl = $('skills'), panel = $('panel'), toggle = $('sheetToggle');
  needsEl.innerHTML = Object.entries(NEEDS).map(([k, l]) =>
    `<div class="meter" data-k="${k}" data-level="ok"><span>${l}</span><div class="m-track"><i></i></div><span class="m-val">0</span></div>`).join('');

  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    ['status', 'camp', 'diary', 'story'].forEach(t => { $('tab-' + t).hidden = t !== b.dataset.tab; });
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

      // skills only show up once they're part of her life
      const shown = (Object.keys(SKILLS) as SkillKey[]).filter(k => (k !== 'music' || S.items.drum) && (k !== 'writing' || S.items.journal)
        && (k !== 'crafting' || S.stats.crafted > 0 || S.crafting.started)
        && (k !== 'building' || Object.values(S.projects).some(p => p.started)) && (k !== 'gardening' || S.projects.garden.done));
      skillsEl.innerHTML = shown.map(k => {
        const s = S.skills[k], p = s.lvl >= 10 ? 100 : s.xp / xpNeed(s.lvl) * 100;
        return `<div class="skill"><span>${SKILLS[k]}</span><div class="m-track"><i style="width:${p}%"></i></div><span class="lvl">Lv ${s.lvl}</span></div>`;
      }).join('');

      renderCamp();
      if (!$('tab-story').hidden) $('story').innerHTML = renderStory();
      if (S.diaryDirty) {
        S.diaryDirty = false;
        $('diary').innerHTML = renderDiary();
      }
    },
  };
}
