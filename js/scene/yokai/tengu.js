// tengu.js — 烏天狗 crow-beaked mountain goblin, beating its wings, leaf fan in hand
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube } from '../toon.js';
import { once, ink, darkWood, skin, maw, glowSprite, extrude } from './shared.js';

// a wing in the xy plane reaching out along sx: a curved leading edge and a scalloped
// trailing edge of primaries. Extruded thin, so the outline shell works on it.
function wingShape(sx, span, tips) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.bezierCurveTo(sx * span * 0.27, 0.34, sx * span * 0.68, 0.38, sx * span, 0.12);
  let [px, py] = [span, 0.12];
  for (const [x, y] of tips) {
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    s.quadraticCurveTo(sx * (px + (mx - px) * 0.2), py - 0.02, sx * (mx - 0.05), my + 0.07);   // notch
    s.quadraticCurveTo(sx * (x + 0.06), y - 0.02, sx * x, y);                                  // feather tip
    [px, py] = [x, y];
  }
  s.quadraticCurveTo(sx * px * 0.4, py * 0.4, 0, -0.06);
  return s;
}

export function buildTengu(body, seed) {
  const robe = once('tenguRobe', () => toon(0xebe4d4));
  const hakama = once('tenguHakama', () => toon(0x2f3566));
  const feather = once('feather', () => toon(0x1d2034));
  const feather2 = once('feather2', () => toon(0x3b4677));
  const beak = once('tenguBeak', () => toon(0xf2b234, { emissive: 0x3a2000 }));
  const pom = once('bonten', () => toon(0xff7a2a, { emissive: 0x4a1200 }));
  const red = once('maskRed', () => toon(0xd8322a));
  const eyeGlow = once('tenguEye', () => new THREE.MeshBasicMaterial({ color: glow(0xffd23a, 1.7) }));
  const leaf = once('yatsude', () => toon(0x5f9a3c, { side: THREE.DoubleSide }));

  const torso = new THREE.Group();
  body.add(torso);
  const sleeve = (sx) => ({
    geo: lathe([[0.05, 0.02], [0.1, -0.1], [0.13, -0.26], [0.1, -0.28]], 12),
    mat: robe,
    p: [sx * 0.25, 0.22, 0.03],
    r: [0.15, 0, sx * 0.35],
  });
  torso.add(bake([
    // yamabushi robe over wide hakama, the sash with its six orange pompoms
    { geo: lathe([[0.1, 0.32], [0.2, 0.27], [0.24, 0.06], [0.22, -0.14]], 16), mat: robe },
    { geo: lathe([[0.2, -0.1], [0.28, -0.34], [0.35, -0.6], [0.32, -0.64], [0.18, -0.62]], 16), mat: hakama },
    { geo: new THREE.TorusGeometry(0.225, 0.03, 6, 20), mat: hakama, p: [0, -0.12, 0], r: [Math.PI / 2, 0, 0] },
    // the yuigesa: a dark stole down the chest carrying the orange pompoms
    ...[-1, 1].map(
      (sx) => ({
        geo: new THREE.BoxGeometry(0.06, 0.4, 0.03),
        mat: feather2,
        p: [sx * 0.085, 0.08, 0.22],
        r: [-0.12, 0, -sx * 0.12],
      })
    ),
    ...[[-0.1, 0.2], [0.1, 0.2], [-0.085, 0.06], [0.085, 0.06], [-0.07, -0.07], [0.07, -0.07]].map(([x, y]) =>
      ({ geo: new THREE.IcosahedronGeometry(0.042, 1), mat: pom, p: [x, y, 0.25] })),
    sleeve(-1), sleeve(1),
    ...[-1, 1].map(
      (sx) => ({
        geo: new THREE.TorusGeometry(0.11, 0.02, 5, 14),
        mat: hakama,
        p: [sx * 0.33, -0.02, 0.07],
        r: [Math.PI / 2 + 0.15, 0, sx * 0.35],
      })
    ),
    // one-tooth geta peeping out under the hakama
    ...[-0.12, 0.12].flatMap((x) => [
      { geo: new THREE.BoxGeometry(0.11, 0.035, 0.24), mat: darkWood(), p: [x, -0.7, 0.04] },
      { geo: new THREE.BoxGeometry(0.03, 0.09, 0.12), mat: darkWood(), p: [x, -0.76, 0.04] },
    ]),
  ], { outline: 0.014 }));

  // crow head: feathered skull, swept-back crest, a long hooked beak, glaring eyes, the tokin cap
  const head = joint(torso, 0, 0.47, 0.02);
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.19, 18, 14), mat: feather, s: [0.95, 0.95, 1.12] },
    { geo: new THREE.SphereGeometry(0.11, 12, 10), mat: feather, p: [0, -0.12, 0.02], s: [1.2, 0.9, 1.1] },   // throat ruff
    ...[-0.07, 0, 0.07].map(
      (x) => ({
        geo: taperedTube([[x, 0.1, -0.12], [x * 1.4, 0.18, -0.26], [x * 2, 0.16, -0.42]], 0.06, { tip: 0.1 }),
        mat: feather,
      })
    ),
    {
      geo: taperedTube(
        [[0, 0.05, 0.13], [0, 0.03, 0.29], [0, -0.06, 0.4], [0, -0.2, 0.43]],
        0.085,
        { tip: 0.03, segments: 16 }
      ),
      mat: beak,
      s: [0.9, 1, 1],
    },
    { geo: new THREE.CylinderGeometry(0.045, 0.07, 0.07, 10), mat: darkWood(), p: [0, 0.2, 0.08], r: [0.45, 0, 0] },
    {
      geo: new THREE.SphereGeometry(0.05, 10, 8),
      mat: eyeGlow,
      p: [-0.09, 0.06, 0.165],
      s: [1.2, 0.75, 0.5],
      r: [0, 0, -0.25],
    },
    {
      geo: new THREE.SphereGeometry(0.05, 10, 8),
      mat: eyeGlow,
      p: [0.09, 0.06, 0.165],
      s: [1.2, 0.75, 0.5],
      r: [0, 0, 0.25],
    },
    { geo: new THREE.SphereGeometry(0.018, 8, 6), mat: ink(), p: [-0.085, 0.06, 0.19], s: [0.6, 1.4, 0.5] },
    { geo: new THREE.SphereGeometry(0.018, 8, 6), mat: ink(), p: [0.085, 0.06, 0.19], s: [0.6, 1.4, 0.5] },
    // red kumadori strokes over the eyes give it the scowl
    { geo: new THREE.CapsuleGeometry(0.018, 0.1, 4, 6), mat: red, p: [-0.09, 0.12, 0.16], r: [0, 0, 1.25] },
    { geo: new THREE.CapsuleGeometry(0.018, 0.1, 4, 6), mat: red, p: [0.09, 0.12, 0.16], r: [0, 0, -1.25] },
  ], { outline: 0.012 }));
  const jaw = joint(head, 0, -0.04, 0.14);
  jaw.add(bake([
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: maw(), p: [0, 0.02, 0.06], s: [1, 0.5, 1.4] },
    {
      geo: taperedTube([[0, 0, 0], [0, -0.04, 0.12], [0, -0.1, 0.2]], 0.055, { tip: 0.05 }),
      mat: beak,
      s: [0.85, 0.8, 1],
    },
  ], { outline: 0.01 }));

  // the wings: dark primaries with lighter coverts on the front face
  const wings = [-1, 1].map((sx) => {
    const j = joint(torso, sx * 0.14, 0.24, -0.2);
    j.add(bake([
      {
        geo: extrude(
          wingShape(sx, 1.1, [[1.06, -0.1], [0.92, -0.27], [0.75, -0.37], [0.56, -0.41], [0.37, -0.37], [0.19, -0.27]]),
          0.035
        ),
        mat: feather,
      },
      {
        geo: extrude(wingShape(sx, 0.8, [[0.7, -0.02], [0.54, -0.1], [0.37, -0.13], [0.2, -0.09]]), 0.03),
        mat: feather2,
        p: [0, 0.02, 0.03],
      },
    ], { outline: 0.012 }));
    j.scale.setScalar(1.05);
    return j;
  });

  // a yatsude-leaf fan in the right hand
  const fan = joint(torso, 0.34, -0.04, 0.14);
  const fs = new THREE.Shape();
  for (let i = 0; i <= 18; i++) {
    const a = -Math.PI * 0.95 + (i / 18) * Math.PI * 1.9;
    const r = i % 2 ? 0.1 : 0.2;
    const x = Math.sin(a) * r;
    const y = 0.12 + Math.cos(a) * r;
    if (i === 0) fs.moveTo(x, y);
    else fs.quadraticCurveTo(Math.sin(a - 0.08) * r * 1.05, 0.12 + Math.cos(a - 0.08) * r * 1.05, x, y);
  }
  fan.add(bake([
    { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: skin() },
    { geo: new THREE.CylinderGeometry(0.014, 0.014, 0.18, 5), mat: darkWood(), p: [0, 0.06, 0] },
    { geo: extrude(fs, 0.02), mat: leaf, p: [0, 0.07, 0] },
  ], { outline: 0.01 }));

  body.add(glowSprite(0x6a7aff, 1.9, 0.26));
  return (t, s, self) => {
    const ph = t * 6 + seed;
    const flap = 0.1 + 0.55 * Math.sin(ph);
    wings[0].rotation.set(0, -0.45, -flap);
    wings[1].rotation.set(0, 0.45, flap);
    self.hop = (0.5 - 0.5 * Math.sin(ph - 0.9)) * 0.12;          // lifted by each downstroke
    torso.rotation.x = 0.06 * Math.sin(ph - 0.9);
    head.rotation.y = Math.sin(t * 0.9 + seed) * 0.35;
    head.rotation.z = Math.sin(t * 1.7 + seed) * 0.1;
    jaw.rotation.x = Math.max(0, Math.sin(t * 2.3 + seed) - 0.6) * 0.9;   // a caw now and then
    fan.rotation.z = -0.3 + Math.sin(t * 2.4 + seed) * 0.35;
  };
}
