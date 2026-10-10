// hero.js — the onmyōji runner: cel-shaded, outlined, jointed and procedurally
// animated (run cycle, casting, getting hit, kneeling, being grabbed).
// Faces -z (the running direction); the back (+z) is what the play camera sees.
import * as THREE from 'three';
import { toon, bake, joint, lathe, taperedTube, addOutline } from './toon.js';
import { faceTex, crestTex, foxMaskTex, shadowTex } from './textures.js';

const COLORS = {
  skin: 0xf7d2b2, robe: 0xe9e4da, trim: 0xd8322a, hakama: 0xb0232e,
  hair: 0x232036, obi: 0x2c2346, tabi: 0xffffff, zori: 0x3b2a24, paper: 0xf2cf63,
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };

export function createHero() {
  const M = {
    skin: toon(COLORS.skin),
    face: toon(0xffffff, { map: faceTex() }),
    robe: toon(COLORS.robe),
    trim: toon(COLORS.trim),
    hakama: toon(COLORS.hakama),
    hair: toon(COLORS.hair),
    obi: toon(COLORS.obi),
    tabi: toon(COLORS.tabi),
    zori: toon(COLORS.zori),
    paper: toon(COLORS.paper, { side: THREE.DoubleSide }),
    mask: toon(0xffffff, { map: foxMaskTex() }),
    crest: toon(0xffffff, { map: crestTex(), transparent: true, alphaTest: 0.4 }),
  };
  const flashMats = [M.skin, M.face, M.robe, M.hakama, M.hair];

  const root = new THREE.Group();
  const body = joint(root);                        // whole-body offset (falls, lifts)
  const hips = joint(body, 0, 0.84, 0);

  // ---------- hakama (pleated trousers) ----------
  hips.add(bake([
    { geo: lathe([[0.16, -0.16], [0.175, -0.06], [0.165, 0.04], [0.15, 0.1]]), mat: M.hakama, s: [1, 1, 0.82] },
  ]));

  const leg = (sx) => {
    const hip = joint(hips, sx * 0.095, -0.03, 0);
    // one continuous flare split at the knee, so both halves shade alike
    hip.add(bake([{ geo: lathe([[0.088, 0.02], [0.105, -0.2], [0.123, -0.41]], 14), mat: M.hakama }]));
    const knee = joint(hip, 0, -0.38, 0);
    knee.add(bake([
      { geo: lathe([[0.12, 0.03], [0.137, -0.17], [0.152, -0.36]], 14), mat: M.hakama },
      { geo: new THREE.SphereGeometry(0.06, 12, 10), mat: M.tabi, p: [0, -0.39, -0.03], s: [0.95, 0.75, 1.7] },
      { geo: new THREE.BoxGeometry(0.11, 0.025, 0.24), mat: M.zori, p: [0, -0.43, -0.035] },
    ], { outline: 0.012 }));
    return { hip, knee };
  };
  const legL = leg(-1), legR = leg(1);

  // ---------- torso ----------
  const spine = joint(hips, 0, 0.08, 0);
  spine.add(bake([
    { geo: lathe([[0.15, -0.02], [0.17, 0.1], [0.185, 0.22], [0.18, 0.32], [0.14, 0.4], [0.07, 0.45]]), mat: M.robe, s: [1, 1, 0.8] },
    { geo: new THREE.CylinderGeometry(0.162, 0.158, 0.1, 22), mat: M.obi, p: [0, 0.03, 0], s: [1, 1, 0.82] },
    { geo: new THREE.TorusGeometry(0.162, 0.012, 6, 28), mat: M.trim, p: [0, 0.01, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.83, 1] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), mat: M.trim, p: [0.07, 0.01, -0.13] },
    { geo: new THREE.CapsuleGeometry(0.01, 0.07, 3, 6), mat: M.trim, p: [0.08, -0.04, -0.13], r: [0, 0, 0.2] },
    { geo: new THREE.TorusGeometry(0.075, 0.022, 8, 20), mat: M.trim, p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.SphereGeometry(0.075, 14, 10), mat: M.robe, p: [-0.175, 0.35, 0] },
    { geo: new THREE.SphereGeometry(0.075, 14, 10), mat: M.robe, p: [0.175, 0.35, 0] },
    { geo: new THREE.CylinderGeometry(0.048, 0.055, 0.12, 10), mat: M.skin, p: [0, 0.47, 0] },
  ]));
  // pentagram crest on the back
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), M.crest);
  crest.position.set(0, 0.24, 0.149);
  spine.add(crest);
  // a few spare talismans tucked into the obi
  const charms = joint(spine, 0.13, 0.0, 0.08);
  charms.add(bake([0, 1, 2].map((i) => ({
    geo: new THREE.PlaneGeometry(0.045, 0.11), mat: M.paper, p: [i * 0.018, -0.05 - i * 0.008, i * 0.012], r: [0, 0.5, 0.12 * i],
  })), { outline: 0 }));

  // ---------- head ----------
  const head = joint(spine, 0, 0.56, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 24), M.face);
  skull.scale.set(1, 1.05, 1);
  head.add(skull);
  addOutline(skull, 0.012);
  const bang = (x) => ({
    geo: taperedTube([[x, 0.15, -0.12], [x * 1.08, 0.08, -0.185], [x * 1.12, -0.01, -0.19]], 0.035, { tip: 0.15 }), mat: M.hair,
  });
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.193, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), mat: M.hair, p: [0, 0.012, 0.005] },
    { geo: new THREE.SphereGeometry(0.191, 24, 16, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.28, Math.PI * 0.42), mat: M.hair },
    ...[-0.11, -0.06, -0.01, 0.04, 0.09].map(bang),
    { geo: taperedTube([[-0.15, 0.09, -0.07], [-0.175, -0.04, -0.07], [-0.165, -0.16, -0.05]], 0.04, { tip: 0.2 }), mat: M.hair },
    { geo: taperedTube([[0.15, 0.09, -0.07], [0.175, -0.04, -0.07], [0.165, -0.16, -0.05]], 0.04, { tip: 0.2 }), mat: M.hair },
    ...[-0.08, 0, 0.08].map((x) => ({ geo: taperedTube([[x, 0.17, -0.04], [x * 1.2, 0.21, 0.06], [x * 1.3, 0.18, 0.15]], 0.045, { tip: 0.2 }), mat: M.hair })),
    { geo: new THREE.SphereGeometry(0.035, 10, 8), mat: M.skin, p: [-0.178, -0.01, -0.01], s: [0.5, 1, 0.8] },
    { geo: new THREE.SphereGeometry(0.035, 10, 8), mat: M.skin, p: [0.178, -0.01, -0.01], s: [0.5, 1, 0.8] },
  ], { outline: 0.01 }));

  // fox mask tilted on the left side of the head
  const mask = joint(head, -0.17, 0.07, 0.0);
  mask.rotation.set(0, Math.PI / 2 + 0.25, -0.35);
  mask.add(bake([
    { geo: new THREE.SphereGeometry(0.1, 20, 14), mat: M.mask, s: [0.95, 1.1, 0.45] },
    { geo: new THREE.ConeGeometry(0.035, 0.08, 8), mat: M.mask, p: [-0.06, 0.12, 0], r: [0, 0, 0.3] },
    { geo: new THREE.ConeGeometry(0.035, 0.08, 8), mat: M.mask, p: [0.06, 0.12, 0], r: [0, 0, -0.3] },
  ], { outline: 0.008 }));

  // high ponytail: a jointed chain that streams behind when running
  const tie = joint(head, 0, 0.13, 0.15);
  tie.add(bake([{ geo: new THREE.TorusGeometry(0.04, 0.016, 8, 16), mat: M.trim, r: [0.6, 0, 0] }], { outline: 0.008 }));
  const tail = [];
  let parent = tie;
  const radii = [0.055, 0.06, 0.052, 0.04, 0.026, 0.012];
  for (let i = 0; i < 5; i++) {
    const seg = joint(parent, 0, i ? -0.11 : 0, 0);
    seg.add(bake([{ geo: lathe([[radii[i], 0.01], [radii[i] * 1.12, -0.055], [radii[i + 1], -0.12]], 12), mat: M.hair }], { outline: 0.008 }));
    tail.push(seg);
    parent = seg;
  }
  // red cord streamers from the tie
  const cords = [-1, 1].map((sx) => {
    const c = joint(tie, sx * 0.02, 0, 0.02);
    c.add(bake([{ geo: taperedTube([[0, 0, 0], [sx * 0.02, -0.1, 0.03], [sx * 0.01, -0.2, 0.02]], 0.012, { tip: 0.5 }), mat: M.trim }], { outline: 0 }));
    return c;
  });

  // ---------- arms + wide sleeves ----------
  const arm = (sx) => {
    const shoulder = joint(spine, sx * 0.2, 0.35, 0);
    shoulder.add(bake([{ geo: new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), mat: M.robe, p: [0, -0.13, 0] }], { outline: 0.012 }));
    const elbow = joint(shoulder, 0, -0.27, 0);
    elbow.add(bake([
      { geo: new THREE.CapsuleGeometry(0.042, 0.13, 4, 10), mat: M.robe, p: [0, -0.1, 0] },
      { geo: new THREE.SphereGeometry(0.045, 12, 10), mat: M.skin, p: [0, -0.23, 0], s: [0.85, 1.1, 0.75] },
      { geo: new THREE.CapsuleGeometry(0.012, 0.05, 3, 6), mat: M.skin, p: [-0.012 * sx, -0.3, -0.005] },
      { geo: new THREE.CapsuleGeometry(0.012, 0.05, 3, 6), mat: M.skin, p: [0.012 * sx, -0.3, -0.005] },
    ], { outline: 0.01 }));
    const hand = joint(elbow, 0, -0.3, 0);
    // the big kariginu sleeve hangs from the shoulder and lags behind the arm
    const sleeve = joint(shoulder, sx * 0.03, -0.05, 0);
    sleeve.add(bake([
      { geo: new THREE.CapsuleGeometry(0.09, 0.2, 6, 14), mat: M.robe, p: [sx * 0.015, -0.2, 0.03], s: [0.45, 1, 1.05] },
      { geo: new THREE.TorusGeometry(0.085, 0.014, 6, 16), mat: M.trim, p: [sx * 0.015, -0.33, 0.03], r: [0, Math.PI / 2, 0], s: [1, 1.4, 1] },
    ], { outline: 0.012 }));
    return { shoulder, elbow, hand, sleeve };
  };
  const armL = arm(-1), armR = arm(1);

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  root.add(shadow);

  /* ===================== animation ===================== */
  let phase = 0, castT = 0, hurtT = 0;
  let mode = 'run', modeT = 1;          // run | kneel | grabbed
  const S = Math.sin, Cc = Math.cos;

  function setMode(m) { if (m !== mode) { mode = m; modeT = 0; } }

  return {
    root, body,
    handR: armR.hand,
    chest: spine,
    get mode() { return mode; },
    cast() { castT = 1; },
    hurt() { hurtT = 1; },
    setMode,
    reset() {
      mode = 'run'; modeT = 1; castT = 0; hurtT = 0;
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.setScalar(1);
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      shadow.visible = true;
    },
    update(dt, speed, t) {
      modeT = Math.min(1, modeT + dt * 2.2);
      const amp = Math.min(1, Math.max(0.3, speed / 8));
      if (mode === 'run') phase += dt * (1.5 + speed * 0.075) * Math.PI * 2;
      const s = S(phase);
      const kneeCurve = (p) => -(0.18 + 1.25 * Math.pow(Math.max(0, Cc(p)), 1.5));

      // ---- base: run cycle ----
      const pose = {
        hipsY: 0.84 + 0.035 * Cc(2 * phase) * amp - 0.02 * amp,
        hipsRy: 0.12 * s * amp,
        lean: -0.2 * amp,
        twist: -0.24 * s * amp,
        thighL: 0.75 * s * amp, thighR: -0.75 * s * amp,
        kneeL: kneeCurve(phase) * amp, kneeR: kneeCurve(phase + Math.PI) * amp,
        shL: -0.8 * s * amp, shR: 0.8 * s * amp,
        shLz: -0.14, shRz: 0.14,
        elL: 1.05 + 0.25 * Math.abs(s), elR: 1.05 + 0.25 * Math.abs(s),
        headX: 0.14 * amp, headY: 0.12 * s * amp,
        bodyY: 0,
      };

      // ---- casting: right arm thrust forward, left hand to the chest ----
      castT = Math.max(0, castT - dt * 2.4);
      if (castT > 0) {
        const w = castT > 0.75 ? (1 - castT) / 0.25 : ease(castT / 0.75);
        pose.shR = lerp(pose.shR, 1.6, w); pose.shRz = lerp(pose.shRz, 0.02, w); pose.elR = lerp(pose.elR, 0.05, w);
        pose.shL = lerp(pose.shL, 0.75, w); pose.shLz = lerp(pose.shLz, 0.45, w); pose.elL = lerp(pose.elL, 1.9, w);
        pose.twist = lerp(pose.twist, 0.4, w);
      }

      // ---- capture poses ----
      if (mode !== 'run') {
        const k = ease(modeT);
        const target = mode === 'kneel' ? {
          hipsY: 0.47, hipsRy: 0, lean: 0.28, twist: 0,
          thighL: 0.15, thighR: -0.05, kneeL: -1.6, kneeR: -1.55,
          shL: 1.25, shR: 1.15, shLz: -0.35, shRz: 0.35, elL: 1.5, elR: 1.6,
          headX: 0.5 + 0.05 * S(t * 9), headY: 0.15 * S(t * 3), bodyY: 0,
        } : {
          hipsY: 0.84, hipsRy: 0.15 * S(t * 6), lean: 0.05, twist: 0.2 * S(t * 7),
          thighL: 0.4 * S(t * 13), thighR: 0.4 * S(t * 13 + Math.PI),
          kneeL: -0.6 - 0.4 * Math.max(0, S(t * 13)), kneeR: -0.6 - 0.4 * Math.max(0, S(t * 13 + Math.PI)),
          shL: 0.15, shR: 0.15, shLz: -0.05, shRz: 0.05, elL: 0.6 + 0.4 * S(t * 11), elR: 0.6 + 0.4 * S(t * 11 + 1),
          headX: -0.1 + 0.15 * S(t * 5), headY: 0.45 * S(t * 4), bodyY: 0,
        };
        for (const key in target) pose[key] = lerp(pose[key], target[key], k);
      }

      // ---- hit reaction ----
      hurtT = Math.max(0, hurtT - dt * 2.4);
      pose.lean += 0.45 * hurtT;
      for (const m of flashMats) m.emissive.setRGB(hurtT * 0.9, hurtT * 0.1, hurtT * 0.15);

      // ---- apply ----
      hips.position.y = pose.hipsY;
      hips.rotation.y = pose.hipsRy;
      spine.rotation.set(pose.lean, pose.twist, 0);
      legL.hip.rotation.x = pose.thighL; legR.hip.rotation.x = pose.thighR;
      legL.knee.rotation.x = pose.kneeL; legR.knee.rotation.x = pose.kneeR;
      armL.shoulder.rotation.set(pose.shL, 0, pose.shLz);
      armR.shoulder.rotation.set(pose.shR, 0, pose.shRz);
      armL.elbow.rotation.x = pose.elL; armR.elbow.rotation.x = pose.elR;
      head.rotation.set(pose.headX - pose.lean * 0.6, pose.headY - pose.twist * 0.5, 0);
      body.position.y = pose.bodyY;
      shadow.visible = mode !== 'grabbed';

      // sleeves trail behind and lag the arm swing; ponytail streams in the wind
      const wind = mode === 'grabbed' ? 0.3 : amp;
      for (const [a, sh, sx] of [[armL, pose.shL, -1], [armR, pose.shR, 1]]) {
        a.sleeve.rotation.x = -sh * 0.45 - 0.45 * wind + S(t * 9 + sx) * 0.06 * wind;
        a.sleeve.rotation.z = sx * (0.05 + 0.05 * wind);
      }
      tail.forEach((seg, i) => {
        const base = i === 0 ? -(0.45 + 0.85 * wind) : -0.1 * wind;
        seg.rotation.x = base + S(t * 9 - i * 0.9) * 0.14 * wind + (i ? 0.08 * (1 - wind) : 0);
        seg.rotation.z = S(t * 6.3 - i * 0.8) * 0.1 * wind;
      });
      cords.forEach((c, i) => { c.rotation.x = -0.9 * wind + S(t * 11 + i * 2) * 0.25; });
      charms.rotation.x = -0.3 * wind + S(t * 10) * 0.15;
    },
  };
}
