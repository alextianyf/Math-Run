// torii.js — the torii gates over the path, with their shimenawa ropes.
import * as THREE from 'three';
import { toon, place, taperedTube } from '../toon.js';
import { plaqueTex } from '../textures.js';
import { NEAR, GAP, SPAN, merge, instanced, Scroller } from './shared.js';

export function buildTorii(scene) {
  const red = [], black = [], rope = [], paper = [];
  for (const sx of [-1, 1]) {
    red.push(place(new THREE.CylinderGeometry(0.17, 0.21, 4.3, 16), [sx * 2.75, 2.15, 0]));
    black.push(place(new THREE.CylinderGeometry(0.26, 0.28, 0.36, 16), [sx * 2.75, 0.18, 0]));
  }
  red.push(place(new THREE.BoxGeometry(6.7, 0.24, 0.24), [0, 3.5, 0]));      // nuki
  red.push(place(new THREE.BoxGeometry(7.0, 0.22, 0.36), [0, 4.1, 0]));      // shimaki
  red.push(place(new THREE.BoxGeometry(0.22, 0.5, 0.16), [0, 3.8, 0]));      // gakuzuka strut
  black.push(place(new THREE.BoxGeometry(0.5, 0.7, 0.1), [0, 3.82, 0.1]));    // plaque board
  // kasagi: the curved top beam with up-swept ends
  const k = new THREE.Shape();
  k.moveTo(-3.9, 0.36);
  k.quadraticCurveTo(0, -0.1, 3.9, 0.36);
  k.lineTo(3.95, 0.66);
  k.quadraticCurveTo(0, 0.22, -3.95, 0.66);
  k.closePath();
  const kasagi = new THREE.ExtrudeGeometry(k, { depth: 0.46, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 16 });
  black.push(place(kasagi, [0, 4.0, -0.23]));
  // shimenawa (sacred rope) with shide paper streamers
  rope.push(taperedTube([[-2.6, 3.28, 0.2], [-1.3, 3.0, 0.24], [0, 2.92, 0.25], [1.3, 3.0, 0.24], [2.6, 3.28, 0.2]], 0.075, { tip: 1, radial: 8, segments: 24 }));
  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    rope.push(place(new THREE.CylinderGeometry(0.035, 0.06, 0.32, 6), [x, 2.78, 0.25]));
    const z = new THREE.Shape();
    z.moveTo(0, 0); z.lineTo(0.13, 0); z.lineTo(0.13, -0.11); z.lineTo(0.05, -0.11); z.lineTo(0.05, -0.22);
    z.lineTo(0.13, -0.22); z.lineTo(0.13, -0.38); z.lineTo(0.0, -0.38); z.lineTo(0.0, -0.27); z.lineTo(0.08, -0.27);
    z.lineTo(0.08, -0.16); z.lineTo(0, -0.16); z.closePath();
    paper.push(place(new THREE.ShapeGeometry(z), [x + 0.2, 3.0, 0.27]));
  }

  const count = SPAN / GAP;
  const meshes = [
    instanced(merge(red), toon(0xd8382b, { emissive: 0x3a0806 }), count),
    instanced(merge(black), toon(0x1a1520), count),
    instanced(merge(rope), toon(0xc9a45a), count),
    instanced(merge(paper), toon(0xf7f3ea, { side: THREE.DoubleSide }), count),
    instanced(place(new THREE.PlaneGeometry(0.36, 0.54), [0, 3.82, 0.16]), new THREE.MeshBasicMaterial({ map: plaqueTex() }), count),
  ];
  scene.add(...meshes);
  const items = Array.from({ length: count }, (_, i) => ({ x: 0, z: NEAR - 6 - i * GAP }));
  return new Scroller(meshes, items);
}
