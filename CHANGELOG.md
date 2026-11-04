# Changelog

## [Unreleased]

### Added
- 14 new interface languages: Spanish, French, German, Portuguese (Brazil), Italian, Dutch, Russian, Ukrainian, Turkish, Indonesian, Vietnamese, Czech, Romanian and Swedish, each with its own localized Sample CV. The Language menu is labelled in the current language and in English (e.g. "Sprache / Language").
- Sponsor bar at the bottom of the window: the app is free, with a "Buy me a coffee" link to GitHub Sponsors and a "More" dialog. Hidden in the Mac App Store build.
- "Add sample CV" in the menu under the arrow next to "New CV": adds the Sample CV again, in the interface language.
- CV language in each CV's settings: sets the fixed text on the document ("present") and the page language. New CVs start in the interface language; existing CVs are Polish.

### Fixed
- The English Sample CV printed the Polish word "obecnie" instead of "present".
- Characters missing from Lato (e.g. Cyrillic) fall back to the bundled Source Sans 3 instead of a system font.

### Changed
- The app is now called "CV Press" (previously "Moje CV"). Existing CVs and settings stay where they were.

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
