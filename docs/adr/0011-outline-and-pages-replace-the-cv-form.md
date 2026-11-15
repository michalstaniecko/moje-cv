# The Outline, the pages and the toolbar replace the CV form

Status: proposed – experiment (`experiment/inline-editing-redesign`; spec and tickets: `docs/specs/outline-instead-of-cv-form.md`). Supersedes the consequence of ADR-0010 that "the CV form stays permanently" and decision 4 of `docs/specs/wysiwyg-editing.md`.

The owner wants to remove the CV form from the editor's sidebar. We decided that everything only the CV form can do moves to the Outline, the Page fields with their menus and Field popovers, or the toolbar, and that the CV form is removed only after that (a separate, last ticket). An inventory (2026-11-15) found that the CV design settings (accent colour, font, Template, CV language) are already reachable without the form through the toolbar's "CV design" popover, so they stay there and do not enter the Outline: the popover works in both modes, the Outline exists only in Edit mode, and a second place for the same settings would be a duplicate. The real gaps are: turning the photo off without deleting it (no such option existed at all), removing a contact visibly, and reordering bullets, list items and contacts without a keyboard shortcut. The photo gets a `hidden` flag (`CV_SCHEMA_VERSION` 7) and behaves like a hidden section: not on the pages, in the PDF or in the DOCX, listed in the Outline with a "Show on CV" switch. The content of a hidden section is edited after showing it again; there is no second way to display hidden content.

## Considered Options

- **Keep the CV form permanently** (ADR-0010, decision of 2026-11-15): rejected by the owner – two complete editing surfaces double the work for every new field and keep the form-centred e2e suite alive.
- **Move CV design into the Outline**: rejected, it is already reachable from the toolbar in both modes.
- **Remember the last removed photo outside the document** to make "Remove" reversible: rejected, invisible state that is lost when the CV is closed; a `hidden` flag in the document is explicit and survives export/import.
- **Drag-reordering on the pages**: rejected for now; a context menu of the Page field with "Move up/down" and the existing ⌥⇧↑/↓ shortcut cover mouse and keyboard.

## Consequences

- Removing the CV form needs about 190 e2e tests rewritten from the form to the pages and the Outline, and the clean-up of `editorSidebar: 'form'`, `formWidth`, `PaneSeparator` and the sidebar's Outline/Form toggle.
- The linear accessible way to edit becomes the Outline plus the Page fields in document order; it is verified with VoiceOver before the form is removed.
- Older app versions read a CV with a hidden photo as "from a newer version" (ADR-0002 rules for schema bumps).
