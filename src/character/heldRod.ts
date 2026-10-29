// A fishing rod in her right hand, with a line down to the water.
// The rod follows the hand bone's position, but its direction is set in
// world space (forward and up from her body), so it looks right whatever
// rotation the hand has in the current animation.
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Mesh, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import { M } from '../world/materials';

const LENGTH = 1.7; // world units
const WATER_Y = 0.12;
const TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.75); // from straight up, leaned forward

export function createHeldRod(scene: Scene) {
  const geo = new CylinderGeometry(0.018, 0.03, LENGTH, 5);
  geo.translate(0, LENGTH / 2, 0); // pivot at the handle end
  const rod = new Mesh(geo, M.rod);
  rod.castShadow = true;
  rod.visible = false;

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
  const line = new Line(lineGeo, new LineBasicMaterial({ color: '#E8E4D8', transparent: true, opacity: 0.7 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  let hand: Object3D | null = null;
  const q = new Quaternion(), parentQ = new Quaternion(), s = new Vector3(), tip = new Vector3(), fwd = new Vector3();

  return {
    /** Call once the model is loaded. */
    attach(model: Object3D) {
      // three strips the '.' from glTF node names ("Fist.R" → "FistR")
      hand = model.getObjectByName('FistR') ?? model.getObjectByName('Fist.R') ?? null;
      hand?.add(rod);
    },
    /** @param holding whether she's holding the rod right now */
    update(holding: boolean, her: Object3D, t: number) {
      const on = holding && !!hand;
      rod.visible = line.visible = on;
      if (!on || !hand) return;
      // undo the bone's scale and rotation so the rod keeps its size and points where we want
      hand.getWorldScale(s);
      rod.scale.setScalar(1 / s.x);
      hand.getWorldQuaternion(parentQ);
      q.copy(her.quaternion).multiply(TILT);
      rod.quaternion.copy(parentQ.invert().multiply(q));
      // line from the rod tip to a bobber in the water in front of her
      rod.updateMatrixWorld();
      tip.set(0, LENGTH, 0).applyMatrix4(rod.matrixWorld);
      fwd.set(0, 0, 1).applyQuaternion(her.quaternion);
      const a = lineGeo.attributes.position.array as Float32Array;
      a.set([tip.x, tip.y, tip.z, tip.x + fwd.x * 0.6, WATER_Y + 0.02 * Math.sin(t * 2), tip.z + fwd.z * 0.6]);
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}
