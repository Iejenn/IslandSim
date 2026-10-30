// Shared low-poly materials and a mesh helper used by every world builder.
import { DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry, type Material, type MeshStandardMaterialParameters } from 'three';

export const mat = (c: string, o?: MeshStandardMaterialParameters) =>
  new MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, metalness: 0, ...o });

export const M = {
  trunk: mat('#8B6B4A'), leaf: mat('#4E9A55'), leaf2: mat('#3E8449'), coco: mat('#6B4A2E'), rock: mat('#9AA3A6'), bush: mat('#3E7F46'),
  berry: mat('#D2304A', { roughness: 0.5 }),
  log: mat('#7A5638'), wood: mat('#A07A50'), thatch: mat('#A9B861'), bed: mat('#B39462'),
  spring: mat('#3DB4C6', { roughness: 0.2, transparent: true, opacity: 0.9 }),
  pianoBody: mat('#3B2A22', { roughness: 0.5 }), ivory: mat('#F4F0E6', { roughness: 0.5 }), ebony: mat('#1A1512'),
  cloth: mat('#E2604E', { side: DoubleSide }),
  book1: mat('#2F6FA3'), book2: mat('#D9961C'), book3: mat('#7A3E6B'), rod: mat('#5A4632'),
  // forest leaves get their own materials so the seasons can recolour them (palms stay green)
  forestLeaf: mat('#4E9A55'), forestLeaf2: mat('#3E8449'),
  // recoloured per island by applyLook()
  tarp: mat('#5E8F5A', { side: DoubleSide }), hammock: mat('#B9A26A', { side: DoubleSide }), cushion: mat('#EDE6D6'),
  blanket: mat('#B5523B'), blanketStripe: mat('#E8D7B5'),
};
// Materials whose colour differs per island (see S.look): the shelter's tarp,
// bedding, hammock cloth, cushions, blanket, roofs and the wood she works.
const PALETTE = {
  tarp: ['#5E8F5A', '#3F79A8', '#D9822B', '#B8483A', '#D8B23C', '#2F8C8A', '#C9B98F', '#8A5BA8'],
  bedding: ['#B39462', '#7FA6C9', '#C97F7F', '#8FB98A', '#D8C38A', '#A68CC0'],
  hammock: ['#B9A26A', '#E2604E', '#4F8FBF', '#E8C547', '#6BAF7A', '#F2EEE2'],
  cushion: ['#EDE6D6', '#C9DCEB', '#E8C9C9', '#D6E3C8', '#E9DDB8', '#D8CBE6'],
  blanket: [['#B5523B', '#E8D7B5'], ['#3F6E9E', '#F1E7CF'], ['#5B8C4E', '#F0E2B0'], ['#7A4E86', '#EBD9A6'], ['#D08A2E', '#5A3A28']],
  roof: ['#A9B861', '#C9A95A', '#9C8A5A', '#B8C27A', '#8E9E58'],
  wood: [['#A07A50', '#7A5638'], ['#B38B5E', '#8A6440'], ['#8E6844', '#6A4A30'], ['#A8784E', '#7D4F33']], // planks, logs
};
const choose = <T>(list: T[], v: number) => list[Math.min(list.length - 1, Math.floor((v || 0) * list.length))];
/** Recolour the per-island materials from her island's look (0…1 per key). */
export function applyLook(look: Record<string, number>) {
  const m = M;
  m.tarp.color.set(choose(PALETTE.tarp, look.tarp));
  m.bed.color.set(choose(PALETTE.bedding, look.bedding));
  m.hammock.color.set(choose(PALETTE.hammock, look.hammock));
  m.cushion.color.set(choose(PALETTE.cushion, look.cushion));
  const [b, stripe] = choose(PALETTE.blanket, look.blanket);
  m.blanket.color.set(b);
  m.blanketStripe.color.set(stripe);
  m.thatch.color.set(choose(PALETTE.roof, look.roof));
  const [plank, log] = choose(PALETTE.wood, look.wood);
  m.wood.color.set(plank);
  m.log.color.set(log);
}

export const flameMat = new MeshBasicMaterial({ color: '#FF9F3A' });
export const flameMat2 = new MeshBasicMaterial({ color: '#FFE07A' });

export function mesh(geo: BufferGeometry, m: Material, x = 0, y = 0, z = 0, cast = true) {
  const o = new Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
