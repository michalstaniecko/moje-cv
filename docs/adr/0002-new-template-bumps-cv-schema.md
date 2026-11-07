# Every new Template bumps the CV schema version

A CV stores which Template it is rendered with, and CV files are read strictly (validated against the current schema), so an older app version would reject a file naming a Template it doesn't know as a generic "invalid file". We decided that adding a Template bumps `CV_SCHEMA_VERSION` (with a no-op migration step), so an older app reports "file from a newer version" instead. We rejected silently falling back to the default Template for unknown values: the user would see their CV in a different design without knowing why, and it would make the template field the one lenient spot in an otherwise strict schema.

## Addendum: the same holds for every new CV language

A CV also stores its CV language, validated by the same strict schema against the list of Interface languages (CV language and Interface language are one list). Adding a language therefore makes files in that language invalid for an older app, exactly like a new Template. So adding a CV/Interface language bumps `CV_SCHEMA_VERSION` too, with a no-op migration step, so an older app reports "file from a newer version". The checklist for a new language lives in `src/shared/i18n/languages.ts`.
