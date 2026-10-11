"""Turn the recorded game frames into the README demo animation and a still image (requires Pillow).

Reads artifacts/readme-demo/ (made by record.cjs) and writes docs/media/demo.webp and
docs/media/demo.png. The game is framed on a paper-coloured background with step
captions; frame timing follows the recording, thinned out to about 14 frames a second.
An animated WebP rather than a GIF: a running 3D scene changes almost every pixel each
frame, which GIF compresses badly (22 MB at this size, against about 4 MB here).
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "artifacts" / "readme-demo"
OUTPUT = ROOT / "docs" / "media"
OUTPUT.mkdir(parents=True, exist_ok=True)

SIZE = (1280, 800)
WINDOW = (80, 66, 1200, 766)          # where the game sits: 1120 × 700
RADIUS = 14
MIN_GAP = 70                          # ms between kept frames (~14 fps)
FONT = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 19)
INK = "#2e2740"
LABELS = {
    "parade": "01   Yokai bring equations",
    "write": "02   Handwrite the answer — the AI reads it",
    "banish": "03   One talisman banishes every yokai with that answer",
}
BRAND = "百鬼夜行 · Math Run"


def backdrop():
    """Paper-coloured gradient with the window's soft shadow, drawn once."""
    top, bottom = (246, 241, 231), (235, 227, 236)
    image = Image.new("RGB", SIZE)
    draw = ImageDraw.Draw(image)
    for y in range(SIZE[1]):
        k = y / (SIZE[1] - 1)
        draw.line([(0, y), (SIZE[0], y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(top, bottom)))
    shadow = Image.new("L", SIZE, 0)
    x0, y0, x1, y1 = WINDOW
    ImageDraw.Draw(shadow).rounded_rectangle((x0 + 4, y0 + 14, x1 - 4, y1 + 10), radius=RADIUS, fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.paste(Image.new("RGB", SIZE, (58, 44, 74)), (0, 0), shadow)
    return image


def corner_mask(size):
    """Antialiased rounded corners for the game window."""
    big = Image.new("L", (size[0] * 4, size[1] * 4), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius=RADIUS * 4, fill=255)
    return big.resize(size, Image.Resampling.LANCZOS)


recording = json.loads((SOURCE / "frames.json").read_text(encoding="utf-8"))
entries = recording["frames"]
kept = [entries[0]]
for entry in entries[1:]:
    if entry["at"] - kept[-1]["at"] >= MIN_GAP or entry["file"] == recording["posterFile"]:
        kept.append(entry)

base = backdrop()
window = (WINDOW[2] - WINDOW[0], WINDOW[3] - WINDOW[1])
mask = corner_mask(window)
frames, durations, poster = [], [], None
for index, entry in enumerate(kept):
    with Image.open(SOURCE / entry["file"]) as original:
        shot = original.convert("RGB").resize(window, Image.Resampling.LANCZOS)
    frame = base.copy()
    draw = ImageDraw.Draw(frame)
    draw.text((WINDOW[0], 24), LABELS[entry["stage"]], fill=INK, font=FONT)
    draw.text((WINDOW[2], 24), BRAND, fill=INK, font=FONT, anchor="ra")
    frame.paste(shot, WINDOW[:2], mask)
    frames.append(frame)
    end = kept[index + 1]["at"] if index + 1 < len(kept) else recording["duration"]
    durations.append(max(20, round((end - entry["at"]) / 10) * 10))
    if entry["file"] == recording["posterFile"]:
        poster = frame.copy()

target = OUTPUT / "demo.webp"
frames[0].save(target, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=76, method=5)
(poster or frames[-1]).save(OUTPUT / "demo.png", optimize=True)
print(f"{target.name}: {len(frames)} frames, {sum(durations) / 1000:.2f} s, {target.stat().st_size / 1024:.0f} KiB")
