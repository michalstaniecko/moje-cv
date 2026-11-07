import { CV_SCHEMA_VERSION, cvDocumentSchema, type CvDocument } from './schema'

type JsonObject = Record<string, unknown>

// Migracja z wersji n (klucz) do n+1: dostaje dokument w wersji n, zwraca go w wersji n+1 (bez `schemaVersion` – ustawia ją migrateCv).
export type CvMigration = (document: JsonObject) => JsonObject
export type CvMigrations = Record<number, CvMigration>

// Migracje schematu CV. Zmiana schematu = podbicie CV_SCHEMA_VERSION i migracja ze starej wersji.
export const cvMigrations: CvMigrations = {
  // 1 → 2: CV dostaje listę tagów – istniejące CV startują bez tagów.
  1: (document) => ({ ...document, tags: [] }),
  // 2 → 3: CV zapamiętuje swój szablon – istniejące CV dostają „Klasyczny”, czyli wygląd sprzed szablonów.
  2: (document) => ({ ...document, settings: { ...(document.settings as object), template: 'classic' } }),
  // 3 → 4: nowy szablon „Nowoczesny” – treść bez zmian; starsza wersja aplikacji zgłosi „plik z nowszej wersji” (ADR 0002).
  3: (document) => document,
  // 4 → 5: nowy szablon „Wyrazisty” – treść bez zmian; starsza wersja aplikacji zgłosi „plik z nowszej wersji” (ADR 0002).
  4: (document) => document,
  // 5 → 6: CV dostaje CV language – istniejące i importowane stare CV są po polsku, więc drukują to samo co dotąd
  // („obecnie”). Migracje działają przy każdym odczycie, więc nie zależą od języka interfejsu.
  5: (document) => ({ ...document, settings: { ...(document.settings as object), language: 'pl' } })
}

// Dokument z nowszej wersji aplikacji – tej wersji nie da się go odczytać.
export class NewerSchemaVersionError extends Error {}

// Odczytuje dokument CV zapisany w dowolnej obsługiwanej wersji schematu, migrując go krok po kroku do bieżącej.
// Brak migracji dla wersji pliku, błąd migracji lub niezgodność ze schematem kończy się wyjątkiem.
export function migrateCv(input: unknown, migrations: CvMigrations): CvDocument {
  let document = input
  while (isObject(document) && typeof document.schemaVersion === 'number' && document.schemaVersion !== CV_SCHEMA_VERSION) {
    const { schemaVersion } = document
    if (schemaVersion > CV_SCHEMA_VERSION) throw new NewerSchemaVersionError(`Unsupported CV schema version: ${schemaVersion}`)
    const migrate = migrations[schemaVersion]
    if (!migrate) throw new Error(`No migration from CV schema version ${schemaVersion}`)
    document = { ...migrate(document), schemaVersion: schemaVersion + 1 }
  }
  return cvDocumentSchema.parse(document)
}

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)
