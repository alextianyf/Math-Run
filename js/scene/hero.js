// hero.js — the young onmyōji, now a real VRM character (models/hero.vrm: VRoid's
// CC0 sample "Sakurada Fumiriya", re-styled at load time for the night parade).
//
// The model brings a full humanoid skeleton, facial expressions, MToon cel
// materials with outlines and spring-bone hair. Our own procedural animation
// drives its normalised humanoid bones: idle ↔ run blend, a cast with
// anticipation and follow-through, a hit flinch, kneel/grabbed poses, blinking,
// eye contact with the camera on the title screen, and running wind on the hair.
// Faces -z (the running direction).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { shadowTex } from './textures.js';
import { restyleHero, makeFoxMask } from './heroStyle.js';
import { dressHero } from './heroRobe.js';

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
// gaussian bump on a periodic phase
const bump = (ph, c, w) => { const d = ((((ph - c) % TAU) + TAU + Math.PI) % TAU) - Math.PI; return Math.exp(-(d * d) / (w * w)); };

/* ===================== poses ===================== */
// Euler angles per joint, authored for a character whose bones have identity rest
// rotation and whose arms hang down (I-pose); the arm bones get a base rotation
// below so the same numbers drive the VRM's T-pose rig.
const KEYS = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'hdL', 'uaR', 'faR', 'hdR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'];
const BONE = {
  hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
  uaL: 'leftUpperArm', faL: 'leftLowerArm', hdL: 'leftHand', uaR: 'rightUpperArm', faR: 'rightLowerArm', hdR: 'rightHand',
  thL: 'leftUpperLeg', shL: 'leftLowerLeg', ftL: 'leftFoot', thR: 'rightUpperLeg', shR: 'rightLowerLeg', ftR: 'rightFoot',
};
const HIPS_REF = 0.86;                       // hipsY the poses were authored against
const blankPose = () => { const p = { hipsY: HIPS_REF }; for (const k of KEYS) p[k] = [0, 0, 0]; return p; };
function mix(a, b, w) {
  if (w <= 0) return a;
  const out = { hipsY: lerp(a.hipsY, b.hipsY, w) };
  for (const k of KEYS) out[k] = [lerp(a[k][0], b[k][0], w), lerp(a[k][1], b[k][1], w), lerp(a[k][2], b[k][2], w)];
  return out;
}

// Standing on the title screen: weight on the left leg, sword mudra raised before the face
function poseIdle(t) {
  const p = blankPose(), br = Math.sin(t * 1.7);
  p.hipsY = 0.855 + 0.004 * br;
  p.hips = [0, 0.12, 0.035];
  p.thL = [0.02, 0, -0.07]; p.shL = [-0.04, 0, 0]; p.ftL = [0.02, -0.1, 0.07];
  p.thR = [0.2, -0.12, 0.08]; p.shR = [-0.32, 0, 0]; p.ftR = [0.12, 0.15, -0.05];
  p.spine = [0.03, -0.08, -0.03];
  p.chest = [-0.02 + 0.015 * br, -0.1, 0];
  p.neck = [0, 0.04, 0];
  p.head = [0.05 + 0.012 * Math.sin(t * 0.9), 0.16 + 0.05 * Math.sin(t * 0.47), 0.07];
  p.uaR = [0.38, 0.25, 0.42]; p.faR = [2.15, 0.2, 0]; p.hdR = [0.1, 0, 0];
  p.uaL = [-0.1, 0, -0.18]; p.faL = [0.3, 0, 0]; p.hdL = [0.12, 0, 0];
  return p;
}

// Run cycle at phase ph (0..2π), amplitude a (0..1): a driving sprint — forward lean,
// little hip sway, elbows pumping at ~90° close to the body, steady head
function poseRun(ph, a) {
  const p = blankPose(), s = Math.sin(ph), c = Math.cos(ph);
  p.hipsY = HIPS_REF - 0.012 * a - 0.03 * a * Math.cos(2 * ph);
  p.hips = [0, -0.07 * a * s, 0.02 * a * c];
  p.spine = [-(0.1 + 0.24 * a), 0.1 * a * s, -0.015 * a * c];
  p.chest = [-0.05 * a, 0.1 * a * s, 0];
  p.neck = [0.08 * a, -0.08 * a * s, 0];
  p.head = [0.14 * a + 0.015 * a * Math.cos(2 * ph), -0.08 * a * s, 0];
  for (const [side, off, sx] of [['L', 0, -1], ['R', Math.PI, 1]]) {
    const q = ph + off, sq = Math.sin(q);
    p['th' + side] = [a * (0.15 + 0.85 * sq), 0, sx * 0.03];
    p['sh' + side] = [-a * (0.1 + 1.6 * bump(q, 0.2, 1.0) + 0.25 * bump(q, Math.PI + 0.35, 0.6)), 0, 0];
    p['ft' + side] = [a * (0.12 + 0.25 * bump(q, Math.PI / 2 + 0.3, 0.5) - 0.55 * bump(q, 1.5 * Math.PI + 0.45, 0.55)), 0, 0];
    // arms swing against the same-side leg; elbows stay bent and pump
    p['ua' + side] = [a * (0.1 - 0.85 * sq), 0, sx * (0.05 + 0.03 * a)];
    p['fa' + side] = [a * (1.45 + 0.35 * Math.max(0, -sq)) + 0.3 * (1 - a), 0, 0];
    p['hd' + side] = [0, 0, 0];
  }
  return p;
}

// Cast overlay: wind-up, then the right arm thrusts the sword mudra forward
// while the left hand forms a seal at the chest; holds, then eases back
const CAST_DUR = 0.5;
function applyCast(p, ct) {
  const w = smooth(0, 0.05, ct) * (1 - smooth(0.32, CAST_DUR, ct));
  if (w <= 0) return p;
  const k = smooth(0.05, 0.14, ct);
  const pre = {
    uaR: [-0.3, 0.2, 0.55], faR: [2.0, 0, 0], hdR: [0.2, 0, 0],
    chest: [p.chest[0], -0.32, 0], uaL: [0.2, 0, -0.3], faL: [1.2, 0, 0], head: [p.head[0], 0.15, 0],
  };
  const hit = {
    uaR: [1.52, 0.05, 0.1], faR: [0.08, 0, 0], hdR: [-0.1, 0, 0],
    chest: [p.chest[0] - 0.04, 0.4, 0], uaL: [0.55, 0.3, 0.42], faL: [2.05, 0, 0], head: [p.head[0], -0.25, 0],
  };
  const out = { ...p };
  for (const key in pre) {
    out[key] = pre[key].map((v, i) => lerp(p[key][i], lerp(v, hit[key][i], k), w));
  }
  return out;
}

function poseKneel(t) {
  const p = blankPose();
  p.hipsY = 0.47; p.hips = [0.1, 0, 0];
  p.thL = [0.14, 0.06, -0.1]; p.shL = [-1.62, 0, 0]; p.ftL = [-0.5, 0, 0];
  p.thR = [0.1, -0.06, 0.1]; p.shR = [-1.58, 0, 0]; p.ftR = [-0.5, 0, 0];
  p.spine = [0.22, 0, 0]; p.chest = [0.12, 0, 0];
  p.neck = [0.15, 0, 0]; p.head = [0.35 + 0.03 * Math.sin(t * 23), 0.1 * Math.sin(t * 2.1), 0];
  p.uaL = [1.35, -0.3, -0.35]; p.faL = [1.5, 0, 0];
  p.uaR = [1.25, 0.3, 0.35]; p.faR = [1.6, 0, 0];
  return p;
}

function poseGrabbed(t) {
  const p = blankPose();
  p.hips = [0.1, 0.15 * Math.sin(t * 5), 0.08 * Math.sin(t * 7)];
  for (const [side, off, sx] of [['L', 0, -1], ['R', Math.PI, 1]]) {
    p['th' + side] = [0.35 + 0.55 * Math.sin(t * 12 + off), 0, sx * 0.1];
    p['sh' + side] = [-0.5 - 0.6 * Math.max(0, Math.sin(t * 12 + 1.2 + off)), 0, 0];
    p['ft' + side] = [-0.4, 0, 0];
    p['ua' + side] = [0.15 + 0.25 * Math.sin(t * 9 + off * 0.6), 0, sx * 0.35];
    p['fa' + side] = [0.9 + 0.5 * Math.sin(t * 11 + off * 0.3), 0, 0];
  }
  p.spine = [0.05, 0.15 * Math.sin(t * 6), 0.1 * Math.sin(t * 7)];
  p.chest = [0.05, 0, 0];
  p.head = [0.15 + 0.1 * Math.sin(t * 5), 0.45 * Math.sin(t * 4), 0];
  return p;
}

/* ===================== the hero ===================== */
const HERO_HEIGHT = 1.68;                    // world units, hair included
const Z = new THREE.Vector3(0, 0, 1);

export function createHero() {
  const root = new THREE.Group();
  const dynamic = new THREE.Group();         // kept for the world's API; nothing lives here now
  const fingertip = new THREE.Object3D();    // spell origin: re-parented to the right hand once loaded
  fingertip.position.set(0, 1.1, -0.3);
  root.add(fingertip);
  const lookTarget = new THREE.Object3D();
  dynamic.add(lookTarget);

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  root.add(shadow);

  // ---- loaded state ----
  let vrm = null;
  let bones = null;
  let hipsRest = 0;
  let modelScale = 1;
  const materials = [];
  let chestNode = root;
  let robe = null;
  const armBase = { L: new THREE.Quaternion().setFromAxisAngle(Z, 1.3), R: new THREE.Quaternion().setFromAxisAngle(Z, -1.3) };
  const armBaseInv = { L: armBase.L.clone().invert(), R: armBase.R.clone().invert() };

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
  const ready = new Promise((resolve, reject) => {
    loader.load('./models/hero.vrm', (gltf) => {
      vrm = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.combineMorphs(vrm);
      vrm.scene.traverse((o) => {
        if (o.isMesh) { o.frustumCulled = false; for (const m of [].concat(o.material)) if (!materials.includes(m)) materials.push(m); }
      });
      restyleHero(vrm, materials);

      // size: scale the model to the game's hero height, feet on y = 0
      const box = new THREE.Box3().setFromObject(vrm.scene);
      modelScale = HERO_HEIGHT / (box.max.y - box.min.y);
      vrm.scene.scale.setScalar(modelScale);
      vrm.scene.position.y = -box.min.y * modelScale;
      root.add(vrm.scene);

      // the onmyōji outfit, fitted and skinned while the model is still in its rest pose
      robe = dressHero(vrm, root, modelScale, dynamic);
      materials.push(...robe.materials);

      bones = {};
      for (const k of KEYS) bones[k] = vrm.humanoid.getNormalizedBoneNode(BONE[k]);
      hipsRest = bones.hips.position.y;
      chestNode = vrm.humanoid.getRawBoneNode('chest') || root;
      const hand = vrm.humanoid.getRawBoneNode('rightHand');
      const index = vrm.humanoid.getRawBoneNode('rightIndexDistal') || hand;
      index.add(fingertip);
      fingertip.position.set(0, 0, 0);
      // spell seal hand: curl the ring and little fingers, index + middle extended
      for (const f of ['Ring', 'Little']) for (const s of ['Proximal', 'Intermediate', 'Distal']) {
        const n = vrm.humanoid.getNormalizedBoneNode('right' + f + s);
        if (n) n.rotation.z = -1.2;
      }
      const thumb = vrm.humanoid.getNormalizedBoneNode('rightThumbProximal');
      if (thumb) thumb.rotation.set(0, -0.5, -0.3);
      // left hand: a loose fist
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) for (const s of ['Proximal', 'Intermediate', 'Distal']) {
        const n = vrm.humanoid.getNormalizedBoneNode('left' + f + s);
        if (n) n.rotation.z = 1.1;
      }
      const thumbL = vrm.humanoid.getNormalizedBoneNode('leftThumbProximal');
      if (thumbL) thumbL.rotation.set(0, 0.5, 0.3);

      vrm.humanoid.getRawBoneNode('head').add(makeFoxMask());
      if (vrm.lookAt) vrm.lookAt.target = lookTarget;
      resolve(vrm);
    }, undefined, (err) => { console.error('[math-run] hero model failed to load', err); reject(err); });
  });

  /* ===================== per-frame ===================== */
  const e = new THREE.Euler(), qPose = new THREE.Quaternion(), tmp = new THREE.Vector3();
  let phase = 0, castT = 99, hurtT = 0, mode = 'run', modeT = 1, nextBlink = 2, blinkT = 0;

  function applyPose(p) {
    for (const k of KEYS) {
      const node = bones[k];
      if (!node) continue;
      qPose.setFromEuler(e.set(p[k][0], p[k][1], p[k][2]));
      const side = k[2] === 'L' ? 'L' : 'R';
      if (k.startsWith('ua')) node.quaternion.copy(qPose).multiply(armBase[side]);
      else if (k.startsWith('fa') || k.startsWith('hd')) node.quaternion.copy(armBaseInv[side]).multiply(qPose).multiply(armBase[side]);
      else node.quaternion.copy(qPose);
    }
    bones.hips.position.y = hipsRest + (p.hipsY - HIPS_REF) / modelScale;
  }

  const expr = (name, v) => { if (vrm.expressionManager?.getExpression(name)) vrm.expressionManager.setValue(name, v); };
  let expression = 'normal';
  function setFace(dt, t) {
    const em = vrm.expressionManager;
    if (!em) return;
    const shocked = mode === 'kneel' || mode === 'grabbed';
    if (!shocked && t > nextBlink) { blinkT = 0.14; nextBlink = t + 2.4 + Math.random() * 3; }
    blinkT -= dt;
    const casting = castT < 0.42;
    const next = shocked ? 'shock' : casting ? 'cast' : hurtT > 0.3 ? 'hurt' : 'normal';
    if (next !== expression) { em.resetValues(); expression = next; }
    expr('blink', shocked ? 0 : blinkT > 0 ? 1 : 0);
    if (shocked) { expr('Surprised', 1); expr('sad', 0.35); expr('oh', 0.5); }
    else if (casting) { expr('angry', 0.7); expr('aa', 0.35); }   // shouting the spell
    else if (hurtT > 0.3) { expr('angry', 0.4); expr('ih', 0.4); }
  }

  function setWind(speed, t, amp) {
    const sb = vrm.springBoneManager;
    if (!sb) return;
    const gust = 0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 0.7);
    const power = 0.03 + amp * (0.22 + 0.12 * gust);
    const dx = 0.25 * Math.sin(t * 1.1) * amp;
    for (const joint of sb.joints) {
      joint.settings.gravityPower = power;
      joint.settings.gravityDir.set(dx, -0.35, 1).normalize();
    }
  }

  function setMode(m) { if (m !== mode) { mode = m; modeT = 0; } }

  return {
    root, dynamic, ready,
    handR: fingertip,
    get chest() { return chestNode; },
    get vrm() { return vrm; },
    get mode() { return mode; },
    cast() { castT = 0; },
    hurt() { hurtT = 1; },
    setMode,
    reset() {
      mode = 'run'; modeT = 1; castT = 99; hurtT = 0;
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.setScalar(1);
      shadow.visible = true;
    },
    // camera: on the title screen he makes eye contact with the viewer
    update(dt, speed, t, camera) {
      if (!vrm) return;
      const amp = smooth(0.3, 6.5, speed);
      phase += dt * (1.0 + speed * 0.085) * TAU * (amp > 0.01 ? 1 : 0);
      let p = mix(poseIdle(t), poseRun(phase, amp), amp);
      castT += dt;
      p = applyCast(p, castT);
      modeT = Math.min(1, modeT + dt * 2.2);
      if (mode !== 'run') p = mix(p, mode === 'kneel' ? poseKneel(t) : poseGrabbed(t), smooth(0, 1, modeT));
      hurtT = Math.max(0, hurtT - dt * 2.4);
      if (hurtT > 0) {
        p.chest = [p.chest[0] + 0.45 * hurtT, p.chest[1], p.chest[2]];
        p.head = [p.head[0] + 0.35 * hurtT, p.head[1], p.head[2]];
        p.uaL = [p.uaL[0], p.uaL[1], p.uaL[2] - 0.5 * hurtT];
        p.uaR = [p.uaR[0], p.uaR[1], p.uaR[2] + 0.5 * hurtT];
      }
      for (const m of materials) if (m.emissive) m.emissive.setRGB(hurtT * 0.9, hurtT * 0.12, hurtT * 0.15);
      applyPose(p);
      shadow.visible = mode !== 'grabbed';
      setFace(dt, t);
      setWind(speed, t, amp);

      // eye contact while standing still; otherwise look where he runs
      if (vrm.lookAt) {
        if (camera && amp < 0.05 && mode === 'run') lookTarget.position.copy(camera.position);
        else { bones.head.getWorldPosition(tmp); lookTarget.position.set(tmp.x, tmp.y, tmp.z - 10); }
        lookTarget.updateMatrixWorld(true);
      }
      vrm.update(dt);
      root.updateMatrixWorld(true);
      robe.update(dt, speed, t);
    },
  };
}
