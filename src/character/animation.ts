// Crossfades between her animation clips. The sim asks for semantic keys
// ("walk"); config/animations.ts maps them to the model's clip names.
import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import { ANIM, ONE_SHOT_CLIPS, type AnimKey } from '../config/animations';

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
    a.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.setEffectiveWeight(1);
    a.setEffectiveTimeScale(1);
    a.fadeIn(0.3).play();
    if (current && current !== a) current.fadeOut(0.3);
    current = a;
  }

  return { mixer, play };
}
