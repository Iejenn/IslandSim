// Her 3D body. The sim owns where she is (S.pos) and what she looks at
// (S.faceTarget); this just mirrors that onto the model each frame and
// smooths her turning so it isn't instant.
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, type Scene } from 'three';
import { S } from '../sim/state';

export function createBody(scene: Scene) {
  const her = new Group();
  her.position.set(S.pos.x, S.pos.y, S.pos.z);
  scene.add(her);
  // invisible, generous click target for "tap her to follow"
  const hit = new Mesh(new CylinderGeometry(0.5, 0.5, 1.9, 8), new MeshBasicMaterial());
  hit.material.visible = false;
  hit.position.y = 0.95;
  her.add(hit);

  return {
    her,
    hit,
    attach(model: Object3D) { her.add(model); },
    /** @param dt real seconds */
    update(dt: number) {
      her.position.set(S.pos.x, S.pos.y, S.pos.z);
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
