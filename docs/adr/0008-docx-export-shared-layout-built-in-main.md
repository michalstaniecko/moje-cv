# DOCX export uses one shared layout, built from CV blocks in the main process

Status: accepted (decision log: `docs/specs/issue-84-grilling.md`).

The DOCX export exists so the user can keep editing their CV in a word processor, not to reproduce a Template. We decided that every Template exports to the same simplified layout (headings as Word heading styles, real bulleted lists, dates on a right-aligned tab stop, a borderless table only for the header with a photo), carrying over only the content, accent colour, font and CV language. The file is built natively with the `docx` library in the main process from `generateBlocks` with a geometry of its own, so the main process never imports Template modules (which import CSS) and a new Template needs no DOCX work. The fonts are embedded from unmodified upstream static TTF files shipped next to their `OFL.txt` as `extraResources`, even though the renderer already bundles the same families as `@fontsource` WOFF2: converting WOFF2 to TTF counts as a modification under the OFL, and Lato and Source Sans 3 carry Reserved Font Names.

## Considered Options

- **Converting the rendered Template HTML to DOCX** (`docx/html`, `@turbodocx/html-to-docx`): rejected, because the Templates are laid out with CSS grid/flex, which these converters ignore, so a Word-specific markup would have to be written anyway.
- **PDF to DOCX**: rejected, no maintained JS library; Word's own PDF import is the free workaround.
- **A DOCX mapping per Template from the start**: deferred (+1–3 days per Template). It needs the Template geometry moved to CSS-free modules and makes every new Template more expensive; a layout made for editing has more value than fidelity.
- **Word tables for every two-column arrangement** (dates column, contacts grid, list columns): rejected for MVP, because borderless tables are hard to extend for non-technical users; tab stops and lists survive all four editors.
- **Fonts converted from `@fontsource` WOFF2**: rejected for the licensing reason above.

## Consequences

- The DOCX never looks exactly like the PDF; the app says so in the notice after saving.
- The app ships two copies of each CV font (WOFF2 for the renderer, TTF for DOCX, about 5–7 MB more).
- Revisit if per-Template DOCX fidelity is requested: that is when Template geometry moves out of the CSS-importing modules.
