# Interface colours live only in CSS tokens; Appearance is switched through `nativeTheme`

Every colour of the app's own interface is a CSS custom property declared once in `app.css`, with a light set and a dark set selected by `prefers-color-scheme`. The main process owns the Appearance setting (Light / Dark / System), exactly like the Interface language: it is chosen in the app menu, stored in the settings file, and applied by setting `nativeTheme.themeSource`. Electron then flips `prefers-color-scheme` in the renderer, so no IPC, no `data-theme` attribute on `html` and no React state carry the choice, and native dialogs and menus follow it too. `color-scheme: dark` is applied to interface elements only, never to `html`, so CV pages, template thumbnails and the exported PDF stay untouched by Appearance. The single exception to "colours only in `app.css`" is the window background for `BrowserWindow.backgroundColor`, which is repeated once in `src/shared/appearance.ts` and kept equal to the `--ui-app-bg` token by a unit test.

## Considered Options

- **`data-theme` attribute on `html` driven by renderer state over IPC**: rejected, because it duplicates what `nativeTheme` already does, adds an API surface, and leaves native dialogs on the system look.
- **Dark palette applied by a global `color-scheme: dark` on `html`**: rejected, because Chromium would then restyle controls and defaults inside CV pages, which must look the same as the PDF regardless of Appearance.
- **Per-component colours (Tailwind or CSS-in-JS)**: rejected, because a single token sheet is enough for a 600-line stylesheet and keeps the "colours exist in one place" rule enforceable.
