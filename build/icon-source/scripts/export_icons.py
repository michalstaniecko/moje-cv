"""Export the raster deliverables for issue #73 (round 10).

For the light icon (icon.svg + icon-small.svg) and the dark one
(icon-dark.svg + icon-small-dark.svg) this writes:

  NAME-1024-flat.png   resvg render of the SVG, no drop shadow
  NAME-1024.png        master: the flat render over a raster drop shadow
  NAME.iconset/        the ten PNGs iconutil expects

and, for the light icon only, the Windows and Linux icons electron-builder
picks up from build/ (directories.buildResources):

  build/icon.ico       16, 24, 32, 48, 64, 128, 256 in one file
  build/icon.png       1024 x 1024 (Linux; electron-builder needs >= 512)
  build/icons/NxN.png  16 ... 512 (Linux icon set, preferred over icon.png)

Windows and Linux draw no macOS-style drop shadow, so these are all flat
renders, again rasterised straight at each size: icon-small.svg up to 32 px,
icon.svg above.

Every PNG is rasterised by resvg straight at its pixel size (never a
downscale of the 1024 master). 16, 16@2x and 32 come from the -small SVG,
32@2x (64 px) and up from the full SVG.

Drop shadow. The SVG rules forbid filters, so the shadow is added here: the
squircle's alpha at 1024, blurred (Gaussian, sigma SHADOW_SIGMA, i.e. about
2 x sigma "blur" in design-tool terms), moved down SHADOW_DY, black at
SHADOW_ALPHA. That approximates the Apple macOS icon template shadow and
stays inside the 100-px margin. Below 1024 the same 1024 shadow layer is
LANCZOS-downscaled (it is a blur, so scaling it loses nothing) and the
directly rasterised artwork is composited over it. SHADOW_MIN_PX sets the
smallest iconset slot that gets the shadow (see the note there).

All PNGs are RGBA and get Apple's sRGB ICC profile attached as-is (resvg
renders in sRGB, so this tags the pixels and changes no values).

Usage: python -I export_icons.py   (needs Pillow and resvg; resvg is taken
from $RESVG, else from PATH, else /opt/homebrew/bin/resvg)
"""
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT.parent
RESVG = os.environ.get("RESVG") or shutil.which("resvg") or "/opt/homebrew/bin/resvg"
SRGB_ICC = Path("/System/Library/ColorSync/Profiles/sRGB Profile.icc").read_bytes()

SHADOW_DY = 12       # px at 1024, straight down
SHADOW_SIGMA = 12    # Gaussian sigma at 1024 (~24 px blur)
SHADOW_ALPHA = 0.35  # black at 35 %
# 16/32 px: the 1024 shadow shrinks to a sub-pixel offset and a 0.2-px blur,
# so all it adds is a faint grey fringe on the squircle's lower edge (judged
# on render/iconset-sheet.png): no depth, slightly muddier edge. The small
# slots therefore stay flat; 64 px (32@2x) and up carry the shadow.
SHADOW_MIN_PX = 64

SLOTS = [  # (file stem, pixel size)
    ("icon_16x16", 16), ("icon_16x16@2x", 32), ("icon_32x32", 32),
    ("icon_32x32@2x", 64), ("icon_128x128", 128), ("icon_128x128@2x", 256),
    ("icon_256x256", 256), ("icon_256x256@2x", 512), ("icon_512x512", 512),
    ("icon_512x512@2x", 1024),
]
SMALL_MAX_PX = 32  # slots up to this size come from the -small SVG

ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
LINUX_SIZES = (16, 32, 48, 64, 128, 256, 512)

SETS = {  # output name: (full SVG, small SVG)
    "icon": ("icon.svg", "icon-small.svg"),
    "icon-dark": ("icon-dark.svg", "icon-small-dark.svg"),
}


def render(svg, size):
    """Rasterise svg at size x size with resvg; any stderr output is fatal."""
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "r.png"
        p = subprocess.run([RESVG, "-w", str(size), "-h", str(size), str(svg), str(out)],
                           capture_output=True, text=True)
        if p.returncode or p.stderr.strip():
            sys.exit(f"resvg failed for {svg}@{size}: rc={p.returncode} {p.stderr.strip()}")
        img = Image.open(out).convert("RGBA")
        img.load()
    assert img.size == (size, size), (svg, size, img.size)
    return img


def shadow_layer(flat1024):
    """Black RGBA layer: the alpha of flat1024, blurred, offset, scaled."""
    a = flat1024.getchannel("A").filter(ImageFilter.GaussianBlur(SHADOW_SIGMA))
    a = ImageChops.offset(a, 0, SHADOW_DY)
    a = a.point(lambda v: round(v * SHADOW_ALPHA))
    layer = Image.new("RGBA", flat1024.size, (0, 0, 0, 0))
    layer.putalpha(a)
    # ImageChops.offset wraps; the top rows must stay empty (they are, as the
    # icon has a 100-px margin, but assert it so a geometry change can't
    # silently wrap a shadow onto the top edge).
    assert a.crop((0, 0, 1024, SHADOW_DY)).getextrema()[1] == 0
    return layer


def with_shadow(art, shadow1024):
    s = shadow1024 if art.size[0] == 1024 else shadow1024.resize(art.size, Image.LANCZOS)
    out = s.copy()
    out.alpha_composite(art)
    return out


def save(img, path):
    assert img.mode == "RGBA"
    img.save(path, icc_profile=SRGB_ICC)


def export(name, full_svg, small_svg):
    full_svg, small_svg = ROOT / full_svg, ROOT / small_svg
    flat = render(full_svg, 1024)
    shadow = shadow_layer(flat)
    save(flat, ROOT / f"{name}-1024-flat.png")
    save(with_shadow(flat, shadow), ROOT / f"{name}-1024.png")

    iconset = ROOT / f"{name}.iconset"
    iconset.mkdir(exist_ok=True)
    for old in iconset.glob("*.png"):
        old.unlink()
    for stem, px in SLOTS:
        art = render(small_svg if px <= SMALL_MAX_PX else full_svg, px)
        save(with_shadow(art, shadow) if px >= SHADOW_MIN_PX else art, iconset / f"{stem}.png")
    print(f"wrote {name}-1024.png, {name}-1024-flat.png, {name}.iconset/ ({len(SLOTS)} files)")


def ico_sizes(path):
    """Sizes listed in an ICO directory (header parsed by hand, not by Pillow)."""
    data = path.read_bytes()
    reserved, kind, count = struct.unpack_from("<HHH", data, 0)
    assert (reserved, kind) == (0, 1), f"{path} is not an ICO file"
    sizes = []
    for i in range(count):
        w, h = struct.unpack_from("<BB", data, 6 + 16 * i)
        sizes.append((w or 256, h or 256))  # 0 means 256
    return sizes


def export_win_linux(full_svg="icon.svg", small_svg="icon-small.svg"):
    full_svg, small_svg = ROOT / full_svg, ROOT / small_svg

    def flat(px):
        return render(small_svg if px <= SMALL_MAX_PX else full_svg, px)

    imgs = [flat(px) for px in ICO_SIZES]
    ico = BUILD / "icon.ico"
    imgs[-1].save(ico, format="ICO", sizes=[im.size for im in imgs], append_images=imgs[:-1])
    got = ico_sizes(ico)
    want = [(px, px) for px in ICO_SIZES]
    if sorted(got) != want:
        sys.exit(f"{ico}: expected sizes {want}, got {got}")

    save(render(full_svg, 1024), BUILD / "icon.png")

    icons = BUILD / "icons"
    icons.mkdir(exist_ok=True)
    for old in icons.glob("*.png"):
        old.unlink()
    for px in LINUX_SIZES:
        save(flat(px), icons / f"{px}x{px}.png")
    print(f"wrote icon.ico ({', '.join(str(w) for w, _ in sorted(got))}), icon.png (1024), "
          f"icons/ ({len(LINUX_SIZES)} files)")


if __name__ == "__main__":
    for name, (full, small) in SETS.items():
        export(name, full, small)
    export_win_linux()
