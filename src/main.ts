// Entry point: builds the world, wires the sim's hooks to the 3D character
// and UI, and runs the game loop. The sim (src/sim) knows nothing about
// Three.js or the DOM; everything that connects them lives here.
import './style.css';
import { Raycaster, Vector2, Vector3, type Fog } from 'three';
import { createSound } from './audio/sound';
import { createAnimator } from './character/animation';
import { createPerformer, type Playing } from './character/perform';
import { loadCharacter } from './character/model';
import { createHeldTools, type HeldTool } from './character/heldTools';
import { createBody } from './character/movement';
import { updateNeeds } from './sim/needs';
import { runTask, settleHeight } from './sim/runner';
import { hooks, hour, initState, isNight, log, say } from './sim/state';
import { startTask, T } from './sim/tasks';
import { createBubble } from './ui/bubble';
import { createHud } from './ui/hud';
import { createInfoCard } from './ui/infoCard';
import { createPanel } from './ui/panel';
import { inspect } from './world/inspect';
import { createAnimals } from './world/animals';
import { createBuildings } from './world/buildings';
import { createCrafted } from './world/crafted';
import { createDog } from './world/dog';
import { createForest } from './world/forest';
import { createLivestock } from './world/livestock';
import { createProps } from './world/props';
import { createFlowers } from './world/flowers';
import { createJoys } from './world/joys';
import { createWaterfall } from './world/waterfall';
import { createCritters } from './world/critters';
import { createClouds } from './world/clouds';
import { createShore } from './world/shore';
import { createIslet } from './world/islet';
import { createLifeProps } from './world/life';
import { createSmoke } from './world/smoke';
import { createPaths } from './world/paths';
import { createRabbits } from './world/rabbits';
import { createRain } from './world/rain';
import { createAtmosphere } from './world/atmosphere';
import { createEvents } from './world/events';
import { createSeasons } from './world/seasons';
import { drought } from './sim/events';
import { createSky } from './world/sky';
import { createStage } from './world/stage';
import { createTerrain } from './world/terrain';
import { applyLook } from './world/materials';
import { createWater } from './world/water';
import { clearSave, newSeed, playActiveSlot, readSave, takeSkipMenu, withSeed, writeSave } from './save';
import { createMenu } from './ui/menu';
import { snapshot } from './sim/persist';
import type { CraftKey } from './sim/state';
import type { AnimKey } from './config/animations';

/* ---------- saved game? ---------- */
const save = readSave();
const seed = save?.seed ?? newSeed();

/* ---------- world: scattered from the saved seed, so a reload shows the same island ---------- */
const { renderer, scene, camera, controls } = createStage(document.getElementById('scene')!);
const { animateWater, updateSky, props, terrain } = withSeed(seed, () => {
  const terrain = createTerrain(scene);
  return { animateWater: createWater(scene), updateSky: createSky(scene, camera), props: createProps(scene), terrain };
});
const updatePaths = createPaths(terrain);
const updateFlowers = createFlowers(scene);
const updateForest = createForest(scene);
const updateCrafted = createCrafted(scene);
const updateBuildings = createBuildings(scene);
const updateRain = createRain(scene);
const updateDog = createDog(scene);
const updateAnimals = createAnimals(scene);
const updateLivestock = createLivestock(scene);
const updateRabbits = createRabbits(scene);
const updateSeasons = createSeasons(scene, terrain.material);
const updateEvents = createEvents(scene);
const updateAtmosphere = createAtmosphere(scene);
const updateJoys = createJoys(scene);
const updateWaterfall = createWaterfall(scene);
const updateCritters = createCritters(scene);
const updateClouds = createClouds(scene), updateShore = createShore(scene), updateSmoke = createSmoke(scene), updateIslet = createIslet(scene), updateLifeProps = createLifeProps(scene);

/* ---------- sim + her ---------- */
const S = initState(save?.state);
applyLook(S.look); // this island's colours: tarp, bedding, roofs, wood…
// Dev only (stripped from the production build): poke at the state from the
// browser console, e.g. __S.needs.food = 5, __S.projects.dock.done = true, __give('axe').
if (import.meta.env.DEV) {
  Object.assign(window, {
    __S: S, __camera: camera, __controls: controls,
    __play: (k: AnimKey) => hooks.play(k, true), // try an animation, e.g. __play('death')
    __pose: (p: Parameters<NonNullable<typeof performer>['setTest']>[0]) => performer?.setTest(p), // try bone rotations
    __look: (x: number, y: number) => { // what a tap at these screen pixels would show
      const r = new Raycaster(); r.setFromCamera(new Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
      return inspect(r, S);
    },
    __give: (k: CraftKey) => { S.items[k] = true; },
    __startTask: (id: string) => { const t = T[id](); if (t) startTask(t); },
  });
}
const body = createBody(scene);
if (import.meta.env.DEV) Object.defineProperty(window, '__her', { get: () => body.her }); // (dev) her body, for poking at bones
const heldTools = createHeldTools(scene);
let ready = false;
let animator: ReturnType<typeof createAnimator> | null = null;
let performer: ReturnType<typeof createPerformer> | null = null;

/* ---------- sound (made in the browser, off until the player turns it on) ---------- */
const sound = createSound();
const soundBtn = document.getElementById('sound')!;
const showSound = () => soundBtn.setAttribute('aria-checked', String(sound.on)); // (the switch in the settings menu shows it)
soundBtn.addEventListener('click', () => { sound.toggle(); showSound(); });
showSound();
// browsers only start audio after a click: if it was on last time, the first click anywhere brings it back
addEventListener('pointerdown', () => sound.resumeOnGesture(), { once: true });

/* ---------- UI ---------- */
const infoCard = createInfoCard();
const hud = createHud();
const bubble = createBubble(body.her, camera);
const panel = createPanel(newIsland);
/* the start menu: the island waits (and the camera slowly circles it) while it's open */
let started = false; // has she been let loose yet? (the sim doesn't run until the menu's first closed)
const menu = createMenu({
  play() { started = true; begin(); },
  saveNow,
  started: () => started,
  onToggle(open) {
    document.body.classList.toggle('menu-open', open);
    controls.autoRotate = open;
    controls.autoRotateSpeed = 0.35;
    if (open) hud.setFollow(false);
  },
});
/* the gear: a little settings menu (back to the start menu, sound) */
const gear = document.getElementById('gear')!, settings = document.getElementById('settingsMenu')!;
const showSettings = (open: boolean) => { settings.hidden = !open; gear.setAttribute('aria-expanded', String(open)); };
gear.addEventListener('click', () => showSettings(settings.hidden === true));
addEventListener('pointerdown', e => { if (!(e.target as Element).closest('.settings')) showSettings(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') showSettings(false); });
document.getElementById('openMenu')!.addEventListener('click', () => { showSettings(false); menu.open(); });
if (takeSkipMenu()) { document.getElementById('menu')!.hidden = true; started = true; } // (just switched islands from the menu)
else menu.open();
function renderUI() {
  hud.render();
  panel.render();
}

/* ---------- saving ---------- */
let leaving = false; // set when starting over, so the unload handlers don't save the old island again
function saveNow() {
  if (!ready || !started || S.dead || leaving) return;
  writeSave(seed, snapshot(S));
}
function newIsland() {
  leaving = true;
  clearSave();
  playActiveSlot(); // (straight into the new island, no menu)
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
    waveUntil = clockT + 2.5; // she waves back
    infoCard.hide();
    return;
  }
  // anything else with a story: show its card where it was tapped
  const info = inspect(ray, S);
  if (info) infoCard.show(info, e.clientX, e.clientY);
  else infoCard.hide();
});

function loadModel() {
  const loading = document.getElementById('loading')!;
  loadCharacter().then(gltf => {
    body.attach(gltf.scene);
    heldTools.attach(gltf.scene);
    animator = createAnimator(gltf.scene, gltf.animations);
    performer = createPerformer(gltf.scene, body.her, scene);
    animator.play('idle');
    ready = true;
    loading.style.opacity = '0';
    begin();
  }, err => {
    loading.textContent = 'Couldn’t load her model. Try reloading the page.';
    console.error(err);
  });
}

/** Her first words, once the model is in and the menu has let her go. */
let begun = false;
function begin() {
  if (begun || !ready || !started) return;
  begun = true;
  if (save) say('Oh, you’re back.');
  else {
    say('Where… am I?');
    log('She woke up on a beach. No boat, no people. Just her and this island.', 'big');
  }
}

/* ---------- main loop ---------- */
let last = performance.now(), lastUI = 0, lastSave = 0, clockT = 0, waveUntil = 0;
const tmpV = new Vector3();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // real seconds, capped so a background tab doesn't jump
  last = now;
  clockT += dt;
  const sp = S.speed, animScale = sp > 0 ? Math.min(sp, 6) : 0; // animations stop speeding up past 6×
  if (ready && started && !menu.isOpen && !S.dead && sp > 0) {
    const dm = dt * 4 * sp; // 1 real second = 4 game minutes at 1×
    S.min += dm;
    updateNeeds(dm);
    if (!S.dead) runTask(dt * animScale, dm);
  }
  animator?.mixer.update(S.dead ? dt : dt * animScale);
  // what her hands are doing right now (only while she's actually at it, not walking there)
  const step = S.task?.steps[S.task.i], doing = step?.type === 'do' ? S.task!.id : null;
  const playing = doing === 'drum' && S.task!.instrument ? S.task!.instrument : null;
  const gesture: Playing = clockT < waveUntil ? (S.sitting ? 'sitWave' : 'wave')
    : playing ?? (doing === 'cook' && S.sitting ? 'stir'
    : (doing === 'write' || doing === 'whittle') && S.sitting ? 'carve'
    : doing === 'dance' || (doing === 'party' && S.task!.i === S.task!.steps.length - 1) ? 'dance' // (the party ends in a dance)
    : doing === 'fish' && S.items.rod && S.sitting ? 'cast'
    : doing === 'relax' && S.sitting && S.dog.state === 'friend' && clockT % 14 < 6 ? 'pet' // now and then she strokes her dog
    : null);
  performer?.update(sp > 0 || clockT < waveUntil ? gesture : null, dt, clockT, Math.min(2.6, 1.4 + 0.12 * S.skills.music.lvl) * Math.min(animScale || 1, 2));
  if (ready) { settleHeight(); body.update(dt); }
  // she carries the right tool for the whole task (rod for fishing, axe for chopping, pick for mining)
  const id = S.task?.id;
  const held: HeldTool | null = !ready ? null : id === 'fish' && S.items.rod ? 'rod' : (id === 'fish' || id === 'hunt') && S.items.spear ? 'spear' : id === 'chop' && S.items.axe ? 'axe' : id === 'mine' && S.items.pick ? 'pick' : null;
  heldTools.update(held, body.her, clockT);
  updateCrafted(S, held ?? (playing === 'flute' || playing === 'ukulele' ? playing : null)); // (a flute or ukulele in her hands isn't in its spot)
  updateForest(S);
  props.syncBerries(S.berries);
  updateBuildings(S, body.her, clockT);
  if (ready) updateDog(S, body.her, dt, clockT);
  updateLivestock(S, body.her, dt, clockT);
  updateRabbits(S, dt);
  updateSeasons(S);
  updatePaths(S, clockT);
  updateFlowers(S);
  updateEvents(S, body.her, clockT);
  updateJoys(S);
  updateCritters(S, dt, clockT);
  // the sky and the shore: clouds, surf and footprints, smoke from the fire
  const sunUp = Math.sin((hour() - 6) / 12 * Math.PI), light = Math.min(1, Math.max(0, (sunUp + 0.1) / 0.4));
  const dry = drought() ? 0.75 : 1; // the pond shrinks in a drought (and the waterfall dwindles)
  props.pond.scale.set(dry, 1, dry);
  updateWaterfall(clockT, drought() ? 1 : 0);
  props.shelter.visible = !S.projects.lodge.done; // the lodge replaces the old shelter
  updateAnimals(dt, clockT, isNight());
  const storm = S.weather.storm;
  const rain = updateRain(dt, S.weather.raining, controls.target, storm);
  updateClouds(S, dt * animScale, rain);
  updateShore(S, body.her, clockT, light);
  updateSmoke(S, dt * animScale, rain, storm ? 1 : rain * 0.3, light);
  updateIslet(S, clockT, storm ? 1 : rain * 0.4);
  updateLifeProps(S);
  props.sway(storm ? rain : rain * 0.3, clockT);
  sound.update(S, camera, body.her, rain, ready ? S.speed : 0);
  animateWater(clockT);
  updateSky(clockT, hour(), S.fire, props.campfire, rain, storm, dt);
  updateAtmosphere(S, scene.fog as Fog, rain, dt, clockT);
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
