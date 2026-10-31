// The island's hidden places (sim/places.ts) in the world: the overgrown ruin
// in the forest, the blowhole spouting on the rocky coast (higher in rough
// weather), a rock arch by the hidden cove, a flat rock and cairn on the
// hilltop, seabirds on the cliffs in spring and summer, the wreck on the reef
// under the water, and glow-worms twinkling in the cave at night once found.
import { BoxGeometry, ConeGeometry, Mesh, MeshBasicMaterial, SphereGeometry, CylinderGeometry, DodecahedronGeometry, Group, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, type Scene } from 'three';
import { BLOWHOLE_P, CAVE_FACE, CAVE_P, CLIFFS_P, COVE_P, HILLTOP_P, RUIN_P, WRECK_P } from '../sim/island';
import { PLACES, type PlaceKey } from '../sim/places';
import { season } from '../sim/seasons';
import type { SimState } from '../sim/state';
import { pickable } from './inspect';
import { M, mat, mesh } from './materials';

const CARDS: Record<PlaceKey, { unfound: string; hint: string; about: string }> = {
  ruin: { unfound: 'Mossy stones', hint: 'Deep in the forest. Someone was here once…', about: 'A ring of toppled stones, carved with spirals' },
  blowhole: { unfound: 'A hole in the rocks', hint: 'Something roars here when the waves come in', about: 'The sea bursts up through the rock, higher in rough weather' },
  cove: { unfound: 'A rock arch', hint: 'Only reachable round the rocks at low tide', about: 'A tiny hidden beach, calm as a bath' },
  hilltop: { unfound: 'The top of the hill', hint: 'A long climb above the waterfall', about: 'The whole island lies below, and the sea all around' },
  cliffs: { unfound: 'The cliffs', hint: 'Busy with birds in spring and summer', about: 'Hundreds of seabirds nest here in spring and summer' },
  wreck: { unfound: 'A dark shape on the reef', hint: 'Best seen from a canoe on a calm day', about: 'An old ship on the bottom, all covered in coral' },
  grotto: { unfound: 'The glow-worm grotto', hint: 'Deep in the cave, at night', about: 'Tiny blue-green lights on the cave ceiling at night' },
};
const moss = mat('#6E8463'), spray = mat('#EAF6F8', { transparent: true, opacity: 0.7 }), bird = mat('#F4F2EC'), hull = mat('#4A3626');

export function createPlaces(scene: Scene) {
  // tap to look: a hint of something before she's found it, and the place's own card once she has
  const card = (k: PlaceKey) => (S: SimState) => {
    const c = CARDS[k];
    if (!S.places?.[k]) return { title: c.unfound, lines: ['She hasn’t found this place yet', c.hint] };
    const extra = k === 'wreck' && S.relics?.length ? [`She brought up ${S.relics.length} old thing${S.relics.length > 1 ? 's' : ''} from it`] : [];
    return { title: PLACES[k].name.replace(/^the /, '').replace(/^./, ch => ch.toUpperCase()), lines: [`She found it on day ${S.places[k]}`, c.about, ...extra] };
  };
  // (an invisible, easy-to-tap target for places that are hard to tap: a few small birds, the gap under the arch)
  const target = (p: { x: number; y: number; z: number }, r: number, k: PlaceKey) => {
    const m = new Mesh(new SphereGeometry(r, 8, 6), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(p.x, p.y + r * 0.6, p.z); scene.add(m); pickable(m, card(k));
  };
  const at = (g: Group, p: { x: number; y: number; z: number }) => { g.position.set(p.x, p.y, p.z); scene.add(g); return g; };

  /* the ruin: a ring of toppled, mossy stone pillars round a carved slab */
  const ruin = at(new Group(), RUIN_P);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, h = [1.4, 0.5, 1.1, 0.3, 1.6, 0.7, 0.4, 1.2][i];
    const pillar = mesh(new BoxGeometry(0.4, h, 0.4), i % 3 ? M.rock : moss, Math.cos(a) * 1.6, h / 2, Math.sin(a) * 1.6);
    pillar.rotation.set((i % 2) * 0.12, a, (i % 3) * 0.08); ruin.add(pillar);
  }
  const fallen = mesh(new BoxGeometry(1.4, 0.35, 0.4), moss, 0.4, 0.17, 2.3); fallen.rotation.y = 0.6; ruin.add(fallen);
  ruin.add(mesh(new BoxGeometry(1.0, 0.18, 0.7), M.rock, 0, 0.09, 0));
  pickable(ruin, card('ruin'));

  /* the blowhole: a ring of black rock, and a spout of spray now and then */
  const blow = at(new Group(), BLOWHOLE_P);
  for (let i = 0; i < 6; i++) { const r = mesh(new DodecahedronGeometry(0.45, 0), mat('#4C5257'), Math.cos(i) * 0.8, 0.15, Math.sin(i) * 0.8); r.rotation.set(i, i * 2, 0); blow.add(r); }
  const spout = mesh(new ConeGeometry(0.35, 2.4, 8, 1, true), spray, 0, 1.2, 0, false); spout.rotation.x = Math.PI; blow.add(spout);
  pickable(blow, card('blowhole'));

  /* the hidden cove: a natural rock arch at its entrance */
  const arch = at(new Group(), COVE_P);
  for (const x of [-1.1, 1.1]) arch.add(mesh(new BoxGeometry(0.7, 2.0, 0.8), M.rock, x, 1.0, 0));
  const top = mesh(new BoxGeometry(3.0, 0.6, 0.9), M.rock, 0, 2.2, 0); top.rotation.z = 0.06; arch.add(top);
  arch.rotation.y = Math.atan2(COVE_P.x, COVE_P.z);
  pickable(arch, card('cove'));
  target(COVE_P, 1.6, 'cove'); // (so tapping the gap under the arch works too)

  /* the hilltop: a flat rock to sit on, and a little cairn */
  const hill = at(new Group(), HILLTOP_P);
  hill.add(mesh(new BoxGeometry(1.2, 0.3, 0.9), M.rock, 0, 0.15, 0));
  for (let i = 0; i < 4; i++) hill.add(mesh(new BoxGeometry(0.3 - i * 0.05, 0.12, 0.25 - i * 0.04), M.rock, 0.9, 0.06 + i * 0.12, 0.3));
  pickable(hill, card('hilltop'));

  /* seabirds on the cliffs, in spring and summer */
  target(CLIFFS_P, 2.2, 'cliffs');
  const birds = Array.from({ length: 8 }, (_, i) => { const b = mesh(new BoxGeometry(0.22, 0.04, 0.1), bird, 0, 0, 0, false); b.userData.i = i; scene.add(b); return b; });

  /* the wreck on the reef: a broken hull and a leaning mast, under the water */
  const wreck = at(new Group(), WRECK_P);
  const h = mesh(new BoxGeometry(1.4, 0.7, 3.6), hull, 0, 0, 0); h.rotation.set(0.15, 0.7, 0.35); wreck.add(h);
  const mast = mesh(new CylinderGeometry(0.06, 0.08, 2.4, 6), hull, 0.2, 1.0, 0.3); mast.rotation.z = 0.6; wreck.add(mast);
  pickable(wreck, card('wreck'));

  /* glow-worms in the cave: tiny blue-green lights round the mouth, at night */
  const pts: number[] = [];
  // (on the inside of the cave's dark mouth, a half dome: see buildings.ts, so they're in view)
  for (let i = 0; i < 70; i++) {
    let nx = 0, ny = 0;
    do { nx = Math.random() * 1.8 - 0.9; ny = Math.random() * 0.9; } while (nx * nx + ny * ny > 0.8);
    const nz = Math.sqrt(1 - nx * nx - ny * ny);
    pts.push(nx * 0.95, ny * 1.25 - 0.1, nz * 0.6 - 0.15 + 0.03);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  const glow = new Points(g, new PointsMaterial({ color: '#7CFFE0', size: 0.11, transparent: true, opacity: 0.9, depthWrite: false }));
  glow.position.set(CAVE_P.x, CAVE_P.y + 0.1, CAVE_P.z); glow.rotation.y = Math.atan2(CAVE_FACE.x, CAVE_FACE.z);
  glow.visible = false; scene.add(glow);

  /** @param t seconds on the animals' clock (it stops while paused) */
  return function updatePlaces(S: SimState, t: number) {
    // the blowhole spouts every few seconds, higher when the sea is rough
    const rough = S.weather.storm ? 1.6 : S.weather.raining || S.weather.coming ? 1.2 : 0.8, ph = (t * 0.4) % 1;
    spout.visible = ph < 0.35;
    spout.scale.set(1, rough * Math.sin((ph / 0.35) * Math.PI), 1);
    // seabirds wheel round the cliffs in spring and summer
    const nesting = season() === 'spring' || season() === 'summer';
    for (const b of birds) {
      b.visible = nesting;
      if (!nesting) continue;
      const i = b.userData.i as number, a = t * (0.5 + i * 0.05) + i;
      b.position.set(CLIFFS_P.x + Math.cos(a) * (2 + i * 0.3), CLIFFS_P.y + 2 + Math.sin(t + i) * 0.6, CLIFFS_P.z + Math.sin(a) * (2 + i * 0.3));
      b.rotation.set(0, -a, Math.sin(t * 10 + i) * 0.5);
    }
    // glow-worms twinkle at night, once she's found them
    const h = (S.min / 60) % 24, night = h >= 20 || h < 5;
    glow.visible = !!S.places?.grotto && night;
    (glow.material as PointsMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 2);
  };
}
