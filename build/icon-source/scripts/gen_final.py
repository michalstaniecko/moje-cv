"""Generate the final CV Press icon files (issue #73, round 9).

Base design is 07-t1 (see gen_refine.py). This round changes three things:

1. Elevation. 07-t1 cast a 56-unit shadow band below the page. The sheet should
   instead look barely lifted off the tile: a tight, nearly even shadow that
   hugs the page with only a small downward bias. No filters or blur, so the
   shadow is built from rounded rects whose opacity comes only from
   stop-opacity on linear gradients. Two candidates:
     08-e1  contact shadow: one rect +12 around the page, +8 more at the
            bottom, DEEP at a uniform 0.35.
     08-e2  stepped fake blur: three rects +6/+12/+18 around the page
            (+4/+8/+12 more at the bottom), DEEP at 0.22/0.14/0.08.
   ELEVATION picks the one written to icon.svg: e2. e1's single solid step
   reads as a dark frame drawn around the page; e2's three faint steps read
   as a soft, tight shadow and vanish into the page edge at 16 px.

2. icon-small.svg for 16 and 32 px. Same squircle, gradient, page, sidebar,
   photo and colours, but the content is a few thick blocks on the 64-unit
   grid (whole pixels at 16 px, and so at 32 px too): photo, three white
   sidebar bars, an ink name bar and three accent bars (the last one short) on
   the full icon's section rows 7, 9 and 11. No thin rules, no shadow.
   Tried and rejected: two bars per column (rows 7 and 9, bottom third of the
   page empty, top-heavy) and two bars on rows 8 and 10 (big gap under photo).

3. icon-mark.svg (no tile, no shadow): the 07-t1 foreground scaled 1.25x about
   the centre (replaces the old /tmp/markgen script), plus a 16-unit accent
   outline behind the page so the page edge reads on light and dark
   backgrounds. Outline bounds x176-848 / y96-928 (9.4% margin top/bottom).
   20 units was tried first; it is a blurry 1.25 px at 64, 16 is a crisp 1 px.

Also writes the candidates to variants/ (08-e1, 08-e2 and their -fg files).

Round 10: light/dark appearance. Every colour role is now a palette entry
(LIGHT reproduces round 9 byte for byte). A .icns cannot carry appearance
variants (macOS 26 dark/tinted icons need an Icon Composer .icon), so the dark
files are prepared sources only; build/icon.icns stays the light icon.

  icon-dark.svg, icon-small-dark.svg  (DARK_PICK = d4)  Same geometry. Tile
      #18222e -> #0f1620 (--ui-panel-bg / --ui-app-bg, dark), with a 6-unit
      rim in #5b9cf0 (--ui-accent, dark) at 0.45 -> 0.12 stop-opacity so the
      squircle still has an edge on a dark Dock. Page #e6edf5 (--ui-text,
      dark: white dimmed). Sidebar #2c3a4a (--ui-border, dark), lighter than
      the tile so the page's left half doesn't sink into it. Page content
      keeps the light accents #1f6fcf/#174f99 and ink #1c2733: they sit on
      the light page, where the dark-mode accents (#5b9cf0/#7fb3f5) would be
      too pale. Page shadow in black (0.12/0.2/0.3), since #0f3a73 vanishes on
      the dark tile.
      Rejected (variants/10-*): d1 slate tile #2c3a4a -> #18222e with a
      darker #0f1620 sidebar (tile looks greyish, flat on light Docks); d2 ink
      tile and ink sidebar with a blue halo round the page (sidebar merges
      into the tile at 16-64 px); d3 = d4 with a grey #93a3b5 rim (fine, but
      loses the one brand-blue cue on the tile).
  icon-mark-light.svg  outline darkened to #174f99 so the white page edge
      reads on light backgrounds (#1f6fcf is a touch soft on #eef3f8).
  icon-mark-dark.svg   outline lightened to #5b9cf0 (dark --ui-accent) and
      page/sidebar text dimmed to #e6edf5, matching the dark icon; the bright
      outline separates the ink sidebar from a dark background.
"""
from pathlib import Path

ACCENT, SHADE = "#1f6fcf", "#174f99"
DEEP = "#0f3a73"
PAPER, INK = "#ffffff", "#1c2733"

# Palette roles. LIGHT is the shipped icon (values from app.css, light :root).
LIGHT = dict(
    tile=(ACCENT, SHADE),   # squircle gradient, top -> bottom
    rim=None,               # optional (colour, top opacity, bottom opacity) edge
    paper=PAPER,            # page
    side=INK,               # sidebar
    side_fg=PAPER,          # photo and sidebar lines
    ink=INK,                # name bar
    accent=ACCENT, shade=SHADE,
    deep=DEEP,              # page shadow colour
    outline=ACCENT,         # mark outline
)

ROOT = Path(__file__).resolve().parent.parent
VAR = ROOT / "variants"
TILE = (100, 824, 181)       # squircle x/y, size, corner radius
RIM = 6                      # dark tile edge width (3 px at 512)

PAGE = (256, 192, 768, 832)  # x0, y0, x1, y1 at 1024
SIDE = 512                   # sidebar right edge
ELEVATION = "e2"             # which candidate goes into icon.svg


def tile(p):
    """Squircle defs and body. With p["rim"], a thin lighter edge sits under
    a tile inset by RIM, so a dark tile still has an edge on a dark Dock."""
    o, n, r = TILE
    t0, t1 = p["tile"]
    defs = [('<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="512" y1="100" x2="512" y2="924">'
             f'<stop offset="0" stop-color="{t0}"/><stop offset="1" stop-color="{t1}"/></linearGradient>')]
    if not p["rim"]:
        return defs, [f'<rect x="{o}" y="{o}" width="{n}" height="{n}" rx="{r}" fill="url(#bg)"/>']
    c, a0, a1 = p["rim"]
    defs.append('<linearGradient id="rim" gradientUnits="userSpaceOnUse" x1="512" y1="100" x2="512" y2="924">'
                f'<stop offset="0" stop-color="{c}" stop-opacity="{a0}"/>'
                f'<stop offset="1" stop-color="{c}" stop-opacity="{a1}"/></linearGradient>')
    w = RIM
    return defs, [
        f'<rect x="{o}" y="{o}" width="{n}" height="{n}" rx="{r}" fill="{t1}"/>',
        f'<rect x="{o}" y="{o}" width="{n}" height="{n}" rx="{r}" fill="url(#rim)"/>',
        f'<rect x="{o + w}" y="{o + w}" width="{n - 2 * w}" height="{n - 2 * w}" rx="{r - w}" fill="url(#bg)"/>',
    ]


def svg(defs, body):
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">']
    if defs:
        out += ["  <defs>"] + [f"    {d}" for d in defs] + ["  </defs>"]
    out += [f"  {b}" for b in body]
    return "\n".join(out) + "\n</svg>\n"


class T:
    """Integer-only transform: v -> v * num / den + off. Asserts exactness."""

    def __init__(self, num=1, den=1, off=0):
        self.num, self.den, self.off = num, den, off

    def ln(self, v):
        assert (v * self.num) % self.den == 0, v
        return v * self.num // self.den

    def p(self, v):
        return self.ln(v) + self.off


ID = T()


def rect(t, x, y, w, h, rx, fill):
    return (f'<rect x="{t.p(x)}" y="{t.p(y)}" width="{t.ln(w)}" height="{t.ln(h)}" '
            f'rx="{t.ln(rx)}" fill="{fill}"/>')


def circle(t, cx, cy, r, fill):
    return f'<circle cx="{t.p(cx)}" cy="{t.p(cy)}" r="{t.ln(r)}" fill="{fill}"/>'


def page(t, p=LIGHT, r=16):
    """White page plus the full-height ink sidebar, rounded on the left."""
    x0, y0, x1, y1 = PAGE
    X0, Y0, Y1, S, R = t.p(x0), t.p(y0), t.p(y1), t.p(SIDE), t.ln(r)
    return [
        rect(t, x0, y0, x1 - x0, y1 - y0, r, p["paper"]),
        (f'<path d="M{X0 + R} {Y0} H{S} V{Y1} H{X0 + R} A{R} {R} 0 0 1 {X0} {Y1 - R} '
         f'V{Y0 + R} A{R} {R} 0 0 1 {X0 + R} {Y0} Z" fill="{p["side"]}"/>'),
    ]


def content(t, p=LIGHT):
    """07-t1 page content (photo, sidebar line pairs, right column)."""
    sf, ink, acc, sh = p["side_fg"], p["ink"], p["accent"], p["shade"]
    out = [circle(t, 384, 320, 72, sf)]
    for y, (a, b) in zip((448, 576, 704), ((128, 96), (128, 80), (112, 64))):
        out += [rect(t, 320, y, a, 16, 8, sf), rect(t, 320, y + 48, b, 16, 8, sf)]
    x, w = 576, 144
    out += [
        rect(t, x, 256, w, 56, 12, ink),       # name
        rect(t, x, 336, w - 48, 16, 8, sh),    # job title
        rect(t, x, 376, w, 8, 4, acc),         # header rule
        rect(t, x, 448, w - 48, 32, 8, sh),    # section heading
        rect(t, x, 496, w, 16, 8, acc),
        rect(t, x, 576, w, 16, 8, acc), rect(t, x, 624, w - 32, 16, 8, acc),
        rect(t, x, 704, w - 48, 32, 8, sh),
        rect(t, x, 752, w - 32, 16, 8, acc),
    ]
    return out


def flat(i, opacity, colour=DEEP):
    """A linear gradient with two equal stops: colour at a uniform stop-opacity."""
    return (f'<linearGradient id="sh{i}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{colour}" stop-opacity="{opacity}"/>'
            f'<stop offset="1" stop-color="{colour}" stop-opacity="{opacity}"/></linearGradient>')


def shadow(layers, p=LIGHT):
    """layers: (grow around, extra at bottom, opacity), outermost first."""
    x0, y0, x1, y1 = PAGE
    defs, body = [], []
    for i, (g, b, op) in enumerate(layers, 1):
        defs.append(flat(i, op, p["deep"]))
        body.append(f'<rect x="{x0 - g}" y="{y0 - g}" width="{x1 - x0 + 2 * g}" '
                    f'height="{y1 - y0 + 2 * g + b}" rx="{16 + g}" fill="url(#sh{i})"/>')
    return defs, body


SHADOWS = {
    "e1": [(12, 8, 0.35)],
    "e2": [(18, 12, 0.08), (12, 8, 0.14), (6, 4, 0.22)],
}


def full_icon(elev, p=LIGHT, layers=None):
    defs, sh = shadow(layers or SHADOWS[elev], p)
    tdefs, tbody = tile(p)
    fg = sh + page(ID, p) + content(ID, p)
    return svg(tdefs + defs, tbody + fg), svg(defs, fg)


def small_icon(p=LIGHT):
    """16/32 px version: thick blocks on the 64-unit grid, square corners."""
    body = page(ID, p) + [
        circle(ID, 384, 320, 72, p["side_fg"]),   # photo, centred on a 2x2 pixel block
        rect(ID, 576, 256, 128, 64, 0, p["ink"]),  # name bar, row 4
    ]
    # Rows 7, 9 and 11, the same three section rows as the full icon.
    for y, w in ((448, 128), (576, 128), (704, 64)):
        body += [rect(ID, 320, y, 128, 64, 0, p["side_fg"]),  # sidebar bar, 2 px wide
                 rect(ID, 576, y, w, 64, 0, p["accent"])]     # accent bar, last one short
    tdefs, tbody = tile(p)
    return svg(tdefs, tbody + body), svg([], body)


def mark(p=LIGHT):
    """Foreground at 1.25x about the centre (v -> 1.25v - 128), accent outline."""
    t = T(5, 4, -128)
    x0, y0, x1, y1 = PAGE
    # Outline 16 wide in output units: exactly 1 px at 64 px, and the page
    # (x192-832, y112-912) and outline edges (x176-848, y96-928) all land on
    # the 16-unit grid, so the 1-px ring is crisp at 64.
    w = 16
    X0, Y0, X1, Y1 = t.p(x0) - w, t.p(y0) - w, t.p(x1) + w, t.p(y1) + w
    outline = rect(ID, X0, Y0, X1 - X0, Y1 - Y0, t.ln(16) + w, p["outline"])
    return svg([], [outline] + page(t, p) + content(t, p))



# Dark appearance (round 10). Values from app.css, dark @media block:
# --ui-app-bg #0f1620, --ui-panel-bg #18222e, --ui-border #2c3a4a,
# --ui-text #e6edf5, --ui-accent #5b9cf0, --ui-accent-dark #7fb3f5.
D_BG, D_PANEL, D_BORDER = "#0f1620", "#18222e", "#2c3a4a"
D_TEXT, D_ACCENT = "#e6edf5", "#5b9cf0"
DARK_BASE = dict(LIGHT, paper=D_TEXT, side_fg=D_TEXT, outline=D_ACCENT)
DARK_CANDIDATES = {
    # slate tile, sidebar darker than the tile, black page shadow
    "d1": (dict(DARK_BASE, tile=(D_BORDER, D_PANEL), side=D_BG, deep="#000000"),
           [(18, 12, 0.12), (12, 8, 0.2), (6, 4, 0.3)]),
    # ink tile, ink sidebar, the page lit by a dark-accent halo, accent rim
    "d2": (dict(DARK_BASE, tile=(INK, D_BG), side=INK, deep=D_ACCENT, rim=(D_ACCENT, 0.5, 0.15)),
           None),
    # near-black tile, sidebar lighter than the tile, muted rim, black shadow
    "d3": (dict(DARK_BASE, tile=(D_PANEL, D_BG), side=D_BORDER, deep="#000000",
                rim=("#93a3b5", 0.35, 0.1)),
           [(18, 12, 0.12), (12, 8, 0.2), (6, 4, 0.3)]),
    # d3 with the dark-accent rim of d2
    "d4": (dict(DARK_BASE, tile=(D_PANEL, D_BG), side=D_BORDER, deep="#000000",
                rim=(D_ACCENT, 0.45, 0.12)),
           [(18, 12, 0.12), (12, 8, 0.2), (6, 4, 0.3)]),
}
DARK_PICK = "d4"  # written to icon-dark.svg / icon-small-dark.svg

# Mark variants. icon-mark.svg (LIGHT, #1f6fcf outline) stays the universal one.
MARK_LIGHT = dict(LIGHT, outline=SHADE)                       # for light backgrounds
MARK_DARK = dict(LIGHT, paper=D_TEXT, side_fg=D_TEXT, outline=D_ACCENT)  # for dark backgrounds


def write(path, text):
    path.parent.mkdir(exist_ok=True)
    path.write_text(text)


if __name__ == "__main__":
    for e in SHADOWS:
        full, fg = full_icon(e)
        write(VAR / f"08-{e}.svg", full)
        write(VAR / f"08-{e}-fg.svg", fg)
    full, fg = full_icon(ELEVATION)
    write(ROOT / "icon.svg", full)
    write(VAR / "08-icon-fg.svg", fg)
    small, small_fg = small_icon()
    write(ROOT / "icon-small.svg", small)
    write(VAR / "08-small-fg.svg", small_fg)
    write(ROOT / "icon-mark.svg", mark())
    for k, (pal, layers) in DARK_CANDIDATES.items():
        full, fg = full_icon(ELEVATION, pal, layers)
        write(VAR / f"10-{k}.svg", full)
        write(VAR / f"10-{k}-small.svg", small_icon(pal)[0])
    pal, layers = DARK_CANDIDATES[DARK_PICK]
    write(ROOT / "icon-dark.svg", full_icon(ELEVATION, pal, layers)[0])
    write(ROOT / "icon-small-dark.svg", small_icon(pal)[0])
    write(ROOT / "icon-mark-light.svg", mark(MARK_LIGHT))
    write(ROOT / "icon-mark-dark.svg", mark(MARK_DARK))
    print("wrote icon-dark.svg (" + DARK_PICK + "), icon-small-dark.svg, icon-mark-light.svg, "
          "icon-mark-dark.svg and variants/10-*")
    print("wrote icon.svg (" + ELEVATION + "), icon-small.svg, icon-mark.svg and variants/08-*")
