// Loads her glTF from public/models and scales it to 1.75 units tall.
import { Box3, type Mesh, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/Casual_Female.gltf`;

/**
 * Bounding box of the model's meshes in their bind (rest) pose.
 * Box3.setFromObject() measured it this way in r147; newer three measures
 * skinned meshes in their current pose, which made her ~5% the wrong size.
 */
function bindPoseBox(root: Object3D) {
  root.updateMatrixWorld(true);
  const box = new Box3(), part = new Box3();
  root.traverse(o => {
    const g = (o as Mesh).geometry;
    if (!g) return;
    if (!g.boundingBox) g.computeBoundingBox();
    box.union(part.copy(g.boundingBox!).applyMatrix4(o.matrixWorld));
  });
  return box;
}

export function loadCharacter(): Promise<GLTF> {
  return new GLTFLoader().loadAsync(MODEL_URL).then(gltf => {
    const model = gltf.scene;
    model.traverse(o => {
      if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    const box = bindPoseBox(model), h = box.max.y - box.min.y, s = 1.75 / (h || 1);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s; // feet on the ground
    return gltf;
  });
}
