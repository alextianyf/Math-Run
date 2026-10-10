// world.js — rendering core: renderer + bloom, lights tuned for toon shading,
// the environment, the hero, the camera rig and automatic quality scaling.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment, FOG_COLOR } from './environment.js';
import { createHero } from './hero.js';

export const LANES = [-1.9, 0, 1.9];

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const QUALITY = [
  { bloom: false, dpr: 1 },
  { bloom: true, dpr: 1.25 },
  { bloom: true, dpr: 1.75 },
];

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 24, 95);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

  // Lights: cool moonlight from ahead, a warm key from behind the camera so the
  // hero's back and the yokai's faces read clearly, plus a lantern-coloured fill.
  scene.add(new THREE.HemisphereLight(0x8783f2, 0x2a1838, 1.3));
  const moon = new THREE.DirectionalLight(0xc8ceff, 1.8);
  moon.position.set(-30, 40, -60);
  const key = new THREE.DirectionalLight(0xffc796, 1.5);
  key.position.set(8, 10, 16);
  const fill = new THREE.PointLight(0xffa860, 9, 11, 2);
  fill.position.set(0.5, 2.6, 2.2);
  scene.add(moon, key, fill);

  const env = createEnvironment(scene);
  const hero = createHero();
  scene.add(hero.root);

  /* ---------- post-processing ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // threshold 1.0: only HDR emissives (lanterns, flames, spells, eyes) bloom — lit surfaces don't
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let quality = 2;

  /* ---------- camera rig ---------- */
  let presets = null;
  const rig = {
    mode: 'title', k: 1, dur: 1.4,
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    shake: 0,
  };
  function computePresets(aspect) {
    const portrait = aspect < 1;
    presets = {
      play: {
        pos: new THREE.Vector3(0, portrait ? 3.6 : 3.1, portrait ? 6.8 : 5.8),
        look: new THREE.Vector3(0, portrait ? 1.0 : 1.2, -10),
      },
      // camera faces +z here, so screen-left is world +x: look right of the hero
      // to push him to the right half, away from the title card
      title: {
        pos: new THREE.Vector3(portrait ? 0.3 : 1.25, portrait ? 1.3 : 1.45, portrait ? -4.4 : -3.6),
        look: new THREE.Vector3(portrait ? 0.05 : 1.2, portrait ? 0.55 : 1.2, 0),
      },
      // capture scene: over the kneeling hero's shoulder, looking up at the oni's face
      caught: {
        pos: new THREE.Vector3(portrait ? 3.0 : 3.4, portrait ? 2.2 : 2.1, portrait ? 7.6 : 6.4),
        look: new THREE.Vector3(-0.2, portrait ? 3.1 : 2.8, -2.2),
      },
      // profile close-up once the oni lifts the hero to its face: the laughing face on
      // one side, the hero kicking in its fist on the other (camera stays inside the
      // lantern-post line so nothing passes in front of it)
      held: {
        // (landscape looks further left so the pair sits in the right half, clear of the game-over card)
        pos: new THREE.Vector3(-2.8, portrait ? 4.4 : 4.75, portrait ? 0.15 : 0.1),
        look: new THREE.Vector3(0.6, portrait ? 4.25 : 4.55, portrait ? -1.15 : -2.9),
      },
    };
  }
  function setCameraMode(mode, instant = false) {
    // arches right behind the play camera would fill the screen; in the capture
    // scene, arches near the action would block it (far ones stay as a backdrop)
    env.hideToriiBeyond = mode === 'play' ? 1.0 : mode === 'caught' || mode === 'held' ? -7.5 : Infinity;
    rig.fromPos.copy(rig.pos);
    rig.fromLook.copy(rig.look);
    rig.mode = mode;
    rig.dur = mode === 'caught' ? 1.6 : mode === 'held' ? 1.1 : 1.4;
    rig.k = instant ? 1 : 0;
    if (instant) { rig.pos.copy(presets[mode].pos); rig.look.copy(presets[mode].look); }
  }
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function updateCamera(dt, t) {
    const target = presets[rig.mode];
    rig.k = Math.min(1, rig.k + dt / rig.dur);
    const e = easeInOut(rig.k);
    camPos.lerpVectors(rig.fromPos, target.pos, e);
    camLook.lerpVectors(rig.fromLook, target.look, e);
    if (rig.k < 1) {
      if (rig.mode === 'play' || rig.mode === 'title') camPos.y += Math.sin(Math.PI * e) * 1.1;    // swoop over the hero
      rig.pos.copy(camPos); rig.look.copy(camLook);
    } else {
      rig.pos.copy(target.pos); rig.look.copy(target.look);
    }
    camPos.x += Math.sin(t * 0.6) * 0.05;
    camPos.y += Math.sin(t * 0.9) * 0.035;
    if (rig.shake > 0.001) {
      camPos.x += (Math.random() - 0.5) * rig.shake;
      camPos.y += (Math.random() - 0.5) * rig.shake;
      rig.shake *= Math.exp(-dt * 7);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  /* ---------- public API ---------- */
  let width = 1, height = 1;
  const tmp = new THREE.Vector3();

  function applySize() {
    const q = QUALITY[quality];
    const dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  }

  // auto quality: if frames are slow for a few seconds, step down
  let sampleT = 0, sampleN = 0;

  return {
    scene, camera, renderer, hero,
    get pxScale() { return (height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * renderer.getPixelRatio(); },
    get quality() { return quality; },
    setQuality(q) { quality = Math.max(0, Math.min(2, q)); applySize(); },
    sampleFrame(dt) {
      sampleT += dt; sampleN++;
      if (sampleT < 3) return;
      const avg = sampleT / sampleN;
      sampleT = 0; sampleN = 0;
      if (avg > 1 / 42 && quality > 0) { quality--; applySize(); console.info('[math-run] quality →', quality); }
    },
    resize(w, h) {
      width = Math.max(1, w); height = Math.max(1, h);
      applySize();
      const aspect = width / height;
      camera.aspect = aspect;
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(0.44 / aspect)), 50, 72);
      camera.updateProjectionMatrix();
      const first = !presets;
      computePresets(aspect);
      if (first) setCameraMode('title', true);
    },
    setCameraMode,
    // ?debug helper: park the camera anywhere to inspect models
    debugView(pos, look) {
      presets.debug = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) };
      setCameraMode('debug', true);
    },
    shake(amount) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) rig.shake = Math.max(rig.shake, amount);
    },
    update(dt, speed, t) {
      env.step(speed * dt, t, dt);
      hero.update(dt, speed, t);
      updateCamera(dt, t);
    },
    render() {
      if (QUALITY[quality].bloom) composer.render();
      else renderer.render(scene, camera);
    },
    handPosition(out) { return hero.handR.getWorldPosition(out); },
    // World → CSS pixel coordinates inside the canvas
    project(v, out) {
      tmp.copy(v).project(camera);
      out.x = (tmp.x * 0.5 + 0.5) * width;
      out.y = (-tmp.y * 0.5 + 0.5) * height;
      out.visible = tmp.z < 1;
      return out;
    },
  };
}
