// yokai.js — the parade. Each factory returns the same small interface:
//   { type, root, info, update(dt,t), center(out), labelAnchor(out), flash(), dispose() }
//
//   onibi   鬼火      will-o'-wisp with a shader flame        (common)
//   chochin 提灯お化け  glowing paper-lantern ghost             (common)
//   kasa    唐傘お化け  one-legged umbrella ghost, hops         (from wave 3)
//   oni     大鬼       boss — the full jointed oni, walking     (every 4 waves)
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube } from './toon.js';
import { glowTex, shadowTex, lanternPaperTex, wagasaTex } from './textures.js';
import { takeOni, releaseOni } from './oni.js';

const YOKAI_INFO = {
  onibi:   { baseY: 1.35, labelY: 1.05, centerY: 0, color: 0x6fd0ff, radius: 0.5 },
  chochin: { baseY: 1.5,  labelY: 0.9,  centerY: 0, color: 0xffa04a, radius: 0.55 },
  kasa:    { baseY: 1.2,  labelY: 0.85, centerY: 0, color: 0xff5f9a, radius: 0.6 },
  oni:     { baseY: 0,    labelY: 3.7,  centerY: 2.1, color: 0xff4a3a, radius: 1.3 },
};
const ONI_SCALE = 0.92;

const shared = {};
const once = (k, make) => shared[k] || (shared[k] = make());
const white = () => once('white', () => toon(0xfffaf0));
const ink = () => once('ink', () => new THREE.MeshBasicMaterial({ color: 0x0d0812 }));
const tongue = () => once('tongue', () => toon(0xe84a64, { emissive: 0x3a0010 }));
const darkWood = () => once('darkWood', () => toon(0x1d1418));

function glowSprite(color, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(scale);
  return s;
}

/* ---------- billboard flame shader (onibi) ---------- */
function flameMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, seed: { value: seed },
      cCore: { value: glow(0xd8f6ff, 1.5) }, cMid: { value: glow(0x3fb2ff, 1.05) }, cEdge: { value: glow(0x2443ff, 0.7) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform float seed;
      uniform vec3 cCore; uniform vec3 cMid; uniform vec3 cEdge;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        float y = vUv.y;
        float sway = (fbm(vec2(y * 2.0 - time * 1.3, seed)) - 0.5) * 0.4 * y;
        vec2 q = vec2(vUv.x - 0.5 - sway, y - 0.3);
        float width = q.y < 0.0 ? 0.25 : mix(0.25, 0.015, smoothstep(0.0, 0.66, q.y));
        float d = length(vec2(abs(q.x) / max(width, 0.001), q.y < 0.0 ? -q.y / 0.24 : 0.0));
        float n = fbm(vec2(vUv.x * 5.0 + seed, y * 4.0 - time * 3.4));
        float a = smoothstep(1.0, 0.3, d + (n - 0.5) * 0.8 * smoothstep(0.05, 0.55, y));
        a *= smoothstep(1.0, 0.72, y);
        vec3 col = mix(cEdge, cMid, smoothstep(0.1, 0.55, a));
        col = mix(col, cCore, smoothstep(0.62, 1.0, a) * (1.0 - smoothstep(0.32, 0.62, y)));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/* ===================== onibi ===================== */
function buildOnibi(body, seed) {
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
    flame.material.uniforms.time.value = t;
    halo.material.opacity = 0.3 + 0.08 * Math.sin(t * 6 + seed);
    sparks.forEach((s, i) => {
      const a = t * 2.2 + i * Math.PI + seed;
      s.position.set(Math.cos(a) * 0.42, 0.1 + Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.42);
    });
  };
}

/* ===================== chōchin-obake ===================== */
function buildChochin(body) {
  const paperTex = lanternPaperTex();
  const paper = once('lanternMat', () => toon(0xffffff, {
    map: paperTex, emissive: new THREE.Color(0xff7a2a), emissiveMap: paperTex, emissiveIntensity: 0.85, side: THREE.DoubleSide,
  }));
  const lantern = new THREE.Group();
  body.add(lantern);
  lantern.add(bake([
    { geo: lathe([[0.17, -0.5], [0.33, -0.42], [0.42, -0.2], [0.445, 0.02], [0.415, 0.24], [0.32, 0.42], [0.17, 0.5]], 24), mat: paper },
  ], { outline: 0.016 }));
  lantern.add(bake([
    { geo: lathe([[0.2, 0.47], [0.225, 0.51], [0.2, 0.56], [0.06, 0.58]], 18), mat: darkWood() },
    { geo: lathe([[0.06, -0.58], [0.2, -0.56], [0.225, -0.51], [0.2, -0.47]], 18), mat: darkWood() },
    { geo: new THREE.TorusGeometry(0.07, 0.016, 6, 14), mat: darkWood(), p: [0, 0.66, 0] },
    // one huge eye, slit pupil
    { geo: new THREE.SphereGeometry(0.16, 18, 14), mat: white(), p: [0.07, 0.13, 0.4], s: [1, 1.05, 0.5] },
    { geo: new THREE.SphereGeometry(0.085, 14, 10), mat: once('iris', () => toon(0x8a1414)), p: [0.08, 0.12, 0.465], s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: ink(), p: [0.08, 0.12, 0.495], s: [0.35, 1.3, 0.4] },
    // torn-paper grin with fangs
    { geo: new THREE.SphereGeometry(0.2, 16, 8), mat: once('maw', () => toon(0x2a0610)), p: [0, -0.17, 0.4], s: [1.15, 0.32, 0.25] },
    { geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: white(), p: [-0.1, -0.14, 0.44], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.03, 0.08, 6), mat: white(), p: [0.12, -0.14, 0.44], r: [Math.PI, 0, 0] },
  ], { outline: 0.012 }));
  const tongueJ = joint(lantern, 0.05, -0.19, 0.44);
  tongueJ.add(bake([{ geo: taperedTube([[0, 0, 0], [0.02, -0.12, 0.1], [0.06, -0.3, 0.09], [0.03, -0.48, -0.02]], 0.06, { tip: 0.5 }), mat: tongue() }], { outline: 0.01 }));
  body.add(glowSprite(0xff8a3a, 2.2, 0.4));
  return (t, seed) => {
    lantern.rotation.z = Math.sin(t * 1.8 + seed) * 0.16;
    lantern.rotation.y = Math.sin(t * 0.9 + seed) * 0.2;
    tongueJ.rotation.z = Math.sin(t * 5 + seed) * 0.35;
    tongueJ.rotation.x = Math.sin(t * 3.3 + seed) * 0.15;
  };
}

/* ===================== kasa-obake ===================== */
function buildKasa(body) {
  const canopyMat = once('wagasa', () => toon(0xffffff, { map: wagasaTex(), side: THREE.DoubleSide }));
  const top = new THREE.Group();
  body.add(top);
  top.add(bake([
    { geo: new THREE.ConeGeometry(0.85, 0.72, 16, 1, true), mat: canopyMat },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), mat: darkWood(), p: [0, 0.44, 0] },
    { geo: new THREE.ConeGeometry(0.09, 0.1, 10), mat: darkWood(), p: [0, 0.38, 0] },
  ], { outline: 0.016 }));
  const face = joint(top, 0, -0.02, 0.43);
  face.rotation.x = -0.86;                       // follow the canopy's slope
  face.add(bake([
    { geo: new THREE.SphereGeometry(0.16, 18, 14), mat: white(), s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.085, 14, 10), mat: once('iris2', () => toon(0x2a1a6a)), p: [0, 0, 0.06], s: [1, 1, 0.45] },
    { geo: new THREE.SphereGeometry(0.045, 10, 8), mat: ink(), p: [0, 0, 0.085], s: [1, 1, 0.4] },
  ], { outline: 0.01 }));
  const tongueJ = joint(top, 0, -0.2, 0.6);
  tongueJ.add(bake([
    { geo: new THREE.SphereGeometry(0.11, 12, 8), mat: once('maw', () => toon(0x2a0610)), s: [1.2, 0.5, 0.4], r: [-0.86, 0, 0] },
    { geo: taperedTube([[0, 0, 0.02], [0.04, -0.14, 0.17], [0.0, -0.36, 0.2], [-0.05, -0.56, 0.1]], 0.065, { tip: 0.5 }), mat: tongue() },
  ], { outline: 0.01 }));
  const legJ = joint(body, 0, -0.36, 0);
  legJ.add(bake([
    { geo: new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), mat: once('legSkin', () => toon(0xe9dcc8)), p: [0, -0.26, 0] },
    { geo: new THREE.BoxGeometry(0.22, 0.06, 0.34), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.56, 0.02] },
    { geo: new THREE.BoxGeometry(0.2, 0.07, 0.04), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.62, -0.08] },
    { geo: new THREE.BoxGeometry(0.2, 0.07, 0.04), mat: once('wood', () => toon(0x7a4e2c)), p: [0, -0.62, 0.12] },
  ], { outline: 0.012 }));
  body.add(glowSprite(glow(0xff4f8a, 1), 1.6, 0.35));
  return (t, seed, self) => {
    const hop = Math.abs(Math.sin(t * 3.2 + seed));
    self.hop = hop * 0.55;
    const squash = 1 - hop;
    top.scale.set(1 + squash * 0.08, 1 - squash * 0.1, 1 + squash * 0.08);
    top.rotation.z = Math.sin(t * 3.2 + seed) * 0.12;
    legJ.scale.y = 0.85 + hop * 0.15;
    tongueJ.rotation.z = Math.sin(t * 6 + seed) * 0.3;
  };
}

/* ===================== factory ===================== */
export function createYokai(type) {
  const info = YOKAI_INFO[type];
  const root = new THREE.Group();
  const seed = Math.random() * 10;

  const shadow = new THREE.Mesh(
    once('shadowPlane', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.scale.setScalar(info.radius * (type === 'oni' ? 3 : 2.4));
  root.add(shadow);

  if (type === 'oni') {
    const oni = takeOni();
    oni.root.scale.setScalar(ONI_SCALE);
    oni.setMode('walk');
    oni.roar();
    root.add(oni.root);
    return {
      type, root, info, oni,
      update(dt, t) { oni.update(dt, t, 1); },
      center(out) { return out.set(root.position.x, info.centerY, root.position.z); },
      labelAnchor(out) { return out.set(root.position.x, info.labelY, root.position.z); },
      flash() { oni.flash(); },
      dispose() { releaseOni(oni); shadow.material.dispose(); },
    };
  }

  const body = new THREE.Group();
  root.add(body);
  const animate = { onibi: buildOnibi, chochin: buildChochin, kasa: buildKasa }[type](body, seed);
  let flashT = 0;
  const self = {
    type, root, info, hop: 0,
    update(dt, t) {
      self.hop = 0;
      animate(t, seed, self);
      body.position.y = info.baseY + Math.sin(t * 2.4 + seed) * 0.15 + self.hop;
      flashT = Math.max(0, flashT - dt * 5);
      body.scale.setScalar(1 + flashT * 0.25);
      shadow.material.opacity = 0.9 - Math.min(0.6, self.hop);
    },
    center(out) { return out.set(root.position.x, body.position.y, root.position.z); },
    labelAnchor(out) { return out.set(root.position.x, body.position.y + info.labelY, root.position.z); },
    flash() { flashT = 1; },
    dispose() {
      // shared materials/geometries and the cached outline shader stay alive;
      // baked meshes may carry an array of materials
      const keep = new Set(Object.values(shared));
      root.traverse((o) => {
        for (const m of [].concat(o.material || [])) {
          if (keep.has(m)) continue;
          if (m.isShaderMaterial && !m.uniforms?.seed) continue;
          m.dispose();
        }
        if (o.geometry && !keep.has(o.geometry) && !o.isSprite) o.geometry.dispose();
      });
    },
  };
  return self;
}
