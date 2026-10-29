// onibi.js — 鬼火 will-o'-wisp with a shader flame
import * as THREE from 'three';
import { glow } from '../toon.js';
import { once, ink, glowSprite, flameMaterial } from './shared.js';

export function buildOnibi(body, seed) {
  const flame = new THREE.Mesh(once('flamePlane', () => new THREE.PlaneGeometry(1.25, 1.8)), flameMaterial(seed));
  flame.position.y = 0.36;
  body.add(flame);
  body.add(new THREE.Mesh(once('orb', () => new THREE.SphereGeometry(0.19, 20, 14)),
    once('orbMat', () => new THREE.MeshBasicMaterial({ color: glow(0xbfeaff, 1.1) }))));
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(once('dotEye', () => new THREE.SphereGeometry(0.034, 10, 8)), ink());
    e.position.set(sx * 0.065, 0.02, 0.18); e.scale.set(0.85, 1.4, 0.5);
    body.add(e);
  }
  const halo = glowSprite(0x2f8dff, 1.8, 0.35);
  body.add(halo);
  const sparks = [0, 1].map(() => { const s = glowSprite(glow(0x9fe4ff, 1.4), 0.2, 1); body.add(s); return s; });
  return (t) => {
    if (flame.material.uniforms) flame.material.uniforms.time.value = t;   // a bestiary silhouette has a plain material
    halo.material.opacity = 0.3 + 0.08 * Math.sin(t * 6 + seed);
    sparks.forEach((s, i) => {
      const a = t * 2.2 + i * Math.PI + seed;
      s.position.set(Math.cos(a) * 0.42, 0.1 + Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.42);
    });
  };
}
