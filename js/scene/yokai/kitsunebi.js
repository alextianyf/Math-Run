// kitsunebi.js — 狐火 floating fox mask trailing violet foxfire
import * as THREE from 'three';
import { toon, glow, bake } from '../toon.js';
import { once, ink, glowSprite, flameMaterial } from './shared.js';

export function buildKitsunebi(body, seed) {
  const bone = once('maskWhite', () => toon(0xfbf7ef));
  const red = once('maskRed', () => toon(0xd8322a));
  const mask = new THREE.Group();
  body.add(mask);
  mask.add(bake([
    { geo: new THREE.SphereGeometry(0.3, 20, 16), mat: bone, s: [0.85, 1.05, 0.45] },
    { geo: new THREE.ConeGeometry(0.1, 0.26, 8), mat: bone, p: [-0.2, 0.3, -0.02], r: [0, 0, 0.45] },
    { geo: new THREE.ConeGeometry(0.1, 0.26, 8), mat: bone, p: [0.2, 0.3, -0.02], r: [0, 0, -0.45] },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 8), mat: red, p: [-0.2, 0.3, 0.04], r: [0, 0, 0.45] },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 8), mat: red, p: [0.2, 0.3, 0.04], r: [0, 0, -0.45] },
    // slanted eyes, cheek strokes, a forehead mark and the nose
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: ink(), p: [-0.12, 0.07, 0.12], r: [0, 0, 0.35], s: [1, 0.3, 0.3] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: ink(), p: [0.12, 0.07, 0.12], r: [0, 0, -0.35], s: [1, 0.3, 0.3] },
    { geo: new THREE.BoxGeometry(0.14, 0.025, 0.02), mat: red, p: [-0.18, -0.03, 0.11], r: [0, 0.6, 0.5] },
    { geo: new THREE.BoxGeometry(0.14, 0.025, 0.02), mat: red, p: [0.18, -0.03, 0.11], r: [0, -0.6, -0.5] },
    { geo: new THREE.ConeGeometry(0.035, 0.12, 6), mat: red, p: [0, 0.2, 0.13], r: [Math.PI, 0, 0] },
    { geo: new THREE.SphereGeometry(0.035, 8, 6), mat: ink(), p: [0, -0.16, 0.13] },
  ], { outline: 0.012 }));
  // foxfire: the flame shader in violet — one behind the mask, two smaller at its sides
  const flames = [[0, -0.1, -0.12, 1.15], [-0.42, -0.25, -0.05, 0.6], [0.42, -0.25, -0.05, 0.6]].map(([x, y, z, sc], i) => {
    const m = flameMaterial(seed + i * 3);
    m.uniforms.cCore.value = glow(0xffffff, 1.3);
    m.uniforms.cMid.value = glow(0xa98cff, 1.1);
    m.uniforms.cEdge.value = glow(0x5a2dff, 0.8);
    const f = new THREE.Mesh(once('flamePlane', () => new THREE.PlaneGeometry(1.25, 1.8)), m);
    f.position.set(x, y + 0.3 * sc, z);
    f.scale.setScalar(sc);
    body.add(f);
    return f;
  });
  body.add(glowSprite(0x7a5aff, 2, 0.35));
  const wisps = [0, 1, 2].map(() => { const w = glowSprite(glow(0xc4b0ff, 1.4), 0.22, 1); body.add(w); return w; });
  return (t) => {
    for (const f of flames) if (f.material.uniforms) f.material.uniforms.time.value = t;
    mask.rotation.z = Math.sin(t * 1.4 + seed) * 0.12;
    mask.rotation.y = Math.sin(t * 0.7 + seed) * 0.3;
    mask.position.y = Math.sin(t * 3 + seed) * 0.04;
    wisps.forEach((w, i) => {
      const a = t * 1.8 + (i * Math.PI * 2) / 3 + seed;
      w.position.set(Math.cos(a) * 0.6, -0.1 + Math.sin(a * 1.4) * 0.25, Math.sin(a) * 0.5);
    });
  };
}
