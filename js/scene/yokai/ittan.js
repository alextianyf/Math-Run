// ittan.js — 一反木綿 a flying bolt of cloth, rippling
import * as THREE from 'three';
import { toon, bake, joint } from '../toon.js';
import { once, ink, maw, glowSprite } from './shared.js';

export function buildIttan(body) {
  // a strip of cloth streaming back from its face, rippled every frame on the CPU
  const clothMat = once('cloth', () => toon(0xf4efe4, { side: THREE.DoubleSide }));
  const geo = new THREE.PlaneGeometry(0.55, 2.6, 2, 18);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -1.0);
  const base = geo.attributes.position.array.slice();
  body.add(new THREE.Mesh(geo, clothMat));
  const face = joint(body, 0, 0.03, 0.12);
  face.add(bake([
    { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: ink(), p: [-0.12, 0.04, 0], s: [1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: ink(), p: [0.12, 0.04, 0], s: [1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: maw(), p: [0, 0.02, -0.16], s: [1.4, 0.4, 0.7] },
    // two little cloth arms
    { geo: new THREE.BoxGeometry(0.3, 0.02, 0.12), mat: clothMat, p: [-0.38, -0.02, -0.45], r: [0, 0.4, 0.3] },
    { geo: new THREE.BoxGeometry(0.3, 0.02, 0.12), mat: clothMat, p: [0.38, -0.02, -0.45], r: [0, -0.4, -0.3] },
  ], { outline: 0.01 }));
  body.add(glowSprite(0xcfe8ff, 1.6, 0.22));
  const pos = geo.attributes.position;
  // the front rears up like a cobra so the face shows head-on; the tail trails and ripples
  const curl = (z) => (z > -0.5 ? Math.pow((z + 0.5) / 0.8, 1.7) * 0.7 : 0);
  const ripple = (z, t, seed) => Math.sin(z * 2.4 + t * 5 + seed) * 0.16 * (0.3 + (0.7 * (0.3 - z)) / 2.6);
  return (t, seed) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setXYZ(i, x + Math.sin(z * 1.3 - t * 3 + seed) * 0.05, curl(z) + ripple(z, t, seed), z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    face.position.y = curl(0.3) + 0.02 + ripple(0.3, t, seed);
    face.rotation.x = -1.1 - Math.cos(0.3 * 2.4 + t * 5 + seed) * 0.25;
    body.rotation.z = Math.sin(t * 1.2 + seed) * 0.12;
  };
}
