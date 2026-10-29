// lanterns.js — the festival lantern strings and the stone lanterns.
import * as THREE from 'three';
import { toon, glow, place, lathe } from '../toon.js';
import { NEAR, GAP, SPAN, merge, instanced, Scroller, canvasTexture } from './shared.js';

export function buildLanternStrings(scene) {
  const SAG = 0.55, TOP = 3.9, PER = 4;
  const ropeY = (t) => TOP - SAG * 4 * t * (1 - t);

  const post = merge([
    place(new THREE.CylinderGeometry(0.06, 0.075, 4.05, 8), [0, 2.02, 0]),
    place(new THREE.BoxGeometry(0.2, 0.08, 0.2), [0, 4.06, 0]),
  ]);
  const ropePts = [];
  for (let i = 0; i <= 8; i++) ropePts.push([0, ropeY(i / 8), -GAP * (i / 8)]);
  const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts.map((p) => new THREE.Vector3(...p))), 24, 0.014, 5);

  // paper lantern with ribs, as a single unlit glowing body + dark caps
  const ribs = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,20,10,0.35)';
    for (let y = 6; y < h; y += 10) g.fillRect(0, y, w, 2);
  });
  const body = lathe([[0.07, -0.17], [0.125, -0.12], [0.145, 0], [0.125, 0.12], [0.07, 0.17]], 14);
  const caps = merge([
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), [0, 0.185, 0]),
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), [0, -0.185, 0]),
    place(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4), [0, 0.27, 0]),
  ]);

  const spans = SPAN / GAP;
  const postMesh = instanced(post, toon(0x2a1d1a), spans * 2);
  const ropeMesh = instanced(rope, toon(0x2a1d1a), spans * 2);
  const bodyMesh = instanced(body, new THREE.MeshBasicMaterial({ map: ribs, color: glow(0xffffff, 1.6) }), spans * 2 * PER);
  const capMesh = instanced(caps, toon(0x17121a), spans * 2 * PER);
  scene.add(postMesh, ropeMesh, bodyMesh, capMesh);

  const red = new THREE.Color(0xff4a22), warm = new THREE.Color(0xffd9a0);
  const spanItems = [], lanternItems = [];
  for (let i = 0; i < spans; i++) {
    for (const sx of [-1, 1]) {
      const z0 = NEAR - i * GAP;
      spanItems.push({ x: sx * 3.45, z: z0 });
      for (let j = 1; j <= PER; j++) {
        const t = j / (PER + 1);
        lanternItems.push({ x: sx * 3.45, y: ropeY(t) - 0.34, z: z0 - GAP * t });
        bodyMesh.setColorAt(lanternItems.length - 1, (i * 7 + j) % 5 === 0 ? warm : red);
      }
    }
  }
  bodyMesh.instanceColor.needsUpdate = true;
  const spanScroll = new Scroller([postMesh, ropeMesh], spanItems);
  const lanternScroll = new Scroller([bodyMesh, capMesh], lanternItems);
  return {
    step(dz, t) {
      spanScroll.step(dz);
      // a gentle swing: rotate each lantern a little around y (cheap, reads as motion)
      lanternItems.forEach((it, i) => { it.ry = Math.sin(t * 1.3 + i) * 0.4; });
      lanternScroll.step(dz);
    },
  };
}

export function buildStoneLanterns(scene) {
  const stone = merge([
    place(lathe([[0.36, 0], [0.34, 0.12], [0.2, 0.18], [0.12, 0.22]], 6), [0, 0, 0]),
    place(new THREE.CylinderGeometry(0.1, 0.12, 0.75, 8), [0, 0.58, 0]),
    place(new THREE.CylinderGeometry(0.34, 0.26, 0.12, 6), [0, 1.0, 0]),
    place(lathe([[0.5, 0], [0.42, 0.08], [0.18, 0.28], [0.06, 0.34], [0, 0.36]], 6), [0, 1.43, 0]),
    place(new THREE.SphereGeometry(0.08, 8, 6), [0, 1.84, 0]),
  ]);
  const fire = place(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 6), [0, 1.24, 0]);
  const count = 13;
  const stoneMesh = instanced(stone, toon(0x8a8398), count);
  const fireMesh = instanced(fire, new THREE.MeshBasicMaterial({ color: glow(0xffb45a, 2.2) }), count);
  scene.add(stoneMesh, fireMesh);
  const items = Array.from({ length: count }, (_, i) => ({ x: (i % 2 ? 1 : -1) * 4.4, z: NEAR - 3 - i * GAP, ry: Math.PI / 6 }));
  return new Scroller([stoneMesh, fireMesh], items);
}
