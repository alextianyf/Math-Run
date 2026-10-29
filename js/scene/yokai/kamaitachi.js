// kamaitachi.js — 鎌鼬 sickle-pawed weasel riding a little whirlwind, spinning
import * as THREE from 'three';
import { toon, glow, bake, joint, lathe, taperedTube } from '../toon.js';
import { once, white, ink, maw, glowSprite, extrude } from './shared.js';

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

export function buildKamaitachi(body, seed) {
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
    {
      geo: lathe([[0.0, -0.36], [0.12, -0.33], [0.145, -0.18], [0.125, 0.02], [0.085, 0.2], [0.065, 0.32]], 16),
      mat: fur,
      s: [1, 1, 0.9],
    },
    { geo: new THREE.SphereGeometry(0.12, 12, 10), mat: cream, p: [0, -0.02, 0.07], s: [0.7, 2.1, 0.55] },
    ...[-1, 1].flatMap((sx) => [
      { geo: new THREE.SphereGeometry(0.085, 10, 8), mat: fur, p: [sx * 0.095, -0.27, 0.02], s: [0.8, 1, 1.15] },
      { geo: new THREE.SphereGeometry(0.055, 8, 6), mat: fur, p: [sx * 0.12, -0.39, 0.08], s: [1, 0.5, 1.6] },
    ]),
  ], { outline: 0.012 }));
  // a big bushy tail curling up behind, black-tipped like a stoat's
  const tail = joint(torso, 0, -0.28, -0.1);
  tail.add(bake([
    {
      geo: taperedTube(
        [[0, 0, 0], [0, -0.14, -0.22], [0, 0.0, -0.46], [0, 0.32, -0.48], [0, 0.5, -0.32]],
        0.075,
        { tip: 0.55, swell: 0.6, segments: 18 }
      ),
      mat: fur,
    },
    { geo: new THREE.SphereGeometry(0.065, 10, 8), mat: dark, p: [0, 0.5, -0.32], s: [1, 1.3, 1] },
  ], { outline: 0.012 }));
  const head = joint(torso, 0, 0.4, 0.04);
  head.add(bake([
    // a flat, wedge-shaped head running into a long pointed muzzle
    { geo: new THREE.SphereGeometry(0.12, 16, 12), mat: fur, s: [1.05, 0.78, 1.1] },
    {
      geo: new THREE.ConeGeometry(0.075, 0.2, 12),
      mat: fur,
      p: [0, -0.02, 0.15],
      r: [Math.PI / 2, 0, 0],
      s: [1.1, 1, 0.75],
    },
    { geo: new THREE.SphereGeometry(0.06, 10, 8), mat: cream, p: [0, -0.05, 0.12], s: [1.1, 0.6, 1.5] },
    { geo: new THREE.SphereGeometry(0.016, 8, 6), mat: ink(), p: [0, -0.005, 0.245], s: [1.3, 0.9, 0.9] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: fur, p: [-0.11, 0.05, -0.03], s: [0.6, 1, 0.9], r: [0, 0, 0.5] },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: fur, p: [0.11, 0.05, -0.03], s: [0.6, 1, 0.9], r: [0, 0, -0.5] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [-0.118, 0.05, -0.01], s: [0.4, 0.9, 0.5], r: [0, 0, 0.5] },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), mat: once('earPink', () => toon(0xe88a9a)), p: [0.118, 0.05, -0.01], s: [0.4, 0.9, 0.5], r: [0, 0, -0.5] },
    // fierce slanted glowing eyes, a fanged grin, whiskers
    {
      geo: new THREE.SphereGeometry(0.026, 10, 6),
      mat: eyeGlow,
      p: [-0.055, 0.035, 0.1],
      s: [1.5, 0.7, 0.5],
      r: [0, -0.4, -0.35],
    },
    {
      geo: new THREE.SphereGeometry(0.026, 10, 6),
      mat: eyeGlow,
      p: [0.055, 0.035, 0.1],
      s: [1.5, 0.7, 0.5],
      r: [0, 0.4, 0.35],
    },
    { geo: new THREE.SphereGeometry(0.04, 8, 6), mat: maw(), p: [0, -0.06, 0.16], s: [1.1, 0.3, 0.9] },
    { geo: new THREE.ConeGeometry(0.01, 0.035, 5), mat: white(), p: [-0.022, -0.065, 0.195], r: [Math.PI, 0, 0] },
    { geo: new THREE.ConeGeometry(0.01, 0.035, 5), mat: white(), p: [0.022, -0.065, 0.195], r: [Math.PI, 0, 0] },
  ], { outline: 0.012 }));
  head.add(
    bake(
      [-1, 1].flatMap(
        (sx) => [0.02, -0.02].map(
          (dy) => ({
            geo: new THREE.CylinderGeometry(0.003, 0.003, 0.14, 3),
            mat: white(),
            p: [sx * 0.08, -0.02 + dy, 0.19],
            r: [0, sx * 0.3, Math.PI / 2 + dy * 5 * sx],
          })
        )
      ),
      { outline: 0 }
    )
  );
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
      const a = t * (3 + i * 0.4) + i * 1.6 + seed;
      const y = -0.9 + ((t * 0.35 + i * 0.27 + seed) % 1) * 1.1;
      const r = 0.15 + (y + 0.95) * 0.4;
      l.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      l.rotation.set(a * 2, a, 0);
    });
    // mostly faces you, slashing; every few seconds a full spin in the wind
    const c = (t + seed) % 3.4;
    const spin = c < 0.55 ? (1 - Math.cos((c / 0.55) * Math.PI)) * Math.PI : 0;
    weasel.rotation.y = spin + Math.sin(t * 1.3 + seed) * 0.25;
    const slash = Math.sin(t * 5 + seed);
    arms[0].rotation.z = -0.2 + slash * 0.4;
    arms[1].rotation.z = 0.2 + slash * 0.4;
    arms[0].rotation.x = arms[1].rotation.x = -0.2 + Math.cos(t * 5 + seed) * 0.3;
    head.rotation.z = -slash * 0.12;
    tail.rotation.y = Math.sin(t * 3 + seed) * 0.4;
    self.hop = Math.abs(Math.sin(t * 2.5 + seed)) * 0.06;
  };
}
