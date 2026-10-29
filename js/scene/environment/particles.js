// particles.js — fireflies, spider lilies, falling petals, ground mist, fog banks, foxfire.
import * as THREE from 'three';
import { glow } from '../toon.js';
import { glowTex, mistTex, fogBankTex, foxfireTex } from '../textures.js';
import { NEAR, SPAN } from './shared.js';
import { rand } from '../../core/math.js';

export function buildParticles(scene, { count, area, size, color, additive, map = glowTex(), fall = 0, drift = 0 }) {
  const base = new Float32Array(count * 3), pos = new Float32Array(count * 3), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) { base.set(area(i), i * 3); phase[i] = Math.random() * Math.PI * 2; }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    map, color, size, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    material: pts.material,
    step(dz, t, dt) {
      for (let i = 0; i < count; i++) {
        let z = base[i * 3 + 2] + dz;
        if (z > NEAR) z -= SPAN;
        base[i * 3 + 2] = z;
        if (fall) {
          base[i * 3 + 1] -= fall * dt;
          if (base[i * 3 + 1] < 0.05) base[i * 3 + 1] = rand(3, 5);
        }
        const p = phase[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.7 + p) * drift;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 1.1 + p * 2) * drift * 0.6;
        pos[i * 3 + 2] = z + Math.cos(t * 0.9 + p) * drift * 0.5;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

export function buildMist(scene) {
  const tex = mistTex();
  const layers = [[0.25, 0.42, 1], [0.8, 0.26, 1.6]].map(([y, opacity, k]) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3 * k, 7 * k);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 150), new THREE.MeshBasicMaterial({
      map: t, color: 0x9d93e6, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, -55);
    scene.add(m);
    return { t, k, m };
  });
  return {
    materials: layers.map((L) => L.m.material),
    step(dz, t) {
      for (const L of layers) {
        L.t.offset.y += (dz * 7 * L.k) / 150;           // one texture tile = 150 / (7k) world units
        L.t.offset.x = Math.sin(t * 0.05 * L.k) * 0.3;
      }
    },
  };
}

// banks of fog rolling along and across the path, only on the misty night: big
// soft billboards that drift and slowly turn, fading out as they reach the camera
// so it never sits inside one. Hidden (not drawn at all) on every other night.
export function buildFogBanks(scene) {
  const tex = [0, 1, 2].map((n) => fogBankTex(n));
  const group = new THREE.Group();
  group.visible = false;
  const banks = [];
  for (let i = 0; i < 28; i++) {
    const onPath = i % 3 === 0;                          // a third drift across the path itself
    const material = new THREE.SpriteMaterial({ map: tex[i % 3], transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(material);
    const w = onPath ? rand(7, 11) : rand(9, 16);
    s.scale.set(w, w * rand(0.55, 0.75), 1);
    group.add(s);
    banks.push({
      s, w, x: onPath ? rand(-3, 3) : (i % 2 ? 1 : -1) * rand(3.5, 13), y: onPath ? rand(0.3, 1.2) : rand(0.6, 2.6),
      z: NEAR - (i / 28) * SPAN + rand(-2, 2), p: Math.random() * Math.PI * 2, spin: rand(-0.04, 0.04),
    });
  }
  scene.add(group);
  let amount = 0;
  return {
    group,
    // 0..1 from the night's theme; the colour follows the mist
    set amount(v) { amount = v; group.visible = v > 0.01; },
    color: new THREE.Color(),
    step(dz, t) {
      if (!group.visible) { for (const b of banks) { b.z += dz; if (b.z > NEAR) b.z -= SPAN; } return; }
      for (const b of banks) {
        b.z += dz;
        if (b.z > NEAR) b.z -= SPAN;
        b.s.position.set(b.x + Math.sin(t * 0.07 + b.p) * 2.2, b.y + Math.sin(t * 0.13 + b.p * 2) * 0.25, b.z);
        b.s.material.rotation = b.p + t * b.spin;
        // fade in out of the distance, out again before it reaches the camera (z ≈ 6)
        const near = THREE.MathUtils.smoothstep(b.z, -1, 4), far = THREE.MathUtils.smoothstep(b.z, -95, -70);
        b.s.material.opacity = amount * far * (1 - near);
        b.s.material.color.copy(this.color);
      }
    },
  };
}

// foxfire (kitsunebi) on the fox's night: blue-green flames hovering along both
// sides of the path, bobbing, wandering and flickering, each with a soft glow round
// it. Hidden (not drawn at all) on every other night.
export function buildFoxfire(scene) {
  const group = new THREE.Group();
  group.visible = false;
  const flameMap = foxfireTex(), glowMap = glowTex();
  const wisps = [];
  for (let i = 0; i < 28; i++) {
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameMap, color: glow(0x6ff6ff, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0x22c8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    const size = rand(0.8, 1.15);
    group.add(halo, flame);
    wisps.push({
      flame, halo, size, x: (i % 2 ? 1 : -1) * rand(3.2, 5.6), y: rand(1, 2.4),
      z: NEAR - (i / 28) * SPAN + rand(-3, 3), p: Math.random() * Math.PI * 2,
    });
  }
  scene.add(group);
  let amount = 0;
  const hide = (w, dz) => { w.z += dz; if (w.z > NEAR) w.z -= SPAN; };
  return {
    // 0..1 from the night's theme
    set amount(v) { amount = v; group.visible = v > 0.01; },
    step(dz, t) {
      if (!group.visible) { for (const w of wisps) hide(w, dz); return; }
      for (const w of wisps) {
        hide(w, dz);
        const flick = 1 + Math.sin(t * 11 + w.p) * 0.08 + Math.sin(t * 17 + w.p * 3) * 0.06;
        const x = w.x + Math.sin(t * 0.5 + w.p) * 0.6, y = w.y + Math.sin(t * 1.3 + w.p * 2) * 0.25;
        w.flame.position.set(x, y, w.z);
        w.halo.position.set(x, y - w.size * 0.2, w.z);
        w.flame.scale.set(w.size * flick, w.size * 2 * (2 - flick), 1);
        w.halo.scale.setScalar(w.size * 4.2);
        // fade in out of the distance, out again before it reaches the camera
        const k = amount * THREE.MathUtils.smoothstep(w.z, -110, -80) * (1 - THREE.MathUtils.smoothstep(w.z, 0, 5));
        w.flame.material.opacity = k * (0.85 + Math.sin(t * 7 + w.p) * 0.15);
        w.halo.material.opacity = k * 0.4;
      }
    },
  };
}
