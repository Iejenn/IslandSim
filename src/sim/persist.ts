// Turning sim state into something that can be stored, and back. Pure data
// in, pure data out; where it's stored (localStorage) is decided in src/save.ts.
import { copy, DOCK_END } from './island';
import type { SimState } from './state';

/**
 * A plain JSON copy of the state. The current task is left out because it
 * holds functions (tick/done callbacks); on load she simply decides what to
 * do next, standing on solid ground.
 */
export function snapshot(S: SimState): Record<string, unknown> {
  const { task: _task, ...rest } = S;
  const data = JSON.parse(JSON.stringify(rest)) as SimState;
  data.sitting = false;
  data.lift = 0;
  data.faceTarget = null;
  if (data.sailing) { // don't resume in the middle of the sea
    data.sailing = false;
    data.pos = copy(DOCK_END);
  }
  return data as unknown as Record<string, unknown>;
}
