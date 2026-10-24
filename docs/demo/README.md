# README media

Everything in the README's header is made from the real game, so it can be rebuilt whenever the game changes:

| File in `docs/media/` | What it is | Made by |
| --- | --- | --- |
| `hero.png`, `hero-dark.png`, `hero-zh*.png` | 1500 × 500 banner, English and Chinese, light and dark | `hero.cjs` |
| `social-card.jpg` | 1200 × 630 link-preview card (`og:image` in `index.html`) | `hero.cjs` |
| `demo.webp`, `demo.png` | the demo animation, and a still of it | `record.cjs`, then `encode.py` |
| `badges/*.svg` | the buttons and labels under the banner (`-zh` for README.zh-CN.md) | hand-written SVG |

## Rebuild

From the repository root on Windows, with the game served locally:

```powershell
npm install                        # once: Playwright, used to drive the browser
python -m http.server 8000         # in a second terminal
npm run media:hero                 # banner + link-preview card
npm run media:demo                 # demo animation + still
```

Requirements: Microsoft Edge (Playwright drives it headless, on the real GPU so WebGL looks right) and Python with Pillow (`python -m pip install Pillow`). `encode.py` uses the Windows Microsoft YaHei font. Set `MATHRUN_URL` to record from another address (default `http://localhost:8000/`).

## How it works

- `game.cjs` opens the game with `?debug`, starts a run, skips the tutorial and places four yokai — two of them with the answer 7. It then writes a **7** on the talisman with the mouse; the handwriting model reads it like any player's, and one talisman banishes both yokai.
- `hero.cjs` captures the written talisman (on a transparent background) and the moment the talismans fly, then lays them out with the title in `banner.cjs`, in a light and a dark palette.
- `record.cjs` records the same scene as the page draws it (the browser's screencast, with real timing) into the ignored `artifacts/readme-demo/` folder.
- `encode.py` frames the recording on a paper-coloured background with step captions and writes an animated WebP at about 14 frames a second. WebP rather than GIF: a running 3D scene changes almost every pixel each frame, which GIF compresses badly (about 22 MB at this size, against about 4 MB).

Raw captures stay in `artifacts/` and are never committed; only the finished media belong in Git.
