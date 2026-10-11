// heroStyle.js — re-styles the loaded VRM for the night parade (onmyōji look).
// Only material parameters change at load time; the CC0 model file stays untouched.
import * as THREE from 'three';
import { toon, bake } from './toon.js';
import { foxMaskTex } from './textures.js';

const tint = (materials, name, color, shade) => {
  for (const m of materials) {
    if (m.name !== name) continue;
    m.color.setRGB(...color);
    if (shade && m.shadeColorFactor) m.shadeColorFactor.setRGB(...shade);
  }
};

export function restyleHero(vrm, materials) {
  // VRoid hair is a grey strand texture tinted by the material colour: peach-orange
  // in the original. Night-blue black with violet underside suits the onmyōji.
  tint(materials, 'F00_000_Hair_00_HAIR_01', [0.13, 0.14, 0.3], [0.05, 0.05, 0.14]);
  tint(materials, 'F00_000_Hair_00_HAIR_02', [0.22, 0.12, 0.4], [0.07, 0.04, 0.14]);
  tint(materials, 'M00_000_HairBack_00_HAIR', [0.2, 0.11, 0.36], [0.06, 0.04, 0.13]);

  for (const m of materials) {
    // The textures were painted for display as-is; skip the scene's filmic tone
    // mapping on the character so skin and cloth keep their authored colours.
    m.toneMapped = false;
    m.needsUpdate = true;
  }
}

// Kitsune mask worn tilted on the left temple: the one onmyōji prop we keep.
// Built in the head bone's frame (model units, +y up, -z forward).
export function makeFoxMask() {
  const mat = toon(0xffffff, { map: foxMaskTex() });
  const mask = new THREE.Group();
  mask.add(bake([
    { geo: new THREE.SphereGeometry(0.062, 20, 14), mat, s: [0.95, 1.12, 0.42] },
    { geo: new THREE.SphereGeometry(0.027, 10, 8), mat, p: [0, -0.027, -0.025], s: [0.9, 0.7, 0.9] },
    { geo: new THREE.ConeGeometry(0.021, 0.054, 8), mat, p: [-0.037, 0.075, 0], r: [0, 0, 0.32] },
    { geo: new THREE.ConeGeometry(0.021, 0.054, 8), mat, p: [0.037, 0.075, 0], r: [0, 0, -0.32] },
  ], { outline: 0.004 }));
  mask.position.set(-0.112, 0.125, -0.005);
  mask.rotation.set(-0.25, Math.PI / 2 + 0.35, 0.3);
  return mask;
}
