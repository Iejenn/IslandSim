// Playing music: the model has no instrument clips, so while she plays we
// move her arm bones on top of whatever pose the animation holds (sitting or
// standing): drumming hands, strumming, a flute held to her lips, mallets on a
// marimba. Each frame, after the mixer has set the pose, small rotations are
// added to a few bones, faded in and out so it blends with the clip.
import { BoxGeometry, CylinderGeometry, Group, Quaternion, SphereGeometry, Vector3, type Object3D, type Scene } from 'three';
import { fluteModel, ukuleleModel } from '../world/crafted';
import { M, mat, mesh } from '../world/materials';

// What her hands are doing: an instrument, or one of her everyday gestures
// (stirring the pot, carving, petting the dog, waving, dancing, casting the rod).
export type Playing = 'drum' | 'flute' | 'ukulele' | 'marimba'
  | 'stir' | 'carve' | 'pet' | 'wave' | 'sitWave' | 'dance' | 'cast' | null;
type Rot = [number, number, number];
type Pose = Partial<Record<'UpperArmL' | 'UpperArmR' | 'LowerArmL' | 'LowerArmR' | 'FistL' | 'FistR' | 'Head' | 'Torso' | 'Hips', Rot>>;

/**
 * @param model her loaded model  @param her her body group (held instruments ride along in its frame)
 */
export function createPerformer(model: Object3D, her: Object3D, scene: Scene) {
  const bones: Record<string, Object3D> = {};
  model.traverse(o => { bones[o.name.replace('.', '')] = o; });
  // what's in her hands while playing: the flute at her lips, the ukulele across her lap
  // (positions in her own frame, matching the key poses below), and two marimba mallets
  const flute = fluteModel(); flute.position.set(-0.06, 1.2, 0.32);
  const uke = ukuleleModel(); uke.position.set(0.04, 0.63, 0.16); uke.rotation.set(-0.2, 0, 0.35);
  for (const o of [flute, uke]) { o.visible = false; her.add(o); }
  const head = mat('#E9DFC8');
  const mallets = [0, 1].map(() => {
    const g = new Group();
    const stick = mesh(new CylinderGeometry(0.008, 0.008, 0.28, 4), M.log, 0, 0, 0.14); stick.rotation.x = Math.PI / 2;
    g.add(stick, mesh(new SphereGeometry(0.025, 6, 4), head, 0, 0, 0.29));
    g.visible = false;
    scene.add(g);
    return g;
  });
  // little things in her hands: a stirring stick, and a knife and a piece of wood for carving
  const stick = (len: number, r: number, m = M.log) => { const g = new Group(), s2 = mesh(new CylinderGeometry(r, r, len, 4), m, 0, 0, len / 2); s2.rotation.x = Math.PI / 2; g.add(s2); g.visible = false; scene.add(g); return g; };
  const spoon = stick(0.42, 0.012), knife = stick(0.09, 0.006, mat('#B8BEC2'));
  const block = new Group(); block.add(mesh(new BoxGeometry(0.07, 0.05, 0.05), M.wood)); block.visible = false; scene.add(block);
  const fp = new Vector3(), aim = new Vector3();
  let started = 0, last: Playing = null; // when the current gesture began (for one-off moves like casting)
  let weight = 0, current: Playing = null;
  // (dev) a fixed pose to try out bone axes from the console: __pose({ UpperArmR: [-1, 0, 0] })
  let test: Pose | null = null;

  // A held clip (sitting) doesn't rewrite the bones every frame, so our additions
  // would pile up. Remember each bone's pose before and after we touch it: if it's
  // still exactly what we left, the clip didn't reset it, so start from the saved one.
  const before = new Map<Object3D, Quaternion>(), after = new Map<Object3D, Quaternion>();
  function add(pose: Pose, w: number) {
    for (const [name, [x, y, z]] of Object.entries(pose)) {
      const b = bones[name];
      if (!b) continue;
      const pre = before.get(b), post = after.get(b);
      if (pre && post && b.quaternion.equals(post)) b.quaternion.copy(pre);
      before.set(b, b.quaternion.clone());
      b.rotateX(x * w); b.rotateY(y * w); b.rotateZ(z * w);
      after.set(b, b.quaternion.clone());
    }
  }
  /** Put bones we touched back as the clip left them (when we stop playing). */
  function release() {
    for (const [b, post] of after) { const pre = before.get(b); if (pre && b.quaternion.equals(post)) b.quaternion.copy(pre); }
    before.clear(); after.clear();
  }

  return {
    setTest(p: Pose | null) { test = p; },
    /** Call every frame after the animation mixer. @param t real seconds @param tempo beats per second */
    update(playing: Playing, dt: number, t: number, tempo = 2) {
      if (test) { add(test, 1); return; }
      if (playing !== last) { started = t; last = playing; }
      if (playing) current = playing;
      weight += ((playing ? 1 : 0) - weight) * Math.min(1, dt * 5);
      const held = weight > 0.5 ? current : null;
      flute.visible = held === 'flute';
      if (!held) { spoon.visible = knife.visible = block.visible = false; }
      uke.visible = held === 'ukulele';
      if (weight < 0.01 || !current) { mallets.forEach(m => { m.visible = false; }); if (after.size) release(); return; }
      add(current === 'cast' ? castPose(t - started) : POSES[current](t * tempo), weight);
      // props: from her fists, pointing the way each job needs
      const fist = (s: 'L' | 'R') => { const f = bones['Fist' + s]; f.updateWorldMatrix(true, false); return f.getWorldPosition(new Vector3()); };
      const fwd = (dx: number, dy: number, dz: number) => {
        const r = her.rotation.y, c = Math.cos(r), s2 = Math.sin(r);
        return new Vector3(dx * c + dz * s2, dy, -dx * s2 + dz * c);
      };
      spoon.visible = held === 'stir';
      if (spoon.visible) { const f = fist('R'); spoon.position.copy(f); spoon.lookAt(f.clone().add(fwd(0.05, -1, 0.35))); }
      knife.visible = block.visible = held === 'carve';
      if (knife.visible) {
        const fr = fist('R'), fl = fist('L');
        knife.position.copy(fr); knife.lookAt(fl);
        block.position.copy(fl); block.rotation.y = her.rotation.y;
      }
      // mallets: from each fist, pointing ahead and a little down onto the bars
      mallets.forEach((m, i) => {
        m.visible = held === 'marimba';
        if (!m.visible) return;
        const fist = bones[i ? 'FistR' : 'FistL'];
        fist.updateWorldMatrix(true, false);
        fist.getWorldPosition(fp);
        m.position.copy(fp);
        aim.set(Math.sin(her.rotation.y), -0.45, Math.cos(her.rotation.y)).add(fp);
        m.lookAt(aim);
      });
    },
  };
}

// Key poses: rotations (x, y, z for the upper arm, then the lower arm) on top of the
// held sitting / standing pose, found by a small search that puts her fists where
// the instrument is (drum skin, ukulele neck and strings, flute at her lips,
// marimba bars). Each instrument moves between its key poses in time with the music.
const KEY: Record<string, Pose> = {
  stir0: {UpperArmL: [0.17, -0.14, -0.39], LowerArmL: [-0.17, -0.07, 0.5], UpperArmR: [0.12, 0.05, 0.6], LowerArmR: [0, 0, -0.3]},
  stir1: {UpperArmL: [0.16, -0.14, -0.38], LowerArmL: [-0.15, -0.07, 0.5], UpperArmR: [0.13, 0.07, 0.43], LowerArmR: [0.05, -0.01, -0.21]},
  stir2: {UpperArmL: [0.2, -0.13, -0.39], LowerArmL: [-0.2, -0.07, 0.48], UpperArmR: [0.01, 0.01, 0.43], LowerArmR: [0.11, 0.01, 0.09]},
  stir3: {UpperArmL: [0.16, -0.15, -0.39], LowerArmL: [-0.17, -0.07, 0.5], UpperArmR: [0, 0, 0.71], LowerArmR: [0.01, 0, -0.26]},
  carveA: {UpperArmL: [0.38, -0.28, -0.82], LowerArmL: [-0.41, -0.21, 0.79], UpperArmR: [0.14, 0.02, 0.49], LowerArmR: [0.01, -0.03, -0.23]},
  carveB: {UpperArmL: [0.41, -0.26, -0.82], LowerArmL: [-0.4, -0.24, 0.8], UpperArmR: [0.03, 0.01, 0.09], LowerArmR: [0.12, 0.03, 0.6]},
  petA: {UpperArmL: [0.11, -0.14, -0.24], LowerArmL: [-0.14, -0.05, 0.35], UpperArmR: [0.07, -0.08, -0.2], LowerArmR: [-0.01, -0.02, -0.35]},
  petB: {UpperArmL: [0.15, -0.07, -0.24], LowerArmL: [-0.13, -0.03, 0.37], UpperArmR: [-0.07, 0.05, -0.47], LowerArmR: [-0.05, 0.02, -0.33]},
  sitWaveA: {UpperArmL: [0, 0, 0], LowerArmL: [0, 0, 0.03], UpperArmR: [1.17, 0.39, -0.18], LowerArmR: [1.31, 0.31, 0.24]},
  sitWaveB: {UpperArmL: [0, 0, 0], LowerArmL: [0, 0, 0.03], UpperArmR: [0.87, -0.16, -0.48], LowerArmR: [1.04, -0.53, -0.57]},
  castBack: {UpperArmL: [0.25, -0.19, -0.3], LowerArmL: [-0.05, 0.01, 0.35], UpperArmR: [0.84, 0.98, 0.76], LowerArmR: [0.87, 0.56, 0.88]},
  castFwd: {UpperArmL: [0.26, -0.21, -0.29], LowerArmL: [-0.06, -0.02, 0.31], UpperArmR: [0.39, 0.27, 0.42], LowerArmR: [0.13, 0.01, 0.07]},
  waveA: {UpperArmL: [0, -0.02, 0], LowerArmL: [0.01, 0, 0.01], UpperArmR: [1.23, -0.99, -1.03], LowerArmR: [0.34, -0.22, -1]},
  waveB: {UpperArmL: [0, -0.02, 0], LowerArmL: [0.01, 0, 0.01], UpperArmR: [1.37, -0.69, -0.79], LowerArmR: [0.5, -0.2, -0.52]},
  danceUp: {UpperArmL: [1.29, 0.82, 1.06], LowerArmL: [0.79, 0.46, 0.9], UpperArmR: [1.35, -0.79, -1], LowerArmR: [0.81, -0.47, -0.89]},
  danceOut: {UpperArmL: [0.58, -0.29, 0.52], LowerArmL: [1.15, -0.73, -0.71], UpperArmR: [0.57, 0.28, -0.53], LowerArmR: [1.13, 0.77, 0.72]},
  drumDown: {UpperArmL: [0.37, -0.23, -0.75], LowerArmL: [-0.45, -0.29, 0.88], UpperArmR: [0.08, 0.04, 0.37], LowerArmR: [0.03, 0, -0.25]},
  drumUp: {UpperArmL: [0.54, -0.5, -0.35], LowerArmL: [0.1, 0.01, 0.35], UpperArmR: [0.29, 0.08, 0.15], LowerArmR: [0.36, 0.14, 0.52]},
  ukuDown: {UpperArmL: [0.59, -0.27, -0.05], LowerArmL: [0.02, 0.02, 0.52], UpperArmR: [-0.03, 0.02, 0.41], LowerArmR: [-0.01, -0.01, 0.07]},
  ukuUp: {UpperArmL: [0.57, -0.33, -0.06], LowerArmL: [0.02, -0.01, 0.51], UpperArmR: [0.14, 0.07, 0.42], LowerArmR: [0.1, 0.04, 0.33]},
  flute: {UpperArmL: [0.64, -0.42, -1.3], LowerArmL: [0.72, -0.42, -0.85], UpperArmR: [0.67, 0.52, 1.01], LowerArmR: [0.78, 0.56, 0.96]},
  marimbaDown: {UpperArmL: [0.29, -0.21, -0.5], LowerArmL: [0.42, -0.23, -0.77], UpperArmR: [0.28, 0.2, 0.5], LowerArmR: [0.43, 0.24, 0.76]},
  marimbaUp: {UpperArmL: [0.29, -0.25, -0.6], LowerArmL: [0.84, -0.59, -1.11], UpperArmR: [0.28, 0.23, 0.6], LowerArmR: [0.89, 0.59, 1.07]},
};
const lerp = (a: Pose, b: Pose, k: number): Pose => {
  const out: Pose = {};
  for (const n of Object.keys(a) as (keyof Pose)[]) out[n] = a[n]!.map((v, i) => v + (b[n]![i] - v) * k) as Rot;
  return out;
};
const side = (p: Pose, s: 'L' | 'R'): Pose => Object.fromEntries(Object.entries(p).filter(([n]) => n.endsWith(s)));
/** How far the hand is lifted through a beat: 0 on the hit, slowly up, then a quick drop onto the next hit. */
function lift(phase: number) {
  const f = ((phase % 1) + 1) % 1;
  return f < 0.7 ? (1 - Math.cos(f / 0.7 * Math.PI)) / 2 : 1 - (f - 0.7) / 0.3;
}

/** Casting: the hand goes up and back, whips forward, and then holds the rod out. @param s seconds since she started */
function castPose(s: number): Pose {
  if (s < 0.5) return KEY.castBack; // (the fade-in carries her hand up there)
  if (s < 0.8) return lerp(KEY.castBack, KEY.castFwd, (s - 0.5) / 0.3);
  return KEY.castFwd;
}

const POSES: Record<Exclude<Playing, null>, (b: number) => Pose> = {
  // hands take turns on the skin
  drum: b => ({ ...side(lerp(KEY.drumDown, KEY.drumUp, lift(b)), 'L'), ...side(lerp(KEY.drumDown, KEY.drumUp, lift(b + 0.5)), 'R') }),
  // left hand on the neck, right hand strumming twice a beat
  ukulele: b => ({ ...side(KEY.ukuDown, 'L'), ...side(lerp(KEY.ukuDown, KEY.ukuUp, 0.5 - 0.5 * Math.cos(b * Math.PI * 4)), 'R') }),
  // held to her lips, fingers (well, hands) moving a little
  flute: b => Object.fromEntries(Object.entries(KEY.flute).map(([n, r]) => [n, n.startsWith('Lower') ? [r[0] + 0.05 * Math.sin(b * 6.3 + (n.endsWith('L') ? 0 : 1.7)), r[1], r[2]] : r])) as Pose,
  // the everyday ones
  stir: b => { const k = ((b * 0.5) % 1 + 1) % 1 * 4, i = Math.floor(k); return lerp(KEY[`stir${i}`], KEY[`stir${(i + 1) % 4}`], k - i); },
  carve: b => lerp(KEY.carveA, KEY.carveB, lift(b * 0.6)),
  pet: b => lerp(KEY.petA, KEY.petB, 0.5 - 0.5 * Math.cos(b * 2)),
  wave: b => lerp(KEY.waveA, KEY.waveB, 0.5 - 0.5 * Math.cos(b * 7)),
  sitWave: b => lerp(KEY.sitWaveA, KEY.sitWaveB, 0.5 - 0.5 * Math.cos(b * 7)),
  dance: b => ({
    ...side(lerp(KEY.danceOut, KEY.danceUp, 0.5 - 0.5 * Math.cos(b * Math.PI)), 'L'),
    ...side(lerp(KEY.danceOut, KEY.danceUp, 0.5 + 0.5 * Math.cos(b * Math.PI)), 'R'),
    Torso: [0, 0.3 * Math.sin(b * Math.PI), 0.08 * Math.sin(b * Math.PI * 2)],
  }),
  cast: () => KEY.castFwd,
  // mallets taking turns on the bars
  marimba: b => ({ ...side(lerp(KEY.marimbaDown, KEY.marimbaUp, lift(b)), 'L'), ...side(lerp(KEY.marimbaDown, KEY.marimbaUp, lift(b + 0.5)), 'R') }),
};
