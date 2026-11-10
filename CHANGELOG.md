# Changelog

## [Unreleased]

### Added
- Export to DOCX: an "Export to DOCX" button next to "Export to PDF" in the CV editor and File → Export to DOCX… save an editable copy of the CV for Word, Pages, LibreOffice or Google Docs. The file uses one simplified layout for every Template (heading styles, real bulleted lists, dates on a right tab stop) with the CV's accent colour, font and CV language; the PDF stays the exact image of the preview. The photo (JPEG or PNG) sits next to the name, and with Lato the characters it lacks (Cyrillic, some Vietnamese letters) are written in Source Sans 3, as in the preview. The CV's font is embedded in the file, so Word on Windows shows it without installing anything; the fonts ship with the app as unmodified files from their authors, with their SIL Open Font License (`Contents/Resources/fonts`).

### Changed
- The `.dmg` is signed with an Apple Developer ID certificate and notarized by Apple, so macOS opens CV Drawer without the "Open Anyway" procedure in System Settings.
- CV Drawer runs in the macOS App Sandbox. CVs and settings move on first launch from `~/Library/Application Support/Moje CV` into the app's container (`~/Library/Containers/com.michalstaniecko.mojecv`), which the Mac App Store and `.dmg` versions share. The older version no longer sees them afterwards; JSON export and import remain the fallback.

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
