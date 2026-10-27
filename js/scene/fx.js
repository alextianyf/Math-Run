// fx.js — spell effects: pooled HDR particles (one draw call), shock rings,
// flying talismans with light trails (textured with the digit the player wrote),
// foxfire orbs, lightning bolts, pillars of light, a barrier dome, onmyōji magic
// circles and the red 滅 seal stamped on banished yokai.
import * as THREE from 'three';
import { glow } from './toon.js';
import { glowTex, ringTex, magicCircleTex, sealTex } from './textures.js';

const MAX_PARTICLES = 1400;
const TRAIL_N = 16;

export function createFx(scene, camera) {
  /* ===================== particles ===================== */
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  const size = new Float32Array(MAX_PARTICLES);
  const alpha = new Float32Array(MAX_PARTICLES);
  const vel = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  const maxLife = new Float32Array(MAX_PARTICLES);
  const size0 = new Float32Array(MAX_PARTICLES);
  const grav = new Float32Array(MAX_PARTICLES);
  const drag = new Float32Array(MAX_PARTICLES);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('palpha', new THREE.BufferAttribute(alpha, 1));
  const uniforms = { uScale: { value: 400 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 pcolor; attribute float psize; attribute float palpha;
      uniform float uScale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = pcolor; vAlpha = palpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
  }));
  points.frustumCulled = false;
  scene.add(points);

  const cA = new THREE.Color(), cB = new THREE.Color();
  const setColor = (c, v) => (v && v.isColor ? c.copy(v) : c.set(v));

  function emit(p, {
    count = 20, color = 0xffd36b, color2 = color, bright = 1.6, speed = 4, life: l = 0.7, size: s = 0.25,
    gravity = -4, up = 0.6, spread = 1, dragK = 1.6, dir = null,
  } = {}) {
    setColor(cA, color); setColor(cB, color2);
    for (let n = 0; n < count; n++) {
      const i = cursor; cursor = (cursor + 1) % MAX_PARTICLES;
      pos[i * 3] = p.x + (Math.random() - 0.5) * 0.2 * spread;
      pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.2 * spread;
      pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.2 * spread;
      const th = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      const v = speed * (0.35 + Math.random() * 0.65);
      vel[i * 3] = (dir ? dir.x : 0) + Math.cos(th) * r * v;
      vel[i * 3 + 1] = (dir ? dir.y : 0) + u * v + up * speed * 0.5;
      vel[i * 3 + 2] = (dir ? dir.z : 0) + Math.sin(th) * r * v;
      const k = Math.random();
      col[i * 3] = (cA.r + (cB.r - cA.r) * k) * bright;
      col[i * 3 + 1] = (cA.g + (cB.g - cA.g) * k) * bright;
      col[i * 3 + 2] = (cA.b + (cB.b - cA.b) * k) * bright;
      maxLife[i] = life[i] = l * (0.6 + Math.random() * 0.6);
      size0[i] = s * (0.6 + Math.random() * 0.8);
      grav[i] = gravity;
      drag[i] = dragK;
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      const dk = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= dk; vel[i * 3 + 1] = vel[i * 3 + 1] * dk + grav[i] * dt; vel[i * 3 + 2] *= dk;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      alpha[i] = k;
      size[i] = size0[i] * (0.4 + 0.6 * k);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.pcolor.needsUpdate = true;
    geo.attributes.psize.needsUpdate = true;
    geo.attributes.palpha.needsUpdate = true;
  }

  /* ===================== materials ===================== */
  // Every effect gets its own material (its colour and fade are its own) and frees
  // it when done. warmObjects() keeps one spare of each kind, so their shaders stay
  // compiled and no cast ever waits for the GPU to compile one.
  const ringMat = (color) => new THREE.SpriteMaterial({ map: ringTex(), color: glow(color, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloMat = (color) => new THREE.SpriteMaterial({ map: glowTex(), color: glow(color, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sealMat = (ch) => new THREE.SpriteMaterial({ map: sealTex(ch), transparent: true, depthTest: false, depthWrite: false });
  const circleMat = (color, bright) => new THREE.MeshBasicMaterial({
    map: magicCircleTex(), color: glow(color, bright), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const paperMat = (texture) => new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, fog: false });
  const trailMat = (color) => new THREE.ShaderMaterial({
    uniforms: { color: { value: glow(color, 2.4) }, fade: { value: 1 } },
    vertexShader: 'attribute float ta; varying float vA; void main(){ vA = ta; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float fade; varying float vA; void main(){ gl_FragColor = vec4(color, vA * fade); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });

  /* ===================== timed sprites/planes (rings, circles, seals) ===================== */
  const timed = [];
  function addTimed(obj, dur, tick) {
    scene.add(obj);
    timed.push({ obj, t: 0, dur, tick });
  }
  function updateTimed(dt) {
    for (let i = timed.length - 1; i >= 0; i--) {
      const it = timed[i];
      it.t += dt / it.dur;
      it.tick(Math.min(1, it.t), it.obj);
      if (it.t >= 1) {
        scene.remove(it.obj);
        it.obj.material.dispose();
        timed.splice(i, 1);
      }
    }
  }

  // a glow that stays at one spot (the hero's back-light); its strength is set each frame
  function aura(pos) {
    const s = new THREE.Sprite(haloMat(0xffc84a));
    s.position.copy(pos);
    s.visible = false;
    scene.add(s);
    return {
      set(k, color, scale) {
        s.visible = k > 0.01;
        if (!s.visible) return;
        s.material.color.copy(glow(color, 1.6));
        s.material.opacity = Math.min(1, k);
        s.scale.setScalar(scale);
      },
    };
  }

  // a brief burst of light where a spell lands, so the hit reads as an impact
  function flash(p, { color = 0xfff0c0, scale = 4, dur = 0.18 } = {}) {
    const s = new THREE.Sprite(haloMat(color));
    s.position.copy(p);
    addTimed(s, dur, (k, o) => {
      o.scale.setScalar(scale * (0.6 + 0.4 * k));
      o.material.opacity = 1 - k * k;
    });
  }

  function ring(p, { color = 0xffd36b, scale = 3, dur = 0.45 } = {}) {
    const s = new THREE.Sprite(ringMat(color));
    s.position.copy(p);
    addTimed(s, dur, (k, o) => {
      const e = 1 - Math.pow(1 - k, 3);
      o.scale.setScalar(0.2 + scale * e);
      o.material.opacity = 1 - k;
    });
  }

  // Onmyōji circle: billboard at the hand when casting, or flat on the ground (portal)
  const circleGeo = new THREE.PlaneGeometry(1, 1);
  function magicCircle(p, { color = 0xffc84a, scale = 1.2, dur = 0.55, ground = false, spin = 3, bright = 2.2 } = {}) {
    const m = new THREE.Mesh(circleGeo, circleMat(color, bright));
    m.position.copy(p);
    if (ground) m.rotation.x = -Math.PI / 2;
    addTimed(m, dur, (k, o) => {
      const grow = Math.min(1, k * 4);
      const e = 1 - Math.pow(1 - grow, 3);
      o.scale.setScalar(scale * (0.3 + 0.7 * e));
      if (ground) o.rotation.z = k * spin;
      else { o.quaternion.copy(camera.quaternion); o.rotateZ(k * spin); }
      o.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    });
  }

  // 滅 seal: pops in big, settles, then fades — sized to read the same at any distance
  function seal(p, ch = '滅', scale = 1) {
    const s = new THREE.Sprite(sealMat(ch));
    s.position.copy(p);
    s.renderOrder = 10;
    const base = camera.position.distanceTo(p) * 0.11 * scale;
    const rot = (Math.random() - 0.5) * 0.5;
    addTimed(s, 0.85, (k, o) => {
      const pop = k < 0.15 ? 2.1 - (k / 0.15) * 1.1 : 1;
      o.scale.setScalar(base * pop);
      o.material.rotation = rot;
      o.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    });
  }

  /* ===================== talismans + light trails ===================== */
  const talGeo = new THREE.PlaneGeometry(0.4, 0.6);
  const flights = [];
  const fading = [];
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), cur = new THREE.Vector3();
  const side = new THREE.Vector3(), tan = new THREE.Vector3(), view = new THREE.Vector3();

  function makeTrail(color) {
    const g = new THREE.BufferGeometry();
    const tp = new Float32Array(TRAIL_N * 2 * 3), ta = new Float32Array(TRAIL_N * 2);
    g.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    g.setAttribute('ta', new THREE.BufferAttribute(ta, 1));
    const idx = [];
    for (let i = 0; i < TRAIL_N - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, trailMat(color));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, tp, ta, g, hist: [] };
  }
  function updateTrail(tr, head, width) {
    tr.hist.unshift(head.clone());
    if (tr.hist.length > TRAIL_N) tr.hist.pop();
    const n = tr.hist.length;
    for (let i = 0; i < TRAIL_N; i++) {
      const a = tr.hist[Math.min(i, n - 1)], b = tr.hist[Math.min(i + 1, n - 1)];
      tan.subVectors(a, b);
      if (tan.lengthSq() < 1e-6) tan.set(0, 1, 0);
      view.subVectors(camera.position, a);
      side.crossVectors(tan, view).normalize().multiplyScalar(width * (1 - i / TRAIL_N));
      tr.tp.set([a.x + side.x, a.y + side.y, a.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z], i * 6);
      const al = i < n ? Math.pow(1 - i / TRAIL_N, 1.5) : 0;
      tr.ta[i * 2] = al; tr.ta[i * 2 + 1] = al;
    }
    tr.g.attributes.position.needsUpdate = true;
    tr.g.attributes.ta.needsUpdate = true;
  }

  // texture: CanvasTexture shared by all talismans of one cast (ref-counted);
  // null flies a bare orb of foxfire instead of paper
  function talisman(texture, from, getTarget, { dur = 0.34, side: bend = 0, lift = 1.5, onHit, color = 0xffc84a } = {}) {
    if (texture) texture.userData.refs = (texture.userData.refs || 0) + 1;
    const mesh = texture ? new THREE.Mesh(talGeo, paperMat(texture)) : new THREE.Object3D();
    const halo = new THREE.Sprite(haloMat(color));
    halo.scale.setScalar(texture ? 1.4 : 1.1);
    mesh.add(halo);
    mesh.position.copy(from);
    scene.add(mesh);
    flights.push({ mesh, halo, texture, trail: makeTrail(color), from: from.clone(), getTarget, t: 0, dur, bend, lift, onHit, color, spin: (Math.random() - 0.5) * 10 });
  }

  function updateFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t * f.t * (3 - 2 * f.t) * 0.35 + f.t * 0.65;
      p0.copy(f.from);
      f.getTarget(p2);
      p1.lerpVectors(p0, p2, 0.5);
      p1.y += f.lift;
      p1.x += f.bend;
      cur.copy(p0).multiplyScalar((1 - e) * (1 - e)).addScaledVector(p1, 2 * (1 - e) * e).addScaledVector(p2, e * e);
      f.mesh.position.copy(cur);
      f.mesh.quaternion.copy(camera.quaternion);
      f.mesh.rotateZ(f.spin * f.t);
      updateTrail(f.trail, cur, 0.13);
      emit(cur, { count: 2, color: f.color, color2: 0xff7a3a, speed: 0.8, life: 0.35, size: 0.16, gravity: 0, up: 0 });
      if (f.t >= 1) {
        scene.remove(f.mesh);
        f.mesh.material?.dispose();
        f.halo.material.dispose();
        if (f.texture && --f.texture.userData.refs <= 0) f.texture.dispose();
        fading.push({ trail: f.trail, head: cur.clone(), k: 1 });
        flights.splice(i, 1);
        f.onHit?.(cur.clone());
      }
    }
    for (let i = fading.length - 1; i >= 0; i--) {
      const fd = fading[i];
      fd.k -= dt / 0.25;
      fd.trail.mesh.material.uniforms.fade.value = Math.max(0, fd.k);
      updateTrail(fd.trail, fd.head, 0.13);
      if (fd.k <= 0) disposeTrail(fd.trail), fading.splice(i, 1);
    }
  }
  /* ===================== lightning, pillars, barrier ===================== */
  // a jagged bolt from `from` down to `to`: a ribbon, re-jittered while it lives
  const bolts = [];
  const bA = new THREE.Vector3();
  function bolt(from, to, { color = 0xbfe6ff, dur = 0.32, width = 0.16, jag = 0.55, sparks = 26 } = {}) {
    bolts.push({ tr: makeTrail(color), from: from.clone(), to: to.clone(), t: 0, dur, width, jag, next: 0 });
    emit(to, { count: sparks, color: 0xffffff, color2: color, bright: 2.4, speed: 6, life: 0.4, size: 0.22, gravity: -2 });
  }
  function shapeBolt(b) {
    const tr = b.tr;
    for (let i = 0; i < TRAIL_N; i++) {
      const k = i / (TRAIL_N - 1);
      bA.lerpVectors(b.to, b.from, k);
      const j = Math.sin(Math.PI * k) * b.jag;
      bA.x += (Math.random() - 0.5) * j * 2;
      bA.z += (Math.random() - 0.5) * j;
      const a = bA, w = b.width * (1 - 0.6 * k);
      tan.set(0, 1, 0);
      view.subVectors(camera.position, a);
      side.crossVectors(tan, view).normalize().multiplyScalar(w);
      tr.tp.set([a.x + side.x, a.y + side.y, a.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z], i * 6);
      tr.ta[i * 2] = 1; tr.ta[i * 2 + 1] = 1;
    }
    tr.g.attributes.position.needsUpdate = true;
    tr.g.attributes.ta.needsUpdate = true;
  }
  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt / b.dur;
      if ((b.next -= dt) <= 0) { shapeBolt(b); b.next = 0.045; }
      const flicker = b.t < 0.5 ? 1 : (1 - b.t) * 2 * (0.6 + Math.random() * 0.4);
      b.tr.mesh.material.uniforms.fade.value = Math.max(0, flicker) * 1.6;
      if (b.t >= 1) { disposeTrail(b.tr); bolts.splice(i, 1); }
    }
  }

  // a pillar of light rising from the ground at p, over a magic circle
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
  const beamMat = (color) => new THREE.ShaderMaterial({
    uniforms: { color: { value: glow(color, 2.2) }, fade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float fade; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.55 + 0.45 * sin(vUv.x * 62.83 + vUv.y * 9.0)); gl_FragColor = vec4(color, a * fade); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  function pillar(p, { color = 0xffd36b, radius = 0.9, height = 9, dur = 0.7 } = {}) {
    const m = new THREE.Mesh(beamGeo, beamMat(color));
    m.position.set(p.x, 0.02, p.z);
    addTimed(m, dur, (k, o) => {
      const grow = 1 - Math.pow(1 - Math.min(1, k * 3), 3);
      const r = radius * (1.25 - 0.5 * k);
      o.scale.set(r, height * grow, r);
      o.rotation.y = k * 3;
      o.material.uniforms.fade.value = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    });
    magicCircle(new THREE.Vector3(p.x, 0.05, p.z), { color, scale: radius * 3.2, dur: dur * 1.2, ground: true, spin: 2 });
  }

  // the barrier: a dome of light around a point, kept until dropped
  const domeGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = (color) => new THREE.ShaderMaterial({
    uniforms: { color: { value: glow(color, 1.8) }, fade: { value: 1 }, time: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float fade; uniform float time; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 2.2); float bands = 0.5 + 0.5 * sin(vY * 22.0 - time * 3.0); gl_FragColor = vec4(color, (rim * 0.85 + bands * 0.08) * fade); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const domes = [];
  function dome(p, { color = 0x8fe8ff, radius = 1.6 } = {}) {
    const m = new THREE.Mesh(domeGeo, domeMat(color));
    m.position.copy(p);
    m.scale.setScalar(0.01);
    scene.add(m);
    const d = { m, t: 0, k: 0, dropping: false, radius, flash: 0 };
    domes.push(d);
    return {
      drop() { d.dropping = true; },
      flash() { d.flash = 1; },
    };
  }
  function updateDomes(dt) {
    for (let i = domes.length - 1; i >= 0; i--) {
      const d = domes[i];
      d.t += dt;
      d.k = d.dropping ? d.k - dt / 0.35 : Math.min(1, d.k + dt / 0.35);
      d.flash = Math.max(0, d.flash - dt * 2.5);
      const e = 1 - Math.pow(1 - Math.max(0, d.k), 3);
      d.m.scale.setScalar(d.radius * (d.dropping ? 1 + (1 - d.k) * 0.6 : e) * (1 + d.flash * 0.15));
      d.m.material.uniforms.time.value = d.t;
      d.m.material.uniforms.fade.value = Math.max(0, d.k) * (1 + d.flash * 2);
      if (d.dropping && d.k <= 0) { scene.remove(d.m); d.m.material.dispose(); domes.splice(i, 1); }
    }
  }

  function disposeTrail(tr) {
    scene.remove(tr.mesh);
    tr.g.dispose();
    tr.mesh.material.dispose();
  }

  return {
    emit, aura, flash, ring, talisman, magicCircle, seal, bolt, pillar, dome,
    setScale(px) { uniforms.uScale.value = px; },
    // one object per effect material, to be compiled once and then kept (hidden)
    warmObjects() {
      const paper = new THREE.CanvasTexture(document.createElement('canvas'));
      paper.colorSpace = THREE.SRGBColorSpace;      // like the real talisman paper
      return [
        new THREE.Sprite(ringMat(0xffffff)),
        new THREE.Sprite(haloMat(0xffffff)),
        new THREE.Sprite(sealMat('滅')),
        new THREE.Mesh(circleGeo, circleMat(0xffffff, 1)),
        new THREE.Mesh(talGeo, paperMat(paper)),
        new THREE.Mesh(talGeo, trailMat(0xffffff)),
        new THREE.Mesh(beamGeo, beamMat(0xffffff)),
        new THREE.Mesh(domeGeo, domeMat(0xffffff)),
      ];
    },
    update(dt) {
      updateFlights(dt);
      updateBolts(dt);
      updateDomes(dt);
      updateTimed(dt);
      updateParticles(dt);
    },
    clear() {
      life.fill(0);
      for (const f of flights.splice(0)) { scene.remove(f.mesh); disposeTrail(f.trail); }
      for (const fd of fading.splice(0)) disposeTrail(fd.trail);
      for (const b of bolts.splice(0)) disposeTrail(b.tr);
      for (const d of domes.splice(0)) { scene.remove(d.m); d.m.material.dispose(); }
      for (const it of timed.splice(0)) scene.remove(it.obj);
    },
  };
}
