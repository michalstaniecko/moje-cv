import { randomUUID } from 'node:crypto'
import { readdir, readFile, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { exists, writeJsonAtomic } from './atomicFile'
import { emptyCv } from '../renderer/src/domain/emptyCv'
import { cvMigrations, migrateCv, NewerSchemaVersionError, type CvMigrations } from '../renderer/src/domain/migrations'
import type { Clause, CvDocument } from '../renderer/src/domain/schema'
import type { CvListEntry, InvalidCvFileReason } from '../shared/api'
import type { DefaultContent } from '../shared/i18n/en'

export type CvRepository = ReturnType<typeof createCvRepository>

// Importowany plik nie jest poprawnym CV. Użytkownik dostaje powód (`reason`), a nie treść komunikatu.
export class InvalidCvFileError extends Error {
  constructor(readonly reason: InvalidCvFileReason) {
    super(`Niepoprawny plik CV: ${reason}`)
  }
}

type Options = { now?: () => Date; migrations?: CvMigrations }

// Repozytorium CV: jedno CV na plik `<id>.json` w podanym katalogu.
export function createCvRepository(dir: string, { now = () => new Date(), migrations = cvMigrations }: Options = {}) {
  // id przychodzi przez IPC – musi być zwykłą nazwą pliku w katalogu CV.
  const filePath = (id: string) => {
    if (!id || basename(id) !== id || id.startsWith('.')) throw new Error(`Niepoprawny identyfikator CV: ${id}`)
    return join(dir, `${id}.json`)
  }

  // Plik ze starszą wersją schematu jest migrowany do bieżącej (na dysk trafia przy najbliższym zapisie).
  // Niepoprawny JSON, nieudana migracja lub niezgodność ze schematem kończy się wyjątkiem – plik jest uszkodzony.
  async function get(id: string): Promise<CvDocument> {
    return migrateCv(JSON.parse(await readFile(filePath(id), 'utf8')), migrations)
  }

  async function listEntry(id: string): Promise<CvListEntry> {
    try {
      const { name, updatedAt } = await get(id)
      return { status: 'ok', id, name, updatedAt }
    } catch {
      return { status: 'damaged', id }
    }
  }

  // Zapis atomowy (patrz writeJsonAtomic). Uszkodzonego pliku nie nadpisujemy – może dać się go jeszcze odzyskać ręcznie.
  async function save(document: CvDocument): Promise<void> {
    const targetPath = filePath(document.id)
    if ((await exists(targetPath)) && (await listEntry(document.id)).status === 'damaged') {
      throw new Error(`Plik CV jest uszkodzony i nie zostanie nadpisany: ${document.id}`)
    }
    await writeJsonAtomic(targetPath, document)
  }

  // Zapisuje dokument jako nowe CV: nowe id i daty utworzenia/zmiany.
  async function saveAsNew(document: CvDocument): Promise<CvDocument> {
    const timestamp = now().toISOString()
    const created = { ...document, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp }
    await save(created)
    return created
  }

  return {
    // Najpierw CV od ostatnio zmienionego, uszkodzone pliki na końcu.
    async list(): Promise<CvListEntry[]> {
      if (!(await exists(dir))) return []
      const fileNames = await readdir(dir)
      const entries = await Promise.all(
        fileNames
          .filter((fileName) => fileName.endsWith('.json') && !fileName.startsWith('.'))
          .map((fileName) => listEntry(fileName.slice(0, -'.json'.length)))
      )
      return entries.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    },

    get,

    save,

    // Pierwsze uruchomienie = katalog CV jeszcze nie istnieje. Pusty katalog (wszystko usunięte) zostaje pusty.
    async addSampleOnFirstRun(sample: CvDocument): Promise<void> {
      if (!(await exists(dir))) await saveAsNew(sample)
    },

    // Nowe CV z treścią domyślną (`content`) języka interfejsu i domyślną klauzulą z biblioteki (włączoną), o ile jest.
    create: (content: DefaultContent, defaultClause: Clause | null = null) =>
      saveAsNew(emptyCv({ content, now: now(), newId: randomUUID, defaultClause })),

    // Dopisek przy nazwie kopii pochodzi z treści domyślnej języka interfejsu.
    async duplicate(id: string, content: DefaultContent): Promise<CvDocument> {
      const original = await get(id)
      return saveAsNew({ ...original, name: content.copyName(original.name) })
    },

    async rename(id: string, name: string): Promise<CvDocument> {
      if (!name.trim()) throw new Error('Nazwa CV nie może być pusta')
      const renamed = { ...(await get(id)), name: name.trim(), updatedAt: now().toISOString() }
      await save(renamed)
      return renamed
    },

    // Zapis zmian z edytora (autozapis). Spóźniony zapis nie przywraca usuniętego CV.
    async update(document: CvDocument): Promise<void> {
      if (!(await exists(filePath(document.id)))) throw new Error(`CV nie istnieje: ${document.id}`)
      await save({ ...document, updatedAt: now().toISOString() })
    },

    // Eksport do pliku: cały dokument (ze zdjęciem) w bieżącej wersji schematu, z nazwą CV do podpowiedzi nazwy pliku.
    async exportJson(id: string): Promise<{ name: string; content: string }> {
      const document = await get(id)
      return { name: document.name, content: JSON.stringify(document, null, 2) }
    },

    // Import z pliku zawsze tworzy nowe CV – nigdy nie nadpisuje istniejącego.
    importJson: async (content: string) => saveAsNew(parseImported(content, migrations)),

    async delete(id: string): Promise<void> {
      await rm(filePath(id))
    }
  }
}

const sortKey = (entry: CvListEntry) => (entry.status === 'ok' ? entry.updatedAt : '')

// Treść importowanego pliku → CV w bieżącej wersji schematu albo InvalidCvFileError z powodem odrzucenia.
function parseImported(content: string, migrations: CvMigrations): CvDocument {
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new InvalidCvFileError('not-json')
  }
  try {
    return migrateCv(json, migrations)
  } catch (error) {
    if (error instanceof NewerSchemaVersionError) {
      throw new InvalidCvFileError('newer-version')
    }
    throw new InvalidCvFileError('not-a-cv')
  }
}
