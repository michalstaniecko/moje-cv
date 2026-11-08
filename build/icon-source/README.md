# App icon source (issue #73)

`scripts/gen_final.py` writes the SVGs in this directory; everything else is
exported from them. electron-builder picks up the results from `build/`
(`directories.buildResources`), with no setting in `electron-builder.yml`:

- `build/icon.icns`: macOS, 16 to 512@2x (from `icon.iconset/`)
- `build/icon.ico`: Windows, 16, 24, 32, 48, 64, 128, 256
- `build/icon.png` (1024) and `build/icons/NxN.png` (16 to 512): Linux

Other files here:

- `icon.svg`, `icon-small.svg` (16 and 32 px slots), `icon-dark.svg`,
  `icon-small-dark.svg`, `icon-mark*.svg`: the artwork.
- `icon-1024.png`: the 1024 master with the macOS drop shadow (sRGB), for
  App Store Connect and other materials. `icon-1024-flat.png` is the same
  without the shadow. `icon-dark-1024*.png`: the same for the dark icon
  (not used in the build).

## Regenerating

Requirements (macOS):

- [resvg](https://github.com/linebender/resvg) (`brew install resvg`); taken
  from `$RESVG`, else `PATH`, else `/opt/homebrew/bin/resvg`
- Python 3 with Pillow, e.g. a venv:
  `python3 -m venv /tmp/iconvenv && /tmp/iconvenv/bin/pip install Pillow`
- `/usr/bin/iconutil` (part of macOS)

From the repo root:

```sh
PYTHON=/tmp/iconvenv/bin/python sh build/icon-source/scripts/build_icons.sh
```

(`PYTHON` defaults to `python3` on `PATH`.) The script regenerates the SVGs,
checks them, writes the masters, the iconsets, `icon.icns`, `icon.ico`,
`icon.png` and `icons/`, checks every size, and renders review sheets to
`render/`. Iconsets, `render/` and `variants/` are not committed (see
`.gitignore`).
