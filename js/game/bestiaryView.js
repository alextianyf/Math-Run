// bestiaryView.js — the bestiary's 3D viewer: the chosen yokai turning slowly on a
// small stage of its own. Yokai not met yet are shown as a dark silhouette only.
// It has its own little renderer, and only draws while the bestiary is open.
import * as THREE from 'three';
import { createYokai } from '../scene/yokai.js';

let renderer = null, scene, camera, current = null, raf = 0, last = 0, t = 0;
const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
const shadowless = new THREE.MeshBasicMaterial({ color: 0x07040f });

function setup(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a2056, 60, 120);        // the outline shader expects fog
  // the game's lights: cool moon, warm key, lantern fill
  scene.add(new THREE.HemisphereLight(0x8783f2, 0x2a1838, 1.3));
  const moon = new THREE.DirectionalLight(0xc8ceff, 1.6);
  moon.position.set(-6, 8, -4);
  const key = new THREE.DirectionalLight(0xffc796, 1.6);
  key.position.set(4, 6, 10);
  scene.add(moon, key);
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  if (!current) return;
  current.yokai.update(dt, t);
  current.yokai.root.rotation.y += dt * 0.6;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}

// show `type` in `canvas`; met = false draws a silhouette
export function showYokai(canvas, type, met) {
  if (!renderer) setup(canvas);
  hideYokai(false);
  const yokai = createYokai(type);
  yokai.update(0, 0);
  yokai.root.children[0].visible = false;              // its ground shadow
  if (!met) {
    yokai.root.traverse((o) => {
      if (o.isSprite || o.isPoints) o.visible = false;   // no glow on a silhouette
      else if (o.isMesh && o !== yokai.root.children[0]) { o.userData.material = o.material; o.material = shadowless; }
    });
  }
  scene.add(yokai.root);
  current = { yokai, type };
  // frame it: fit the bounding box, looking slightly down
  box.makeEmpty();                                     // meshes only: glow sprites are much bigger than the body
  yokai.root.updateMatrixWorld(true);
  yokai.root.traverse((o) => { if (o.isMesh && o.visible && o !== yokai.root.children[0]) box.expandByObject(o); });
  box.getSize(size); box.getCenter(mid);
  const fit = Math.max(size.y, size.x * 0.9) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(mid.x, mid.y + size.y * 0.15, mid.z + fit * 1.35 + size.z / 2);
  camera.lookAt(mid);
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

// stop drawing (and free the yokai); stop = false keeps the loop for the next one
export function hideYokai(stop = true) {
  if (current) {
    current.yokai.root.traverse((o) => {
      if (o.userData.material) { o.material = o.userData.material; delete o.userData.material; }
      if (o.isSprite || o.isPoints) o.visible = true;
    });
    current.yokai.root.children[0].visible = true;
    scene.remove(current.yokai.root);
    current.yokai.dispose();
    current = null;
  }
  if (stop && raf) { cancelAnimationFrame(raf); raf = 0; }
}
