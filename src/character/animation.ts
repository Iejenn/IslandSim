// Crossfades between her animation clips. The sim asks for semantic keys
// ("walk"); config/animations.ts maps them to the model's clip names.
import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import { ANIM, ONE_SHOT_CLIPS, type AnimKey } from '../config/animations';
import { PACE } from '../sim/island';

// She walks faster on the bigger island (see sim/runner.ts); play her steps
// faster to match, so her feet don't slide.
const STRIDE: Partial<Record<AnimKey, number>> = { walk: PACE, walkCarry: PACE, run: PACE };

export function createAnimator(model: Object3D, animations: AnimationClip[]) {
  const mixer = new AnimationMixer(model);
  const clips: Record<string, AnimationAction> = {};
  animations.forEach(c => { clips[c.name] = mixer.clipAction(c); });
  let current: AnimationAction | null = null;

  /** Fade to an animation. forceOnce plays a normally-looping clip once. */
  function play(key: AnimKey, forceOnce?: boolean) {
    const name = ANIM[key], a = clips[name];
    if (!a || (a === current && !forceOnce && !ONE_SHOT_CLIPS.has(name))) return; // already looping it
    const once = forceOnce || ONE_SHOT_CLIPS.has(name);
    a.reset();
    if (key === 'lieDown') a.time = a.getClip().duration * 0.8; // just the lying-down end of the clip
    a.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.setEffectiveWeight(1);
    a.setEffectiveTimeScale(STRIDE[key] ?? 1);
    const fade = key === 'lieDown' ? 0.7 : 0.3; // ease into bed
    a.fadeIn(fade).play();
    if (current && current !== a) current.fadeOut(fade);
    current = a;
  }

  return { mixer, play };
}
