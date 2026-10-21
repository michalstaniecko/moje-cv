import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { appSettingsSchema, type AppSettings, type Clause, type ClauseContent } from '../renderer/src/domain/schema'
import { exists, writeJsonAtomic } from './atomicFile'

export type SettingsRepository = ReturnType<typeof createSettingsRepository>

const emptySettings: AppSettings = { schemaVersion: 1, clauses: [], defaultClauseId: null }

// Ustawienia globalne (biblioteka klauzul zgody) w jednym pliku JSON, zapisywanym atomowo.
// Uszkodzonego pliku (niepoprawny JSON lub niezgodność ze schematem) nie da się odczytać ani nadpisać.
export function createSettingsRepository(path: string) {
  async function get(): Promise<AppSettings> {
    if (!(await exists(path))) return emptySettings
    return appSettingsSchema.parse(JSON.parse(await readFile(path, 'utf8')))
  }

  // Zmiany idą po kolei (odczyt → zmiana → zapis), więc równoległe operacje nie gubią nawzajem swoich zmian.
  let changes: Promise<unknown> = Promise.resolve()
  function change(update: (settings: AppSettings) => AppSettings): Promise<AppSettings> {
    const next = changes.then(async () => {
      const updated = appSettingsSchema.parse(update(await get()))
      await writeJsonAtomic(path, updated)
      return updated
    })
    changes = next.catch(() => undefined)
    return next
  }

  return {
    get,

    async addClause(content: ClauseContent): Promise<Clause> {
      const clause = { id: randomUUID(), ...content }
      await change((settings) => ({ ...settings, clauses: [...settings.clauses, clause] }))
      return clause
    },

    async updateClause(id: string, content: ClauseContent): Promise<AppSettings> {
      return change((settings) => {
        requireClause(settings, id)
        return { ...settings, clauses: settings.clauses.map((clause) => (clause.id === id ? { id, ...content } : clause)) }
      })
    },

    // Usunięcie klauzuli domyślnej zostawia bibliotekę bez domyślnej.
    async deleteClause(id: string): Promise<AppSettings> {
      return change((settings) => ({
        ...settings,
        clauses: settings.clauses.filter((clause) => clause.id !== id),
        defaultClauseId: settings.defaultClauseId === id ? null : settings.defaultClauseId
      }))
    },

    async setDefaultClause(id: string | null): Promise<AppSettings> {
      return change((settings) => {
        if (id !== null) requireClause(settings, id)
        return { ...settings, defaultClauseId: id }
      })
    },

    // Klauzula, którą dostaje nowe CV. Uszkodzony plik ustawień nie blokuje tworzenia CV – wtedy bez klauzuli.
    async defaultClause(): Promise<Clause | null> {
      try {
        const { clauses, defaultClauseId } = await get()
        return clauses.find((clause) => clause.id === defaultClauseId) ?? null
      } catch {
        return null
      }
    }
  }
}

function requireClause(settings: AppSettings, id: string): void {
  if (!settings.clauses.some((clause) => clause.id === id)) throw new Error(`Klauzula nie istnieje: ${id}`)
}
