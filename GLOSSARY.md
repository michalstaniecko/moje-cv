# CV Drawer

Desktop app for creating, editing and exporting CVs to PDF.

## Language

**Interface language**:
The language of the app itself: menus, buttons, dialogs and messages. An app-wide preference, independent of the language any CV is written in.
_Avoid_: App language, locale (when meaning the CV)

**CV language**:
The language a single CV is written in, governing the fixed text that ends up on the document (e.g. "present" for an ongoing date range). A property of each CV, separate from the Interface language: a new CV starts in the current Interface language, and the user can change its CV language later. Changing it never rewrites what the CV already contains, such as section titles.
_Avoid_: Document locale, PDF language

**Default content**:
The pre-filled values a newly created CV starts with (section titles, contact labels, CV name). Written in the Interface language at the moment of creation; once created, it is ordinary editable CV content.
_Avoid_: Template text, placeholders

**Sample CV**:
A complete, fictional CV built into the app, added to the CV library on first run and again on demand. Written in the Interface language at the moment it is added; once in the library it is an ordinary editable CV, indistinguishable from any other. Its CV language is the language it is written in. Only some language versions have a built-in consent clause; none takes the library's default clause.
_Avoid_: Example, demo, template (that is the visual design), placeholder

**Template**:
One of the predefined visual designs a CV document is rendered with: page arrangement, typography and decoration. Built into the app and chosen per CV; the user cannot edit templates. Concerns only the look, never the CV's content: switching templates loses nothing.
_Avoid_: Theme, layout, skin, style (as names for the whole design)

**Template thumbnail**:
The reduced first page shown for each Template where the user chooses one. Always shows the Sample CV in the CV language, in the accent colour and font of the CV being edited, so it looks the same whether that CV is empty or full and never shows the CV's own content.
_Avoid_: Theme preview, live preview (that is the full-size view of the CV being edited)

**DOCX export**:
A copy of a single CV saved as a DOCX file for further editing in a word processor (Word, Pages, LibreOffice, Google Docs). It uses one simplified layout shared by every Template and carries over only the content, the accent colour, the font and the CV language, so it never reproduces a Template exactly: the PDF stays the faithful rendering of the CV pages. One-way: the app never reads a DOCX back.
_Avoid_: Word export, editable PDF, DOCX template, conversion

**Tag**:
A short, user-chosen label attached to a CV to organise the CV library (e.g. "frontend", "EN", "Allegro"). Private metadata: never shown on the CV document itself. A tag exists only as long as at least one CV carries it. Independent of the CV language, even when it names a language.
_Avoid_: Label (as a separate concept), keyword, skill, category

**CV design**:
The settings for how the document of a single CV looks (accent colour, font, Template), set together with the CV language in the Inspector's "Document" panel, in both Edit mode and Preview mode (and, until it is removed, in a section of this name in the CV form). A property of each CV; changing it never touches the CV's content.
_Avoid_: Appearance (that is the app's light/dark look), look, style

**Appearance**:
The light or dark look of the app's own interface (panels, forms, toolbars), chosen app-wide as Light, Dark or System, where System follows the operating system. Concerns only the interface: CV pages, template thumbnails and the exported PDF always keep their own look.
_Avoid_: Theme, dark mode (as the name of the setting), skin, color scheme (as the name of the setting); for the settings of a single CV's document, say CV design

**Edit mode**:
The state of the CV editor in which the text on the CV pages is edited in place (Page fields), with Field popovers for values that are not text, editing controls around the content (handles with menus, "+" buttons, the "Add to CV" bar), the Inspector to the right of the pages and, until it is removed, the CV form to their left (collapsed to a rail by default). Everything works from the keyboard: Tab goes through the Page fields, Shift+F10 opens the menu of a field's handle and Escape leaves a field for the pages. Every opened CV starts in it. When no field is being edited its pages look and split exactly like the PDF; only the part of the CV holding the focus may show placeholders for its empty fields.
_Avoid_: Design mode, edit view, inline mode

**Preview mode**:
The state of the CV editor in which the CV pages are shown exactly as they will be exported to PDF, with no editing controls on them; the Inspector stays beside the pages, showing only its "Document" panel, so CV design, export and undo still work. Switched with Edit mode by a toggle in the toolbar or View → Preview.
_Avoid_: Print preview, read-only mode, live preview (that is the pages shown in either mode)

**Edit card**:
Retired (ADR-0010); the app no longer has one. The floating panel with the form fields of one part of a CV page, once opened next to it in Edit mode; replaced by Page fields, Field popovers and the menus of the handles on the pages. Use the term only about that history.
_Avoid_: Popup, modal, inline form, tooltip, inspector (the Inspector is a different, current concept: it never holds CV content fields)

**Inspector**:
The fixed column of CV options to the right of the pages in the CV editor, in both Edit mode and Preview mode, scrolling separately from the pages. With nothing selected it shows the "Document" panel (collapsible groups: Template, Style, "CV elements" – the list that replaced the Outline – and Language); selecting a part of the CV – a click or the focus in it on the pages, or a click on its row in "CV elements", also for a hidden or empty part – shows that part's panel under the path "‹ Document / name" (for a section: its name, "Show on CV", "Start on a new page", its position with ↑/↓ and the titles of its entries, which put the caret in the entry on the page). A click on the page background, "‹ Document" or the selected part disappearing (e.g. after an undo) returns to the "Document" panel; clicks in the Inspector, Field popovers, handle menus, dialogs, the preview bar, the "Add to CV" bar and the "+" buttons keep the selection. Preview mode shows only the "Document" panel. Never edits CV content (the only exception is a section title): text is edited on the pages in Page fields, and every change from the Inspector is an ordinary undoable edit of the CV (ADR-0012).
_Avoid_: Sidebar, settings panel, properties panel, Edit card, CV design popover

**Page field**:
One editable piece of CV text on a page in Edit mode: the text of exactly one field (a name, a company, a bullet, a contact label…), drawn by the Template in its place on the page, so it wraps as in the PDF. Text only, without formatting; separators between fields (" – ", ", ") belong to no Page field.
_Avoid_: Inline input, text box, editable area, contenteditable (as the name of the concept)

**Field popover**:
The small panel opened next to a Page field or another part of a page in Edit mode for a value that is not typed as text: a date with "currently", the photo, the consent clause's library actions, contact label suggestions. Holds the controls of one value, never the fields of a whole part of the CV.
_Avoid_: Edit card, form, dialog (except the modal photo crop), tooltip

**Outline**:
Retired (ADR-0012): the narrow side panel of the CV editor that listed the parts of the CV. Its jobs – jumping to a part of the CV, reordering sections, showing or hiding the photo, sections and the consent clause – belong to the "CV elements" list in the Inspector's "Document" panel: the header, the photo, every section in CV order (also the hidden and empty ones) and the consent clause, never CV content beyond names.
_Avoid_: Navigator, table of contents, sidebar (as the name of the panel)

**CV form**:
The complete form with every field of the CV, one under another, in the sidebar to the left of the editable pages – collapsed to a rail by default. To be removed once the Outline, the pages and the toolbar cover everything it does (ADR-0011).
_Avoid_: Editor (that is the whole screen), sidebar

**Sponsor bar**:
The single-line strip at the bottom of the app window, shown on every screen, telling the user that the app is free and that they may thank the author. It never covers CV pages or forms, cannot be closed and holds only a short message, the Sponsor link and a "more" button opening a longer explanation.
_Avoid_: Banner, ad, toast (toasts are the disappearing status messages), donation bar

**Sponsor link**:
The link that opens the author's GitHub Sponsors page in the system browser: in the Sponsor bar and as "Support CV Drawer…" in the Help menu (outside the Mac App Store, like the bar). A thank-you, never a payment for a feature: the app works identically whether or not it is used.
_Avoid_: Donate button, buy-me-a-coffee (as the name of the concept), payment

**Update notice**:
The dismissible strip in the CV library telling a `.dmg` user that a newer version has been published, with a Download button opening its release page. Informs only: the app never downloads or installs updates itself. Never shown in the Mac App Store build.
_Avoid_: auto-update, update banner, toast
