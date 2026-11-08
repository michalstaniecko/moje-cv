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

**Tag**:
A short, user-chosen label attached to a CV to organise the CV library (e.g. "frontend", "EN", "Allegro"). Private metadata: never shown on the CV document itself. A tag exists only as long as at least one CV carries it. Independent of the CV language, even when it names a language.
_Avoid_: Label (as a separate concept), keyword, skill, category

**CV design**:
The settings for how the document of a single CV looks (accent colour, font, Template), gathered in the CV editor in a section of this name together with the CV language. A property of each CV; changing it never touches the CV's content.
_Avoid_: Appearance (that is the app's light/dark look), look, style

**Appearance**:
The light or dark look of the app's own interface (panels, forms, toolbars), chosen app-wide as Light, Dark or System, where System follows the operating system. Concerns only the interface: CV pages, template thumbnails and the exported PDF always keep their own look.
_Avoid_: Theme, dark mode (as the name of the setting), skin, color scheme (as the name of the setting); for the settings of a single CV's document, say CV design

**Sponsor bar**:
The single-line strip at the bottom of the app window, shown on every screen, telling the user that the app is free and that they may thank the author. It never covers CV pages or forms, cannot be closed and holds only a short message, the Sponsor link and a "more" button opening a longer explanation.
_Avoid_: Banner, ad, toast (toasts are the disappearing status messages), donation bar

**Sponsor link**:
The link that opens the author's GitHub Sponsors page in the system browser: in the Sponsor bar and as "Support CV Drawer…" in the Help menu (outside the Mac App Store, like the bar). A thank-you, never a payment for a feature: the app works identically whether or not it is used.
_Avoid_: Donate button, buy-me-a-coffee (as the name of the concept), payment

**Update notice**:
The dismissible strip in the CV library telling a `.dmg` user that a newer version has been published, with a Download button opening its release page. Informs only: the app never downloads or installs updates itself. Never shown in the Mac App Store build.
_Avoid_: auto-update, update banner, toast
