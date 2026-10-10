// textures.js — tiny procedural textures drawn on <canvas>, created once and shared.
// No image files needed, so the whole game stays a handful of static files.
import * as THREE from 'three';

const cache = new Map();

function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

// Soft round glow (white — tint it with material.color)
export const glowTex = () => make('glow', 128, 128, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

// Teardrop flame for will-o'-wisps
export const flameTex = () => make('flame', 64, 128, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.6, h * 0.55);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(w / 2, 2);
  g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.95, h * 0.96, w / 2, h - 2);
  g.bezierCurveTo(w * 0.05, h * 0.96, w * 0.05, h * 0.45, w / 2, 2);
  g.fill();
});

// Expanding shock ring
export const ringTex = () => make('ring', 128, 128, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, r * 0.5, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

// Contact shadow under characters
export const shadowTex = () => make('shadow', 64, 64, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

// Moon disc with faint maria
export const moonTex = () => make('moon', 256, 256, (g, w) => {
  const r = w / 2;
  const grd = g.createRadialGradient(r * 0.85, r * 0.8, r * 0.1, r, r, r * 0.92);
  grd.addColorStop(0, '#fffbe9');
  grd.addColorStop(0.85, '#f1e6c4');
  grd.addColorStop(1, 'rgba(241,230,196,0)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(r, r, r * 0.92, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,150,130,0.18)';
  for (const [x, y, s] of [[0.38, 0.4, 0.16], [0.6, 0.55, 0.2], [0.45, 0.68, 0.1], [0.66, 0.32, 0.09]]) {
    g.beginPath(); g.arc(x * w, y * w, s * w, 0, Math.PI * 2); g.fill();
  }
});
