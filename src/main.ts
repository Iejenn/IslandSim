// Entry point: builds the world, wires the sim's hooks to the 3D character
// and UI, and runs the game loop. The sim (src/sim) knows nothing about
// Three.js or the DOM; everything that connects them lives here.
import './style.css';
import { Raycaster, Vector2, Vector3 } from 'three';
import { createAnimator } from './character/animation';
import { loadCharacter } from './character/model';
import { createHeldTools, type HeldTool } from './character/heldTools';
import { createBody } from './character/movement';
import { updateNeeds } from './sim/needs';
import { runTask, settleHeight } from './sim/runner';
import { hooks, hour, initState, log, say } from './sim/state';
import { startTask, T } from './sim/tasks';
import { createBubble } from './ui/bubble';
import { createHud } from './ui/hud';
import { createPanel } from './ui/panel';
import { createBuildings } from './world/buildings';
import { createCrafted } from './world/crafted';
import { createForest } from './world/forest';
import { createProps } from './world/props';
import { createRain } from './world/rain';
import { createSky } from './world/sky';
import { createStage } from './world/stage';
import { createTerrain } from './world/terrain';
import { createWater } from './world/water';
import { clearSave, newSeed, readSave, withSeed, writeSave } from './save';
import { snapshot } from './sim/persist';
import type { CraftKey } from './sim/state';

/* ---------- saved game? ---------- */
const save = readSave();
const seed = save?.seed ?? newSeed();

/* ---------- world: scattered from the saved seed, so a reload shows the same island ---------- */
const { renderer, scene, camera, controls } = createStage(document.getElementById('scene')!);
const { animateWater, updateSky, props } = withSeed(seed, () => {
  createTerrain(scene);
  return { animateWater: createWater(scene), updateSky: createSky(scene), props: createProps(scene) };
});
const updateForest = createForest(scene);
const updateCrafted = createCrafted(scene);
const updateBuildings = createBuildings(scene);
const updateRain = createRain(scene);

/* ---------- sim + her ---------- */
const S = initState(save?.state);
// Dev only (stripped from the production build): poke at the state from the
// browser console, e.g. __S.needs.food = 5, __S.projects.dock.done = true, __give('axe').
if (import.meta.env.DEV) {
  Object.assign(window, {
    __S: S, __camera: camera, __controls: controls,
    __give: (k: CraftKey) => { S.items[k] = true; },
    __startTask: (id: string) => { const t = T[id](); if (t) startTask(t); },
  });
}
const body = createBody(scene);
const heldTools = createHeldTools(scene);
let ready = false;
let animator: ReturnType<typeof createAnimator> | null = null;

/* ---------- UI ---------- */
const hud = createHud();
const bubble = createBubble(body.her, camera);
const panel = createPanel(newIsland);
function renderUI() {
  hud.render();
  panel.render();
}

/* ---------- saving ---------- */
let leaving = false; // set when starting over, so the unload handlers don't save the old island again
function saveNow() {
  if (!ready || S.dead || leaving) return;
  writeSave(seed, snapshot(S));
}
function newIsland() {
  leaving = true;
  clearSave();
  location.reload();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
addEventListener('pagehide', saveNow);

/* ---------- sim → presentation ---------- */
hooks.play = (anim, forceOnce) => animator?.play(anim, forceOnce);
hooks.onSay = () => bubble.show();
hooks.onDeath = () => {
  clearSave(); // her story is over; a refresh starts a new island
  setTimeout(() => panel.showDeath(), 2600);
};

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
    heldTools.attach(gltf.scene);
    animator = createAnimator(gltf.scene, gltf.animations);
    animator.play('idle');
    ready = true;
    loading.style.opacity = '0';
    if (save) say('Oh, you’re back.');
    else {
      say('Where… am I?');
      log('She woke up on a beach. No boat, no people. Just her and this island.');
    }
  }, err => {
    loading.textContent = 'Couldn’t load her model. Try reloading the page.';
    console.error(err);
  });
}

/* ---------- main loop ---------- */
let last = performance.now(), lastUI = 0, lastSave = 0, clockT = 0;
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
  // she carries the right tool for the whole task (rod for fishing, axe for chopping, pick for mining)
  const id = S.task?.id;
  const held: HeldTool | null = !ready ? null : id === 'fish' && S.items.rod ? 'rod' : id === 'chop' && S.items.axe ? 'axe' : id === 'mine' && S.items.pick ? 'pick' : null;
  heldTools.update(held, body.her, clockT);
  updateCrafted(S, held);
  updateForest(S);
  props.syncBerries(S.berries);
  updateBuildings(S, body.her, clockT);
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
  if (now - lastSave > 5000) { lastSave = now; saveNow(); } // autosave every 5 real seconds
  requestAnimationFrame(frame);
}
renderUI();
loadModel();
requestAnimationFrame(frame);
