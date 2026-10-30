// Her 3D body. The sim owns where she is (S.pos) and what she looks at
// (S.faceTarget); this just mirrors that onto the model each frame and
// smooths her turning so it isn't instant.
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, type Scene } from 'three';
import { S } from '../sim/state';
import { smooth } from '../sim/util';

// The lie-down pose (end of the Death clip) is face down. Once she's down we
// roll her model half a turn around her own length, so she sleeps on her back.
const BODY_H = 0.16; // height of her body's centre line when lying
const SETTLE = 0.6, ROLL = 0.5; // seconds: wait for the pose to settle, then roll over

export function createBody(scene: Scene) {
  const her = new Group();
  her.position.set(S.pos.x, S.pos.y, S.pos.z);
  scene.add(her);
  // invisible, generous click target for "tap her to follow"
  const hit = new Mesh(new CylinderGeometry(0.5, 0.5, 1.9, 8), new MeshBasicMaterial());
  hit.material.visible = false;
  hit.position.y = 0.95;
  her.add(hit);

  let model: Object3D | null = null, baseY = 0, lyingFor = 0, roll = 0;
  return {
    her,
    hit,
    attach(m: Object3D) { model = m; baseY = m.position.y; her.add(m); },
    /** @param dt real seconds */
    update(dt: number) {
      her.position.set(S.pos.x, S.pos.y, S.pos.z);
      const st = S.task?.steps[S.task.i];
      const lying = S.sitting && st?.type === 'do' && st.pose === 'lie';
      lyingFor = lying ? lyingFor + dt : 0;
      // roll onto her back once settled; roll back quickly when she gets up
      const target = lying ? smooth((lyingFor - SETTLE) / ROLL) * Math.PI : 0;
      roll = lying ? target : Math.max(0, roll - dt * Math.PI / 0.3);
      if (model) {
        model.rotation.z = roll; // around her length (the pose lies along her facing direction)
        model.position.set(BODY_H * Math.sin(roll), baseY + BODY_H * (1 - Math.cos(roll)), 0);
      }
      const t = S.faceTarget;
      if (t) {
        const want = Math.atan2(t.x - her.position.x, t.z - her.position.z);
        let diff = want - her.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        her.rotation.y += diff * Math.min(1, dt * 8);
      }
    },
  };
}
