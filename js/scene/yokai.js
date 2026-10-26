// yokai.js — the parade. Each factory returns the same small interface:
//   { type, root, info, update(dt,t), center(out), labelAnchor(out), flash(), dispose() }
//
//   onibi     鬼火      will-o'-wisp with a shader flame
//   chochin   提灯お化け  glowing paper-lantern ghost
//   hitotsume 一つ目小僧  one-eyed little monk in a straw hat, hops
//   kappa     河童      river imp with a water dish, waddles
//   kitsunebi 狐火      floating fox mask trailing violet foxfire
//   kasa      唐傘お化け  one-legged umbrella ghost, hops
//   ittan     一反木綿   a flying bolt of cloth, rippling
//   hyakume   百目      a lump covered in eyes, rolls along
//   nekomata  猫又      two-tailed cat dancing on its hind legs
//   tengu     烏天狗     crow-beaked mountain goblin, beating its wings, leaf fan in hand
//   rokurokubi 轆轤首    lady in a kimono whose long neck sways and stretches
//   nopperabo のっぺらぼう faceless man with a lantern, wiping the face he doesn't have
//   kamaitachi 鎌鼬     sickle-pawed weasel riding a little whirlwind, spinning
//   oni       大鬼      boss — the full jointed oni, walking
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube, addOutline } from './toon.js';
import { glowTex, shadowTex, lanternPaperTex, wagasaTex } from './textures.js';
import { takeOni, releaseOni } from './oni.js';

const YOKAI_INFO = {
  onibi:   { baseY: 1.35, labelY: 1.05, centerY: 0, color: 0x6fd0ff, radius: 0.5 },
  chochin: { baseY: 1.5,  labelY: 0.9,  centerY: 0, color: 0xffa04a, radius: 0.55 },
  kasa:    { baseY: 1.2,  labelY: 0.85, centerY: 0, color: 0xff5f9a, radius: 0.6 },
  hitotsume: { baseY: 0.95, labelY: 0.95, centerY: 0, color: 0xffd27a, radius: 0.55 },
  kappa:     { baseY: 0.85, labelY: 0.95, centerY: 0, color: 0x7ae07a, radius: 0.55 },
  kitsunebi: { baseY: 1.45, labelY: 0.8,  centerY: 0, color: 0xa88aff, radius: 0.5 },
  ittan:     { baseY: 1.7,  labelY: 0.6,  centerY: 0, color: 0xe8f4ff, radius: 0.6 },
  hyakume:   { baseY: 0.8,  labelY: 0.95, centerY: 0, color: 0xff9a5a, radius: 0.6 },
  nekomata:  { baseY: 0.9,  labelY: 1.0,  centerY: 0, color: 0xffd9a0, radius: 0.55 },
  tengu:      { baseY: 1.35, labelY: 1.0,  centerY: 0, color: 0x8a9cff, radius: 0.65 },
  rokurokubi: { baseY: 0.95, labelY: 1.95, centerY: 0, color: 0xd28aff, radius: 0.55 },
  nopperabo:  { baseY: 0.95, labelY: 1.15, centerY: 0, color: 0xf3e2cc, radius: 0.55 },
  kamaitachi: { baseY: 1.2,  labelY: 0.85, centerY: 0, color: 0x9affc8, radius: 0.6 },
  oni:     { baseY: 0,    labelY: 3.7,  centerY: 2.1, color: 0xff4a3a, radius: 1.3 },
};
export const YOKAI_TYPES = Object.keys(YOKAI_INFO);
const ONI_SCALE = 0.92;

const shared = {};
const once = (k, make) => shared[k] || (shared[k] = make());
const white = () => once('white', () => toon(0xfffaf0));
const ink = () => once('ink', () => new THREE.MeshBasicMaterial({ color: 0x0d0812 }));
const tongue = () => once('tongue', () => toon(0xe84a64, { emissive: 0x3a0010 }));
const darkWood = () => once('darkWood', () => toon(0x1d1418));
const skin = () => once('skin', () => toon(0xf4dcc0));
const maw = () => once('maw', () => toon(0x2a0610));

// a round eye looking along +z: white, iris, pupil (parts for bake)
function eyeParts(x, y, z, r, iris, s = 1) {
  return [
    { geo: new THREE.SphereGeometry(r, 14, 10), mat: white(), p: [x, y, z], s: [s, s, s * 0.55] },
    { geo: new THREE.SphereGeometry(r * 0.55, 12, 8), mat: iris, p: [x, y, z + r * 0.4], s: [s, s, s * 0.45] },
    { geo: new THREE.SphereGeometry(r * 0.3, 10, 8), mat: ink(), p: [x, y, z + r * 0.58], s: [s, s, s * 0.4] },
  ];
}

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
    { geo: new THREE.SphereGeometry(0.2, 16, 8), mat: maw(), p: [0, -0.17, 0.4], s: [1.15, 0.32, 0.25] },
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
    { geo: new THREE.SphereGeometry(0.11, 12, 8), mat: maw(), s: [1.2, 0.5, 0.4], r: [-0.86, 0, 0] },
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

/* ===================== hitotsume-kozō ===================== */
function buildHitotsume(body) {
  const robe = once('robe', () => toon(0x34477f));
  const straw = once('straw', () => toon(0xd9b561));
  const hop = new THREE.Group();            // everything above the feet rises with the hop
  body.add(hop);
  hop.add(bake([
    // straw hat
    { geo: new THREE.ConeGeometry(0.46, 0.17, 14, 1, true), mat: straw, p: [0, 0.4, 0] },
    { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.06, 8), mat: darkWood(), p: [0, 0.49, 0] },
    // bald head and the robe below it, tied with a red sash
    { geo: new THREE.SphereGeometry(0.3, 20, 16), mat: skin(), p: [0, 0.1, 0] },
    { geo: lathe([[0.14, -0.14], [0.27, -0.4], [0.32, -0.66], [0.28, -0.7]], 16), mat: robe },
    { geo: new THREE.BoxGeometry(0.58, 0.06, 0.5), mat: once('sash', () => toon(0xd8322a)), p: [0, -0.4, 0] },
    { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: robe, p: [-0.3, -0.3, 0.05], r: [0, 0, 1.2] },
    { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: robe, p: [0.3, -0.3, 0.05], r: [0, 0, -1.2] },
    // a wide grin
    { geo: new THREE.SphereGeometry(0.11, 14, 8), mat: maw(), p: [0, -0.06, 0.26], s: [1.3, 0.4, 0.4] },
  ], { outline: 0.014 }));
  // the one eye (its own joint, so it can blink) and a tongue
  const eye = joint(hop, 0, 0.12, 0.24);
  eye.add(bake(eyeParts(0, 0, 0, 0.13, once('irisBrown', () => toon(0x4a2a12)), 1.15), { outline: 0.01 }));
  const tongueJ = joint(hop, 0, -0.08, 0.3);
  tongueJ.add(bake([{ geo: taperedTube([[0, 0, 0], [0.01, -0.1, 0.08], [0.03, -0.24, 0.06], [0.0, -0.36, 0.0]], 0.045, { tip: 0.5 }), mat: tongue() }], { outline: 0.01 }));
  body.add(bake([
    { geo: new THREE.SphereGeometry(0.09, 10, 8), mat: skin(), p: [-0.13, -0.74, 0.05], s: [1, 0.5, 1.3] },
    { geo: new THREE.SphereGeometry(0.09, 10, 8), mat: skin(), p: [0.13, -0.74, 0.05], s: [1, 0.5, 1.3] },
  ], { outline: 0.012 }));
  body.add(glowSprite(0xffd27a, 1.6, 0.22));
  return (t, seed, self) => {
    const k = Math.abs(Math.sin(t * 2.6 + seed));
    self.hop = k * 0.3;
    hop.position.y = k * 0.04;
    hop.rotation.z = Math.sin(t * 2.6 + seed) * 0.08;
    hop.rotation.y = Math.sin(t * 0.8 + seed) * 0.25;
    eye.scale.y = (t + seed) % 3.1 < 0.14 ? 0.1 : 1;         // a blink now and then
    tongueJ.rotation.z = Math.sin(t * 4 + seed) * 0.3;
  };
}

/* ===================== kappa ===================== */
function buildKappa(body) {
  const green = once('kappa', () => toon(0x5aa65a));
  const shell = once('shell', () => toon(0x6e4b2a));
  const torso = new THREE.Group();
  body.add(torso);
  torso.add(bake([
    { geo: lathe([[0.0, -0.55], [0.26, -0.5], [0.36, -0.25], [0.33, 0.0], [0.2, 0.12], [0, 0.16]], 18), mat: green },
    { geo: new THREE.SphereGeometry(0.3, 16, 12), mat: once('belly', () => toon(0xdbe9a8)), p: [0, -0.24, 0.2], s: [0.8, 0.95, 0.4] },
    // the shell on its back, scored with a couple of ridges
    { geo: new THREE.SphereGeometry(0.42, 14, 10), mat: shell, p: [0, -0.2, -0.24], s: [0.95, 1.0, 0.4] },
    { geo: new THREE.TorusGeometry(0.3, 0.025, 6, 16), mat: shell, p: [0, -0.2, -0.36] },
    { geo: new THREE.TorusGeometry(0.16, 0.025, 6, 12), mat: shell, p: [0, -0.2, -0.4] },
    // legs and webbed feet
    { geo: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), mat: green, p: [-0.17, -0.6, 0] },
    { geo: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), mat: green, p: [0.17, -0.6, 0] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: green, p: [-0.17, -0.72, 0.06], s: [1.1, 0.4, 1.4] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: green, p: [0.17, -0.72, 0.06], s: [1.1, 0.4, 1.4] },
  ], { outline: 0.014 }));
  const head = joint(torso, 0, 0.28, 0.02);
  const irisDark = once('irisDark', () => toon(0x1a1a2a));
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.28, 20, 16), mat: green },
    // the ring of hair and the dish of water on top
    { geo: new THREE.TorusGeometry(0.21, 0.07, 8, 18), mat: once('kappaHair', () => toon(0x1f4a2e)), p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0] },
    { geo: new THREE.CylinderGeometry(0.17, 0.15, 0.04, 16), mat: once('dish', () => new THREE.MeshBasicMaterial({ color: glow(0x8fd8ff, 1.3) })), p: [0, 0.25, 0] },
    // beak
    { geo: new THREE.ConeGeometry(0.1, 0.22, 10), mat: once('beak', () => toon(0xf0c050)), p: [0, -0.02, 0.33], r: [Math.PI / 2, 0, 0] },
    ...eyeParts(-0.12, 0.08, 0.2, 0.075, irisDark),
    ...eyeParts(0.12, 0.08, 0.2, 0.075, irisDark),
  ], { outline: 0.014 }));
  const arms = [-1, 1].map((sx) => {
    const a = joint(torso, sx * 0.3, -0.12, 0.08);
    a.add(bake([
      { geo: new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), mat: green, p: [sx * 0.08, -0.12, 0.04], r: [0, 0, -sx * 0.5] },
      { geo: new THREE.SphereGeometry(0.07, 8, 6), mat: green, p: [sx * 0.14, -0.26, 0.08], s: [1.2, 0.5, 1.2] },
    ], { outline: 0.012 }));
    return a;
  });
  body.add(glowSprite(0x7ae07a, 1.6, 0.18));
  return (t, seed, self) => {
    const w = Math.sin(t * 5 + seed);
    self.hop = Math.abs(w) * 0.08;
    torso.rotation.z = w * 0.07;
    head.rotation.z = -w * 0.08;
    head.rotation.y = Math.sin(t * 1.1 + seed) * 0.3;
    arms[0].rotation.x = w * 0.5; arms[1].rotation.x = -w * 0.5;
  };
}

/* ===================== kitsunebi ===================== */
function buildKitsunebi(body, seed) {
  const bone = once('maskWhite', () => toon(0xfbf7ef));
  const red = once('maskRed', () => toon(0xd8322a));
  const mask = new THREE.Group();
  body.add(mask);
  mask.add(bake([
    { geo: new THREE.SphereGeometry(0.3, 20, 16), mat: bone, s: [0.85, 1.05, 0.45] },
    { geo: new THREE.ConeGeometry(0.1, 0.26, 8), mat: bone, p: [-0.2, 0.3, -0.02], r: [0, 0, 0.45] },
    { geo: new THREE.ConeGeometry(0.1, 0.26, 8), mat: bone, p: [0.2, 0.3, -0.02], r: [0, 0, -0.45] },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 8), mat: red, p: [-0.2, 0.3, 0.04], r: [0, 0, 0.45] },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 8), mat: red, p: [0.2, 0.3, 0.04], r: [0, 0, -0.45] },
    // slanted eyes, cheek strokes, a forehead mark and the nose
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: ink(), p: [-0.12, 0.07, 0.12], r: [0, 0, 0.35], s: [1, 0.3, 0.3] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: ink(), p: [0.12, 0.07, 0.12], r: [0, 0, -0.35], s: [1, 0.3, 0.3] },
    { geo: new THREE.BoxGeometry(0.14, 0.025, 0.02), mat: red, p: [-0.18, -0.03, 0.11], r: [0, 0.6, 0.5] },
    { geo: new THREE.BoxGeometry(0.14, 0.025, 0.02), mat: red, p: [0.18, -0.03, 0.11], r: [0, -0.6, -0.5] },
    { geo: new THREE.ConeGeometry(0.035, 0.12, 6), mat: red, p: [0, 0.2, 0.13], r: [Math.PI, 0, 0] },
    { geo: new THREE.SphereGeometry(0.035, 8, 6), mat: ink(), p: [0, -0.16, 0.13] },
  ], { outline: 0.012 }));
  // foxfire: the flame shader in violet — one behind the mask, two smaller at its sides
  const flames = [[0, -0.1, -0.12, 1.15], [-0.42, -0.25, -0.05, 0.6], [0.42, -0.25, -0.05, 0.6]].map(([x, y, z, sc], i) => {
    const m = flameMaterial(seed + i * 3);
    m.uniforms.cCore.value = glow(0xffffff, 1.3);
    m.uniforms.cMid.value = glow(0xa98cff, 1.1);
    m.uniforms.cEdge.value = glow(0x5a2dff, 0.8);
    const f = new THREE.Mesh(once('flamePlane', () => new THREE.PlaneGeometry(1.25, 1.8)), m);
    f.position.set(x, y + 0.3 * sc, z);
    f.scale.setScalar(sc);
    body.add(f);
    return f;
  });
  body.add(glowSprite(0x7a5aff, 2, 0.35));
  const wisps = [0, 1, 2].map(() => { const w = glowSprite(glow(0xc4b0ff, 1.4), 0.22, 1); body.add(w); return w; });
  return (t) => {
    for (const f of flames) f.material.uniforms.time.value = t;
    mask.rotation.z = Math.sin(t * 1.4 + seed) * 0.12;
    mask.rotation.y = Math.sin(t * 0.7 + seed) * 0.3;
    mask.position.y = Math.sin(t * 3 + seed) * 0.04;
    wisps.forEach((w, i) => {
      const a = t * 1.8 + (i * Math.PI * 2) / 3 + seed;
      w.position.set(Math.cos(a) * 0.6, -0.1 + Math.sin(a * 1.4) * 0.25, Math.sin(a) * 0.5);
    });
  };
}

/* ===================== ittan-momen ===================== */
function buildIttan(body) {
  // a strip of cloth streaming back from its face, rippled every frame on the CPU
  const clothMat = once('cloth', () => toon(0xf4efe4, { side: THREE.DoubleSide }));
  const geo = new THREE.PlaneGeometry(0.55, 2.6, 2, 18);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -1.0);
  const base = geo.attributes.position.array.slice();
  body.add(new THREE.Mesh(geo, clothMat));
  const face = joint(body, 0, 0.03, 0.12);
  face.add(bake([
    { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: ink(), p: [-0.12, 0.04, 0], s: [1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: ink(), p: [0.12, 0.04, 0], s: [1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: maw(), p: [0, 0.02, -0.16], s: [1.4, 0.4, 0.7] },
    // two little cloth arms
    { geo: new THREE.BoxGeometry(0.3, 0.02, 0.12), mat: clothMat, p: [-0.38, -0.02, -0.45], r: [0, 0.4, 0.3] },
    { geo: new THREE.BoxGeometry(0.3, 0.02, 0.12), mat: clothMat, p: [0.38, -0.02, -0.45], r: [0, -0.4, -0.3] },
  ], { outline: 0.01 }));
  body.add(glowSprite(0xcfe8ff, 1.6, 0.22));
  const pos = geo.attributes.position;
  // the front rears up like a cobra so the face shows head-on; the tail trails and ripples
  const curl = (z) => (z > -0.5 ? Math.pow((z + 0.5) / 0.8, 1.7) * 0.7 : 0);
  const ripple = (z, t, seed) => Math.sin(z * 2.4 + t * 5 + seed) * 0.16 * (0.3 + (0.7 * (0.3 - z)) / 2.6);
  return (t, seed) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.setXYZ(i, x + Math.sin(z * 1.3 - t * 3 + seed) * 0.05, curl(z) + ripple(z, t, seed), z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    face.position.y = curl(0.3) + 0.02 + ripple(0.3, t, seed);
    face.rotation.x = -1.1 - Math.cos(0.3 * 2.4 + t * 5 + seed) * 0.25;
    body.rotation.z = Math.sin(t * 1.2 + seed) * 0.12;
  };
}

/* ===================== hyakume ===================== */
function buildHyakume(body) {
  const flesh = once('flesh', () => toon(0xc98f74));
  const iris = once('irisRed', () => toon(0x6a1a1a));
  const blob = new THREE.Group();
  body.add(blob);
  // eyes all over the upper body, each turned to look straight out of the surface
  const parts = [
    { geo: new THREE.SphereGeometry(0.48, 24, 18), mat: flesh, s: [1, 0.95, 0.95] },
    { geo: new THREE.SphereGeometry(0.1, 12, 8), mat: maw(), p: [0, -0.22, 0.42], s: [1.6, 0.35, 0.4] },
  ];
  const n = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), out = new THREE.Vector3(0, 0, 1);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const y = 0.92 - (i / (N - 1)) * 1.3;                     // a spiral down the sphere, skipping the underside
    const r = Math.sqrt(1 - y * y), a = i * 2.39996;
    n.set(Math.cos(a) * r, y, Math.sin(a) * r);
    if (n.z > 0.75 && Math.abs(n.x) < 0.3) continue;         // leave room for the two big ones
    e.setFromQuaternion(q.setFromUnitVectors(out, n));
    const size = 0.06 + ((i * 7) % 5) * 0.008;
    parts.push({ geo: new THREE.SphereGeometry(size, 12, 8), mat: white(), p: [n.x * 0.45, n.y * 0.43, n.z * 0.43], r: [e.x, e.y, e.z], s: [1, 1, 0.5] });
    parts.push({ geo: new THREE.SphereGeometry(size * 0.5, 10, 8), mat: iris, p: [n.x * 0.475, n.y * 0.452, n.z * 0.452], r: [e.x, e.y, e.z], s: [1, 1, 0.4] });
    parts.push({ geo: new THREE.SphereGeometry(size * 0.25, 8, 6), mat: ink(), p: [n.x * 0.49, n.y * 0.466, n.z * 0.466], r: [e.x, e.y, e.z], s: [1, 1, 0.4] });
  }
  blob.add(bake(parts, { outline: 0.014 }));
  // the two big front eyes blink
  const bigEyes = [-0.16, 0.16].map((x) => {
    const j = joint(blob, x, 0.08, 0.42);
    j.add(bake(eyeParts(0, 0, 0, 0.1, iris, 1.1), { outline: 0.01 }));
    return j;
  });
  body.add(bake([
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: flesh, p: [-0.18, -0.5, 0.08], s: [1.1, 0.4, 1.4] },
    { geo: new THREE.SphereGeometry(0.1, 10, 8), mat: flesh, p: [0.18, -0.5, 0.08], s: [1.1, 0.4, 1.4] },
  ], { outline: 0.012 }));
  body.add(glowSprite(0xffb07a, 1.9, 0.22));
  return (t, seed, self) => {
    const k = Math.abs(Math.sin(t * 2.2 + seed));
    self.hop = k * 0.18;
    blob.scale.set(1 + (1 - k) * 0.06, 1 - (1 - k) * 0.08, 1 + (1 - k) * 0.06);
    blob.rotation.y = Math.sin(t * 0.9 + seed) * 0.35;
    blob.rotation.z = Math.sin(t * 2.2 + seed) * 0.06;
    const blink = (t + seed * 0.7) % 2.7 < 0.12;
    for (const j of bigEyes) j.scale.y = blink ? 0.1 : 1;
  };
}

/* ===================== nekomata ===================== */
function buildNekomata(body) {
  const fur = once('fur', () => toon(0xf2dcb4));
  const fur2 = once('fur2', () => toon(0x8a5a3a));
  const cloth = once('tenugui', () => toon(0xd8322a));
  const gold = once('catEye', () => toon(0xf2c23a, { emissive: 0x4a3000 }));
  const torso = new THREE.Group();
  body.add(torso);
  torso.add(bake([
    // standing on its hind legs: a pear-shaped body, a round head with pointed ears
    { geo: lathe([[0.0, -0.5], [0.24, -0.46], [0.3, -0.2], [0.24, 0.05], [0.12, 0.14]], 16), mat: fur },
    { geo: new THREE.SphereGeometry(0.2, 14, 10), mat: fur2, p: [0, -0.2, -0.18], s: [1.1, 1.1, 0.5] },   // darker back
    { geo: new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), mat: fur, p: [-0.14, -0.55, 0.02] },
    { geo: new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), mat: fur, p: [0.14, -0.55, 0.02] },
    { geo: new THREE.SphereGeometry(0.08, 10, 8), mat: fur, p: [-0.14, -0.64, 0.06], s: [1.1, 0.5, 1.4] },
    { geo: new THREE.SphereGeometry(0.08, 10, 8), mat: fur, p: [0.14, -0.64, 0.06], s: [1.1, 0.5, 1.4] },
  ], { outline: 0.014 }));
  const head = joint(torso, 0, 0.32, 0.04);
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.28, 20, 16), mat: fur, s: [1.1, 0.95, 1] },
    { geo: new THREE.ConeGeometry(0.09, 0.22, 8), mat: fur, p: [-0.19, 0.3, -0.02], r: [0, 0, 0.5] },
    { geo: new THREE.ConeGeometry(0.09, 0.22, 8), mat: fur, p: [0.19, 0.3, -0.02], r: [0, 0, -0.5] },
    { geo: new THREE.ConeGeometry(0.045, 0.12, 8), mat: once('earPink', () => toon(0xe88a9a)), p: [-0.19, 0.3, 0.03], r: [0, 0, 0.5] },
    { geo: new THREE.ConeGeometry(0.045, 0.12, 8), mat: once('earPink', () => toon(0xe88a9a)), p: [0.19, 0.3, 0.03], r: [0, 0, -0.5] },
    // the tenugui cloth tied over its head, the way a dancing cat wears one
    { geo: new THREE.SphereGeometry(0.3, 16, 12), mat: cloth, p: [0, 0.04, -0.02], s: [1.08, 0.8, 1.0], r: [0.2, 0, 0] },
    { geo: new THREE.BoxGeometry(0.16, 0.05, 0.28), mat: cloth, p: [0.22, 0.14, 0.12], r: [0.3, -0.6, -0.4] },
    // slit eyes, nose, whiskers, a smiling mouth
    { geo: new THREE.SphereGeometry(0.075, 12, 8), mat: gold, p: [-0.11, 0.02, 0.25], s: [1, 1.1, 0.5] },
    { geo: new THREE.SphereGeometry(0.075, 12, 8), mat: gold, p: [0.11, 0.02, 0.25], s: [1, 1.1, 0.5] },
    { geo: new THREE.SphereGeometry(0.03, 8, 6), mat: ink(), p: [-0.11, 0.02, 0.28], s: [0.4, 1.4, 0.4] },
    { geo: new THREE.SphereGeometry(0.03, 8, 6), mat: ink(), p: [0.11, 0.02, 0.28], s: [0.4, 1.4, 0.4] },
    { geo: new THREE.SphereGeometry(0.035, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [0, -0.08, 0.3], s: [1.3, 0.8, 0.8] },
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: maw(), p: [0, -0.15, 0.27], s: [1.6, 0.35, 0.5] },
    { geo: new THREE.ConeGeometry(0.02, 0.06, 6), mat: white(), p: [-0.05, -0.15, 0.29], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.02, 0.06, 6), mat: white(), p: [0.05, -0.15, 0.29], r: [Math.PI, 0, 0] },
    ...[-1, 1].flatMap((sx) => [0.06, 0, -0.06].map((dy) => ({ geo: new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), mat: white(), p: [sx * 0.3, -0.08 + dy, 0.2], r: [0, 0, Math.PI / 2 + dy * 3] }))),
  ], { outline: 0.012 }));
  // forepaws raised, as in the dance
  const paws = [-1, 1].map((sx) => {
    const a = joint(torso, sx * 0.22, -0.05, 0.1);
    a.add(bake([
      { geo: new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), mat: fur, p: [sx * 0.08, 0.1, 0.04], r: [0, 0, -sx * 0.9] },
      { geo: new THREE.SphereGeometry(0.065, 8, 6), mat: fur2, p: [sx * 0.2, 0.2, 0.06] },
    ], { outline: 0.012 }));
    return a;
  });
  // the two tails
  const tails = [-1, 1].map((sx) => {
    const tj = joint(torso, sx * 0.1, -0.4, -0.22);
    tj.add(bake([
      { geo: taperedTube([[0, 0, 0], [sx * 0.15, 0.2, -0.25], [sx * 0.35, 0.55, -0.35], [sx * 0.3, 0.85, -0.25]], 0.06, { tip: 0.5 }), mat: fur },
      { geo: new THREE.SphereGeometry(0.05, 8, 6), mat: fur2, p: [sx * 0.3, 0.85, -0.25] },
    ], { outline: 0.012 }));
    return tj;
  });
  body.add(glowSprite(0xffd9a0, 1.6, 0.2));
  return (t, seed, self) => {
    const w = Math.sin(t * 4 + seed);
    self.hop = Math.abs(w) * 0.12;
    torso.rotation.z = w * 0.12;
    head.rotation.z = -w * 0.15;
    head.rotation.y = Math.sin(t * 1.3 + seed) * 0.3;
    paws[0].rotation.z = w * 0.35; paws[1].rotation.z = w * 0.35;
    tails[0].rotation.y = Math.sin(t * 3 + seed) * 0.5; tails[1].rotation.y = -Math.sin(t * 3 + 1 + seed) * 0.5;
  };
}

/* ===================== karasu-tengu ===================== */
// a wing in the xy plane reaching out along sx: a curved leading edge and a scalloped
// trailing edge of primaries. Extruded thin, so the outline shell works on it.
function wingShape(sx, span, tips) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.bezierCurveTo(sx * span * 0.27, 0.34, sx * span * 0.68, 0.38, sx * span, 0.12);
  let [px, py] = [span, 0.12];
  for (const [x, y] of tips) {
    const mx = (px + x) / 2, my = (py + y) / 2;
    s.quadraticCurveTo(sx * (px + (mx - px) * 0.2), py - 0.02, sx * (mx - 0.05), my + 0.07);   // notch
    s.quadraticCurveTo(sx * (x + 0.06), y - 0.02, sx * x, y);                                  // feather tip
    [px, py] = [x, y];
  }
  s.quadraticCurveTo(sx * px * 0.4, py * 0.4, 0, -0.06);
  return s;
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -depth / 2);

function buildTengu(body, seed) {
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
  const sleeve = (sx) => ({ geo: lathe([[0.05, 0.02], [0.1, -0.1], [0.13, -0.26], [0.1, -0.28]], 12), mat: robe, p: [sx * 0.25, 0.22, 0.03], r: [0.15, 0, sx * 0.35] });
  torso.add(bake([
    // yamabushi robe over wide hakama, the sash with its six orange pompoms
    { geo: lathe([[0.1, 0.32], [0.2, 0.27], [0.24, 0.06], [0.22, -0.14]], 16), mat: robe },
    { geo: lathe([[0.2, -0.1], [0.28, -0.34], [0.35, -0.6], [0.32, -0.64], [0.18, -0.62]], 16), mat: hakama },
    { geo: new THREE.TorusGeometry(0.225, 0.03, 6, 20), mat: hakama, p: [0, -0.12, 0], r: [Math.PI / 2, 0, 0] },
    // the yuigesa: a dark stole down the chest carrying the orange pompoms
    ...[-1, 1].map((sx) => ({ geo: new THREE.BoxGeometry(0.06, 0.4, 0.03), mat: feather2, p: [sx * 0.085, 0.08, 0.22], r: [-0.12, 0, -sx * 0.12] })),
    ...[[-0.1, 0.2], [0.1, 0.2], [-0.085, 0.06], [0.085, 0.06], [-0.07, -0.07], [0.07, -0.07]].map(([x, y]) =>
      ({ geo: new THREE.IcosahedronGeometry(0.042, 1), mat: pom, p: [x, y, 0.25] })),
    sleeve(-1), sleeve(1),
    ...[-1, 1].map((sx) => ({ geo: new THREE.TorusGeometry(0.11, 0.02, 5, 14), mat: hakama, p: [sx * 0.33, -0.02, 0.07], r: [Math.PI / 2 + 0.15, 0, sx * 0.35] })),
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
    ...[-0.07, 0, 0.07].map((x) => ({ geo: taperedTube([[x, 0.1, -0.12], [x * 1.4, 0.18, -0.26], [x * 2, 0.16, -0.42]], 0.06, { tip: 0.1 }), mat: feather })),
    { geo: taperedTube([[0, 0.05, 0.13], [0, 0.03, 0.29], [0, -0.06, 0.4], [0, -0.2, 0.43]], 0.085, { tip: 0.03, segments: 16 }), mat: beak, s: [0.9, 1, 1] },
    { geo: new THREE.CylinderGeometry(0.045, 0.07, 0.07, 10), mat: darkWood(), p: [0, 0.2, 0.08], r: [0.45, 0, 0] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: eyeGlow, p: [-0.09, 0.06, 0.165], s: [1.2, 0.75, 0.5], r: [0, 0, -0.25] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: eyeGlow, p: [0.09, 0.06, 0.165], s: [1.2, 0.75, 0.5], r: [0, 0, 0.25] },
    { geo: new THREE.SphereGeometry(0.018, 8, 6), mat: ink(), p: [-0.085, 0.06, 0.19], s: [0.6, 1.4, 0.5] },
    { geo: new THREE.SphereGeometry(0.018, 8, 6), mat: ink(), p: [0.085, 0.06, 0.19], s: [0.6, 1.4, 0.5] },
    // red kumadori strokes over the eyes give it the scowl
    { geo: new THREE.CapsuleGeometry(0.018, 0.1, 4, 6), mat: red, p: [-0.09, 0.12, 0.16], r: [0, 0, 1.25] },
    { geo: new THREE.CapsuleGeometry(0.018, 0.1, 4, 6), mat: red, p: [0.09, 0.12, 0.16], r: [0, 0, -1.25] },
  ], { outline: 0.012 }));
  const jaw = joint(head, 0, -0.04, 0.14);
  jaw.add(bake([
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: maw(), p: [0, 0.02, 0.06], s: [1, 0.5, 1.4] },
    { geo: taperedTube([[0, 0, 0], [0, -0.04, 0.12], [0, -0.1, 0.2]], 0.055, { tip: 0.05 }), mat: beak, s: [0.85, 0.8, 1] },
  ], { outline: 0.01 }));

  // the wings: dark primaries with lighter coverts on the front face
  const wings = [-1, 1].map((sx) => {
    const j = joint(torso, sx * 0.14, 0.24, -0.2);
    j.add(bake([
      { geo: extrude(wingShape(sx, 1.1, [[1.06, -0.1], [0.92, -0.27], [0.75, -0.37], [0.56, -0.41], [0.37, -0.37], [0.19, -0.27]]), 0.035), mat: feather },
      { geo: extrude(wingShape(sx, 0.8, [[0.7, -0.02], [0.54, -0.1], [0.37, -0.13], [0.2, -0.09]]), 0.03), mat: feather2, p: [0, 0.02, 0.03] },
    ], { outline: 0.012 }));
    j.scale.setScalar(1.05);
    return j;
  });

  // a yatsude-leaf fan in the right hand
  const fan = joint(torso, 0.34, -0.04, 0.14);
  const fs = new THREE.Shape();
  for (let i = 0; i <= 18; i++) {
    const a = -Math.PI * 0.95 + (i / 18) * Math.PI * 1.9, r = i % 2 ? 0.1 : 0.2;
    const x = Math.sin(a) * r, y = 0.12 + Math.cos(a) * r;
    if (i === 0) fs.moveTo(x, y); else fs.quadraticCurveTo(Math.sin(a - 0.08) * r * 1.05, 0.12 + Math.cos(a - 0.08) * r * 1.05, x, y);
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

/* ===================== rokurokubi ===================== */
function buildRokurokubi(body, seed) {
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

/* ===================== nopperabō ===================== */
function buildNopperabo(body, seed) {
  const robe = once('nopRobe', () => toon(0x4a6282));
  const haori = once('nopHaori', () => toon(0x262b40, { side: THREE.DoubleSide }));
  const face = once('nopFace', () => toon(0xf3e2cc, { emissive: 0x241a10 }));
  const hair = once('hairBlack', () => toon(0x17121d));
  const obiMat = once('nopObi', () => toon(0x8a5a32));
  const lanternTex = lanternPaperTex();
  const paper = once('nopLantern', () => toon(0xffffff, { map: lanternTex, emissive: new THREE.Color(0xff7a2a), emissiveMap: lanternTex, emissiveIntensity: 1 }));

  const torso = new THREE.Group();
  body.add(torso);
  // a merchant's kimono, a dark haori open at the front, white tabi on zōri
  const haoriGeo = new THREE.LatheGeometry([[0.3, -0.36], [0.29, -0.05], [0.28, 0.18], [0.21, 0.35], [0.12, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 18, 0.45, Math.PI * 2 - 0.9);
  torso.add(bake([
    { geo: lathe([[0.3, -0.74], [0.27, -0.4], [0.25, -0.05], [0.26, 0.18], [0.2, 0.34], [0.1, 0.4]], 18), mat: robe },
    { geo: haoriGeo, mat: haori },
    { geo: new THREE.CylinderGeometry(0.258, 0.258, 0.09, 16), mat: obiMat, p: [0, -0.12, 0] },
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [-0.05, 0.26, 0.21], r: [-0.35, 0, -0.45] },
    { geo: new THREE.BoxGeometry(0.045, 0.24, 0.02), mat: white(), p: [0.05, 0.26, 0.21], r: [-0.35, 0, 0.45] },
    { geo: new THREE.CylinderGeometry(0.06, 0.07, 0.16, 10), mat: face, p: [0, 0.46, 0] },
    ...[-0.1, 0.1].flatMap((x) => [
      { geo: new THREE.SphereGeometry(0.07, 10, 8), mat: white(), p: [x, -0.76, 0.06], s: [0.9, 0.6, 1.4] },
      { geo: new THREE.BoxGeometry(0.12, 0.025, 0.24), mat: once('wood', () => toon(0x7a4e2c)), p: [x, -0.81, 0.06] },
    ]),
    // left arm forward, holding the pole the lantern hangs from
    { geo: new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), mat: haori, p: [-0.27, 0.16, 0.08], r: [-0.5, 0, -0.15] },
    { geo: new THREE.CapsuleGeometry(0.1, 0.12, 4, 8), mat: haori, p: [-0.3, 0.0, 0.2], s: [0.7, 1, 1], r: [-1.1, 0, 0] },
    { geo: new THREE.SphereGeometry(0.055, 10, 8), mat: face, p: [-0.31, 0.04, 0.34] },
    { geo: new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5), mat: once('bamboo', () => toon(0xb59a52)), p: [-0.38, 0.17, 0.5], r: [1.1, 0, 0.35] },
  ], { outline: 0.014 }));

  // the lantern sways from the tip of the pole
  const lanternJ = joint(torso, -0.48, 0.32, 0.64);
  lanternJ.add(bake([
    { geo: new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), mat: ink(), p: [0, -0.06, 0] },
    { geo: lathe([[0.07, -0.33], [0.11, -0.3], [0.125, -0.22], [0.11, -0.14], [0.07, -0.12]], 14), mat: paper },
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), mat: darkWood(), p: [0, -0.115, 0] },
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), mat: darkWood(), p: [0, -0.335, 0] },
  ], { outline: 0.01 }));
  const lanternGlow = glowSprite(0xffa04a, 0.9, 0.55);
  lanternGlow.position.y = -0.22;
  lanternJ.add(lanternGlow);

  // the head: a smooth egg with nothing on it at all, under a samurai's topknot
  const head = joint(torso, 0, 0.68, 0.0);
  head.add(bake([
    { geo: new THREE.SphereGeometry(0.2, 24, 18), mat: face, s: [0.88, 1.1, 0.95] },
    { geo: new THREE.SphereGeometry(0.205, 20, 12, Math.PI - 0.5, Math.PI + 1.0, 0.62, 1.5), mat: hair, s: [0.9, 1.1, 0.98] },
    { geo: new THREE.CapsuleGeometry(0.03, 0.15, 4, 8), mat: hair, p: [0, 0.23, -0.02], r: [Math.PI / 2 - 0.25, 0, 0] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: hair, p: [0, 0.2, -0.1] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: face, p: [-0.175, 0.0, 0.0], s: [0.45, 0.85, 0.6] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: face, p: [0.175, 0.0, 0.0], s: [0.45, 0.85, 0.6] },
  ], { outline: 0.014 }));
  // the right hand comes up and wipes across where the face should be
  const arm = joint(torso, 0.25, 0.3, 0.02);
  arm.add(bake([
    { geo: new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), mat: haori, p: [0, -0.14, 0] },
    { geo: new THREE.CapsuleGeometry(0.1, 0.1, 4, 8), mat: haori, p: [0, -0.3, -0.02], s: [0.7, 1, 1] },
    { geo: new THREE.SphereGeometry(0.05, 10, 8), mat: face, p: [0, -0.42, 0], s: [1, 1.2, 0.6] },
  ], { outline: 0.012 }));
  const sheen = glowSprite(glow(0xfff2dc, 1), 0.5, 0.0);
  sheen.position.set(0, 0.7, 0.3);
  torso.add(sheen);
  body.add(glowSprite(0xbfd0ff, 1.7, 0.18));
  return (t, s, self) => {
    const w = Math.sin(t * 1.4 + seed);
    torso.rotation.z = w * 0.05;
    head.rotation.z = Math.sin(t * 0.6 + seed) * 0.22;           // an unhurried, eerie tilt
    head.rotation.y = Math.sin(t * 0.45 + seed) * 0.25;
    lanternJ.rotation.z = Math.sin(t * 2.2 + seed) * 0.35;
    lanternJ.rotation.x = Math.sin(t * 1.7 + seed) * 0.15;
    // every few seconds the hand passes over the blank face
    const c = ((t + seed) % 4.2) / 4.2;
    const k = c < 0.45 ? Math.sin((c / 0.45) * Math.PI) : 0;
    arm.rotation.set(-0.25 - 2.35 * Math.min(1, k * 1.6), 0, 0.15 + 0.35 * Math.sin(c * 30) * k);
    sheen.material.opacity = 0.25 * k;
    self.hop = 0;
  };
}

/* ===================== kamaitachi ===================== */
function windMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: glow(0xc8ffe6, 0.9) } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float s = fract(vUv.x * 3.0 + vUv.y * 0.9 - time * 1.7);
        float band = smoothstep(0.0, 0.12, s) * smoothstep(0.5, 0.18, s);
        float fade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float a = band * fade * 0.6;
        gl_FragColor = vec4(color * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

function bladeShape(sx) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(sx * 0.02, 0.34, sx * 0.36, 0.4);          // back of the blade, out to the point
  s.quadraticCurveTo(sx * 0.13, 0.25, sx * 0.07, -0.03);        // the sharp inner edge
  return s;
}

function buildKamaitachi(body, seed) {
  const fur = once('weasel', () => toon(0xc98a3e));
  const cream = once('weaselBelly', () => toon(0xf6e6c8));
  const dark = once('weaselDark', () => toon(0x3a2416));
  const steel = once('sickle', () => toon(0xdbe6f0, { emissive: 0x24414e }));
  const eyeGlow = once('weaselEye', () => new THREE.MeshBasicMaterial({ color: glow(0xb8ff5a, 1.2) }));
  const wind = once('wind', windMaterial);

  // the whirlwind it rides: two scrolling funnels of wind
  const funnel = once('funnel', () => new THREE.CylinderGeometry(0.62, 0.12, 1.25, 20, 1, true));
  const winds = [1, 0.72].map((sc, i) => {
    const m = new THREE.Mesh(funnel, wind);
    m.position.y = -0.48;
    m.scale.set(sc, 1, sc);
    m.rotation.y = i * 2;
    body.add(m);
    return m;
  });
  const leafMats = [once('leafGreen', () => toon(0x7ab04a)), once('leafOrange', () => toon(0xe08a3a))];
  const leaves = [0, 1, 2, 3].map((i) => {
    const l = new THREE.Mesh(once('leafGeo', () => new THREE.SphereGeometry(0.05, 6, 4).scale(1, 0.18, 0.55)), leafMats[i % 2]);
    body.add(l);
    return l;
  });

  const weasel = new THREE.Group();
  weasel.scale.setScalar(1.15);
  body.add(weasel);
  const torso = joint(weasel, 0, 0, 0);
  torso.rotation.x = 0.2;
  torso.add(bake([
    // a long, lithe body: narrow hips, a slender neck
    { geo: lathe([[0.0, -0.36], [0.12, -0.33], [0.145, -0.18], [0.125, 0.02], [0.085, 0.2], [0.065, 0.32]], 16), mat: fur, s: [1, 1, 0.9] },
    { geo: new THREE.SphereGeometry(0.12, 12, 10), mat: cream, p: [0, -0.02, 0.07], s: [0.7, 2.1, 0.55] },
    ...[-1, 1].flatMap((sx) => [
      { geo: new THREE.SphereGeometry(0.085, 10, 8), mat: fur, p: [sx * 0.095, -0.27, 0.02], s: [0.8, 1, 1.15] },
      { geo: new THREE.SphereGeometry(0.055, 8, 6), mat: fur, p: [sx * 0.12, -0.39, 0.08], s: [1, 0.5, 1.6] },
    ]),
  ], { outline: 0.012 }));
  // a big bushy tail curling up behind, black-tipped like a stoat's
  const tail = joint(torso, 0, -0.28, -0.1);
  tail.add(bake([
    { geo: taperedTube([[0, 0, 0], [0, -0.14, -0.22], [0, 0.0, -0.46], [0, 0.32, -0.48], [0, 0.5, -0.32]], 0.075, { tip: 0.55, swell: 0.6, segments: 18 }), mat: fur },
    { geo: new THREE.SphereGeometry(0.065, 10, 8), mat: dark, p: [0, 0.5, -0.32], s: [1, 1.3, 1] },
  ], { outline: 0.012 }));
  const head = joint(torso, 0, 0.4, 0.04);
  head.add(bake([
    // a flat, wedge-shaped head running into a long pointed muzzle
    { geo: new THREE.SphereGeometry(0.12, 16, 12), mat: fur, s: [1.05, 0.78, 1.1] },
    { geo: new THREE.ConeGeometry(0.075, 0.2, 12), mat: fur, p: [0, -0.02, 0.15], r: [Math.PI / 2, 0, 0], s: [1.1, 1, 0.75] },
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: cream, p: [0, -0.05, 0.12], s: [1.1, 0.6, 1.5] },
    { geo: new THREE.SphereGeometry(0.016, 8, 6), mat: ink(), p: [0, -0.005, 0.245], s: [1.3, 0.9, 0.9] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: fur, p: [-0.11, 0.05, -0.03], s: [0.6, 1, 0.9], r: [0, 0, 0.5] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: fur, p: [0.11, 0.05, -0.03], s: [0.6, 1, 0.9], r: [0, 0, -0.5] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [-0.118, 0.05, -0.01], s: [0.4, 0.9, 0.5], r: [0, 0, 0.5] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [0.118, 0.05, -0.01], s: [0.4, 0.9, 0.5], r: [0, 0, -0.5] },
    // fierce slanted glowing eyes, a fanged grin, whiskers
    { geo: new THREE.SphereGeometry(0.026, 10, 6), mat: eyeGlow, p: [-0.055, 0.035, 0.1], s: [1.5, 0.7, 0.5], r: [0, -0.4, -0.35] },
    { geo: new THREE.SphereGeometry(0.026, 10, 6), mat: eyeGlow, p: [0.055, 0.035, 0.1], s: [1.5, 0.7, 0.5], r: [0, 0.4, 0.35] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: maw(), p: [0, -0.06, 0.16], s: [1.1, 0.3, 0.9] },
    { geo: new THREE.ConeGeometry(0.01, 0.035, 5), mat: white(), p: [-0.022, -0.065, 0.195], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.01, 0.035, 5), mat: white(), p: [0.022, -0.065, 0.195], r: [Math.PI, 0, 0] },
  ], { outline: 0.012 }));
  head.add(bake([-1, 1].flatMap((sx) => [0.02, -0.02].map((dy) => ({ geo: new THREE.CylinderGeometry(0.003, 0.003, 0.14, 3), mat: white(), p: [sx * 0.08, -0.02 + dy, 0.19], r: [0, sx * 0.3, Math.PI / 2 + dy * 5 * sx] }))), { outline: 0 }));
  // forelimbs ending in sickles, held out to either side
  const arms = [-1, 1].map((sx) => {
    const a = joint(torso, sx * 0.1, 0.14, 0.05);
    a.add(bake([
      { geo: new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), mat: fur, p: [sx * 0.07, 0.02, 0.02], r: [0, 0, -sx * 1.1] },
      { geo: new THREE.SphereGeometry(0.045, 8, 6), mat: fur, p: [sx * 0.14, 0.05, 0.03] },
    ], { outline: 0.012 }));
    const b = joint(a, sx * 0.14, 0.05, 0.03);
    b.add(bake([{ geo: extrude(bladeShape(sx), 0.025), mat: steel }], { outline: 0.01 }));
    b.rotation.z = -sx * 0.7;
    return a;
  });
  body.add(glowSprite(0x7affc0, 1.8, 0.22));
  return (t, s, self) => {
    wind.uniforms.time.value = t;
    winds[1].rotation.y = 2 + t * 0.5;
    leaves.forEach((l, i) => {
      const a = t * (3 + i * 0.4) + i * 1.6 + seed, y = -0.9 + ((t * 0.35 + i * 0.27 + seed) % 1) * 1.1;
      const r = 0.15 + (y + 0.95) * 0.4;
      l.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      l.rotation.set(a * 2, a, 0);
    });
    // mostly faces you, slashing; every few seconds a full spin in the wind
    const c = (t + seed) % 3.4;
    const spin = c < 0.55 ? (1 - Math.cos((c / 0.55) * Math.PI)) * Math.PI : 0;
    weasel.rotation.y = spin + Math.sin(t * 1.3 + seed) * 0.25;
    const slash = Math.sin(t * 5 + seed);
    arms[0].rotation.z = -0.2 + slash * 0.4; arms[1].rotation.z = 0.2 + slash * 0.4;
    arms[0].rotation.x = arms[1].rotation.x = -0.2 + Math.cos(t * 5 + seed) * 0.3;
    head.rotation.z = -slash * 0.12;
    tail.rotation.y = Math.sin(t * 3 + seed) * 0.4;
    self.hop = Math.abs(Math.sin(t * 2.5 + seed)) * 0.06;
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
  const build = { onibi: buildOnibi, chochin: buildChochin, kasa: buildKasa, hitotsume: buildHitotsume, kappa: buildKappa, kitsunebi: buildKitsunebi, ittan: buildIttan, hyakume: buildHyakume, nekomata: buildNekomata,
    tengu: buildTengu, rokurokubi: buildRokurokubi, nopperabo: buildNopperabo, kamaitachi: buildKamaitachi };
  const animate = build[type](body, seed);
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
