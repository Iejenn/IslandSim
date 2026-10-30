// Skill XP and level-ups (max level 10).
import { log, S, say, SKILLS, type SkillKey } from './state';
import { pick } from './util';
import { checkMastery } from './life';

export const xpNeed = (l: number) => Math.round(25 * Math.pow(l + 1, 1.35));

export function addXp(k: SkillKey, x: number) {
  const s = S.skills[k];
  if (s.lvl >= 10) return;
  s.xp += x;
  while (s.lvl < 10 && s.xp >= xpNeed(s.lvl)) {
    s.xp -= xpNeed(s.lvl);
    s.lvl++;
    S.mood = Math.min(40, S.mood + 12);
    log(`${SKILLS[k]} went up to level ${s.lvl}.`);
    say(k === 'music'
      ? pick(['I played a whole song without a mistake!', 'My fingers are starting to remember.'])
      : pick(['I’m getting better at this!', 'Look at me go.']));
    if (S.task) S.task.celebrate = true;
    checkMastery(k);
  }
}
