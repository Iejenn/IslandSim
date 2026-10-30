// Island sounds, all made on the fly with the Web Audio API (no sound files):
// waves and wind, rain, the crackling fire, birds by day and crickets by
// night, her footsteps, chopping and hammering, and her drum. Sounds near her
// get quieter as the camera zooms out. Off until the player turns it on
// (browsers only allow audio after a click anyway).
import type { Object3D, PerspectiveCamera, Vector3 } from 'three';
import { FIRE, WATERFALL } from '../sim/island';
import { season } from '../sim/seasons';
import { hour, type SimState } from '../sim/state';

const PREF = 'islandsim.sound';

export function createSound() {
  let ctx: AudioContext | null = null, master: GainNode, noise: AudioBuffer;
  let waves: GainNode, wind: GainNode, rain: GainNode, fireBed: GainNode, fall: GainNode, windFilter: BiquadFilterNode;
  let on = false, nextStep = 0, nextCrackle = 0, nextBird = 0, nextHit = 0, nextCricket = 0;

  /** A looping noise source through a filter into its own (initially silent) gain. */
  function bed(type: BiquadFilterType, freq: number, q = 0.7) {
    const src = ctx!.createBufferSource();
    src.buffer = noise; src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx!.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx!.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return { g, f };
  }

  function start() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    waves = bed('lowpass', 420).g;
    const w = bed('bandpass', 500, 0.6); wind = w.g; windFilter = w.f;
    rain = bed('highpass', 1800).g;
    fireBed = bed('lowpass', 180).g;
    fall = bed('bandpass', 1100, 0.5).g; // the waterfall's rush
  }

  /** A short burst of filtered noise (footstep, crackle, thunk). */
  function burst(vol: number, freq: number, dur: number, type: BiquadFilterType = 'bandpass') {
    const t = ctx!.currentTime, src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    src.buffer = noise;
    f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  /** A pitched blip that slides from f0 to f1 (bird chirp, drum, cricket). */
  function tone(vol: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine', delay = 0) {
    const t = ctx!.currentTime + delay, o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const ease = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, ctx!.currentTime, 0.6);

  /* ---------- her music: a little phrase per call; returns how long until the next one ---------- */
  // a pentatonic scale, so whatever she plays sounds pleasant
  const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
  const CHORDS = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]]; // C, Am, F, G
  let note = 4, chord = 0;
  /** A held flute note: soft attack, a little vibrato. */
  function fluteNote(f: number, dur: number, vol: number, delay = 0) {
    const t = ctx!.currentTime + delay, o = ctx!.createOscillator(), lfo = ctx!.createOscillator(), depth = ctx!.createGain(), g = ctx!.createGain();
    o.type = 'sine'; o.frequency.value = f * 2;
    lfo.frequency.value = 5.5; depth.gain.value = f * 0.012;
    lfo.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  /** One phrase on an instrument; skill makes it steadier and quicker (and fewer wrong notes). */
  function music(k: 'drum' | 'flute' | 'ukulele' | 'marimba', lvl: number, near: number) {
    const beat = 0.62 - 0.025 * Math.min(10, lvl), sloppy = Math.max(0, 0.12 - lvl * 0.015);
    const jitter = () => (Math.random() - 0.5) * sloppy;
    const off = () => Math.random() < sloppy * 2 ? 1.06 : 1; // a slightly wrong note now and then
    const step = () => { note = Math.max(0, Math.min(SCALE.length - 1, note + Math.floor(Math.random() * 5) - 2)); return SCALE[note] * off(); };
    if (k === 'drum') {
      // boom … ta-ta, with more fills as she gets better
      tone(0.18 * near, 110, 55, 0.35);
      tone(0.08 * near, 220, 160, 0.12, 'sine', beat * 0.5 + jitter());
      tone(0.08 * near, 220, 160, 0.12, 'sine', beat * 0.75 + jitter());
      if (lvl >= 3 && Math.random() < 0.4) tone(0.06 * near, 260, 190, 0.08, 'sine', beat * 0.875);
      return beat;
    }
    if (k === 'flute') {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) fluteNote(step(), beat * (n === 1 ? 1.6 : 0.8), 0.05 * near, i * beat * 0.5 + jitter());
      return beat * (n === 1 ? 1.6 : n * 0.5 + 0.4);
    }
    if (k === 'ukulele') {
      // strum the chord (down, then up), moving to the next chord every couple of bars
      if (Math.random() < 0.3) chord = (chord + 1) % CHORDS.length;
      CHORDS[chord].forEach((f, i) => tone(0.045 * near, f * off(), f * 0.995, 0.7, 'triangle', i * 0.025 + jitter()));
      CHORDS[chord].slice().reverse().forEach((f, i) => tone(0.03 * near, f, f * 0.995, 0.5, 'triangle', beat * 0.5 + i * 0.02));
      return beat;
    }
    // marimba: two mallet notes, a woody ring with an octave on top
    for (let i = 0; i < 2; i++) { const f = step(), d = i * beat * 0.5 + jitter(); tone(0.07 * near, f, f, 0.45, 'sine', d); tone(0.02 * near, f * 4, f * 4, 0.12, 'sine', d); }
    return beat;
  }

  // remember the player's choice (only in this browser)
  try { on = localStorage.getItem(PREF) === 'on'; } catch { /* storage blocked */ }

  return {
    get on() { return on; },
    /** Turn sound on or off (must be called from a click the first time). */
    toggle() {
      on = !on;
      if (on && !ctx) start();
      if (ctx) { if (on) void ctx.resume(); else void ctx.suspend(); }
      try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* fine */ }
      return on;
    },
    /** Start the audio after a page load if it was on last time (needs any click). */
    resumeOnGesture() {
      if (on && !ctx) start();
      if (on && ctx) void ctx.resume();
    },
    /**
     * @param rainLevel 0…1 how hard it's raining (from the rain visuals)
     * @param speed game speed (effects stop while paused)
     */
    update(S: SimState, camera: PerspectiveCamera, her: Object3D, rainLevel: number, speed: number) {
      if (!on || !ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime, h = hour(), night = h >= 21 || h < 5.5;
      const camDist = camera.position.distanceTo(her.position);
      const near = Math.max(0.12, Math.min(1, 1 - (camDist - 10) / 70)); // her sounds fade as you zoom out
      const fireDist = Math.hypot(camera.position.x - FIRE.x, camera.position.z - FIRE.z);

      // ambient beds
      ease(waves, 0.05 + 0.03 * Math.sin(now * 0.8) + (S.weather.storm ? 0.05 : 0));
      ease(wind, (S.weather.storm ? 0.12 : 0.015) + (season() === 'winter' ? 0.02 : 0));
      windFilter.frequency.setTargetAtTime(400 + 250 * Math.sin(now * 0.3), now, 1);
      ease(rain, 0.11 * rainLevel);
      const fire = Math.min(1, S.fire / 40) * Math.max(0.15, Math.min(1, 1 - (fireDist - 6) / 50));
      ease(fireBed, 0.05 * fire);
      const wf = WATERFALL.bottom, fallDist = camera.position.distanceTo({ x: wf.x, y: wf.y, z: wf.z } as Vector3);
      ease(fall, 0.07 * Math.max(0, Math.min(1, 1 - (fallDist - 5) / 35)));
      if (speed === 0) return;

      // fire crackles
      if (fire > 0.05 && now > nextCrackle) {
        burst(0.12 * fire, 2500 + Math.random() * 2500, 0.03 + Math.random() * 0.04, 'highpass');
        nextCrackle = now + 0.05 + Math.random() * 0.5;
      }
      // birds by day (more in spring), crickets on warm nights
      if (!night && rainLevel < 0.3 && now > nextBird) {
        const f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) tone(0.025, f, f * (1.2 + Math.random() * 0.3), 0.08 + Math.random() * 0.05, 'sine', i * 0.12);
        nextBird = now + (season() === 'spring' ? 1.5 : 3.5) + Math.random() * 5;
      }
      if (night && season() !== 'winter' && rainLevel < 0.3 && now > nextCricket) {
        for (let i = 0; i < 3; i++) tone(0.008, 4300, 4250, 0.04, 'triangle', i * 0.07);
        nextCricket = now + 0.6 + Math.random() * 1.2;
      }

      // her: footsteps, work, the drum
      const st = S.task?.steps[S.task.i];
      if (st?.type === 'go' && !st.ride && now > nextStep) {
        burst(0.05 * near, 350 + Math.random() * 150, 0.06);
        nextStep = now + (st.run ? 0.28 : 0.42) / Math.min(2, Math.max(1, speed / 2));
      }
      if (st?.type === 'do' && now > nextHit) {
        if (st.pose === 'chop') { tone(0.12 * near, 140, 70, 0.12); burst(0.08 * near, 900, 0.08); nextHit = now + 0.9; }
        else if (st.pose === 'hammer') { tone(0.08 * near, 320, 200, 0.06, 'triangle'); nextHit = now + 0.55; }
        else if (S.task?.id === 'drum' && S.task.instrument) nextHit = now + music(S.task.instrument, S.skills.music.lvl, near);
        else nextHit = now + 0.3;
      }
    },
  };
}
