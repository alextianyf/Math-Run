// oni.js — the red oni (赤鬼) of the old pictures, boss of the parade and the one who
// catches you. Faces +z (toward the hero).
//
// The body is a real skinned character: the hero's VRM (models/hero.vrm, VRoid's CC0
// sample) loaded a second time, stripped to its bare body and re-sculpted into a brute
// at load time — every vertex is pushed out along its bones (a broad deep chest, thick
// arms and hands, heavy long legs, a short thick neck) and the skeleton is re-bound to
// the new proportions. The head is our own procedural oni head (mane, ridged horns,
// glowing eyes, tusks) sitting on the head bone; the tiger pelt with its rope belt,
// iron bracers and anklets and the studded kanabō ride on their bones too.
//
// Poses drive the humanoid bones directly (VRoid's bones all have identity rest
// rotations, so no VRM runtime is needed): walk, roar, stagger, reach, grab, lift, laugh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { toon, glow, bake, joint, lathe, taperedTube, loft, addOutline } from './toon.js';
import { tigerTex, glowTex } from './textures.js';

const lerp = (a, b, k) => a + (b - a) * k;

/* ===================== the body template ===================== */
// Oni units: the frame the procedural parts are built in (old oni scale, horn tips at
// y ≈ 4.15). The VRM is scaled so its head bone lands under the procedural head.
const HEAD_SCALE = 0.75;
const HEAD_Y = 3.22;                        // procedural head origin: horn tips at 3.22 + 1.24 · 0.75 ≈ 4.15
const HEAD_ABOVE_BONE = 0.26;                // ... above the VRM head bone

// Bulk per bone: how much each bone's own segment is stretched along the model's axes
// (x across, y up, z front-back; the model is in T-pose, so every segment is axis
// aligned). Children are re-placed at the stretched ends of their parents, so the
// skeleton grows with the flesh. Right-side bones use the left-side entries.
const BULK = {
  J_Bip_C_Hips: [1.7, 1.0, 1.6],
  J_Bip_C_Spine: [2.8, 1.1, 2.5],            // a thick waist and belly
  J_Bip_C_Chest: [3.3, 1.05, 2.5],
  J_Bip_C_UpperChest: [3.8, 1.0, 2.45],
  J_Bip_C_Neck: [3.4, 0.5, 3.0],               // a bull neck: trapezius mass under the head
  J_Bip_C_Head: [3.4, 0.6, 3.0],
  J_Bip_L_Shoulder: [3.5, 3.3, 2.9],           // long collarbones (broad shoulders), heavy traps
  J_Bip_L_UpperArm: [1.35, 3.5, 3.3],
  J_Bip_L_LowerArm: [1.3, 3.2, 3.0],
  J_Bip_L_Hand: [1.5, 2.6, 2.5],
  J_Bip_L_UpperLeg: [2.3, 1.0, 2.5],
  J_Bip_L_LowerLeg: [2.25, 1.0, 2.3],
  J_Bip_L_Foot: [2.0, 1.5, 1.6],
};

let template = null;
const templateReady = new GLTFLoader().loadAsync('./models/hero.vrm')
  .then((gltf) => { template = buildTemplate(gltf.scene); return template; })
  .catch((err) => { console.error('[math-run] oni body failed to load', err); return null; });

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const _hx = new THREE.Vector3();
const _hy = new THREE.Vector3();
const _hz = new THREE.Vector3();
const _hm = new THREE.Matrix4();

function buildTemplate(scene) {
  // keep the bare body, drop face, eyes, hair and clothes
  const meshes = [], drop = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh && /Body_00_SKIN/.test([].concat(o.material)[0].name)) meshes.push(o);
    else drop.push(o);
  });
  for (const o of drop) { o.removeFromParent(); o.geometry.dispose(); }
  scene.updateMatrixWorld(true);

  // per-bone stretch, and the bones' old and new rest positions (model space)
  const bones = [];
  scene.traverse((o) => { if (o.isBone) bones.push(o); });       // parents before children
  const S = new Map(), oldP = new Map(), newP = new Map();
  for (const b of bones) {
    const s = BULK[b.name.replace('_R_', '_L_')];
    S.set(b, s ? new THREE.Vector3(...s) : b.parent?.isBone ? S.get(b.parent) : new THREE.Vector3(1, 1, 1));
    oldP.set(b, b.getWorldPosition(new THREE.Vector3()));
  }
  for (const b of bones) {
    const p = b.parent?.isBone ? b.parent : null;
    newP.set(b, p ? oldP.get(b).clone().sub(oldP.get(p)).multiply(S.get(p)).add(newP.get(p)) : oldP.get(b).clone());
  }

  // Each skin relates bind space to the scene by C = boneWorld · boneInverse (the same
  // for every bone at rest). Move every vertex with its bones in scene space:
  //   v' = Σ w · (newStart + S ⊙ (v − oldStart))
  const C = new Map(), Cinv = new Map();
  for (const mesh of meshes) {
    const sk = mesh.skeleton, c = sk.bones[0].matrixWorld.clone().multiply(sk.boneInverses[0]);
    C.set(mesh, c); Cinv.set(mesh, c.clone().invert());
  }
  const done = new Set();          // the body's primitives share one vertex buffer: move it once
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    g.userData.oniTemplate = true;
    if (done.has(pos.array)) continue;
    done.add(pos.array);
    const skI = g.attributes.skinIndex, skW = g.attributes.skinWeight, sk = mesh.skeleton.bones;
    const toWorld = C.get(mesh).clone().multiply(mesh.bindMatrix);
    const toLocal = mesh.bindMatrixInverse.clone().multiply(Cinv.get(mesh));
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
      _a.set(0, 0, 0); _b.set(0, 0, 0);
      if (nor) _n.fromBufferAttribute(nor, i);
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        const w = skW.getComponent(i, k);
        if (!w) continue;
        const bone = sk[skI.getComponent(i, k)], s = S.get(bone) ?? ONE;
        _a.addScaledVector(_v.clone().sub(oldP.get(bone)).multiply(s).add(newP.get(bone)), w);
        if (nor) _b.addScaledVector(_n.clone().divide(s), w);
        wsum += w;
      }
      _a.divideScalar(wsum || 1);
      _a.applyMatrix4(toLocal);
      pos.setXYZ(i, _a.x, _a.y, _a.z);
      if (nor) { _b.normalize(); nor.setXYZ(i, _b.x, _b.y, _b.z); }
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData.oniTemplate = true;
  }
  // re-place the bones and re-bind each skin to them (keeping its C)
  for (const b of bones) {
    b.position.copy(b.parent.worldToLocal(newP.get(b).clone()));
    b.updateMatrixWorld(true);
  }
  for (const mesh of meshes) {
    const sk = mesh.skeleton;
    sk.boneInverses = sk.bones.map((bone) => bone.matrixWorld.clone().invert().multiply(C.get(mesh)));
  }
  for (const m of meshes) m.material = new THREE.MeshBasicMaterial();   // replaced per oni

  // measurements the props are fitted to (model units, relative to the bones)
  const byName = (n) => bones.find((b) => b.name === n);
  const P = (n) => newP.get(byName(n));
  const verts = [], seen = new Set();
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, toWorld = C.get(mesh).clone().multiply(mesh.bindMatrix);
    const skI = g.attributes.skinIndex, skW = g.attributes.skinWeight, sk = mesh.skeleton.bones;
    const ids = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    for (const i of ids) {
      if (seen.has(i)) continue;
      seen.add(i);
      const v = _v.fromBufferAttribute(pos, i).applyMatrix4(toWorld).clone();
      let best = 0;
      for (let q = 1; q < 4; q++) if (skW.getComponent(i, q) > skW.getComponent(i, best)) best = q;
      v.bone = sk[skI.getComponent(i, best)].name;           // the bone that moves it most
      verts.push(v);
    }
  }
  const minY = Math.min(...verts.map((v) => v.y));          // the soles
  // radius of the limb around the segment a→b at fraction t
  const radius = (a, b, t) => {
    const A = P(a), B = P(b), d = B.clone().sub(A), len = d.length();
    d.divideScalar(len);
    let r = 0;
    const part = a.replace('J_Bip_', '');
    for (const v of verts) {
      if (!v.bone.includes(part)) continue;
      const rel = v.clone().sub(A), ax = rel.dot(d) / len;
      if (Math.abs(ax - t) > 0.06) continue;
      const rad = rel.addScaledVector(d, -rel.dot(d)).length();
      r = Math.max(r, rad);
    }
    return r;
  };
  // half-width and depth of the trunk at height y
  const slice = (y, dy = 0.02, legs = false) => {
    let rx = 0, z0 = Infinity, z1 = -Infinity;
    for (const v of verts) {
      if (Math.abs(v.y - y) >= dy || !(v.bone.includes('_C_') || (legs && v.bone.includes('UpperLeg')))) continue;
      rx = Math.max(rx, Math.abs(v.x)); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    return { rx, z0, z1 };
  };
  const hipsY = P('J_Bip_C_Hips').y;
  const k = (HEAD_Y - HEAD_ABOVE_BONE) / (P('J_Bip_C_Head').y - minY);    // model → oni units
  return {
    scene, k, minY,
    P: Object.fromEntries(bones.map((b) => [b.name, newP.get(b)])),
    pelt: [0.075, 0.04, 0.0, -0.04, -0.08, -0.12, -0.16, -0.2].map((dy) => ({ dy, ...slice(hipsY + dy, 0.025, true) })),
    forearm: radius('J_Bip_L_LowerArm', 'J_Bip_L_Hand', 0.82),
    shin: radius('J_Bip_L_LowerLeg', 'J_Bip_L_Foot', 0.82),
  };
}

// Building an oni takes a moment (the props are baked, the body cloned), so a finished
// one is kept and handed out again: the rank-trial boss and the capture scene both
// take it from here.
let spare = null;
export function takeOni() {
  const oni = spare ?? createOni();
  spare = null;
  return oni;
}
export function releaseOni(oni) {
  oni.root.removeFromParent();
  oni.root.position.set(0, 0, 0);
  oni.root.rotation.set(0, 0, 0);
  oni.root.scale.setScalar(1);
  oni.reset();
  if (spare) oni.dispose();
  else spare = oni;
}

/* ===================== poses ===================== */
// Euler angles per bone in the model's own frame (it faces -z): limbs that hang down
// swing forward with +x, the spine and head tilt back with +x; arms are authored hanging
// (the T-pose arm is lowered by ARM_BASE first), as in hero.js.
const KEYS = ['hips', 'spine', 'chest', 'upper', 'neck', 'head', 'uaL', 'faL', 'hdL', 'uaR', 'faR', 'hdR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'];
const BONES = {
  hips: 'C_Hips', spine: 'C_Spine', chest: 'C_Chest', upper: 'C_UpperChest', neck: 'C_Neck', head: 'C_Head',
  uaL: 'L_UpperArm', faL: 'L_LowerArm', hdL: 'L_Hand', uaR: 'R_UpperArm', faR: 'R_LowerArm', hdR: 'R_Hand',
  thL: 'L_UpperLeg', shL: 'L_LowerLeg', ftL: 'L_Foot', thR: 'R_UpperLeg', shR: 'R_LowerLeg', ftR: 'R_Foot',
};
const Zax = new THREE.Vector3(0, 0, 1);
const ARM_BASE = { L: new THREE.Quaternion().setFromAxisAngle(Zax, 1.3), R: new THREE.Quaternion().setFromAxisAngle(Zax, -1.3) };
const ARM_BASE_INV = { L: ARM_BASE.L.clone().invert(), R: ARM_BASE.R.clone().invert() };
const blankPose = () => { const p = { hipsY: 0, jaw: 0.06, curlR: 0.4 }; for (const k of KEYS) p[k] = [0, 0, 0]; return p; };

// How the grabbing hand holds the hero. Frame: handR (oni units; -y runs down the fingers,
// +x is the palm's normal, z runs across the knuckles). The hero is upright along the
// knuckle line with the palm against the side of his waist and facing the way the fingers
// point, so they close round his front while the thumb wraps his back. curl: per finger
// joint at full grip (curlR = 1) — a wrap, not a fist. thumb: at full grip Thumb1 swings
// across under the palm (opposition, about the fingers' axis) and every thumb joint flexes
// toward the palm, the distal ones most — each about its own bend axis, since the thumb
// lies at an angle to the fingers.
const GRIP = {
  at: [0.16, -0.15, 0],              // waist centre in the hand frame
  waistY: 0.92,                      // hero units: feet to waist
  curl: [0.5, 0.45, 0.35],
  thumb: { opp: -0.7, flex: [0.5, 0.9, 1.1] },
};

function createOni() {
  const tiger = tigerTex();
  tiger.repeat.set(2, 1);
  const M = {
    skin: toon(0xd63c33, { emissive: 0x2a0404 }),
    hair: toon(0x221820),
    horn: toon(0xe9dcb4),
    tiger: toon(0xffffff, { map: tiger }),
    gold: toon(0xe3ad3e, { emissive: 0x3a2000 }),
    iron: toon(0x2e2b38),
    stud: toon(0xa29eb4),
    mouth: toon(0x2a070b),
    teeth: toon(0xfff8ea),
    eye: new THREE.MeshBasicMaterial({ color: glow(0xffd04a, 1.6) }),
    hornDark: toon(0x6e5a44),
    rope: toon(0xd9b561),
    cord: toon(0xb8202a),
    pupil: new THREE.MeshBasicMaterial({ color: 0x1a0608 }),
  };
  const rows = (list) => list.map(([y, rx, rz, cz, e]) => ({ y, rx, rz, cz, e: 2, ef: e }));

  const root = new THREE.Group();
  const rig = joint(root);                  // everything visible; hidden until the body is in
  rig.visible = false;

  /* ---------- props, built in oni units ---------- */
  // tiger-skin loincloth: a skirt lofted through cross-sections of the oni's own hips and
  // thighs (measured on the sculpted body, in oni units, relative to the hips bone) so it
  // wraps them snugly, with a twisted straw rope belt bedded into its top edge, a knot and
  // hanging ends at the front, a ragged hem and the tiger's tail at the hip
  const buildPelt = (rows) => {
    const top = rows[0], hem = rows[rows.length - 1];
    const ring = (r, y, out, n, f) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(f(a, Math.sin(a) * (r.rx + out), y, r.cz + Math.cos(a) * (r.rz + out)));
      }
      return pts;
    };
    const rope = (phase) => taperedTube(ring(top, top.y - 0.03, 0.0, 48, (a, x, y, z) => {
      const tw = a * 11 + phase, d = 0.022 * Math.cos(tw);
      return [x + Math.sin(a) * d, y + 0.022 * Math.sin(tw), z + Math.cos(a) * d];
    }), 0.036, { tip: 1, segments: 144, radial: 6 });
    const tufts = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.1, len = 0.12 + ((i * 5) % 3) * 0.035;
      tufts.push({ geo: new THREE.ConeGeometry(0.065, len, 5), mat: M.tiger,
        p: [Math.sin(a) * (hem.rx - 0.02), hem.y - len / 2 + 0.03, hem.cz + Math.cos(a) * (hem.rz - 0.02)], r: [Math.PI, 0, 0] });
    }
    const fx = 0.12, fz = top.cz + top.rz + 0.01;          // the knot, on the front of the belt
    return bake([
      { geo: loft(rows.map((r) => ({ y: r.y, rx: r.rx, rz: r.rz, cz: r.cz, e: 2.3 })), { segs: 32, uRep: 2 }), mat: M.tiger },
      ...tufts,
      { geo: rope(0), mat: M.rope },
      { geo: rope(Math.PI), mat: M.rope },
      { geo: new THREE.SphereGeometry(0.075, 10, 8), mat: M.rope, p: [fx, top.y - 0.03, fz], s: [1.2, 1, 0.8] },
      { geo: taperedTube([[fx, top.y - 0.05, fz + 0.02], [fx + 0.04, top.y - 0.25, fz + 0.06], [fx, top.y - 0.48, fz + 0.07]], 0.035, { tip: 0.6 }), mat: M.rope },
      { geo: taperedTube([[fx, top.y - 0.05, fz + 0.02], [fx + 0.1, top.y - 0.2, fz + 0.05], [fx + 0.14, top.y - 0.4, fz + 0.06]], 0.035, { tip: 0.6 }), mat: M.rope },
      { geo: taperedTube([[-top.rx, top.y - 0.12, top.cz], [-hem.rx - 0.08, hem.y - 0.15, hem.cz + 0.02], [-hem.rx - 0.06, hem.y - 0.48, hem.cz + 0.1], [-hem.rx, hem.y - 0.68, hem.cz + 0.2]], 0.05, { tip: 0.5 }), mat: M.tiger },
    ], { outline: 0.02 });
  };

  // ---------- head: heavy brow, deep-set eyes, broad nose, jutting jaw ----------
  const head = new THREE.Group();
  head.scale.setScalar(HEAD_SCALE);
  // the mane: a thick mass of black curls over the back and top of the skull, spilling
  // down the neck to the shoulders, with a few heavier locks tossed up between the horns
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


  // kanabō (studded iron club), gripped in the left fist and resting over the shoulder
  const club = new THREE.Group();
  club.position.set(0, -0.2, 0.0);
  club.add(bake([
    { geo: lathe([[0.07, -0.36], [0.055, -0.3], [0.055, 0.35], [0.1, 0.5], [0.19, 1.42], [0.15, 1.54], [0.0, 1.57]], 8), mat: M.iron },
    { geo: new THREE.TorusGeometry(0.08, 0.025, 6, 12), mat: M.gold, p: [0, 0.4, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.TorusGeometry(0.19, 0.03, 6, 16), mat: M.gold, p: [0, 1.38, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.TorusGeometry(0.07, 0.02, 6, 12), mat: M.gold, p: [0, -0.44, 0] },
    // the grip, bound with red cord
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ geo: new THREE.TorusGeometry(0.062, 0.018, 5, 10), mat: M.cord, p: [0, -0.24 + i * 0.09, 0], r: [Math.PI / 2 + (i % 2 ? 0.25 : -0.25), 0, 0] })),
  ], { outline: 0.02 }));
  // rows of chunky studs (no outline — tiny outlined cones shimmer)
  const studs = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI * 2 + i * 0.45, y = 0.6 + i * 0.15, r = 0.105 + i * 0.016;
      studs.push({ geo: new THREE.ConeGeometry(0.045, 0.1, 6), mat: M.stud, p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57] });
    }
  }
  club.add(bake(studs, { outline: 0 }));

  // iron cuffs bound in gold, sized to the limb they close around (oni units)
  const cuff = (r, h, studs) => {
    const g = new THREE.Group();
    g.add(bake([
      { geo: new THREE.CylinderGeometry(r, r * 0.97, h, 16), mat: M.iron },
      { geo: new THREE.TorusGeometry(r, 0.022, 6, 20), mat: M.gold, p: [0, h / 2, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.TorusGeometry(r * 0.97, 0.022, 6, 20), mat: M.gold, p: [0, -h / 2, 0], r: [Math.PI / 2, 0, 0] },
    ], { outline: 0.02 }));
    if (studs) {
      g.add(bake([0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return { geo: new THREE.ConeGeometry(0.026, 0.06, 6), mat: M.stud, p: [Math.sin(a) * r, 0, Math.cos(a) * r], r: [Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57] };
      }), { outline: 0 }));
    }
    return g;
  };

  // the grabbing hand's palm frame (-y runs down the fingers, oni units) — capture.js
  // holds the hero at handR's (0, -0.16, 0). Parked roughly in place until the body is in.
  const handR = new THREE.Object3D();
  handR.position.set(-0.75, 1.2, 1.2);
  rig.add(handR);

  /* ---------- the body ---------- */
  let B = null, hipsRest = 0, k = 1, chestNode = rig;
  const curlBones = { L: [], R: [] }, thumbs = { L: [], R: [] }, thumbAxes = [];
  const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), X_AXIS = new THREE.Vector3(1, 0, 0), PALM = new THREE.Vector3(0, -1, 0);
  // a child of `bone` whose axes are y = up, z = the oni's forward (model -z) — or, for a
  // limb, -y running down the limb — and whose unit is one oni unit
  const mount = (bone, obj, { down = null, at = null } = {}) => {
    const f = new THREE.Object3D();
    const y = down ? down.clone().negate().normalize() : new THREE.Vector3(0, 1, 0);
    const z = new THREE.Vector3(0, 0, -1);
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (at) f.position.copy(at);
    f.scale.setScalar(1 / k);
    bone.add(f);
    if (obj) f.add(obj);
    return f;
  };
  function attachBody(t) {
    if (!t || B) return;
    k = t.k;
    const body = cloneSkinned(t.scene);
    body.rotation.y = Math.PI;                      // the model faces -z; the oni faces +z
    body.scale.setScalar(k);
    body.position.y = -t.minY * k;
    const skins = [];
    body.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
    for (const o of skins) {
      o.material = M.skin;
      o.frustumCulled = false;
      addOutline(o, 0.026 / k);
    }
    rig.add(body);
    B = {};
    for (const key of KEYS) B[key] = body.getObjectByName('J_Bip_' + BONES[key]);
    hipsRest = B.hips.position.y;
    chestNode = B.upper;
    for (const side of ['L', 'R']) {
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) for (let i = 1; i <= 3; i++) curlBones[side].push([body.getObjectByName(`J_Bip_${side}_${f}${i}`), i - 1]);
      for (let i = 1; i <= 3; i++) thumbs[side].push(body.getObjectByName(`J_Bip_${side}_Thumb${i}`));
      if (side === 'R') {
        // each thumb joint bends toward the palm (model -y) about the axis across its own segment
        const ends = [...thumbs.R.slice(1), body.getObjectByName('J_Bip_R_Thumb3_end')];
        ends.forEach((child) => thumbAxes.push(child.position.clone().normalize().cross(PALM).normalize()));
      }
    }
    // bone-to-bone directions and lengths in the model's rest frame (= every bone's local frame)
    const seg = (a, b) => t.P['J_Bip_' + b].clone().sub(t.P['J_Bip_' + a]);
    const dir = (a, b) => seg(a, b).normalize();
    const len = (a, b) => seg(a, b).length();

    mount(B.head, head, { at: new THREE.Vector3(0, HEAD_ABOVE_BONE / k, -0.03 / k) });
    // the pelt, lofted through the measured hips (oni units, around the hips bone)
    const hz = t.P.J_Bip_C_Hips.z;
    // (a skirt hangs from the widest point down: keep a running envelope of the slices)
    let ex = 0, e0 = Infinity, e1 = -Infinity;
    const rows = t.pelt.map((c, i) => {
      if (c.rx > 0) { ex = Math.max(ex, c.rx); e0 = Math.min(e0, c.z0); e1 = Math.max(e1, c.z1); }
      return { y: c.dy * k, rx: ex * k + 0.035 + 0.02 * i, rz: ((e1 - e0) / 2) * k + 0.035 + 0.02 * i, cz: -((e0 + e1) / 2 - hz) * k };
    });
    mount(B.hips, buildPelt(rows));
    for (const side of ['L', 'R']) {
      const fa = len(side + '_LowerArm', side + '_Hand');
      mount(B['fa' + side], cuff(t.forearm * k * 1.08, 0.2, true), { down: dir(side + '_LowerArm', side + '_Hand'), at: dir(side + '_LowerArm', side + '_Hand').multiplyScalar(fa * 0.8) });
      const sh = len(side + '_LowerLeg', side + '_Foot');
      mount(B['sh' + side], cuff(t.shin * k * 1.08, 0.13, false), { down: dir(side + '_LowerLeg', side + '_Foot'), at: dir(side + '_LowerLeg', side + '_Foot').multiplyScalar(sh * 0.86) });
    }
    mount(B.hdL, club, { down: dir('L_Hand', 'L_Middle1') });
    handR.removeFromParent();
    handR.position.set(0, 0, 0);
    mount(B.hdR, handR, { down: dir('R_Hand', 'R_Middle1') });
    // the new meshes join the mist-proof draw order (see below)
    rig.traverse((o) => { if (o.isMesh) o.renderOrder = 2; else if (o.isSprite) o.renderOrder = 3; });
    rig.visible = true;
    // lay the club over the shoulder: in the idle pose its shaft runs from the fist up and
    // back past the head (directions in the oni's own frame)
    const was = mode;
    mode = 'idle';
    api.snap(0);
    const rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentQ = rq.multiply(club.parent.getWorldQuaternion(new THREE.Quaternion()));
    const want = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.25, 0.55, -0.8).normalize());
    club.quaternion.copy(parentQ.invert().multiply(want));
    mode = was;
    api.snap(lastT);
  }

  // The ground mist is two additive planes at shin and knee height, drawn after every
  // opaque mesh, so it washed everything below the knees pale pink. Drawing the oni in
  // the transparent pass after it (still fully opaque, still writing depth) keeps the
  // skin one red from head to toe.
  for (const m of Object.values(M)) m.transparent = true;
  rig.traverse((o) => { if (o.isMesh) o.renderOrder = 2; else if (o.isSprite) o.renderOrder = 3; });

  /* ===================== animation ===================== */
  const pose = blankPose();
  let mode = 'idle', staggerT = 0, flashT = 0, roarT = 0, walkPhase = 0, lastT = 0;

  function target(t) {
    const p = blankPose();
    const br = Math.sin(t * 2);
    // idle: a hunched brute, weight low, the club resting on its left shoulder
    p.hipsY = 0.02 * br;
    p.hips = [0, 0, 0];
    p.spine = [-0.1, 0, 0]; p.chest = [-0.06 + 0.02 * br, 0, 0]; p.upper = [-0.04, 0, 0];
    p.neck = [0.12, 0, 0]; p.head = [0.12, 0, 0];
    p.thL = [0.02, 0.1, -0.1]; p.shL = [-0.08, 0, 0]; p.ftL = [0.06, -0.1, 0.08];
    p.thR = [0.02, -0.1, 0.1]; p.shR = [-0.08, 0, 0]; p.ftR = [0.06, 0.1, -0.08];
    p.uaR = [0.1, 0, 0.32]; p.faR = [0.3, 0, 0]; p.hdR = [0, 0, 0];
    p.uaL = [0.55, 0.3, -0.55]; p.faL = [2.15, 0.2, 0]; p.hdL = [0.2, 0, 0];
    p.jaw = 0.08; p.curlR = 0.45;
    if (mode === 'walk') {
      const s = Math.sin(walkPhase), c = Math.cos(walkPhase);
      p.hipsY = -0.04 - 0.08 * Math.abs(s);
      p.hips = [0, 0.06 * s, 0.05 * s];
      p.spine = [-0.16, -0.1 * s, 0]; p.chest = [-0.05, -0.06 * s, -0.03 * s];
      p.head = [0.2, 0.1 * s, 0];
      p.thL = [0.5 * s, 0, -0.15]; p.thR = [-0.5 * s, 0, 0.15];   // a wide, heavy stance
      p.shL = [-0.12 - 0.9 * Math.max(0, c), 0, 0]; p.shR = [-0.12 - 0.9 * Math.max(0, -c), 0, 0];
      p.ftL = [0.25 * Math.max(0, c) - 0.1 * s, 0, 0]; p.ftR = [0.25 * Math.max(0, -c) + 0.1 * s, 0, 0];
      p.uaR = [0.4 * s, 0, 0.3]; p.faR = [0.35 + 0.2 * Math.max(0, s), 0, 0];
    } else if (mode === 'roar') {
      Object.assign(p, { spine: [0.18, 0, 0], chest: [0.12, 0, 0], head: [0.45, 0, 0], jaw: 0.65,
        uaR: [0.5, 0, 1.45], faR: [0.7, 0, 0], uaL: [0.5, 0, -1.3], faL: [1.3, 0, 0] });
    } else if (mode === 'reach' || mode === 'grab') {
      Object.assign(p, {
        // a deep crouch, so the fist closes round the kneeling hero's waist (knuckles upright,
        // fingers pointing forward past him)
        hipsY: -0.9, spine: [-0.95, 0, 0], chest: [-0.15, 0, 0], upper: [-0.05, 0, 0], head: [0.75, 0, 0], jaw: 0.18,
        uaR: [1.0, 0, 0.1], faR: [0.1, 0, 0], hdR: [0.8, 0, -0.4],
        thR: [1.3, 0, 0.1], shR: [-1.9, 0, 0], ftR: [0.6, 0, 0],
        thL: [-0.1, 0, -0.15], shL: [-1.1, 0, 0], ftL: [0.5, 0, 0],
        curlR: mode === 'grab' ? 1 : -0.2,
      });
    } else if (mode === 'lift' || mode === 'laugh') {
      const kk = mode === 'laugh' ? Math.abs(Math.sin(t * 13)) : 0;
      Object.assign(p, {
        spine: [0.06 + 0.05 * kk, 0, 0], chest: [0.04, 0, 0], head: [0.1 + 0.15 * kk, -0.4 + (mode === 'laugh' ? 0.08 * Math.sin(t * 3) : 0), 0],   // turned to the prize in its fist
        jaw: 0.22 + (mode === 'laugh' ? 0.35 * kk : 0), hipsY: 0.03 * kk,
        uaR: [1.5, 0, 0.9], faR: [0.6, 0, 0], hdR: [-0.4, 0, -0.4], curlR: 1,   // the fist held out beside the face, the hero upright in it
      });
    }
    if (roarT > 0) {
      const w = Math.sin(Math.min(1, roarT) * Math.PI);
      p.head = [p.head[0] + 0.45 * w, p.head[1], p.head[2]]; p.jaw += 0.55 * w;
      p.spine = [p.spine[0] + 0.15 * w, p.spine[1], p.spine[2]];
      p.uaR = [p.uaR[0], p.uaR[1], p.uaR[2] + 0.5 * w];
    }
    if (staggerT > 0) {
      p.spine = [p.spine[0] + 0.4 * staggerT, p.spine[1], p.spine[2]];
      p.head = [p.head[0] + 0.35 * staggerT, p.head[1], p.head[2]];
    }
    return p;
  }

  const e = new THREE.Euler(), q = new THREE.Quaternion();
  function blend(tg, kk) {
    pose.hipsY = lerp(pose.hipsY, tg.hipsY, kk); pose.jaw = lerp(pose.jaw, tg.jaw, kk); pose.curlR = lerp(pose.curlR, tg.curlR, kk);
    for (const key of KEYS) for (let i = 0; i < 3; i++) pose[key][i] = lerp(pose[key][i], tg[key][i], kk);
  }
  function apply() {
    jaw.rotation.x = pose.jaw;
    if (!B) return;
    for (const key of KEYS) {
      const node = B[key];
      q.setFromEuler(e.set(pose[key][0], pose[key][1], pose[key][2]));
      const side = key[2];
      if (key.startsWith('ua')) node.quaternion.copy(q).multiply(ARM_BASE[side]);
      else if (key.startsWith('fa') || key.startsWith('hd')) node.quaternion.copy(ARM_BASE_INV[side]).multiply(q).multiply(ARM_BASE[side]);
      else node.quaternion.copy(q);
    }
    B.hips.position.y = hipsRest + pose.hipsY / k;
    for (const [n, i] of curlBones.R) n.rotation.z = -pose.curlR * GRIP.curl[i];
    for (const [n] of curlBones.L) n.rotation.z = 1.35;          // a fist round the club
    const g = Math.max(0, pose.curlR);
    // the thumb closes with the fingers (curlR blends in with the pose, so it never snaps)
    thumbs.R.forEach((n, i) => {
      _tq.setFromAxisAngle(thumbAxes[i], GRIP.thumb.flex[i] * g);
      if (i === 0) n.quaternion.copy(_tq2.setFromAxisAngle(X_AXIS, GRIP.thumb.opp * g)).multiply(_tq);
      else n.quaternion.copy(_tq);
    });
    thumbs.L[0].rotation.set(0, 0.6, 0.4);
  }

  const api = {
    root, head,
    handR,
    get body() { return rig; },
    get chest() { return chestNode; },
    get mode() { return mode; },
    setMode(m) { mode = m; },
    roar() { roarT = 1; },
    flash() { flashT = 1; staggerT = 1; },
    // where a held hero goes: its feet position and orientation (world), so that its waist
    // sits in the palm and the fingers close round it (see GRIP)
    holdTransform(pos, quat) {
      handR.updateWorldMatrix(true, false);
      const m = handR.matrixWorld.elements;
      const ax = _hx.set(m[0], m[1], m[2]).normalize(), az = _hz.set(m[8], m[9], m[10]).normalize();
      // palm on his right side (or left, if the hand is upside down); he faces down the fingers
      const flip = az.y < 0;
      const up = flip ? az.negate() : az;
      const xh = ax.multiplyScalar(flip ? 1 : -1).addScaledVector(up, -ax.dot(up)).normalize();
      const zh = _hy.crossVectors(xh, up);
      quat.setFromRotationMatrix(_hm.makeBasis(xh, up, zh));
      handR.localToWorld(pos.set(...GRIP.at)).addScaledVector(up, -GRIP.waistY);
      return pos;
    },
    // jump every joint straight to the current mode's pose (for skipping cinematics)
    snap(t = 0) { blend(target(t), 1); apply(); root.updateMatrixWorld(true); },
    // back to a calm idle, as if new
    reset() {
      mode = 'idle'; staggerT = flashT = roarT = walkPhase = 0;
      M.skin.emissive.setRGB(0.17, 0.016, 0.016);
      this.snap();
    },
    update(dt, t, walkSpeed = 0) {
      lastT = t;
      walkPhase += dt * (1.2 + walkSpeed * 0.25) * Math.PI;
      staggerT = Math.max(0, staggerT - dt * 2.5);
      roarT = Math.max(0, roarT - dt * 0.9);
      flashT = Math.max(0, flashT - dt * 4);
      blend(target(t), 1 - Math.exp(-dt * (mode === 'grab' ? 14 : 7)));
      M.skin.emissive.setRGB(0.17 + flashT * 0.9, 0.016 + flashT * 0.8, 0.016 + flashT * 0.6);
      apply();
    },
    dispose() {
      root.traverse((o) => {
        if (o.geometry && !o.geometry.userData.oniTemplate) o.geometry.dispose();
        if (o.isSkinnedMesh) o.skeleton.dispose();
        for (const m of [].concat(o.material || [])) if (!m.isShaderMaterial) m.dispose();   // keep the shared outline shader
      });
    },
  };
  if (template) attachBody(template);
  else templateReady.then(attachBody);
  api.snap();
  return api;
}
