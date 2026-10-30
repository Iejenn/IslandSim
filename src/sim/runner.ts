// Plays out the current task's steps. Walking happens here (in game time) so
// fast-forward moves her at the right speed; character/movement.ts only
// mirrors the result onto the 3D model.
import { decide } from './decide';
import { DOCK_START, ground, PACE, V, type Pt } from './island';
import { onDock, surfaceY } from './plans';
import { hooks, S, type Step } from './state';
import { injured } from './events';
import { endTask } from './tasks';
import { clamp } from './util';

// units per game minute; scaled with the island so a bigger island doesn't
// mean she spends her whole day walking
const WALK = 0.4 * PACE, RUN = 0.75 * PACE, ROW = 0.9 * PACE;
const BOAT_FLOOR_Y = 0.24; // her feet when sitting in the boat on the water

/** Path from a to b that detours around the campfire instead of walking through it. */
function avoidFire(a: Pt, b: Pt): Pt[] {
  const ab = { x: b.x - a.x, z: b.z - a.z }, L2 = ab.x * ab.x + ab.z * ab.z;
  if (L2 < 1e-4) return [b];
  const t = clamp(-(a.x * ab.x + a.z * ab.z) / L2, 0, 1), cp = V(a.x + ab.x * t, a.z + ab.z * t);
  const cpLen = Math.hypot(cp.x, cp.z);
  if (cpLen < 1.3 && Math.hypot(a.x, a.z) > 1.3 && Math.hypot(b.x, b.z) > 1.3) {
    const n = cpLen < 0.01 ? V(-ab.z, ab.x) : cp, l = Math.hypot(n.x, n.z);
    return [ground(V(n.x / l * 1.9, n.z / l * 1.9)), b];
  }
  return [b];
}

/** Walking path: around the fire, and on/off the dock only via its landward end (never through the sea). */
function walkPath(a: Pt, b: Pt): Pt[] {
  const fromDock = onDock(a), toDock = onDock(b);
  if (fromDock && !toDock) return [DOCK_START, ...avoidFire(DOCK_START, b)];
  if (!fromDock && toDock) return [...avoidFire(a, DOCK_START), b];
  return avoidFire(a, b);
}

function enterStep(st: Step) {
  if (st.type === 'go') {
    if (st.ride) {
      st.path = [st.to];
      S.sailing = true; // stays seated; the boat carries her
    } else {
      st.path = walkPath(S.pos, st.to);
      hooks.play(st.run ? 'run' : st.carry ? 'walkCarry' : 'walk');
      S.lift = 0;
    }
  } else if (st.type === 'do') {
    S.faceTarget = st.face || null;
    S.lift = st.lift || 0;
    st.begin?.();
    if (st.pose === 'sit') { hooks.play('sitDown'); S.sitting = true; }
    else if (st.pose === 'lie') { hooks.play('lieDown'); S.sitting = true; } // (stands up the same way)
    else if (st.pose === 'gather') hooks.play('gather', false);
    else if (st.pose === 'chop') hooks.play('chop');
    else if (st.pose === 'hammer') hooks.play('hammer');
    else hooks.play('idle');
  } else {
    hooks.play(st.anim, true);
    if (st.anim === 'standUp') S.sitting = false; // (lift resets when the task ends, so she stands up *on* the lookout or hammock)
  }
}

function next() {
  const task = S.task;
  if (!task) return;
  task.i++;
  task.started = false;
  task.el = 0;
  if (task.i >= task.steps.length) endTask();
}

/**
 * Advance the current task.
 * @param dtAnim real seconds scaled like the animations (for 'wait' steps)
 * @param dm game minutes elapsed
 */
export function runTask(dtAnim: number, dm: number) {
  if (!S.task) { decide(); if (!S.task) return; }
  const task = S.task;
  const st = task.steps[task.i];
  if (!st) { endTask(); return; }
  if (!task.started) { task.started = true; task.el = 0; enterStep(st); }
  if (st.type === 'go') {
    const path = st.path!, tgt = path[0], pos = S.pos;
    const dx = tgt.x - pos.x, dz = tgt.z - pos.z, d = Math.hypot(dx, dz);
    const step = (st.ride ? ROW : st.run && !injured() ? RUN : WALK) * dm * (injured() && !st.ride ? 0.5 : 1); // tied to game time so fast-forward doesn't starve her (a sprained ankle halves it)
    S.faceTarget = tgt;
    if (d <= step) {
      pos.x = tgt.x; pos.z = tgt.z;
      path.shift();
      if (!path.length) next();
    } else {
      pos.x += dx / d * step; pos.z += dz / d * step;
    }
  } else if (st.type === 'do') {
    task.el += dm;
    if (st.tick) st.tick(dm);
    if (task.el >= st.min) { if (st.done) st.done(); next(); }
  } else {
    task.el += dtAnim;
    if (task.el >= st.sec) next();
  }
}

/** Keep her on whatever she's standing on: terrain, the dock, or the boat. */
export function settleHeight() {
  S.pos.y = S.sailing ? BOAT_FLOOR_Y : surfaceY(S.pos.x, S.pos.z) + S.lift;
}
