// Renderer, scene, camera and orbit controls.
import { ACESFilmicToneMapping, Color, Fog, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Pt } from '../sim/island';

export const v3 = (p: Pt) => new Vector3(p.x, p.y, p.z);

export function createStage(host: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  // Modern equivalent of r147's `ColorManagement.legacyMode = false` +
  // `outputEncoding = sRGBEncoding`: hex colours are treated as sRGB, lighting
  // happens in linear space, output is sRGB. (Both are three's defaults now;
  // set explicitly so the intent is visible.)
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was removed in r180+ (three falls back to PCF anyway).
  renderer.shadowMap.type = PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#8FD3E6');
  scene.fog = new Fog('#8FD3E6', 120, 260);

  const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(30, 25, 38);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.38;
  controls.minDistance = 4;
  controls.maxDistance = 120; // room to see the whole (bigger) island

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, controls };
}
