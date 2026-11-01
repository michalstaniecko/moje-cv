# CV Press

Desktop app for creating, editing and exporting CVs to PDF.

## Language

**Interface language**:
The language of the app itself: menus, buttons, dialogs and messages. An app-wide preference, independent of the language any CV is written in.
_Avoid_: App language, locale (when meaning the CV)

**CV language**:
The language a single CV is written in, governing the fixed text that ends up on the document (e.g. "present" for an ongoing date range). A property of each CV, separate from the Interface language.
_Avoid_: Document locale, PDF language

**Default content**:
The pre-filled values a newly created CV starts with (section titles, contact labels, CV name). Written in the Interface language at the moment of creation; once created, it is ordinary editable CV content.
_Avoid_: Template text, placeholders

**Template**:
One of the predefined visual designs a CV document is rendered with: page arrangement, typography and decoration. Built into the app and chosen per CV; the user cannot edit templates. Concerns only the look, never the CV's content: switching templates loses nothing.
_Avoid_: Theme, layout, skin, style (as names for the whole design)

**Tag**:
A short, user-chosen label attached to a CV to organise the CV library (e.g. "frontend", "EN", "Allegro"). Private metadata: never shown on the CV document itself. A tag exists only as long as at least one CV carries it. Independent of the CV language, even when it names a language.
_Avoid_: Label (as a separate concept), keyword, skill, category

**Appearance**:
The light or dark look of the app's own interface (panels, forms, toolbars), chosen app-wide as Light, Dark or System, where System follows the operating system. Concerns only the interface: CV pages, template thumbnails and the exported PDF always keep their own look.
_Avoid_: Theme, dark mode (as the name of the setting), skin, color scheme (as the name of the setting)
