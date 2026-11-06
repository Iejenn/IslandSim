// v2.1 hobbies (sim/hobbies.ts) in the world: the easel she paints at (with
// the picture on it), her little gallery in camp (her latest paintings, a
// bark sheet with the birds in her log, and her woven wall hanging), the bird
// that turns up while she sits birdwatching, her hand loom while she weaves,
// and the rug and seat cushions she's woven.
import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, NearestFilter, PlaneGeometry, SphereGeometry, SRGBColorSpace,
  type Object3D, type Scene,
} from 'three';
import { FIRE, GALLERY_P, GALLERY_YAW, ground, lodgeLocal, LODGE_YAW, SEATS, SH, V, addScaled, dirXZ, yawTo } from '../sim/island';
import { BIRDS, birdColour, SUBJECT_TITLE, type PaintSubject } from '../sim/hobbies';
import type { SimState } from '../sim/state';
import { cap, pickable } from './inspect';
import { M, mat, mesh } from './materials';

const WEAVE_COLOURS = [['#B6452C', '#F0D9A8'], ['#2E6E8E', '#EADFC8'], ['#5E7F3A', '#E7C55A'], ['#7A4B8C', '#F2C9A0'], ['#C98A2B', '#3B2A20'], ['#A33B55', '#F4E6D2']];

/* ---------- little paintings, drawn on a canvas: what's in them depends on the subject ---------- */
function rnd(seed: number) { let a = seed | 0; return () => { a = (a * 1664525 + 1013904223) | 0; return ((a >>> 8) & 0xffff) / 0xffff; }; }
function paintCanvas(subject: PaintSubject, seed: number) {
  const W = 48, H = 36, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!, r = rnd(seed);
  const sky = (top: string, bottom: string, h = H * 0.6) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, W, h); };
  const sea = (y: number, col: string) => { g.fillStyle = col; g.fillRect(0, y, W, H - y); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * W), y + 2 + Math.floor(r() * (H - y - 3)), 4 + Math.floor(r() * 5), 1); };
  const blob = (x: number, y: number, rx: number, ry: number, col: string) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const ground = (y: number, col: string) => { g.fillStyle = col; g.fillRect(0, y, W, H - y); };
  const hut = (x: number, y: number, s: number, roof: string) => { g.fillStyle = '#8A5E3A'; g.fillRect(x - 5 * s, y - 6 * s, 10 * s, 6 * s); g.fillStyle = roof; g.beginPath(); g.moveTo(x - 7 * s, y - 6 * s); g.lineTo(x, y - 11 * s); g.lineTo(x + 7 * s, y - 6 * s); g.fill(); };
  switch (subject) {
    case 'sunset': sky('#F2A65A', '#E85D5D', H * 0.62); blob(24 + (r() - 0.5) * 16, H * 0.6, 6, 6, '#FFD27A'); sea(Math.round(H * 0.6), '#5A3E6E'); break;
    case 'sea': sky('#7EC8E3', '#CDEBF2'); sea(Math.round(H * 0.6), '#2E7D9A'); blob(10 + r() * 28, 7, 5, 2, '#FFFFFF'); break;
    case 'islet': sky('#86CDE6', '#D8F0F4'); sea(Math.round(H * 0.6), '#2E8A9E'); blob(26, H * 0.6, 12, 4, '#E8D6A0'); for (let i = 0; i < 5; i++) g.fillRect(18 + i * 3, H * 0.6 - 9 - (i % 2) * 3, 1, 9 + (i % 2) * 3), g.fillStyle = '#5E9E4E'; break;
    case 'boat': sky('#8FD0E8', '#D8F0F4'); sea(Math.round(H * 0.55), '#2E7D9A'); g.fillStyle = '#7A4E2C'; g.beginPath(); g.moveTo(12, 24); g.lineTo(36, 24); g.lineTo(32, 28); g.lineTo(16, 28); g.fill(); break;
    case 'waterfall': ground(0, '#7E8A6A'); blob(24, 10, 16, 12, '#8E8C7A'); g.fillStyle = '#EAF6F8'; g.fillRect(21, 4, 6, 20); blob(24, 28, 16, 6, '#5BB5C8'); break;
    case 'ducks': ground(0, '#6FAE5A'); blob(24, 20, 22, 12, '#5BB5C8'); for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { const x = 12 + i * 7 + r() * 3, y = 18 + r() * 5; blob(x, y, 3, 2, i ? '#8A6A48' : '#F2EDE0'); blob(x + 2, y - 2, 1.4, 1.4, i ? '#8A6A48' : '#2F6B4A'); } break;
    case 'camp': sky('#8FD0E8', '#E0F4F6', H * 0.5); ground(Math.round(H * 0.5), '#6FAE5A'); hut(14, 26, 1, '#C9A35A'); blob(32, 28, 3, 2, '#E8643C'); blob(32, 26, 1.5, 2.5, '#F2C230'); break;
    case 'lodge': sky('#8FD0E8', '#E0F4F6', H * 0.5); ground(Math.round(H * 0.5), '#6FAE5A'); hut(24, 30, 1.8, '#9C5B3A'); g.fillStyle = '#F2D27A'; g.fillRect(20, 22, 3, 3); break;
    case 'dog': ground(0, '#E8C98A'); blob(24, 22, 10, 6, '#8A5E3A'); blob(33, 15, 5, 5, '#8A5E3A'); blob(36, 12, 2, 3, '#5A3A22'); g.fillStyle = '#2B211A'; g.fillRect(34, 14, 1, 1); break;
    case 'hens': ground(0, '#7DB862'); for (let i = 0; i < 3; i++) { const x = 10 + i * 13, y = 20 + r() * 6; blob(x, y, 4, 3.5, '#F4F2EC'); g.fillStyle = '#D2382E'; g.fillRect(x + 2, y - 5, 2, 2); } break;
    case 'home': sky('#B9D3E8', '#F0E6D6', H * 0.55); ground(Math.round(H * 0.55), '#9CB86A'); hut(24, 28, 1.6, '#B3412F'); g.fillStyle = '#F2D27A'; g.fillRect(19, 20, 3, 3); g.fillRect(27, 20, 3, 3); break;
  }
  // brush texture: a few lighter and darker dabs over everything
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'; g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 2, 1); }
  const t = new CanvasTexture(c); t.magFilter = NearestFilter; t.colorSpace = SRGBColorSpace;
  return t;
}
/** A striped, zig-zag woven pattern in one of the colour pairs. */
function weaveCanvas(colour: number) {
  const [a, b] = WEAVE_COLOURS[colour % WEAVE_COLOURS.length], c = document.createElement('canvas'); c.width = 16; c.height = 24;
  const g = c.getContext('2d')!;
  g.fillStyle = a; g.fillRect(0, 0, 16, 24);
  g.fillStyle = b;
  for (let y = 0; y < 24; y += 6) for (let x = 0; x < 16; x++) g.fillRect(x, y + Math.abs((x % 6) - 3), 1, 1);
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 23, 16, 1);
  const t = new CanvasTexture(c); t.magFilter = NearestFilter; t.colorSpace = SRGBColorSpace;
  return t;
}
const texMat = (t: CanvasTexture) => new MeshStandardMaterial({ map: t, roughness: 0.95 });

export function createHobbies(scene: Scene) {
  const frameMat = mat('#6B4A2E'), bark = mat('#C9B48A'), canvasBack = mat('#EFE6D2');

  /* ---------- the easel (only while she paints), with the picture she's working on ---------- */
  const easel = new Group();
  for (const s of [-1, 1]) { const leg = mesh(new CylinderGeometry(0.02, 0.025, 1.3, 4), M.log, s * 0.22, 0.62, 0); leg.rotation.z = s * 0.12; easel.add(leg); }
  const back = mesh(new CylinderGeometry(0.02, 0.025, 1.3, 4), M.log, 0, 0.6, -0.22); back.rotation.x = -0.3; easel.add(back);
  easel.add(mesh(new BoxGeometry(0.5, 0.03, 0.05), M.log, 0, 0.62, 0.03));
  const easelPic = new Mesh(new PlaneGeometry(0.48, 0.36), canvasBack); easelPic.position.set(0, 0.84, 0.05); easelPic.rotation.x = -0.1; easel.add(easelPic);
  const easelBack = mesh(new BoxGeometry(0.5, 0.38, 0.015), frameMat, 0, 0.84, 0.035, false); easelBack.rotation.x = -0.1; easel.add(easelBack); // (so from behind it's a board, not see-through)
  easel.visible = false; scene.add(easel);
  let easelFor: PaintSubject | null = null;

  /* ---------- her gallery: a wooden frame by the rack, facing the fire ---------- */
  const gallery = new Group();
  gallery.position.set(GALLERY_P.x, GALLERY_P.y, GALLERY_P.z); gallery.rotation.y = GALLERY_YAW;
  for (const x of [-1.32, 1.32]) gallery.add(mesh(new CylinderGeometry(0.05, 0.06, 1.75, 5), M.log, x, 0.87, 0));
  gallery.add(mesh(new BoxGeometry(2.8, 0.07, 0.07), M.log, 0, 1.72, 0));
  gallery.add(mesh(new BoxGeometry(2.64, 0.05, 0.05), M.log, 0, 0.55, 0));
  scene.add(gallery);
  // six frames: the newest paintings, two rows of three (the middle of the frame)
  const slots = Array.from({ length: 6 }, (_, i) => {
    const g = new Group(), x = (i % 3 - 1) * 0.56, y = i < 3 ? 1.35 : 0.88;
    g.position.set(x, y, 0.04);
    g.add(mesh(new BoxGeometry(0.5, 0.39, 0.03), frameMat, 0, 0, 0));
    const pic = new Mesh(new PlaneGeometry(0.44, 0.33), canvasBack); pic.position.z = 0.02; g.add(pic);
    gallery.add(g);
    return { g, pic, key: '' };
  });
  slots.forEach((s, i) => pickable(s.g, S => {
    const p = S.paintings[S.paintings.length - 1 - i];
    return p ? { title: `“${SUBJECT_TITLE[p.subject]}”`, lines: [`Painted on day ${p.day}`, { beach: 'On the beach', pond: 'By the pond', camp: 'Looking across her camp' }[p.where]] } : null;
  }));
  // the bird log: a bark sheet with a mark for every bird she's seen
  const log = new Group(); log.position.set(1.08, 1.1, 0.04); // (right of the paintings)
  log.add(mesh(new BoxGeometry(0.34, 0.5, 0.02), bark, 0, 0, 0));
  const ticks = BIRDS.map((b, i) => { const d = mesh(new SphereGeometry(0.03, 5, 4), mat(b.colour), (i % 3 - 1) * 0.09, 0.18 - Math.floor(i / 3) * 0.11, 0.02, false); log.add(d); return d; });
  gallery.add(log);
  pickable(log, S => {
    const seen = BIRDS.filter(b => S.birds?.[b.name]);
    return { title: 'Her bird log', lines: [`${seen.length} of ${BIRDS.length} island birds`, seen.length ? cap(seen.slice(-4).map(b => b.name).join(', ')) + (seen.length > 4 ? '…' : '') : 'Nothing yet', ...(S.birdwatcher ? ['Every bird on the island!'] : [])] };
  });
  // her woven wall hanging, on the left post
  const hanging = new Mesh(new PlaneGeometry(0.3, 0.6), canvasBack); hanging.position.set(-1.08, 1.18, 0.06); gallery.add(hanging); // (left of the paintings)
  gallery.add(mesh(new CylinderGeometry(0.012, 0.012, 0.36, 4), M.log, -1.08, 1.5, 0.06, false).rotateZ(Math.PI / 2));
  pickable(hanging, S => { const w = S.woven.find(x => x.key === 'hanging'); return w ? { title: 'A woven wall hanging', lines: [`Woven on day ${w.day}`, `From ${w.yarn === 'wool' ? 'her sheep’s wool' : 'plant fibre'}`] } : null; });

  /* ---------- the rug (in front of the shelter, or in the lodge's living room) and the seat cushions ---------- */
  const rug = new Mesh(new PlaneGeometry(1.0, 1.5), canvasBack); rug.rotation.x = -Math.PI / 2; rug.visible = false; scene.add(rug);
  pickable(rug, S => { const w = S.woven.find(x => x.key === 'rug'); return w ? { title: 'A woven rug', lines: [`Woven on day ${w.day}`, 'Warm under her feet'] } : null; });
  const cushions = SEATS.map(({ p }) => {
    const out = dirXZ(FIRE, p), at = addScaled(p, out, 0.45);
    const m = new Mesh(new BoxGeometry(0.42, 0.07, 0.3), canvasBack); m.position.set(at.x, p.y + 0.32, at.z); m.rotation.y = Math.atan2(out.x, out.z) + Math.PI / 2;
    m.visible = false; scene.add(m);
    pickable(m, S => { const w = S.woven.find(x => x.key === 'cushions'); return w ? { title: 'A woven cushion', lines: [`Woven on day ${w.day}`, 'Much nicer than a bare log'] } : null; });
    return m;
  });

  /* ---------- while she's at it: the hand loom in her lap, the bird she's watching ---------- */
  const loom = new Group();
  loom.add(mesh(new BoxGeometry(0.42, 0.03, 0.04), M.log, 0, 0, -0.14)); loom.add(mesh(new BoxGeometry(0.42, 0.03, 0.04), M.log, 0, 0, 0.14));
  const cloth = new Mesh(new PlaneGeometry(0.36, 0.26), canvasBack); cloth.rotation.x = -Math.PI / 2; cloth.position.y = 0.01; loom.add(cloth);
  loom.visible = false; scene.add(loom);
  const bird = new Group();
  const birdBody = new MeshStandardMaterial({ color: '#8A7558', roughness: 0.9 });
  const body = mesh(new SphereGeometry(0.09, 7, 5), birdBody, 0, 0.09, 0, false); body.scale.set(0.8, 0.8, 1.3); bird.add(body);
  bird.add(mesh(new SphereGeometry(0.055, 6, 4), birdBody, 0, 0.17, 0.09, false));
  bird.add(mesh(new ConeGeometry(0.018, 0.06, 4), mat('#E3A13A'), 0, 0.17, 0.16, false).rotateX(Math.PI / 2));
  const tail = mesh(new BoxGeometry(0.07, 0.015, 0.1), birdBody, 0, 0.11, -0.12, false); tail.rotation.x = 0.4; bird.add(tail);
  bird.scale.setScalar(1.4); // (a touch bigger than life, so it's easy to spot)
  bird.visible = false; scene.add(bird);

  const textures = new Map<string, MeshStandardMaterial>();
  const paintMat = (subject: PaintSubject, seed: number) => {
    const k = `${subject}:${seed}`;
    if (!textures.has(k)) textures.set(k, texMat(paintCanvas(subject, seed)));
    return textures.get(k)!;
  };
  const weaveMat = (colour: number) => {
    const k = `w${colour}`;
    if (!textures.has(k)) textures.set(k, texMat(weaveCanvas(colour)));
    return textures.get(k)!;
  };
  let shownPaintings = '', shownWoven = '', lodgeDone: boolean | null = null;

  /** @param t seconds on the animals' clock (the bird stops when paused) */
  return function updateHobbies(S: SimState, her: Object3D, t: number) {
    const step = S.task?.steps[S.task.i], doing = step?.type === 'do' && S.task!.started ? S.task!.id : null, yaw = her.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);

    // the easel stands in front of her while she paints
    easel.visible = doing === 'paint' && !!S.easelSubject;
    if (easel.visible) {
      easel.position.set(her.position.x + fx * 0.85, her.position.y - 0.02, her.position.z + fz * 0.85);
      easel.rotation.y = yaw + Math.PI; // (the picture faces her)
      if (easelFor !== S.easelSubject) { easelFor = S.easelSubject; easelPic.material = paintMat(easelFor!, dayKey(S)); }
    }

    // the gallery: the newest six paintings (and nothing at all until there's something to show)
    const pk = S.paintings.map(p => p.seed).join(',');
    if (pk !== shownPaintings) {
      shownPaintings = pk;
      slots.forEach((s, i) => {
        const p = S.paintings[S.paintings.length - 1 - i];
        s.g.visible = !!p;
        if (p) s.pic.material = paintMat(p.subject, p.seed);
      });
    }
    const woven = S.woven ?? [], wk = woven.map(w => `${w.key}${w.colour}`).join(',');
    const lodge = !!S.projects.lodge?.done;
    if (wk !== shownWoven || lodge !== lodgeDone) {
      shownWoven = wk; lodgeDone = lodge;
      const find = (k: string) => woven.find(w => w.key === k);
      const r = find('rug'), c = find('cushions'), h = find('hanging');
      rug.visible = !!r; cushions.forEach(m => { m.visible = !!c; });
      hanging.visible = !!h;
      if (r) {
        rug.material = weaveMat(r.colour);
        const p = lodge ? lodgeLocal(0, 0.45) : addScaled(SH, dirXZ(SH, FIRE), 1.5);
        const gy = lodge ? p.y + 0.13 : ground(V(p.x, p.z)).y + 0.04; rug.position.set(p.x, gy, p.z);
        rug.rotation.set(-Math.PI / 2, 0, lodge ? LODGE_YAW : yawTo(SH, FIRE));
      }
      if (c) cushions.forEach(m => { m.material = weaveMat(c.colour); });
      if (h) hanging.material = weaveMat(h.colour);
    }
    gallery.visible = S.paintings.length > 0 || Object.keys(S.birds ?? {}).length > 0 || !!woven.find(w => w.key === 'hanging');
    log.visible = Object.keys(S.birds ?? {}).length > 0;
    ticks.forEach((d, i) => { d.visible = !!S.birds?.[BIRDS[i].name]; });

    // the hand loom in her lap while she weaves
    loom.visible = doing === 'weave' && S.sitting;
    if (loom.visible) {
      loom.position.set(her.position.x + fx * 0.32, her.position.y + 0.48, her.position.z + fz * 0.32);
      loom.rotation.y = yaw;
      const piece = woven[woven.length - 1];
      cloth.material = weaveMat(piece ? piece.colour + 1 : 0);
      cloth.scale.y = 0.2 + 0.8 * (S.weaving ?? 0);
    }

    // a bird turns up while she sits still, a few steps in front of her, and hops about
    bird.visible = doing === 'birds' && !!S.watching;
    if (bird.visible) {
      birdBody.color.set(birdColour(S.watching));
      const hop = Math.max(0, Math.sin(t * 5)) * 0.06 * (Math.sin(t * 0.7) > 0.3 ? 1 : 0), side = Math.sin(t * 0.4) * 0.6;
      bird.position.set(her.position.x + fx * 2.4 + fz * side, her.position.y + hop, her.position.z + fz * 2.4 - fx * side);
      bird.rotation.y = yaw + Math.PI + Math.sin(t * 0.9) * 0.8; // (facing her, then looking about)
    }
  };
}
/** A stable seed for the picture on the easel (the finished painting gets its own). */
const dayKey = (S: SimState) => Math.floor(S.min / 1440) * 7 + 3;
