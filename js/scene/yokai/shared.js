// shared.js — what several yokai use: shared materials (made once, never disposed),
// eyes, glow sprites, the onibi flame shader, extruded shapes.
import * as THREE from 'three';
import { toon, glow } from '../toon.js';
import { glowTex } from '../textures.js';

export const shared = {};
export const once = (k, make) => shared[k] || (shared[k] = make());
export const white = () => once('white', () => toon(0xfffaf0));
export const ink = () => once('ink', () => new THREE.MeshBasicMaterial({ color: 0x0d0812 }));
export const tongue = () => once('tongue', () => toon(0xe84a64, { emissive: 0x3a0010 }));
export const darkWood = () => once('darkWood', () => toon(0x1d1418));
export const skin = () => once('skin', () => toon(0xf4dcc0));
export const maw = () => once('maw', () => toon(0x2a0610));

// a round eye looking along +z: white, iris, pupil (parts for bake)
export function eyeParts(x, y, z, r, iris, s = 1) {
  return [
    { geo: new THREE.SphereGeometry(r, 14, 10), mat: white(), p: [x, y, z], s: [s, s, s * 0.55] },
    { geo: new THREE.SphereGeometry(r * 0.55, 12, 8), mat: iris, p: [x, y, z + r * 0.4], s: [s, s, s * 0.45] },
    { geo: new THREE.SphereGeometry(r * 0.3, 10, 8), mat: ink(), p: [x, y, z + r * 0.58], s: [s, s, s * 0.4] },
  ];
}

export function glowSprite(color, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(scale);
  return s;
}

/* ---------- billboard flame shader (onibi) ---------- */
export function flameMaterial(seed) {
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

// a flat shape given a little thickness, centred on z = 0
export const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -depth / 2);
