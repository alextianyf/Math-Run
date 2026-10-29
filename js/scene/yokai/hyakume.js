// hyakume.js — 百目 a lump covered in eyes, rolls along
import * as THREE from 'three';
import { toon, bake, joint } from '../toon.js';
import { once, white, ink, maw, eyeParts, glowSprite } from './shared.js';

export function buildHyakume(body) {
  const flesh = once('flesh', () => toon(0xc98f74));
  const iris = once('irisRed', () => toon(0x6a1a1a));
  const blob = new THREE.Group();
  body.add(blob);
  // eyes all over the upper body, each turned to look straight out of the surface
  const parts = [
    { geo: new THREE.SphereGeometry(0.48, 24, 18), mat: flesh, s: [1, 0.95, 0.95] },
    { geo: new THREE.SphereGeometry(0.1, 12, 8), mat: maw(), p: [0, -0.22, 0.42], s: [1.6, 0.35, 0.4] },
  ];
  const n = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), out = new THREE.Vector3(0, 0, 1);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const y = 0.92 - (i / (N - 1)) * 1.3;                     // a spiral down the sphere, skipping the underside
    const r = Math.sqrt(1 - y * y), a = i * 2.39996;
    n.set(Math.cos(a) * r, y, Math.sin(a) * r);
    if (n.z > 0.75 && Math.abs(n.x) < 0.3) continue;         // leave room for the two big ones
    e.setFromQuaternion(q.setFromUnitVectors(out, n));
    const size = 0.06 + ((i * 7) % 5) * 0.008;
    parts.push({ geo: new THREE.SphereGeometry(size, 12, 8), mat: white(), p: [n.x * 0.45, n.y * 0.43, n.z * 0.43], r: [e.x, e.y, e.z], s: [1, 1, 0.5] });
    parts.push({ geo: new THREE.SphereGeometry(size * 0.5, 10, 8), mat: iris, p: [n.x * 0.475, n.y * 0.452, n.z * 0.452], r: [e.x, e.y, e.z], s: [1, 1, 0.4] });
    parts.push({ geo: new THREE.SphereGeometry(size * 0.25, 8, 6), mat: ink(), p: [n.x * 0.49, n.y * 0.466, n.z * 0.466], r: [e.x, e.y, e.z], s: [1, 1, 0.4] });
  }
  blob.add(bake(parts, { outline: 0.014 }));
  // the two big front eyes blink
  const bigEyes = [-0.16, 0.16].map((x) => {
    const j = joint(blob, x, 0.08, 0.42);
    j.add(bake(eyeParts(0, 0, 0, 0.1, iris, 1.1), { outline: 0.01 }));
    return j;
  });
  body.add(bake([
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: flesh, p: [-0.18, -0.5, 0.08], s: [1.1, 0.4, 1.4] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: flesh, p: [0.18, -0.5, 0.08], s: [1.1, 0.4, 1.4] },
  ], { outline: 0.012 }));
  body.add(glowSprite(0xffb07a, 1.9, 0.22));
  return (t, seed, self) => {
    const k = Math.abs(Math.sin(t * 2.2 + seed));
    self.hop = k * 0.18;
    blob.scale.set(1 + (1 - k) * 0.06, 1 - (1 - k) * 0.08, 1 + (1 - k) * 0.06);
    blob.rotation.y = Math.sin(t * 0.9 + seed) * 0.35;
    blob.rotation.z = Math.sin(t * 2.2 + seed) * 0.06;
    const blink = (t + seed * 0.7) % 2.7 < 0.12;
    for (const j of bigEyes) j.scale.y = blink ? 0.1 : 1;
  };
}
