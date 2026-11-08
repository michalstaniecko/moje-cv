"""Build render/iconset-sheet.png: every PNG of each iconset at 1x (on the
light and the dark --ui-app-bg), then the 16 and 32 px slots zoomed x8
(nearest). A last block per iconset shows the 16/32 slots WITH the raster
drop shadow, which export_icons.py does not ship (SHADOW_MIN_PX), so the
choice can be judged side by side.

Usage: iconset_sheet.py OUT.png NAME...   (NAME.iconset, NAME.svg, NAME-small.svg
in build/icon-source/; for NAME=icon-dark the small SVG is icon-small-dark.svg)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_icons import ROOT, SETS, SLOTS, render, shadow_layer, with_shadow  # noqa: E402

LIGHT = (238, 243, 248)
DARK = (15, 22, 32)
PAD = 16


def on(bg, img):
    t = Image.new("RGBA", img.size, bg + (255,))
    t.alpha_composite(img)
    return t


def strip(imgs, bg):
    """imgs at 1x, bottom-aligned, on bg."""
    w = sum(i.width for i in imgs) + PAD * (len(imgs) + 1)
    h = max(i.height for i in imgs) + 2 * PAD
    s = Image.new("RGBA", (w, h), bg + (255,))
    x = PAD
    for i in imgs:
        s.alpha_composite(i, (x, h - PAD - i.height))
        x += i.width + PAD
    return s


def zooms(imgs, bgs):
    tiles = [on(bg, i).resize((i.width * 8, i.height * 8), Image.NEAREST) for i in imgs for bg in bgs]
    w = sum(t.width for t in tiles) + PAD * (len(tiles) + 1)
    s = Image.new("RGBA", (w, 256 + 2 * PAD), (200, 200, 200, 255))
    x = PAD
    for t in tiles:
        s.alpha_composite(t, (x, PAD))
        x += t.width + PAD
    return s


def main():
    out_path = Path(sys.argv[1])
    blocks = []
    for name in sys.argv[2:]:
        d = ROOT / f"{name}.iconset"
        imgs = [Image.open(d / f"{stem}.png").convert("RGBA") for stem, _ in SLOTS]
        small = [Image.open(d / f"{s}.png").convert("RGBA") for s in ("icon_16x16", "icon_32x32")]
        full, small_svg = SETS[name]
        sh = shadow_layer(render(ROOT / full, 1024))
        shadowed = [with_shadow(render(ROOT / small_svg, s), sh) for s in (16, 32)]
        blocks += [
            (f"{name}.iconset, all 10 PNGs at 1x (16, 16@2x, 32, 32@2x, 128, 128@2x, 256, 256@2x, 512, 512@2x) on light", strip(imgs, LIGHT)),
            ("same on dark", strip(imgs, DARK)),
            ("shipped 16 and 32 (flat), x8 nearest: 16 light, 16 dark, 32 light, 32 dark", zooms(small, (LIGHT, DARK))),
            ("NOT shipped: 16 and 32 with the raster drop shadow, x8 nearest", zooms(shadowed, (LIGHT, DARK))),
        ]
    W = max(b.width for _, b in blocks) + 2 * PAD
    H = sum(b.height + 30 for _, b in blocks) + PAD
    sheet = Image.new("RGBA", (W, H), (200, 200, 200, 255))
    dr = ImageDraw.Draw(sheet)
    y = PAD
    for label, b in blocks:
        dr.text((PAD, y), label, fill=(0, 0, 0, 255))
        sheet.alpha_composite(b, (PAD, y + 16))
        y += b.height + 30
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path)
    print("wrote", out_path.resolve())


if __name__ == "__main__":
    main()
