// head.js — the oni's head: heavy brow, deep-set glowing eyes, broad nose, a mane like
// black flame, ridged horns, and a lower jaw with tusks that opens to roar and laugh.
import * as THREE from 'three';
import { bake, joint, loft, taperedTube } from '../toon.js';
import { glowTex } from '../textures.js';
import { HEAD_SCALE } from './body.js';

// loft rows: [y, rx, rz, cz, front exponent]
const rows = (list) => list.map(([y, rx, rz, cz, e]) => ({ y, rx, rz, cz, e: 2, ef: e }));

// M: the oni's materials (index.js)
export function buildHead(M) {
  const head = new THREE.Group();
  head.scale.setScalar(HEAD_SCALE);
  // the mane: a cap of hair over the skull, bristling with tapered locks that flare out
  // and up like black flame, the lower ones falling heavily over the neck and shoulders
  const mane = [{ geo: new THREE.SphereGeometry(0.5, 20, 14), mat: M.hair, p: [0, 0.32, -0.13], s: [1.04, 1.04, 1] }];
  const skull = new THREE.Vector3(0, 0.32, -0.13);
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3();
  for (let i = 0; i < 44; i++) {
    const u = ((i * 7) % 11) / 10, v = ((i * 5) % 9) / 8;          // pseudo-random per lock
    const az = (i / 43 - 0.5) * 4.4;                                 // around the back (0 = straight back)
    const el = -0.7 + v * 1.9 - Math.abs(az) * 0.1;                  // from the nape up over the crown
    d.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    a0.copy(skull).addScaledVector(d, 0.42);
    const fall = el < 0.1 ? 0.3 + u * 0.2 : -0.12 - v * 0.1;        // low locks hang, high ones flick up
    a1.copy(a0).addScaledVector(d, 0.2 + u * 0.06).addScaledVector(up, -fall * 0.35);
    a2.copy(a0).addScaledVector(d, 0.34 + u * 0.12).addScaledVector(up, -fall);
    mane.push({ geo: taperedTube([a0.toArray(), a1.toArray(), a2.toArray()], 0.1 + v * 0.05, { tip: 0.06, segments: 8, radial: 7 }), mat: M.hair });
  }
  for (const [x, lean] of [[-0.16, -0.6], [0.0, 0], [0.15, 0.55]]) {
    mane.push({ geo: taperedTube([[x, 0.7, -0.06], [x * 1.8 + lean * 0.12, 1.02, -0.22], [x * 2.6 + lean * 0.32, 1.18, -0.5]], 0.11, { tip: 0.06, swell: 0.25 }), mat: M.hair });
  }
  // sideburns sweeping back past the ears
  for (const sx of [-1, 1]) {
    mane.push({ geo: taperedTube([[sx * 0.44, 0.34, 0.12], [sx * 0.52, 0.12, 0.1], [sx * 0.62, -0.08, -0.04]], 0.09, { tip: 0.1, segments: 8 }), mat: M.hair });
    mane.push({ geo: taperedTube([[sx * 0.46, 0.2, 0.16], [sx * 0.5, -0.02, 0.18], [sx * 0.56, -0.2, 0.08]], 0.075, { tip: 0.1, segments: 8 }), mat: M.hair });
  }
  // thick ridged horns, curving out and then forward, banded dark near the root
  const horn = (sx) => {
    const pts = [[sx * 0.2, 0.5, 0.08], [sx * 0.4, 0.78, 0.02], [sx * 0.5, 1.03, 0.1], [sx * 0.42, 1.24, 0.3]];
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const parts = [{ geo: taperedTube(pts, 0.17, { tip: 0.04, segments: 18, radial: 10 }), mat: M.horn }];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), z = new THREE.Vector3(0, 0, 1);
    for (const t of [0.06, 0.17, 0.28, 0.39]) {
      const c = curve.getPointAt(t), tan = curve.getTangentAt(t);
      e.setFromQuaternion(q.setFromUnitVectors(z, tan));
      parts.push({ geo: new THREE.TorusGeometry(0.17 * (1 - 0.96 * t) * 0.98, 0.026 - t * 0.03, 6, 18), mat: M.hornDark, p: c.toArray(), r: [e.x, e.y, e.z] });
    }
    return parts;
  };
  const lip = (a, inset = 0) => [0.4 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.8), 0.18 + (0.33 - inset) * Math.pow(Math.cos(a), 0.8)];
  head.add(bake([
    { geo: loft(rows([
      [0.8, 0.06, 0.06, -0.05], [0.75, 0.26, 0.28, -0.05], [0.63, 0.41, 0.41, -0.04, 2.2], [0.47, 0.48, 0.46, 0.0, 2.4],
      [0.35, 0.5, 0.44, 0.03, 2.6], [0.22, 0.49, 0.42, 0.07, 2.6], [0.1, 0.48, 0.4, 0.11, 2.5], [-0.02, 0.45, 0.37, 0.15, 2.5],
      [-0.1, 0.41, 0.33, 0.18, 2.5], [-0.15, 0.35, 0.27, 0.2, 2.4],
    ]), { segs: 32, front: 1 }), mat: M.skin },
    // a heavy brow ridge knotted into a scowl, bushy eyebrows flaring up at the ends
    { geo: new THREE.SphereGeometry(0.27, 16, 12), mat: M.skin, p: [-0.21, 0.37, 0.4], s: [1, 0.46, 0.66] },
    { geo: new THREE.SphereGeometry(0.27, 16, 12), mat: M.skin, p: [0.21, 0.37, 0.4], s: [1, 0.46, 0.66] },
    { geo: taperedTube([[-0.05, 0.31, 0.55], [-0.22, 0.4, 0.53], [-0.4, 0.5, 0.42], [-0.5, 0.62, 0.3]], 0.065, { tip: 0.2, swell: 0.35 }), mat: M.hair },
    { geo: taperedTube([[0.05, 0.31, 0.55], [0.22, 0.4, 0.53], [0.4, 0.5, 0.42], [0.5, 0.62, 0.3]], 0.065, { tip: 0.2, swell: 0.35 }), mat: M.hair },
    // eye sockets (dark), cheekbones
    { geo: new THREE.SphereGeometry(0.17, 14, 10), mat: M.mouth, p: [-0.2, 0.21, 0.44], s: [1, 0.7, 0.3] },
    { geo: new THREE.SphereGeometry(0.17, 14, 10), mat: M.mouth, p: [0.2, 0.21, 0.44], s: [1, 0.7, 0.3] },
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [-0.36, 0.08, 0.36], s: [1, 0.8, 0.8] },
    { geo: new THREE.SphereGeometry(0.16, 12, 10), mat: M.skin, p: [0.36, 0.08, 0.36], s: [1, 0.8, 0.8] },
    // broad flat nose with nostrils
    { geo: new THREE.SphereGeometry(0.15, 14, 10), mat: M.skin, p: [0, 0.03, 0.49], s: [1.5, 0.8, 0.9] },
    { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: M.mouth, p: [-0.1, -0.07, 0.56], s: [1.2, 0.7, 0.7] },
    { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: M.mouth, p: [0.1, -0.07, 0.56], s: [1.2, 0.7, 0.7] },
    // pointed ears with gold rings
    { geo: new THREE.ConeGeometry(0.1, 0.3, 8), mat: M.skin, p: [-0.5, 0.3, -0.02], r: [0, 0, 1.2] },
    { geo: new THREE.ConeGeometry(0.1, 0.3, 8), mat: M.skin, p: [0.5, 0.3, -0.02], r: [0, 0, -1.2] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 14), mat: M.gold, p: [-0.5, 0.1, 0.0], r: [0, Math.PI / 2, 0] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 14), mat: M.gold, p: [0.5, 0.1, 0.0], r: [0, Math.PI / 2, 0] },
    ...horn(-1), ...horn(1),
    // snarl lines beside the nose
    { geo: new THREE.CapsuleGeometry(0.022, 0.12, 4, 6), mat: M.skin, p: [-0.19, 0.0, 0.5], r: [0.2, 0, -0.5] },
    { geo: new THREE.CapsuleGeometry(0.022, 0.12, 4, 6), mat: M.skin, p: [0.19, 0.0, 0.5], r: [0.2, 0, 0.5] },
    // upper teeth along the lip, and the dark mouth cavity behind them
    ...[-0.95, -0.62, -0.32, 0, 0.32, 0.62, 0.95].map((a) => {
      const [x, z] = lip(a, 0.04);
      return { geo: new THREE.ConeGeometry(0.038, 0.11, 6), mat: M.teeth, p: [x, -0.17, z], r: [Math.PI, 0, 0] };
    }),
    { geo: new THREE.SphereGeometry(0.33, 16, 12), mat: M.mouth, p: [0, -0.1, 0.16], s: [1, 0.55, 0.95] },
    ...mane,
  ], { outline: 0.024 }));
  // glowing eyes under the brow (no outline, so they burn), each with a soft halo
  const eyeGlow = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa020, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), M.eye);
    eye.position.set(sx * 0.2, 0.22, 0.465); eye.scale.set(0.95, 0.55, 0.4); eye.rotation.z = sx * 0.22;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.pupil);
    pupil.position.set(sx * 0.19, 0.215, 0.51); pupil.scale.set(0.9, 2.2, 0.6);
    const halo = new THREE.Sprite(eyeGlow);
    halo.position.set(sx * 0.2, 0.22, 0.55); halo.scale.setScalar(0.42);
    head.add(eye, pupil, halo);
  }
  // lower jaw (opens to roar/laugh): heavy and jutting, with two tusks
  const jaw = joint(head, 0, -0.12, 0.06);
  jaw.add(bake([
    { geo: loft(rows([
      [0.0, 0.38, 0.35, 0.1, 2.6], [-0.1, 0.39, 0.36, 0.1, 2.8], [-0.21, 0.35, 0.33, 0.08, 2.4], [-0.29, 0.24, 0.23, 0.02], [-0.32, 0.05, 0.05, 0.0],
    ]), { segs: 28, front: 1 }), mat: M.skin },
    { geo: new THREE.CircleGeometry(0.36, 24), mat: M.mouth, p: [0, 0.005, 0.09], r: [-Math.PI / 2, 0, 0], s: [1, 0.95, 1] },
    // great curved tusks jutting up over the lip
    { geo: taperedTube([[-0.25, -0.04, 0.3], [-0.29, 0.14, 0.36], [-0.25, 0.32, 0.34], [-0.19, 0.42, 0.3]], 0.068, { tip: 0.12, segments: 10 }), mat: M.teeth },
    { geo: taperedTube([[0.25, -0.04, 0.3], [0.29, 0.14, 0.36], [0.25, 0.32, 0.34], [0.19, 0.42, 0.3]], 0.068, { tip: 0.12, segments: 10 }), mat: M.teeth },
    ...[-0.1, 0, 0.1].map((x) => ({ geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: M.teeth, p: [x, 0.03, 0.4] })),
  ], { outline: 0.02 }));
  return { head, jaw };
}
