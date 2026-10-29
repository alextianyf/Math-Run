// ground.js — the scrolling stone path and the ground either side.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { PATH_W, canvasTexture } from './shared.js';
import { rand } from '../../core/math.js';

export function buildGround(scene) {
  const stone = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1d1925';
    g.fillRect(0, 0, w, h);
    const rows = 4;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -60 : 0;
      while (x < w) {
        const sw = rand(90, 150);
        const l = rand(30, 42);
        g.fillStyle = `hsl(${rand(245, 262)}, 10%, ${l}%)`;
        g.fillRect(x + 3, r * rh + 3, sw - 6, rh - 6);
        g.fillStyle = `hsla(250, 20%, ${l + 12}%, 0.5)`;          // worn top edge
        g.fillRect(x + 3, r * rh + 3, sw - 6, 3);
        for (let i = 0; i < 60; i++) {
          g.fillStyle = Math.random() < 0.15 ? 'rgba(90,140,100,0.25)' : `rgba(0,0,0,${rand(0, 0.18)})`;
          g.fillRect(x + 3 + Math.random() * (sw - 6), r * rh + 3 + Math.random() * (rh - 6), 2, 2);
        }
        x += sw;
      }
    }
  }, [1, 320 / PATH_W]);

  const gravel = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5d5872';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `hsl(${rand(240, 265)}, 10%, ${rand(30, 62)}%)`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, rand(0.6, 1.8), 0, Math.PI * 2);
      g.fill();
    }
  }, [1, 320 / 1.5]);

  const moss = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#16231f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `hsla(${rand(120, 175)}, 30%, ${rand(8, 22)}%, 0.6)`;
      g.fillRect(Math.random() * w, Math.random() * h, rand(1, 4), rand(2, 6));
    }
  }, [240 / 8, 320 / 8]);

  const flat = (w, mat, x, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 320), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, -110);
    scene.add(m);
  };
  const mossMat = toon(0xffffff, { map: moss });
  const stoneMat = toon(0xffffff, { map: stone });
  flat(240, mossMat, 0, 0);
  flat(PATH_W, stoneMat, 0, 0.02);
  const gravelMat = toon(0xffffff, { map: gravel });
  flat(1.5, gravelMat, -(PATH_W / 2 + 0.75), 0.015);
  flat(1.5, gravelMat, PATH_W / 2 + 0.75, 0.015);

  const curbMat = toon(0x4a4458);
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 320), curbMat);
    curb.position.set(sx * (PATH_W / 2 + 0.08), 0.07, -110);
    scene.add(curb);
  }

  return {
    // what a change of night tints: the path, the gravel and curbs beside it, the ground
    look: { stone: stoneMat, gravel: gravelMat, curb: curbMat, grass: mossMat },
    step(dz) {
      stone.offset.y += dz / PATH_W;
      gravel.offset.y += dz / 1.5;
      moss.offset.y += dz / 8;
    },
  };
}
