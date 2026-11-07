import { randomUUID } from 'node:crypto'
import { readdir, readFile, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { exists, writeJsonAtomic } from './atomicFile'
import { emptyCv } from '../renderer/src/domain/emptyCv'
import { cvMigrations, migrateCv, NewerSchemaVersionError, type CvMigrations } from '../renderer/src/domain/migrations'
import type { Clause, CvDocument, CvLanguage } from '../renderer/src/domain/schema'
import { InvalidTagError, normalizeTags, tagKey } from '../renderer/src/domain/tags'
import type { CvListEntry, InvalidCvFileReason } from '../shared/api'
import { dictionaryFor, type InterfaceLanguage } from '../shared/i18n/languages'

export type CvRepository = ReturnType<typeof createCvRepository>

// Importowany plik nie jest poprawnym CV. Użytkownik dostaje powód (`reason`), a nie treść komunikatu.
export class InvalidCvFileError extends Error {
  constructor(readonly reason: InvalidCvFileReason) {
    super(`Invalid CV file: ${reason}`)
  }
}

type Options = { now?: () => Date; migrations?: CvMigrations }

// Repozytorium CV: jedno CV na plik `<id>.json` w podanym katalogu.
export function createCvRepository(dir: string, { now = () => new Date(), migrations = cvMigrations }: Options = {}) {
  // id przychodzi przez IPC – musi być zwykłą nazwą pliku w katalogu CV.
  const filePath = (id: string) => {
    if (!id || basename(id) !== id || id.startsWith('.')) throw new Error(`Invalid CV id: ${id}`)
    return join(dir, `${id}.json`)
  }

  // Odczyt-zmiana-zapis jednego CV (autozapis, tagi, zmiana nazwy, usunięcie) idzie po kolei, żeby żadna operacja
  // nie nadpisała zmiany innej, która przeczytała plik wcześniej, a zapisała później.
  const perCv = createKeyedQueue()
  // Ustalanie pisowni tagów (ustawianie tagów, import) idzie po kolei w całej bibliotece – inaczej dwa CV oznaczone
  // naraz mogłyby dostać pisownie tego samego tagu różniące się wielkością liter.
  const tagSpelling = createKeyedQueue()
  const LIBRARY = 'library'

  // Plik ze starszą wersją schematu jest migrowany do bieżącej (na dysk trafia przy najbliższym zapisie).
  // Niepoprawny JSON, nieudana migracja lub niezgodność ze schematem kończy się wyjątkiem – plik jest uszkodzony.
  async function get(id: string): Promise<CvDocument> {
    return migrateCv(JSON.parse(await readFile(filePath(id), 'utf8')), migrations)
  }

  async function listEntry(id: string): Promise<CvListEntry> {
    try {
      const { name, updatedAt, tags } = await get(id)
      return { status: 'ok', id, name, updatedAt, tags }
    } catch (error) {
      return { status: 'damaged', id, reason: error instanceof NewerSchemaVersionError ? 'newer-version' : 'damaged' }
    }
  }

  // Tagi do zapisania w CV: znormalizowane (normalizeTags), a tag równy bez względu na wielkość liter tagowi innego CV
  // w bibliotece przejmuje tamtą pisownię. `exceptId` – CV, którego własna pisownia nie jest przejmowana.
  // Wywoływać tylko wewnątrz kolejki `tagSpelling`.
  async function normalizeToLibrarySpelling(tags: string[], exceptId?: string): Promise<string[]> {
    const normalized = normalizeTags(tags)
    const spellings = await existingSpellings(exceptId)
    return normalized.map((tag) => spellings.get(tagKey(tag)) ?? tag)
  }

  // Pisownia tagów pozostałych (nieuszkodzonych) CV w bibliotece, według tagu bez względu na wielkość liter.
  // Brak osobnego rejestru – istniejące tagi to suma tagów CV (zob. GLOSSARY.md).
  async function existingSpellings(exceptId?: string): Promise<Map<string, string>> {
    const spellings = new Map<string, string>()
    for (const entry of await listEntries()) {
      if (entry.status !== 'ok' || entry.id === exceptId) continue
      for (const tag of entry.tags) if (!spellings.has(tagKey(tag))) spellings.set(tagKey(tag), tag)
    }
    return spellings
  }

  async function listEntries(): Promise<CvListEntry[]> {
    if (!(await exists(dir))) return []
    const fileNames = await readdir(dir)
    return Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith('.json') && !fileName.startsWith('.'))
        .map((fileName) => listEntry(fileName.slice(0, -'.json'.length)))
    )
  }

  // Zapis atomowy (patrz writeJsonAtomic). Nieczytelnego pliku nie nadpisujemy: uszkodzony może dać się jeszcze
  // odzyskać ręcznie, a plik z nowszej wersji aplikacji straciłby dane, których ta wersja nie zna.
  async function save(document: CvDocument): Promise<void> {
    const targetPath = filePath(document.id)
    if ((await exists(targetPath)) && (await listEntry(document.id)).status !== 'ok') {
      throw new Error(`The CV file can’t be read, so it will not be overwritten: ${document.id}`)
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
    // Najpierw CV od ostatnio zmienionego, nieczytelne pliki (uszkodzone i z nowszej wersji) na końcu.
    async list(): Promise<CvListEntry[]> {
      return (await listEntries()).sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    },

    get,

    save,

    // Pierwsze uruchomienie = katalog CV jeszcze nie istnieje. Pusty katalog (wszystko usunięte) zostaje pusty.
    async addSampleOnFirstRun(sample: CvDocument): Promise<void> {
      if (!(await exists(dir))) await saveAsNew(sample)
    },

    // Sample CV na żądanie: zawsze nowe CV z treścią przekazanego dokumentu (bez wykrywania duplikatów).
    addSample: (sample: CvDocument): Promise<CvDocument> => saveAsNew(sample),

    // Nowe CV w bieżącym języku interfejsu (`language`): to jego CV language i treść domyślna.
    // Domyślna klauzula z biblioteki jest włączona, o ile jest.
    create: (language: CvLanguage, defaultClause: Clause | null = null) =>
      saveAsNew(emptyCv({ language, now: now(), newId: randomUUID, defaultClause })),

    // Dopisek przy nazwie kopii pochodzi z treści domyślnej bieżącego języka interfejsu (`language`);
    // kopia zachowuje CV language oryginału.
    async duplicate(id: string, language: InterfaceLanguage): Promise<CvDocument> {
      const original = await get(id)
      return saveAsNew({ ...original, name: dictionaryFor(language).defaultContent.copyName(original.name) })
    },

    rename: (id: string, name: string): Promise<CvDocument> =>
      perCv.run(id, async () => {
        if (!name.trim()) throw new Error('The CV name cannot be empty')
        const renamed = { ...(await get(id)), name: name.trim(), updatedAt: now().toISOString() }
        await save(renamed)
        return renamed
      }),

    // Zastępuje tagi CV (znormalizowanymi). Tag równy bez względu na wielkość liter tagowi innego CV przejmuje tamtą pisownię.
    // Nie zmienia daty ostatniej zmiany – porządkowanie biblioteki nie miesza kolejności listy.
    setTags: (id: string, tags: string[]): Promise<CvDocument> =>
      tagSpelling.run(LIBRARY, () =>
        perCv.run(id, async () => {
          const document = await get(id)
          const tagged = { ...document, tags: await normalizeToLibrarySpelling(tags, id) }
          await save(tagged)
          return tagged
        })
      ),

    // Zapis zmian z edytora (autozapis). Spóźniony zapis nie przywraca usuniętego CV.
    // Tagami zarządza wyłącznie lista CV – zostają te z dysku, więc spóźniony autozapis nie nadpisze świeżo ustawionych.
    update: (document: CvDocument): Promise<void> =>
      perCv.run(document.id, async () => {
        if (!(await exists(filePath(document.id)))) throw new Error(`CV does not exist: ${document.id}`)
        const { tags } = await get(document.id)
        await save({ ...document, tags, updatedAt: now().toISOString() })
      }),

    // Eksport do pliku: cały dokument (ze zdjęciem) w bieżącej wersji schematu, z nazwą CV do podpowiedzi nazwy pliku.
    async exportJson(id: string): Promise<{ name: string; content: string }> {
      const document = await get(id)
      return { name: document.name, content: JSON.stringify(document, null, 2) }
    },

    // Import z pliku zawsze tworzy nowe CV – nigdy nie nadpisuje istniejącego.
    // Tagi z pliku są normalizowane jak przy ustawianiu tagów i przejmują pisownię istniejących tagów biblioteki.
    // Za długi tag odrzuca cały plik.
    async importJson(content: string): Promise<CvDocument> {
      const document = parseImported(content, migrations)
      return tagSpelling.run(LIBRARY, async () => {
        let tags: string[]
        try {
          tags = await normalizeToLibrarySpelling(document.tags)
        } catch (error) {
          if (error instanceof InvalidTagError) throw new InvalidCvFileError('tag-too-long')
          throw error
        }
        return saveAsNew({ ...document, tags })
      })
    },

    delete: (id: string): Promise<void> => perCv.run(id, () => rm(filePath(id)))
  }
}

// Kolejki operacji według klucza: operacja startuje dopiero, gdy skończą się (sukcesem lub błędem) wcześniejsze o tym samym kluczu.
function createKeyedQueue() {
  const tails = new Map<string, Promise<unknown>>()
  return {
    run<T>(key: string, operation: () => Promise<T>): Promise<T> {
      const result = (tails.get(key) ?? Promise.resolve()).then(() => operation())
      const tail = result.catch(() => undefined)
      tails.set(key, tail)
      void tail.then(() => tails.get(key) === tail && tails.delete(key))
      return result
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
