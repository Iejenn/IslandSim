// Loads her glTF from public/models and scales it to 1.75 units tall.
import { Box3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
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

// v2.2: every castaway has her own looks. (The model's own skin is almost black, which made her a
// featureless silhouette; these are natural skin tones, hair colours and clothes.)
const LOOKS = {
  Skin: ['#F1C9A5', '#E0AC86', '#C68E64', '#A8703F', '#8A5A3A', '#6B4226'],
  Hair: ['#3A2416', '#1E1A18', '#6B4423', '#A0652E', '#C99A4A', '#7A2E1E'],
  Shirt: ['#3F6FA8', '#C9553F', '#4E8F5A', '#E0B23C', '#8A5BA8', '#2F8C8A', '#E8E2D0', '#D97B8F'],
  Pants: ['#5A4632', '#3F4A5A', '#6B6048', '#8A6A48', '#2F3A2E'],
};
/** Recolour her skin, hair and clothes from this island's look (0…1 per key). */
export function applyCastawayLook(model: Object3D, look: Record<string, number>) {
  const pickOf = (list: string[], v: number) => list[Math.min(list.length - 1, Math.floor((v || 0) * list.length))];
  model.traverse(o => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (!m || Array.isArray(m)) return;
    const list = LOOKS[m.name as keyof typeof LOOKS];
    if (list) m.color.set(pickOf(list, look[m.name.toLowerCase()]));
    if (m.name === 'Belt') m.color.set('#4A3020');
  });
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
