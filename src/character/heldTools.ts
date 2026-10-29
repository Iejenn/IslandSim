// Tools in her right hand: the fishing rod (with a line to the water) while
// fishing, the axe while chopping, the pick while mining.
//
// The rod is aimed in world space (forward and up from her body), so it looks
// steady whatever the hand does. The axe and pick should swing with her arm,
// so when she picks one up we work out the hand-relative rotation that makes
// it point forward right now, and keep that while the animation swings.
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type { CraftKey } from '../sim/state';
import { spearModel, toolModel } from '../world/crafted';
import { M } from '../world/materials';

const ROD_LENGTH = 1.7; // world units
const WATER_Y = 0.12;
const X = new Vector3(1, 0, 0);
const ROD_TILT = new Quaternion().setFromAxisAngle(X, 0.75); // from straight up, leaned forward
const TOOL_TILT = new Quaternion().setFromAxisAngle(X, 1.1); // tool head out in front, ready to swing
const SPEAR_TILT = new Quaternion().setFromAxisAngle(X, 2.2); // point down into the water in front of her

export type HeldTool = Extract<CraftKey, 'rod' | 'axe' | 'pick' | 'spear'>;

export function createHeldTools(scene: Scene) {
  const rodGeo = new CylinderGeometry(0.018, 0.03, ROD_LENGTH, 5);
  rodGeo.translate(0, ROD_LENGTH / 2, 0); // pivot at the handle end
  const rod = new Mesh(rodGeo, M.rod);
  rod.castShadow = true;
  // tool models are built handle-down at the origin; grip them a little up the handle
  const wrap = (g: Group) => { const w = new Group(); g.position.y = -0.15; w.add(g); return w; };
  const tools: Record<HeldTool, Object3D> = { rod, axe: wrap(toolModel('axe')), pick: wrap(toolModel('pick')), spear: wrap(spearModel()) };
  for (const t of Object.values(tools)) t.visible = false;

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
  const line = new Line(lineGeo, new LineBasicMaterial({ color: '#E8E4D8', transparent: true, opacity: 0.7 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  let hand: Object3D | null = null, current: HeldTool | null = null;
  const q = new Quaternion(), handQ = new Quaternion(), s = new Vector3(), tip = new Vector3(), fwd = new Vector3();

  /** Rotation (relative to the hand) that points the tool along `tilt` from her body right now. */
  function aim(tool: Object3D, her: Object3D, tilt: Quaternion) {
    hand!.getWorldQuaternion(handQ);
    q.copy(her.quaternion).multiply(tilt);
    tool.quaternion.copy(handQ.invert().multiply(q));
  }

  return {
    /** Call once the model is loaded. */
    attach(model: Object3D) {
      // three strips the '.' from glTF node names ("Fist.R" → "FistR")
      hand = model.getObjectByName('FistR') ?? model.getObjectByName('Fist.R') ?? null;
      if (hand) for (const t of Object.values(tools)) hand.add(t);
    },
    /** @param tool what she's holding right now, if anything */
    update(tool: HeldTool | null, her: Object3D, t: number) {
      if (!hand) tool = null;
      const picked = tool !== current;
      current = tool;
      for (const [k, obj] of Object.entries(tools)) obj.visible = k === tool;
      line.visible = tool === 'rod';
      if (!tool || !hand) return;
      const obj = tools[tool];
      // undo the bone's scale so the tool keeps its real size
      hand.getWorldScale(s);
      obj.scale.setScalar(1 / s.x);
      if (tool === 'rod') aim(obj, her, ROD_TILT); // every frame: steady rod
      else if (tool === 'spear') aim(obj, her, SPEAR_TILT); // poised over the water
      else if (picked) aim(obj, her, TOOL_TILT); // once: then it swings with the hand
      if (tool !== 'rod') return;
      // line from the rod tip to a bobber in the water in front of her
      obj.updateMatrixWorld();
      tip.set(0, ROD_LENGTH, 0).applyMatrix4(obj.matrixWorld);
      fwd.set(0, 0, 1).applyQuaternion(her.quaternion);
      const a = lineGeo.attributes.position.array as Float32Array;
      a.set([tip.x, tip.y, tip.z, tip.x + fwd.x * 0.6, WATER_Y + 0.02 * Math.sin(t * 2), tip.z + fwd.z * 0.6]);
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}
