// textures.js — every texture in the game is drawn procedurally on a <canvas>,
// created once and shared. No image files, so the site stays a few static files.
import * as THREE from 'three';

const cache = new Map();
const KANJI_FONT = '"Kaiti SC","STKaiti","KaiTi","BiauKai","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK SC",serif';

function make(key, w, h, draw, { repeat = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

const radial = (g, x, y, r, stops) => {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => grd.addColorStop(o, c));
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
};

/* ===================== generic sprites ===================== */
export const glowTex = () => make('glow', 128, 128, (g, w) => {
  radial(g, w / 2, w / 2, w / 2, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.65)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]);
});

export const ringTex = () => make('ring', 128, 128, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, r * 0.5, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

export const shadowTex = () => make('shadow', 64, 64, (g, w) => {
  radial(g, w / 2, w / 2, w / 2, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
});

export const moonTex = () => make('moon', 256, 256, (g, w) => {
  const r = w / 2;
  const grd = g.createRadialGradient(r * 0.85, r * 0.8, r * 0.1, r, r, r * 0.92);
  grd.addColorStop(0, '#fffbe9'); grd.addColorStop(0.85, '#f1e6c4'); grd.addColorStop(1, 'rgba(241,230,196,0)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(r, r, r * 0.92, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,150,130,0.18)';
  for (const [x, y, s] of [[0.38, 0.4, 0.16], [0.6, 0.55, 0.2], [0.45, 0.68, 0.1], [0.66, 0.32, 0.09]]) {
    g.beginPath(); g.arc(x * w, y * w, s * w, 0, Math.PI * 2); g.fill();
  }
});

export const petalTex = () => make('petal', 64, 64, (g) => {
  g.translate(32, 32);
  const grd = g.createLinearGradient(0, -26, 0, 26);
  grd.addColorStop(0, '#ffe3ef'); grd.addColorStop(1, '#f59ac0');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 26);
  g.bezierCurveTo(-24, 8, -18, -22, -5, -24);
  g.lineTo(0, -16);
  g.lineTo(5, -24);
  g.bezierCurveTo(18, -22, 24, 8, 0, 26);
  g.fill();
});

export const mistTex = () => make('mist', 256, 256, (g, w) => {
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w, y = Math.random() * w, r = 20 + Math.random() * 60;
    for (const dx of [-w, 0, w]) for (const dy of [-w, 0, w]) {   // draw wrapped so it tiles
      radial(g, x + dx, y + dy, r, [[0, 'rgba(255,255,255,0.13)'], [1, 'rgba(255,255,255,0)']]);
    }
  }
}, { repeat: true });

// a bank of fog: soft billows heaped into one cloud, lit from above (bright tops,
// lilac-grey undersides) so it reads as something with volume, not a grey wash
export const fogBankTex = (n) => make(`fogBank${n}`, 256, 256, (g, w, h) => {
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
    const x = w / 2 + Math.cos(a) * d * 82, y = h * 0.56 + Math.sin(a) * d * 46 - (1 - d) * 18;
    const r = (1 - d * 0.55) * (26 + Math.random() * 30);
    radial(g, x, y, r, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]);
  }
  g.globalCompositeOperation = 'source-atop';           // shade what was drawn: light from above
  const grd = g.createLinearGradient(0, h * 0.25, 0, h * 0.85);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(96,88,140,0.7)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// a foxfire flame: a bright teardrop with a soft glow, tip up
export const foxfireTex = () => make('foxfire', 64, 128, (g, w, h) => {
  radial(g, w / 2, h * 0.68, w * 0.5, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  const grd = g.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, w * 0.3);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(w / 2, h * 0.12);                                      // the flickering tip
  g.bezierCurveTo(w * 0.62, h * 0.38, w * 0.8, h * 0.55, w * 0.78, h * 0.7);
  g.arc(w / 2, h * 0.7, w * 0.28, 0, Math.PI);
  g.bezierCurveTo(w * 0.2, h * 0.55, w * 0.38, h * 0.38, w / 2, h * 0.12);
  g.fill();
});

export const cloudTex = () => make('cloud', 256, 128, (g) => {
  for (let i = 0; i < 26; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 18 + Math.random() * 30;
    radial(g, x, y, r, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  }
});

/* ===================== hero ===================== */
// Kariginu cloth: white silk with soft vertical folds and a faint woven sheen
export const robeFoldTex = () => make('robeFold', 256, 128, (g, w, h) => {
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * w + Math.random() * 8, fw = 14 + Math.random() * 16;
    const grd = g.createLinearGradient(x - fw, 0, x + fw, 0);
    grd.addColorStop(0, 'rgba(150,140,190,0)'); grd.addColorStop(0.5, 'rgba(150,140,190,0.22)'); grd.addColorStop(1, 'rgba(150,140,190,0)');
    g.fillStyle = grd; g.fillRect(x - fw, 0, fw * 2, h);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
}, { repeat: true });

// Sashinuki (指貫): violet silk with gathered folds and small wisteria-diamond crests
export const sashinukiTex = () => make('sashinuki', 256, 256, (g, w, h) => {
  g.fillStyle = '#4b3486'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {                    // soft vertical folds
    const grd = g.createLinearGradient(x, 0, x + 32, 0);
    grd.addColorStop(0, 'rgba(20,8,50,0.28)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.05)'); grd.addColorStop(1, 'rgba(20,8,50,0.28)');
    g.fillStyle = grd; g.fillRect(x, 0, 32, h);
  }
  g.fillStyle = 'rgba(232,222,255,0.78)';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 64 + (row % 2 ? 32 : 0) + 16, y = row * 64 + 32;
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 7, y); g.lineTo(x, y + 8); g.lineTo(x - 7, y); g.closePath(); g.fill();
      for (const [dx, dy] of [[0, -12], [12, 0], [0, 12], [-12, 0]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2); g.fill(); }
    }
  }
}, { repeat: true });

// Seimei kikyō pentagram crest for the back of the robe
export const crestTex = () => make('crest', 256, 256, (g) => {
  g.translate(128, 128);
  g.strokeStyle = '#c0262d'; g.lineJoin = 'round';
  g.lineWidth = 14;
  g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 12;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const x = Math.cos(a) * 92, y = Math.sin(a) * 92;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
});

// Fox mask (kitsune) worn on the side of the head (sphere UV, front u 0.75)
export const foxMaskTex = () => make('fox', 256, 128, (g) => {
  g.fillStyle = '#fbf7ef'; g.fillRect(0, 0, 256, 128);
  const cx = 192, cy = 66;
  g.fillStyle = '#d8322a';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sx * 4, cy - 4);
    g.quadraticCurveTo(cx + sx * 16, cy - 14, cx + sx * 26, cy - 6);
    g.quadraticCurveTo(cx + sx * 16, cy - 2, cx + sx * 4, cy - 4);
    g.fill();
    g.strokeStyle = '#d8322a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx + sx * 8, cy + 10); g.quadraticCurveTo(cx + sx * 20, cy + 6, cx + sx * 24, cy + 16); g.stroke();
  }
  g.fillStyle = '#111';
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 14, cy - 7, 5, 2, sx * -0.3, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(cx, cy + 20, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8322a';
  g.beginPath(); g.moveTo(cx, cy - 34); g.quadraticCurveTo(cx + 7, cy - 22, cx, cy - 14); g.quadraticCurveTo(cx - 7, cy - 22, cx, cy - 34); g.fill();
});

/* ===================== yokai ===================== */
export const lanternPaperTex = () => make('lanternPaper', 512, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#f3b25e'); grd.addColorStop(0.5, '#ffd88f'); grd.addColorStop(1, '#f0a24e');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(150,80,20,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * w, 0, 1, h);
  }
  g.fillStyle = 'rgba(110,50,15,0.55)';
  for (let y = 16; y < h; y += 28) g.fillRect(0, y, w, 3);
  g.fillStyle = 'rgba(150,30,20,0.85)';
  g.font = `bold 110px ${KANJI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('妖', w * 0.25, h * 0.52);
  g.fillText('祭', w * 0.75, h * 0.52);
});

export const wagasaTex = () => make('wagasa', 512, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#5a1d4a'); grd.addColorStop(0.25, '#a3245a'); grd.addColorStop(1, '#c23a5e');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f6efe2';                      // janome (snake-eye) ring
  g.fillRect(0, h * 0.58, w, h * 0.13);
  g.fillStyle = '#3a0f2a';
  g.fillRect(0, h * 0.93, w, h * 0.07);
  g.strokeStyle = 'rgba(40,8,25,0.6)'; g.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * w;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
});

export const tigerTex = () => make('tiger', 256, 128, (g, w, h) => {
  g.fillStyle = '#eaa233'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b120c';
  for (let i = 0; i < 14; i++) {
    const x = (i / 14) * w + Math.random() * 6;
    g.beginPath();
    g.moveTo(x, -4);
    g.quadraticCurveTo(x + 10, h * 0.35, x - 2, h * 0.6);
    g.quadraticCurveTo(x + 6, h * 0.8, x + 2, h + 4);
    g.lineTo(x + 9, h + 4);
    g.quadraticCurveTo(x + 13, h * 0.7, x + 7, h * 0.5);
    g.quadraticCurveTo(x + 16, h * 0.3, x + 8, -4);
    g.fill();
  }
}, { repeat: true });

/* ===================== shrine ===================== */
export const plaqueTex = () => make('plaque', 128, 192, (g, w, h) => {
  g.fillStyle = '#16121c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9a640'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.lineWidth = 2; g.strokeRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#f0c55a';
  g.font = `bold 60px ${KANJI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('算', w / 2, h * 0.34);
  g.fillText('神', w / 2, h * 0.68);
});

/* ===================== spells ===================== */
// Onmyōji circle: rings, pentagram and the nine-syllable kuji around the edge
export const magicCircleTex = () => make('magic', 512, 512, (g) => {
  g.translate(256, 256);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 244, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 226, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 172, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    if (i) g.lineTo(Math.cos(a) * 168, Math.sin(a) * 168); else g.moveTo(Math.cos(a) * 168, Math.sin(a) * 168);
  }
  g.stroke();
  g.font = `bold 34px ${KANJI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const kuji = '臨兵闘者皆陣列在前';
  [...kuji].forEach((ch, i) => {
    const a = (i / kuji.length) * Math.PI * 2;
    g.save(); g.rotate(a); g.fillText(ch, 0, -199); g.restore();
  });
});

// Red hanko seal stamped on a banished yokai
export const sealTex = (ch = '滅') => make('seal' + ch, 256, 256, (g) => {
  g.translate(128, 128);
  g.fillStyle = '#d22a24';
  g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff3e0'; g.lineWidth = 6;
  g.beginPath(); g.arc(0, 0, 102, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff3e0';
  g.font = `bold 150px ${KANJI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 8);
  // rough stamp edge
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2, r = 100 + Math.random() * 22;
    g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, Math.random() * 4, 0, Math.PI * 2); g.fill();
  }
});
