"""Build an appearance sheet: each row is one icon or mark at 512, 64, 32 and
16 px (1x), on a light Dock-like background (#eef3f8, --ui-app-bg light), a
dark one (#0f1620, --ui-app-bg dark) and a colourful wallpaper-like gradient.
Next to the 32 and 16 renders, a nearest-neighbour x4 zoom of each.

Usage: appearance_sheet.py OUT.png ROW...
  ROW = LABEL=FULL.svg[,SMALL.svg[,shadow]]
  16 and 32 come from SMALL.svg when given, else FULL.svg. With "shadow",
  each size gets the raster drop shadow exactly as export_icons.py applies it
  (SHADOW_MIN_PX and up), so the rows match the iconset.
SVG paths are relative to build/icon-source/.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_icons import ROOT, SHADOW_MIN_PX, render, shadow_layer, with_shadow  # noqa: E402

LIGHT = (238, 243, 248)
DARK = (15, 22, 32)
PAD = 16
SIZES = (512, 64, 32, 16)
PANEL_W = sum(SIZES) + 32 * 4 + 16 * 4 + PAD * 8
PANEL_H = 512 + 2 * PAD
LABEL_W = 150


def wallpaper(w, h):
    """Diagonal orange -> magenta -> violet -> blue gradient."""
    stops = [(0.0, (247, 163, 92)), (0.35, (217, 87, 158)), (0.7, (110, 64, 190)), (1.0, (40, 110, 200))]
    img = Image.new("RGBA", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.6 + y / h * 0.4)
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t <= t1:
                    f = (t - t0) / (t1 - t0)
                    px[x, y] = tuple(round(a + (b - a) * f) for a, b in zip(c0, c1)) + (255,)
                    break
    return img


def row_images(spec):
    parts = spec.split(",")
    full = ROOT / parts[0]
    small = ROOT / parts[1] if len(parts) > 1 and parts[1] else full
    shadow = len(parts) > 2 and parts[2] == "shadow"
    sh = shadow_layer(render(full, 1024)) if shadow else None
    out = {}
    for s in SIZES:
        img = render(small if s <= 32 else full, s)
        out[s] = with_shadow(img, sh) if shadow and s >= SHADOW_MIN_PX else img
    return out


def panel(bg, imgs):
    p = bg.copy() if isinstance(bg, Image.Image) else Image.new("RGBA", (PANEL_W, PANEL_H), bg + (255,))
    x = PAD
    for s in SIZES:
        y = PAD + (512 - s) // 2 if s == 512 else PAD + 200
        p.alpha_composite(imgs[s], (x, y))
        x += s + PAD
        if s <= 32:
            z = imgs[s].resize((s * 4, s * 4), Image.NEAREST)
            p.alpha_composite(z, (x, PAD + 200 + 80))
            x += max(s * 4, 0) + PAD
    return p


def main():
    out_path = Path(sys.argv[1])
    rows = [a.split("=", 1) for a in sys.argv[2:]]
    wall = wallpaper(PANEL_W, PANEL_H)
    sheet = Image.new("RGBA", (LABEL_W + 3 * (PANEL_W + PAD), 40 + len(rows) * (PANEL_H + PAD)),
                      (200, 200, 200, 255))
    d = ImageDraw.Draw(sheet)
    for j, h in enumerate(("light #eef3f8", "dark #0f1620", "wallpaper")):
        d.text((LABEL_W + j * (PANEL_W + PAD) + 4, 14), h + "   (512, 64, 32, 32 x4, 16, 16 x4)", fill=(0, 0, 0, 255))
    for i, (label, spec) in enumerate(rows):
        imgs = row_images(spec)
        y = 40 + i * (PANEL_H + PAD)
        d.text((6, y + 8), label, fill=(0, 0, 0, 255))
        for j, bg in enumerate((LIGHT, DARK, wall)):
            sheet.alpha_composite(panel(bg, imgs), (LABEL_W + j * (PANEL_W + PAD), y))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)
    print("wrote", out_path.resolve())


if __name__ == "__main__":
    main()
