// rokurokubi.js — 轆轤首 lady in a kimono whose long neck sways and stretches
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube, addOutline } from '../toon.js';
import { once, white, ink, glowSprite } from './shared.js';

export function buildRokurokubi(body, seed) {
  const kimono = once('kimonoViolet', () => toon(0x4c2a72));
  const lining = once('kimonoLining', () => toon(0xd23a62));
  const obi = once('obiGold', () => toon(0xe8b04a, { emissive: 0x2a1800 }));
  const pale = once('paleSkin', () => toon(0xf7ede6, { emissive: 0x1a1018 }));
  const hair = once('hairBlack', () => toon(0x17121d));
  const lips = once('lips', () => toon(0xc8243a));
  const blush = once('blush', () => toon(0xf7c4cc));

  // kimono: a tall narrow robe that flares into a hem with no feet under it
  const sleeve = (sx) => [
    { geo: new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), mat: kimono, p: [sx * 0.24, 0.2, 0.04], r: [-0.3, 0, sx * 0.15] },
    { geo: new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), mat: kimono, p: [sx * 0.15, 0.04, 0.2], r: [Math.PI / 2, 0, sx * 0.9] },
    // the long furisode sleeve hanging from the forearm, red lining showing at its edge
    { geo: new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), mat: kimono, p: [sx * 0.2, -0.17, 0.18], s: [0.75, 1, 0.38], r: [0.1, 0, sx * 0.08] },
    { geo: new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), mat: lining, p: [sx * 0.2, -0.2, 0.17], s: [0.8, 1, 0.3], r: [0.1, 0, sx * 0.08] },
  ];
  body.add(bake([
    { geo: lathe([[0.32, -0.82], [0.3, -0.5], [0.24, -0.1], [0.24, 0.16], [0.2, 0.34], [0.1, 0.42]], 18), mat: kimono },
    { geo: lathe([[0.315, -0.86], [0.34, -0.8], [0.3, -0.7]], 18), mat: lining },
    { geo: new THREE.CylinderGeometry(0.255, 0.25, 0.2, 18), mat: obi, p: [0, 0.03, 0] },
    { geo: new THREE.TorusGeometry(0.258, 0.016, 6, 20), mat: lining, p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.SphereGeometry(0.13, 10, 8), mat: obi, p: [-0.13, 0.06, -0.26], s: [1, 0.7, 0.4], r: [0, 0, 0.4] },
    { geo: new THREE.SphereGeometry(0.13, 10, 8), mat: obi, p: [0.13, 0.06, -0.26], s: [1, 0.7, 0.4], r: [0, 0, -0.4] },
    // white under-collar crossing left over right
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [-0.05, 0.27, 0.205], r: [-0.35, 0, -0.45] },
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [0.05, 0.27, 0.205], r: [-0.35, 0, 0.45] },
    ...sleeve(-1), ...sleeve(1),
  ], { outline: 0.014 }));

  // the neck: a tube bent on the CPU every frame, so it can sway and stretch
  const neckBase = joint(body, 0, 0.38, 0);
  const neckGeo = new THREE.CylinderGeometry(0.042, 0.06, 1, 8, 22, true).translate(0, 0.5, 0);
  const base = neckGeo.attributes.position.array.slice();
  const neck = new THREE.Mesh(neckGeo, pale);
  neck.frustumCulled = false;
  addOutline(neck, 0.012);
  neckBase.add(neck);

  const head = joint(neckBase, 0, 1, 0);
  const pin = (x, a) => [
    { geo: new THREE.CylinderGeometry(0.008, 0.008, 0.34, 5), mat: obi, p: [x, 0.26, -0.03], r: [0, 0, a] },
    { geo: new THREE.SphereGeometry(0.024, 8, 6), mat: lining, p: [x - Math.sin(a) * 0.17, 0.26 + Math.cos(a) * 0.17, -0.03] },
  ];
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.17, 20, 16), mat: pale, p: [0, 0.08, 0], s: [0.92, 1.08, 0.95] },
    // shimada hair: a cap over crown and back, side wings, a big bun on top, a knot behind
    { geo: new THREE.SphereGeometry(0.182, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat: hair, p: [0, 0.09, -0.015], r: [-0.62, 0, 0], s: [0.96, 1.08, 1.0] },
    { geo: new THREE.SphereGeometry(0.1, 12, 10), mat: hair, p: [-0.16, 0.1, -0.03], s: [0.55, 0.95, 1] },
    { geo: new THREE.SphereGeometry(0.1, 12, 10), mat: hair, p: [0.16, 0.1, -0.03], s: [0.55, 0.95, 1] },
    { geo: new THREE.SphereGeometry(0.12, 14, 10), mat: hair, p: [0, 0.31, -0.04], s: [1.3, 0.72, 0.95] },
    { geo: new THREE.TorusGeometry(0.065, 0.035, 8, 14), mat: hair, p: [0, 0.36, 0.04], s: [1.2, 1, 1] },
    { geo: new THREE.SphereGeometry(0.1, 12, 10), mat: hair, p: [0, 0.02, -0.18], s: [1.1, 0.75, 0.8] },
    { geo: new THREE.BoxGeometry(0.17, 0.05, 0.025), mat: lining, p: [0, 0.27, 0.09], r: [-0.4, 0, 0] },
    ...pin(-0.02, 0.9), ...pin(0.02, -0.9),
    // a loose strand down one cheek
    { geo: taperedTube([[0.12, 0.2, 0.08], [0.15, 0.04, 0.12], [0.12, -0.12, 0.1], [0.15, -0.26, 0.06]], 0.016, { tip: 0.2 }), mat: hair },
  ], { outline: 0.012 }));
  // the face paint goes on without outlines, so it stays delicate
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.032, 10, 6), mat: ink(), p: [-0.062, 0.09, 0.152], s: [1.5, 0.42, 0.5], r: [0, 0, 0.3] },
    { geo: new THREE.SphereGeometry(0.032, 10, 6), mat: ink(), p: [0.062, 0.09, 0.152], s: [1.5, 0.42, 0.5], r: [0, 0, -0.3] },
    { geo: new THREE.SphereGeometry(0.022, 10, 6), mat: lips, p: [0, -0.03, 0.134], s: [1.4, 0.55, 0.45] },
    { geo: new THREE.SphereGeometry(0.024, 8, 6), mat: blush, p: [-0.095, -0.015, 0.104], s: [1.3, 0.5, 0.3] },
    { geo: new THREE.SphereGeometry(0.024, 8, 6), mat: blush, p: [0.095, -0.015, 0.104], s: [1.3, 0.5, 0.3] },
  ], { outline: 0 }));
  body.add(glowSprite(0xb06aff, 1.7, 0.26));
  const hemGlow = glowSprite(glow(0xc89aff, 1), 1, 0.5);
  hemGlow.position.y = -0.85;
  body.add(hemGlow);

  const pos = neckGeo.attributes.position;
  const bend = (u, t) => [0.2 * u * Math.sin(t * 1.3 + seed + u * 2.6), 0.16 * u * u + 0.05 * u * Math.sin(t * 1.9 + seed)];
  return (t) => {
    const H = 0.9 + 0.18 * Math.sin(t * 0.8 + seed);
    for (let i = 0; i < pos.count; i++) {
      const u = base[i * 3 + 1];
      const [ox, oz] = bend(u, t);
      pos.setXYZ(i, base[i * 3] + ox, u * H, base[i * 3 + 2] + oz);
    }
    pos.needsUpdate = true;
    neckGeo.computeVertexNormals();
    const [hx, hz] = bend(1, t), [px, pz] = bend(0.9, t);
    head.position.set(hx, H, hz);
    head.rotation.z = -Math.atan((hx - px) / (0.1 * H)) * 0.8;
    head.rotation.x = 0.05 - Math.atan((hz - pz) / (0.1 * H)) * 0.4;   // keep the face turned to you
    head.rotation.y = Math.sin(t * 0.7 + seed) * 0.4;
    body.rotation.z = Math.sin(t * 1.1 + seed) * 0.04;
  };
}
