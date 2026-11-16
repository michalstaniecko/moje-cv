# Inspector beside the pages replaces the Outline and the CV design popover

Status: proposed – experiment (`experiment/inline-editing-redesign`, integration branch `feat/136-inspector`; spec: issue #136, tickets #137–#142; accepted prototype: branch `prototype/global-options-ui`, variant A). Supersedes the part of ADR-0011 that keeps CV design in the toolbar ("the Outline exists only in Edit mode"), decisions Q13, Q18 and Q19 of `docs/specs/inline-editing-redesign.md` and D3 of `docs/specs/outline-instead-of-cv-form.md`.

General CV options had no single place: CV design lived in the toolbar's "CV design" popover and in the CV form, visibility of the photo, sections and consent clause in the Outline (which disappears in Preview mode) plus handle menus on the pages, and every option behaved a little differently. We decided that the editor screen gets one fixed column to the right of the pages, the Inspector (about 284–320 px, `clamp(284px, 24vw, 320px)`), present in both Edit mode and Preview mode, with the pages and the Inspector scrolling separately and the screen itself never scrolling. With nothing selected it shows the "Document" panel: CV design in collapsible groups (Template with Template thumbnails, Style with accent colour swatches plus a custom colour and font cards set in their own typeface, Language with the CV language and a note that it does not translate content) and, from #138, the "CV elements" list that takes over the Outline's jobs; selecting a part of the CV on the pages or in that list shows the part's own panel (#139–#141). The Inspector never edits CV content (only a section title); every action goes through the editor as a `Change<CvDocument>`, so it is on the pages at once, autosaved and one undo step, and the custom colour keeps the `settings:accentColor` merge key. The "CV design" popover leaves the toolbar, which instead gets Undo/Redo (#137). Collapsed groups are an interface preference, remembered in memory for the app session (simpler than app settings; not a property of the CV).

## Considered Options

- **Keep CV design in the toolbar popover** (ADR-0011, Q18): rejected – the argument that the popover is the only place reachable in both modes no longer holds once the Inspector is in both modes, and a popover hides the pages it changes.
- **Keep the Outline as a left sidebar next to a right-hand Inspector**: rejected as the end state – two side panels take space from the pages and split the same part-of-CV actions; the Outline stays only temporarily (layout Outline | pages | Inspector) until the "CV elements" list replaces it (#138).
- **Put the Inspector in the left sidebar instead of the Outline**: rejected – the sidebar disappears in Preview mode and is still shared with the CV form until #135.
- **Remember collapsed groups in the app settings**: rejected for now – needs schema, IPC and migration work for a minor preference; session memory is enough.
- **"Layout and format" options (text size, density, photo shape, date format, page size) and an "App" tab** from the prototype: out of scope – each option without a schema field is a separate schema change (ADR-0002); Interface language and Appearance stay in the native menu.

## Consequences

- `editorSidebar`, the sidebar rail and the CV form stay until #135; while the CV form is shown its CV design section and the Inspector's Document panel show the same settings, so e2e locators for the form's controls are scoped to `.editor-form`.
- E2E tests that used the popover are rewritten to the Inspector; golden pages pick the Template in the Inspector and must not change.
- The Inspector is a UI root (`color-scheme: light dark`, `--ui-*` tokens, ADR-0004); Template thumbnails in it stay white paper.
- A linear accessible path (Inspector → Page fields) and VoiceOver on the "CV elements" list must be checked by a human before the Outline and the CV form are gone.
