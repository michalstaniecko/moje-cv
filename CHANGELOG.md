# Changelog

## [Unreleased]

### Added
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

### Fixed
- Closing the window or quitting right after an edit waits for the save, and asks before discarding changes that couldn’t be saved.
- Keyboard focus returns to the button that opened a form in a CV library row (rename, tags, delete) when the form closes; after deleting a CV it moves to the neighbouring CV, or to "New CV" when the library is empty.
- The English Sample CV printed the Polish word "obecnie" instead of "present".
- Characters missing from Lato (e.g. Cyrillic) fall back to the bundled Source Sans 3 instead of a system font.

### Changed
- The app is now called "CV Press" (previously "Moje CV"). Existing CVs and settings stay where they were.
- A CV file saved by a newer version of the app is marked "Needs a newer version of CV Press" instead of "Damaged file". It is never overwritten; it can still be deleted, with a confirmation saying what will be lost.
- The app never opens new windows or navigates away from its own screens.
- A failed autosave shows an alert with Try again; leaving the editor with unsaved changes asks first instead of doing nothing.

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
