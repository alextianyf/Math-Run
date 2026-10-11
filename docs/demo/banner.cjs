// Shared markup and palettes for the README banner and the link-preview card,
// used by hero.cjs. The talisman and the game frame are real captures of the
// game (a digit written with the mouse, then the talismans in flight).
const themes = {
  light: {
    ink: "#2e2740",
    canvas: "linear-gradient(115deg,#f6f1e7 0%,#f3ede4 55%,#ebe3ec 100%)",
    lede: "#6b6480",
    eyebrow: "#a33a2c",
    rule: "#d9a79c",
    shotBorder: "#ddd5e6",
    shotShadow: "0 18px 50px #3a2c4a33",
    paperShadow: "drop-shadow(0 8px 14px #5a3d2a2e)",
  },
  dark: {
    ink: "#f0ecfa",
    canvas: "linear-gradient(115deg,#14112a 0%,#1b1638 55%,#110e24 100%)",
    lede: "#a7a0c3",
    eyebrow: "#f2c46d",
    rule: "#6a5a96",
    shotBorder: "#2f2952",
    shotShadow: "0 18px 50px #00000085",
    paperShadow: "drop-shadow(0 10px 18px #00000080)",
  },
};

const copy = {
  title: '<span class="zh">百鬼夜行</span> · Math Run',
  lede: "Handwrite the answer. Banish the yokai.<br>An AI reads your pen, right in the browser.",
  eyebrow: "A math game you play with a pen",
};

const base = (palette) => `*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI','Microsoft YaHei',sans-serif;color:${palette.ink}}
  main{overflow:hidden;position:relative;background:${palette.canvas}}
  h1{font-weight:600;letter-spacing:-1px;margin:0 0 16px}.zh{font-family:KaiTi,STKaiti,'Kaiti SC',serif;font-weight:700;letter-spacing:2px}
  p{line-height:1.6;color:${palette.lede};margin:0}
  .eyebrow{position:absolute;font-family:Georgia,'SimSun',serif;font-weight:500;line-height:1.3;letter-spacing:.2px;color:${palette.eyebrow}}
  .eyebrow::before{content:'';display:block;width:38px;height:2px;margin-bottom:16px;background:${palette.rule}}
  .shot{position:absolute;border-radius:10px;border:1px solid ${palette.shotBorder};box-shadow:${palette.shotShadow}}
  .paper{position:absolute;filter:${palette.paperShadow}}`;

// 1500 × 500 README banner. logo is an SVG data URI; shot and talisman are base64 PNGs.
const banner = ({ theme, logo, shot, talisman }) => {
  const palette = themes[theme];
  return `<style>${base(palette)}
    main{width:1500px;height:500px}
    .identity{position:absolute;left:78px;top:70px}.logo{width:76px;height:76px;margin-bottom:26px;border-radius:16px}
    h1{font-size:56px}p{font-size:23px}
    .eyebrow{left:82px;bottom:53px;font-size:32px}
    .shot{left:850px;top:56px;width:590px;transform:rotate(4deg)}
    .paper{left:690px;top:118px;width:205px;transform:rotate(-8deg)}
  </style><main><div class="identity"><img class="logo" src="${logo}"><h1>${copy.title}</h1><p>${copy.lede}</p></div><div class="eyebrow">${copy.eyebrow}</div><img class="shot" src="data:image/png;base64,${shot}"><img class="paper" src="data:image/png;base64,${talisman}"></main>`;
};

// 1200 × 630 link-preview card (Open Graph / X), same parts in a taller frame
const card = ({ theme, logo, shot, talisman }) => {
  const palette = themes[theme];
  return `<style>${base(palette)}
    main{width:1200px;height:630px}
    .identity{position:absolute;left:64px;top:64px;width:520px}.logo{width:68px;height:68px;margin-bottom:24px;border-radius:15px}
    h1{font-size:50px}p{font-size:22px}
    .eyebrow{left:68px;bottom:60px;font-size:28px}
    .shot{left:560px;top:150px;width:600px;transform:rotate(4deg)}
    .paper{left:470px;top:300px;width:170px;transform:rotate(-8deg)}
  </style><main><div class="identity"><img class="logo" src="${logo}"><h1>${copy.title}</h1><p>${copy.lede}</p></div><div class="eyebrow">${copy.eyebrow}</div><img class="shot" src="data:image/png;base64,${shot}"><img class="paper" src="data:image/png;base64,${talisman}"></main>`;
};

module.exports = { banner, card, themes, copy };
