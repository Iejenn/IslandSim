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
};
export const flameMat = new MeshBasicMaterial({ color: '#FF9F3A' });
export const flameMat2 = new MeshBasicMaterial({ color: '#FFE07A' });

export function mesh(geo: BufferGeometry, m: Material, x = 0, y = 0, z = 0, cast = true) {
  const o = new Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
