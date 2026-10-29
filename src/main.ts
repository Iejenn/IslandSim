// Entry point: builds the world, wires the sim's hooks to the 3D character
// and UI, and runs the game loop. The sim (src/sim) knows nothing about
// Three.js or the DOM; everything that connects them lives here.
import './style.css';
import { Raycaster, Vector2, Vector3 } from 'three';
import { createAnimator } from './character/animation';
import { loadCharacter } from './character/model';
import { createBody } from './character/movement';
import { updateNeeds } from './sim/needs';
import { runTask, settleHeight } from './sim/runner';
import { hooks, hour, initState, log, say } from './sim/state';
import { createBubble } from './ui/bubble';
import { createHud } from './ui/hud';
import { createPanel } from './ui/panel';
import { createBuildings } from './world/buildings';
import { createGiftModels } from './world/giftModels';
import { createProps } from './world/props';
import { createRain } from './world/rain';
import { createSky } from './world/sky';
import { createStage } from './world/stage';
import { createTerrain } from './world/terrain';
import { createWater } from './world/water';

/* ---------- world (built before the sim state so random rolls happen in the original order) ---------- */
const { renderer, scene, camera, controls } = createStage(document.getElementById('scene')!);
createTerrain(scene);
const animateWater = createWater(scene);
const updateSky = createSky(scene);
const props = createProps(scene);
const giftModels = createGiftModels(scene);
const updateBuildings = createBuildings(scene);
const updateRain = createRain(scene);

/* ---------- sim + her ---------- */
const S = initState();
const body = createBody(scene);
let ready = false;
let animator: ReturnType<typeof createAnimator> | null = null;

/* ---------- UI ---------- */
const hud = createHud();
const bubble = createBubble(body.her, camera);
const panel = createPanel(renderUI);
function renderUI() {
  hud.render();
  panel.render();
}

/* ---------- sim → presentation ---------- */
hooks.play = (anim, forceOnce) => animator?.play(anim, forceOnce);
hooks.onSay = () => bubble.show();
hooks.onGift = k => giftModels.build(k);
hooks.onDeath = () => setTimeout(() => panel.showDeath(), 2600);

/* tap her to follow */
const ray = new Raycaster(), ptr = new Vector2();
let downAt: [number, number] | null = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; // was a drag, not a tap
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  if (ray.intersectObject(body.hit, false).length) {
    hud.setFollow(true);
    panel.expand();
    say(S.thought || 'Hm?');
  }
});

function loadModel() {
  const loading = document.getElementById('loading')!;
  loadCharacter().then(gltf => {
    body.attach(gltf.scene);
    animator = createAnimator(gltf.scene, gltf.animations);
    animator.play('idle');
    ready = true;
    loading.style.opacity = '0';
    say('Where… am I?');
    log('She woke up on a beach. No boat, no people. Just her and this island.');
  }, err => {
    loading.textContent = 'Couldn’t load her model. Try reloading the page.';
    console.error(err);
  });
}

/* ---------- main loop ---------- */
let last = performance.now(), lastUI = 0, clockT = 0;
const tmpV = new Vector3();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // real seconds, capped so a background tab doesn't jump
  last = now;
  clockT += dt;
  const sp = S.speed, animScale = sp > 0 ? Math.min(sp, 6) : 0; // animations stop speeding up past 6×
  if (ready && !S.dead && sp > 0) {
    const dm = dt * 4 * sp; // 1 real second = 4 game minutes at 1×
    S.min += dm;
    updateNeeds(dm);
    if (!S.dead) runTask(dt * animScale, dm);
  }
  animator?.mixer.update(S.dead ? dt : dt * animScale);
  if (ready) { settleHeight(); body.update(dt); }
  giftModels.update(dt, clockT, S, body.her);
  props.syncBerries(S.berries);
  updateBuildings(S);
  const rain = updateRain(dt, S.weather.raining, controls.target);
  animateWater(clockT);
  updateSky(clockT, hour(), S.fire, props.campfire, rain);
  if (hud.following && ready) {
    tmpV.copy(body.her.position);
    tmpV.y += 1;
    const d = tmpV.sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
    controls.target.add(d);
    camera.position.add(d);
  }
  controls.update();
  renderer.render(scene, camera);
  bubble.update(now, ready);
  if (now - lastUI > 250) { lastUI = now; renderUI(); }
  requestAnimationFrame(frame);
}
renderUI();
loadModel();
requestAnimationFrame(frame);
