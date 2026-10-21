import { CV_SCHEMA_VERSION, cvDocumentSchema, type CvDocument } from './schema'

type JsonObject = Record<string, unknown>

// Migracja z wersji n (klucz) do n+1: dostaje dokument w wersji n, zwraca go w wersji n+1 (bez `schemaVersion` – ustawia ją migrateCv).
export type CvMigration = (document: JsonObject) => JsonObject
export type CvMigrations = Record<number, CvMigration>

// Migracje schematu CV. Zmiana schematu = podbicie CV_SCHEMA_VERSION i migracja ze starej wersji.
export const cvMigrations: CvMigrations = {}

// Dokument z nowszej wersji aplikacji – tej wersji nie da się go odczytać.
export class NewerSchemaVersionError extends Error {}

// Odczytuje dokument CV zapisany w dowolnej obsługiwanej wersji schematu, migrując go krok po kroku do bieżącej.
// Brak migracji dla wersji pliku, błąd migracji lub niezgodność ze schematem kończy się wyjątkiem.
export function migrateCv(input: unknown, migrations: CvMigrations): CvDocument {
  let document = input
  while (isObject(document) && typeof document.schemaVersion === 'number' && document.schemaVersion !== CV_SCHEMA_VERSION) {
    const { schemaVersion } = document
    if (schemaVersion > CV_SCHEMA_VERSION) throw new NewerSchemaVersionError(`Nieobsługiwana wersja schematu CV: ${schemaVersion}`)
    const migrate = migrations[schemaVersion]
    if (!migrate) throw new Error(`Brak migracji ze schematu CV w wersji ${schemaVersion}`)
    document = { ...migrate(document), schemaVersion: schemaVersion + 1 }
  }
  return cvDocumentSchema.parse(document)
}

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)
