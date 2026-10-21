import { randomUUID } from 'node:crypto'
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { emptyCv } from '../renderer/src/domain/emptyCv'
import { cvDocumentSchema, type CvDocument } from '../renderer/src/domain/schema'
import type { CvListEntry } from '../shared/api'

export type CvRepository = ReturnType<typeof createCvRepository>

type Options = { now?: () => Date }

// Repozytorium CV: jedno CV na plik `<id>.json` w podanym katalogu.
export function createCvRepository(dir: string, { now = () => new Date() }: Options = {}) {
  // id przychodzi przez IPC – musi być zwykłą nazwą pliku w katalogu CV.
  const filePath = (id: string) => {
    if (!id || basename(id) !== id || id.startsWith('.')) throw new Error(`Niepoprawny identyfikator CV: ${id}`)
    return join(dir, `${id}.json`)
  }

  // Niepoprawny JSON lub niezgodność ze schematem kończy się wyjątkiem – plik jest uszkodzony.
  async function get(id: string): Promise<CvDocument> {
    return cvDocumentSchema.parse(JSON.parse(await readFile(filePath(id), 'utf8')))
  }

  async function listEntry(id: string): Promise<CvListEntry> {
    try {
      const { name, updatedAt } = await get(id)
      return { status: 'ok', id, name, updatedAt }
    } catch {
      return { status: 'damaged', id }
    }
  }

  // Zapis atomowy: plik tymczasowy + rename, więc na dysku jest zawsze cała stara albo cała nowa wersja.
  // Uszkodzonego pliku nie nadpisujemy – może dać się go jeszcze odzyskać ręcznie.
  async function save(document: CvDocument): Promise<void> {
    const targetPath = filePath(document.id)
    if ((await exists(targetPath)) && (await listEntry(document.id)).status === 'damaged') {
      throw new Error(`Plik CV jest uszkodzony i nie zostanie nadpisany: ${document.id}`)
    }
    await mkdir(dir, { recursive: true })
    const tempPath = join(dir, `.${document.id}.${randomUUID()}.tmp`)
    try {
      await writeFile(tempPath, JSON.stringify(document, null, 2))
      await rename(tempPath, targetPath)
    } finally {
      await rm(tempPath, { force: true })
    }
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

    create: () => saveAsNew(emptyCv({ now: now(), newId: randomUUID })),

    async duplicate(id: string): Promise<CvDocument> {
      const original = await get(id)
      return saveAsNew({ ...original, name: `${original.name} (kopia)` })
    },

    async rename(id: string, name: string): Promise<CvDocument> {
      if (!name.trim()) throw new Error('Nazwa CV nie może być pusta')
      const renamed = { ...(await get(id)), name: name.trim(), updatedAt: now().toISOString() }
      await save(renamed)
      return renamed
    },

    async delete(id: string): Promise<void> {
      await rm(filePath(id))
    }
  }
}

const exists = (path: string) => access(path).then(() => true, () => false)

const sortKey = (entry: CvListEntry) => (entry.status === 'ok' ? entry.updatedAt : '')
