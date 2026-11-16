# Changelog

## [1.0.0] – Unreleased

### Added
- Export to DOCX: an "Export to DOCX" button next to "Export to PDF" in the CV editor and File → Export to DOCX… save an editable copy of the CV for Word, Pages, LibreOffice or Google Docs. The file uses one simplified layout for every Template (heading styles, real bulleted lists, dates on a right tab stop) with the CV's accent colour, font and CV language; the PDF stays the exact image of the preview. The photo (JPEG or PNG) sits next to the name, and with Lato the characters it lacks (Cyrillic, some Vietnamese letters) are written in Source Sans 3, as in the preview. The CV's font is embedded in the file, so Word on Windows shows it without installing anything; the fonts ship with the app as unmodified files from their authors, with their SIL Open Font License (`Contents/Resources/fonts`).
- The separator between the form and the preview in the CV editor can be dragged to make the form wider or narrower (at least 360 px each for the form and the preview). It also works from the keyboard (←/→, with Shift in bigger steps, Home/End), and a double click restores the default width. The width is one setting for the whole app and is kept after a restart.
- Long text fields in the CV editor grow with their content as you type, so the whole text is always visible without a resize handle. Rows in lists (sections, positions, education, bullets, list items) have one handle instead of three small buttons: drag it to change the order, or click it (or press Enter or Space) for a menu with Move up and Move down; for bullets and list items the menu also has Remove (contacts keep their ✕). ⌥⇧↑ and ⌥⇧↓ move a bullet or list item from its field, and any row from its handle, without opening the menu.
- Bullets and list items can be added and removed from the keyboard: Enter splits the bullet or list item at the cursor into two, Shift+Enter starts a new line within a bullet, and Backspace in an empty bullet or list item removes it.
- Edit the CV right on its pages (WYSIWYG): in Edit mode every text of the CV – the name, contacts, summary, section titles, positions, companies, cities, education, bullets, list items and the consent clause – is typed straight into the page, where a click puts the caret; the text wraps exactly as in the PDF, every change shows on the page at once and is saved automatically, and Cmd+Z undoes it in the same steps as in the form. Only plain text goes in: pasted text loses its formatting, and several pasted lines become several bullets or list items. Enter in a bullet or list item starts a new one, Backspace at its start joins it with the one before and Delete at its end joins the next one; Enter in a contact's value adds a contact, the arrow keys and Tab go from field to field across pages, and Escape leaves the field for the pages. Values that are not typed open a small popover next to them: dates (a month field, "I currently work here", "Clear", a warning when the end is before the start), the photo (change, crop, remove), suggested contact labels, and for the consent clause a bar to pick a clause from the library, restore it, save it as a new clause or hide it. Empty fields show grey hints only in the part being edited and disappear with it, so when nothing is being edited the pages look and split into pages exactly as in the PDF. The page count and the warnings in the preview bar and before export always describe the pages as they will be in the PDF, even while those hints push text further down. Under each section a "+" button adds a position, education entry or item, and an "Add to CV" bar under the last page offers what the CV doesn't have yet – each puts the caret in the new, empty place on the page. A handle next to each part opens a menu with Move up, Move down (also ⌥⇧↑/⌥⇧↓ from a field), New page before, for sections Hide section and Add, for positions and education Remove, and for the contacts Add contact; Shift+F10 in a field opens it. Contacts can be reordered on the pages too: ⌥⇧↑ and ⌥⇧↓ in a contact's label or value move it up or down. In Edit mode screen readers read the pages as the CV with named text fields, and changes made from the keyboard are announced. The PDF, the DOCX and the pages in Preview mode look exactly the same as before.
- An Edit | Preview switch in the toolbar and View → Preview (⇧⌘P): Preview mode hides the sidebar and all editing controls, so the pages look exactly like the PDF. Every opened CV starts in Edit mode.
- Undo and Redo buttons in the toolbar, in Edit mode and in Preview mode: they undo and redo the same steps as ⌘Z / ⇧⌘Z and Edit → Undo / Redo, show those shortcuts in their tooltips, and are greyed out when there is nothing to undo or redo.
- The Inspector, a column to the right of the pages in both Edit mode and Preview mode, scrolling on its own: its "Document" panel has the CV design in groups that collapse and stay collapsed until the app quits – Template (Template thumbnails), Style (eight accent colour swatches, a custom colour and font cards written in their own typeface) and Language (the CV language, with a note that it doesn't translate your content). Every change shows on the pages at once, is saved automatically and is one undo step; dragging in the custom colour is one step too. It replaces the "CV design" button in the toolbar.
- "CV elements" in the Inspector's "Document" panel: one list of the header, the photo, every section in CV order (also the hidden and empty ones, marked "hidden" or "empty", with the number of entries) and the consent clause. The photo, every section and the clause have the same "Show on CV" switch, which also works in Preview mode; each change is one undo step. Drag a section's handle to reorder, or open its menu (also with Shift+F10) for Move up, Move down and New page before. In Edit mode a click on a name puts the caret in that part of the CV on the pages. The full form is still one click away ("Form" on the thin rail to the left of the pages), and the choice is kept after a restart.
- The Inspector follows what you work on: a click (or the focus) in a part of the CV on the pages, or a click on its row in "CV elements" – also for a hidden or empty section – shows that part's panel under "‹ Document / name". A section's panel renames it, shows or hides it, starts it on a new page and moves it up or down ("2 of 5"), and lists the titles of its entries; a click on one puts the caret in it on the page. Each change is one undo step. A click on the page background or on "‹ Document", or an undo that takes the part away, returns to the "Document" panel; Preview mode always shows the "Document" panel.
- The photo can be hidden without deleting it: "Hide photo" in the photo popover on the page, or the "Show on CV" switch in the Photo row of "CV elements", takes it off the pages, the PDF and the DOCX, and the same switch brings back the same image. Each change is one undo step. Without a photo, the Photo row picks one, like "Add to CV". CVs saved with an older version open with their photo shown.
- Contacts can be removed on the pages: the menu of the contacts handle lists "Remove contact: …" for each contact, named by its label (or its value, or its number), and says "Removed." with Undo. The caret then goes to the next contact, or the previous one. Each removal is one undo step.
- Bullets, list items and contacts can be reordered on the pages without knowing the shortcut: a right-click in one (or Shift+F10) opens a menu with "Move … up" and "Move … down", showing ⌥⇧↑/⌥⇧↓ next to them and greyed out at the top or bottom of the list. The caret stays where it was, and each move is one undo step. Below them are the items of the position's or the contacts' handle menu. A right-click in other fields with a handle opens its menu, like Shift+F10.

### Changed
- First release in the Mac App Store, alongside the `.dmg` on GitHub Releases. Both versions are free and share the same CV library on your Mac.
- The `.dmg` is signed with an Apple Developer ID certificate and notarized by Apple, so macOS opens CV Drawer without the "Open Anyway" procedure in System Settings.
- CV Drawer runs in the macOS App Sandbox. CVs and settings are stored in the app's container (`~/Library/Containers/com.michalstaniecko.cvdrawer`), which the Mac App Store and `.dmg` versions share.
- Template thumbnails in the CV editor always show the Sample CV in the CV language, in the CV's accent colour and font, so they show how the Templates differ even for a new, empty CV.
- In Preview mode parts too long for one page are no longer outlined on the pages; the preview bar warns about them, and "Show" switches to Edit mode, where they are outlined as before. "Removed. Undo" now appears in the bottom left corner of the pages, for the form and the pages alike.

### Fixed
- The CV editor screen no longer scrolls as a whole: only the form and the preview scroll, and the toolbar stays in place above them.

## [0.6.0] – 2026-11-08

### Changed
- The app is now called "CV Drawer" (previously "CV Press"), in every interface language. Existing CVs and settings stay where they were; an older "CV Press" or "Moje CV" in Applications can be deleted.

### Fixed
- In German, Italian, Romanian and Russian the "New page before this section" checkbox moves to its own line when it doesn’t fit next to "Hide section", instead of making the CV editor form wider than its column.

## [0.5.0] – 2026-11-08

### Added
- App icon: CV Press has its own icon in the Dock, Finder, Launchpad, the app switcher (⌘Tab), the "About CV Press" panel and on the `.dmg`, instead of the Electron icon.

## [0.4.0] – 2026-11-07

### Added
- The `.dmg` version checks GitHub once a day for a newer release and shows a notice in the CV library; Help → Check for Updates… checks right away. The Mac App Store version makes no network requests.
- Help menu: CV Press Help, Privacy Policy and Report a Problem… open the help page, the privacy policy and a new issue in the public repository in the browser; Support CV Press… opens GitHub Sponsors (not in the Mac App Store build).
- File menu: New CV (⌘N), Add Sample CV, Import… (⌘O), Export JSON…, Export to PDF… (⌘E) and Close Window (⌘W). Exporting is available in the CV editor; in the consent clause library creating and importing are greyed out.
- View menu with Toggle Full Screen, Services in the CV Press menu, and Bring All to Front in the Window menu, which now lists the open windows.
- The app version is shown in the "About CV Press" panel (with copyright), at the bottom of the CV library and in the Sponsor bar's "More" dialog.
- An empty CV library offers "Add sample CV" next to the hint about "New CV".
- The CV library says "Loading…" while the list is loading, instead of showing an empty screen.
- 14 new interface languages: Spanish, French, German, Portuguese (Brazil), Italian, Dutch, Russian, Ukrainian, Turkish, Indonesian, Vietnamese, Czech, Romanian and Swedish, each with its own localized Sample CV. The Language menu is labelled in the current language and in English (e.g. "Sprache / Language").
- Sponsor bar at the bottom of the window: the app is free, with a "Buy me a coffee" link to GitHub Sponsors and a "More" dialog. Hidden in the Mac App Store build.
- "Add sample CV" in the menu under the arrow next to "New CV": adds the Sample CV again, in the interface language.
- CV language in each CV's settings: sets the fixed text on the document ("present") and the page language. New CVs start in the interface language; existing CVs are Polish.
- A translated "Something went wrong" screen with Reload instead of a blank window; a crashed window reloads itself, and repeated crashes ask before reloading again.
- The window remembers its size, position and maximized state, and opens on a visible screen.
- A warning before exporting a CV whose content doesn’t fit on a page; a progress indicator while the PDF is prepared; a separate message when preparing the PDF takes too long.
- The CV name can be changed right in the editor header (click the name; Enter or clicking elsewhere keeps it, Escape cancels, ⌘Z undoes it).
- A warning under the dates when a position or education ends before it starts; it never blocks saving or exporting.
- "Removed. Undo" after removing a position, education entry, bullet, list item, contact or photo; it goes away by itself after a few seconds.

### Accessibility
- Reordering with the keyboard tells screen readers what was picked up, its position while moving ("position 3 of 5"), where it was dropped or that it was put back, plus how to drag with the keyboard, all in the interface language and with the item's name instead of an internal id.
- The preview pages in the CV editor are hidden from screen readers, so the CV is no longer read twice; the page count, the length warning and the zoom buttons stay accessible.
- Escape closes the consent clause form without saving, and the focus returns to "Add clause" or the clause's "Edit".
- The photo crop frame can be focused and moved with the arrow keys (Shift for bigger steps); the hint says so.
- The "longer than 2 pages" warning in the preview has the warning colour and a ⚠ icon in both appearances.
- The Sponsor bar is announced to screen readers as "Support CV Press" instead of "Sponsor".

### Fixed
- In the dark appearance the CV library has a dark background instead of a white one.
- File → Export JSON… in the editor no longer exports the previous version of the CV when the latest changes couldn’t be saved; it says the export failed instead.
- Closing the window or quitting right after an edit waits for the save, and asks before discarding changes that couldn’t be saved.
- Keyboard focus returns to the button that opened a form in a CV library row (rename, tags, delete) when the form closes; after deleting a CV it moves to the neighbouring CV, or to "New CV" when the library is empty.
- The English Sample CV printed the Polish word "obecnie" instead of "present".
- Characters missing from Lato (e.g. Cyrillic) fall back to the bundled Source Sans 3 instead of a system font.

### Changed
- The app is now called "CV Press" (previously "Moje CV"). Existing CVs and settings stay where they were.
- A CV file saved by a newer version of the app is marked "Needs a newer version of CV Press" instead of "Damaged file". It is never overwritten; it can still be deleted, with a confirmation saying what will be lost.
- The app never opens new windows or navigates away from its own screens.
- The window has a minimum size; opening the app again brings the running window to the front instead of starting a second copy.
- A failed autosave shows an alert with Try again; leaving the editor with unsaved changes asks first instead of doing nothing.
- PDF file names transliterate Cyrillic and other non-Latin letters (e.g. CV_Olena_Zrazkova.pdf) and fall back to the CV name; the export notice can be dismissed.
- In the CV editor the "Appearance" section is now "CV design", the back button reads "← CV library" (also in the consent clause library), and the "present" checkbox reads "I currently work here" (the document still says "present").

## [0.3.0] – 2026-10-27

### Added
- CV template choice: "Classic" and "Modern".

## [0.2.0] – 2026-10-26

### Added
- CV tags: tagging from the CV list, suggestions of existing tags.
- Filtering the CV list by tags.
- Tags kept on duplicate, export and import.

## [0.1.0] – 2026-10-21

### Added
- CV preview on A4 pages with page counter, length warnings and zoom.
- PDF export.
- CV library with persistent storage.
- Editing of header, experience, education and lists; section and entry ordering.
- Autosave and Undo/Redo.
- Accent colour and font choice.
- Consent clause library with per-CV clause choice.
- Header photo with 3:4 crop.
- JSON export/import of CVs.
- Interface language (Polish/English).
- macOS .dmg installer.
