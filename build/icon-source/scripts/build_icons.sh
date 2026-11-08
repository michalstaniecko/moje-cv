#!/bin/sh
# Issue #73: generate every SVG, check them, export the master PNGs and
# iconsets, build build/icon.icns (light icon only) plus build/icon.ico,
# build/icon.png and build/icons/ (Windows/Linux), verify them, and render
# the review sheets:
#   render/appearance-sheet.png  light/dark icon and marks on light, dark, wallpaper
#   render/iconset-sheet.png     every iconset PNG at 1x, 16/32 zoomed
# Usage: sh build/icon-source/scripts/build_icons.sh
# Needs Python 3 with Pillow, resvg and /usr/bin/iconutil (macOS); see ../README.md.
# PYTHON picks the interpreter (default: python3 on PATH), RESVG the resvg binary.
set -eu
PY="${PYTHON:-python3}"
$PY -I -c "import PIL" 2>/dev/null || { echo "$PY has no Pillow; set PYTHON to a Python with Pillow (see build/icon-source/README.md)" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$(cd "$ROOT/.." && pwd)"
S="$ROOT/scripts"

$PY -I "$S/gen_final.py"

echo "== SVG checks"
$PY -I - "$ROOT"/icon*.svg <<'EOF'
import re, sys, xml.etree.ElementTree as E
NUM_ATTRS = {"x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2"}
bad = 0
for f in sys.argv[1:]:
    root = E.parse(f).getroot()                       # XML must parse
    txt = open(f).read()
    errs = []
    if root.get("viewBox") != "0 0 1024 1024": errs.append("viewBox")
    if root.get("width") or root.get("height"): errs.append("width/height on <svg>")
    for tag in ("text", "filter", "mask", "radialGradient", "style", "clipPath", "image", "pattern"):
        if f"<{tag}" in txt: errs.append(f"<{tag}>")
    if re.search(r'\sstyle=|\sclass=|\s(fill-|stroke-)?opacity=', txt): errs.append("style/class/opacity attr")
    for el in root.iter():
        for k, v in el.attrib.items():
            if k in NUM_ATTRS and el.tag.endswith("linearGradient") and el.get("gradientUnits") != "userSpaceOnUse":
                continue  # objectBoundingBox 0..1 fractions
            if k in NUM_ATTRS and not re.fullmatch(r"-?\d+", v): errs.append(f"{k}={v}")
        if el.tag.endswith("path"):
            for n in re.findall(r"-?\d*\.?\d+", el.get("d")):
                if not re.fullmatch(r"-?\d+", n): errs.append(f"path number {n}")
    print(f"{f.rsplit('/', 1)[1]}: {'OK' if not errs else 'FAIL ' + ', '.join(errs)}")
    bad += bool(errs)
sys.exit(bad)
EOF

echo "== export (resvg stderr is fatal inside export_icons.py)"
$PY -I "$S/export_icons.py"

echo "== iconset dimensions"
$PY -I - "$ROOT/icon.iconset" "$ROOT/icon-dark.iconset" <<'EOF'
import sys, re
from pathlib import Path
from PIL import Image
expect = {"icon_16x16": 16, "icon_16x16@2x": 32, "icon_32x32": 32, "icon_32x32@2x": 64,
          "icon_128x128": 128, "icon_128x128@2x": 256, "icon_256x256": 256,
          "icon_256x256@2x": 512, "icon_512x512": 512, "icon_512x512@2x": 1024}
bad = 0
for d in map(Path, sys.argv[1:]):
    names = sorted(p.stem for p in d.iterdir())
    if sorted(expect) != names:
        print(d.name, "WRONG FILE SET", names); bad = 1
    for stem, px in expect.items():
        im = Image.open(d / f"{stem}.png")
        ok = im.size == (px, px) and im.mode == "RGBA" and "icc_profile" in im.info
        bad |= not ok
        print(f"{d.name}/{stem}.png {im.size[0]}x{im.size[1]} {im.mode} icc={'icc_profile' in im.info} {'OK' if ok else 'FAIL'}")
sys.exit(bad)
EOF

echo "== iconutil"
/usr/bin/iconutil -c icns "$ROOT/icon.iconset" -o "$BUILD/icon.icns"
ls -l "$BUILD/icon.icns"
RT="$(mktemp -d)/roundtrip.iconset"
/usr/bin/iconutil -c iconset "$BUILD/icon.icns" -o "$RT"
for f in "$RT"/*.png; do
  printf '%s %s\n' "$(basename "$f")" "$(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/ {printf "%s ", $2}')"
done
test -f "$RT/icon_512x512@2x.png" && echo "512@2x present: $(sips -g pixelWidth "$RT/icon_512x512@2x.png" | awk '/pixelWidth/ {print $2}') px"

echo "== Windows / Linux icons"
$PY -I - "$BUILD" <<'EOF'
import struct, sys
from pathlib import Path
from PIL import Image
b = Path(sys.argv[1])
bad = 0
data = (b / "icon.ico").read_bytes()
n = struct.unpack_from("<HHH", data, 0)[2]
hdr = sorted((struct.unpack_from("<B", data, 6 + 16 * i)[0] or 256) for i in range(n))
frames = []
with Image.open(b / "icon.ico") as im:
    pil = sorted(w for w, h in im.info["sizes"])
    for w in pil:
        im.size = (w, w)
        im.load()
        frames.append(f"{im.size[0]}:{im.mode}")
ok = hdr == pil == [16, 24, 32, 48, 64, 128, 256] and all(f.endswith("RGBA") for f in frames)
bad |= not ok
print(f"icon.ico header sizes {hdr}, decoded frames {frames} {'OK' if ok else 'FAIL'}")
im = Image.open(b / "icon.png")
ok = im.size == (1024, 1024) and im.mode == "RGBA"
bad |= not ok
print(f"icon.png {im.size[0]}x{im.size[1]} {im.mode} {'OK' if ok else 'FAIL'}")
want = [16, 32, 48, 64, 128, 256, 512]
names = sorted(p.name for p in (b / "icons").iterdir())
if names != sorted(f"{s}x{s}.png" for s in want):
    print("icons/ WRONG FILE SET", names); bad = 1
for s in want:
    im = Image.open(b / "icons" / f"{s}x{s}.png")
    ok = im.size == (s, s) and im.mode == "RGBA"
    bad |= not ok
    print(f"icons/{s}x{s}.png {im.size[0]}x{im.size[1]} {im.mode} {'OK' if ok else 'FAIL'}")
sys.exit(bad)
EOF

echo "== master PNG"
for f in "$ROOT/icon-1024.png" "$ROOT/icon-dark-1024.png"; do
  sips -g pixelWidth -g pixelHeight -g space -g profile -g hasAlpha "$f"
done

echo "== sheets"
$PY -I "$S/appearance_sheet.py" "$ROOT/render/appearance-sheet.png" \
  "icon (light)=icon.svg,icon-small.svg,shadow" \
  "icon-dark=icon-dark.svg,icon-small-dark.svg,shadow" \
  "icon-mark-light=icon-mark-light.svg" \
  "icon-mark-dark=icon-mark-dark.svg" \
  "icon-mark (universal)=icon-mark.svg"
$PY -I "$S/iconset_sheet.py" "$ROOT/render/iconset-sheet.png" icon icon-dark
