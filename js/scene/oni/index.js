// oni/ — the red oni (赤鬼) of the old pictures, boss of the parade and the one who
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
//
// body.js sculpts the body, head.js builds the head, props.js the pelt, club and cuffs;
// this file puts them together, poses and animates the oni.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { toon, glow, joint, addOutline } from '../toon.js';
import { tigerTex } from '../textures.js';
import { template, templateReady, HEAD_ABOVE_BONE } from './body.js';
import { buildHead } from './head.js';
import { buildPelt, buildClub, buildCuff } from './props.js';

const lerp = (a, b, k) => a + (b - a) * k;
const _hx = new THREE.Vector3();
const _hy = new THREE.Vector3();
const _hz = new THREE.Vector3();
const _hm = new THREE.Matrix4();

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

  const root = new THREE.Group();
  const rig = joint(root);                  // everything visible; hidden until the body is in
  rig.visible = false;

  const { head, jaw } = buildHead(M);
  const club = buildClub(M);

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
    mount(B.hips, buildPelt(M, rows));
    for (const side of ['L', 'R']) {
      const fa = len(side + '_LowerArm', side + '_Hand');
      mount(B['fa' + side], buildCuff(M, t.forearm * k * 1.08, 0.2, true), { down: dir(side + '_LowerArm', side + '_Hand'), at: dir(side + '_LowerArm', side + '_Hand').multiplyScalar(fa * 0.8) });
      const sh = len(side + '_LowerLeg', side + '_Foot');
      mount(B['sh' + side], buildCuff(M, t.shin * k * 1.08, 0.13, false), { down: dir(side + '_LowerLeg', side + '_Foot'), at: dir(side + '_LowerLeg', side + '_Foot').multiplyScalar(sh * 0.86) });
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
