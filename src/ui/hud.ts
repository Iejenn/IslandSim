// Top-left HUD: clock, time-speed buttons and the "Follow her" toggle.
import { dayNum, clock, hour, S } from '../sim/state';

const $ = (id: string) => document.getElementById(id)!;
const PHASES = (h: number) => h < 5 || h >= 21 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 18 ? 'Afternoon' : 'Evening';

export function createHud() {
  const speedBtns = document.querySelectorAll<HTMLButtonElement>('[data-speed]');
  speedBtns.forEach(b => b.addEventListener('click', () => {
    S.speed = +b.dataset.speed!;
    speedBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));

  let following = false;
  const followBtn = $('follow');
  function setFollow(on: boolean) {
    following = on;
    followBtn.setAttribute('aria-pressed', String(on));
    followBtn.textContent = on ? 'Following' : 'Follow her';
  }
  followBtn.addEventListener('click', () => setFollow(!following));

  return {
    setFollow,
    get following() { return following; },
    render() {
      $('clock').textContent = `Day ${dayNum()}, ${clock()}`;
      $('phase').textContent = PHASES(hour());
    },
  };
}
