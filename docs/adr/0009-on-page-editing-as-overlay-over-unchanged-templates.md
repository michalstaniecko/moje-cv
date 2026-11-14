# On-page editing is an overlay over unchanged Template pages, with edit cards instead of editable Template markup

Status: proposed – experiment (decision log: `docs/specs/inline-editing-redesign.md`).

The CV editor lets the user edit a CV by clicking it on the pages instead of filling a long form, and every Template, the PDF and the DOCX export must look exactly as before. We decided that the pages stay a pure rendering of the CV (`CvPages`, Template block views and stylesheets, `generateBlocks`, `paginate` are unchanged; the shared block wrapper only gains a `data-block-id` attribute) and that editing happens in a separate layer next to them, outside the `.cv` root: it reads where blocks ended up on the pages, draws outlines, handles and "+" buttons on top, and opens an Edit card (a floating panel with the fields of that one part of the CV, built from the same field components as the CV form) anchored next to the clicked part. Which field was clicked is recognised through a small contract of class names the Templates already use (`.cv-name`, `.cv-photo`, `.cv-contact`, `.cv-summary`, `.cv-section-title`, `.cv-role`, `.cv-company`, `.cv-date`, `li` in every Template; `.cv-education-level` only where a Template draws the level on its own – Classic's shared education markup does not, so a click there focuses the card's first field). Empty fields get no placeholders in the document: Edit mode and Preview mode always have the same page split as the PDF, and what is missing is offered by controls of the layer outside the content.

## Considered Options

- **`contenteditable` on the rendered Template nodes**: rejected. React re-renders the node on every change (the caret jumps), a page break moves the block to another page (the node remounts and loses focus), each block is rendered twice (measurement and page), several texts on the page have no single field behind them (dates, "company – location", "level, field, institution"), and every Template would need editing code, i.e. a change to the document's rendering.
- **A text field laid exactly over the text on the page**: rejected, because the field wraps lines differently from the Template (fonts, `text-transform`, columns), so the text shifts while typing, and joined texts stay unsolved.
- **Placeholder blocks for empty fields in Edit mode**: rejected, because they change block heights and the page split, so Edit mode would show different pages than the PDF, and every Template would have to draw them.
- **Dragging parts of the CV across pages**: deferred. Entries are split into several blocks that can sit on different pages at any zoom; moving by one position from a menu or shortcut, and dragging in the Outline and inside cards, cover the need for now.

## Consequences

- A new Template gets on-page editing for free if it keeps the class contract; a missing class only costs convenience (the card focuses its first field), never content. The contract is a step of the new-Template checklist in `domain/schema.ts` and is checked by an e2e test.
- The pages stay hidden from screen readers; the layer exposes one labelled button per part of the CV, and the CV form stays as the complete linear way to edit.
- Revisit in-place text editing for fields shown 1:1 on the page (name, section title, bullet) only if the cards prove too indirect in user testing; it would need the pages to keep a block mounted across page breaks.
