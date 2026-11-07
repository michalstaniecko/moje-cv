import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { appSettingsSchema, type AppSettings, type Clause, type ClauseContent } from '../renderer/src/domain/schema'
import type { Appearance } from '../shared/appearance'
import type { InterfaceLanguage } from '../shared/i18n/languages'
import { exists, writeJsonAtomic } from './atomicFile'

export type SettingsRepository = ReturnType<typeof createSettingsRepository>

const emptySettings: AppSettings = { schemaVersion: 1, clauses: [], defaultClauseId: null }

// Ustawienia globalne (biblioteka klauzul zgody, język interfejsu, wygląd interfejsu) w jednym pliku JSON, zapisywanym atomowo.
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

    // `null` (język systemu) usuwa wybór z pliku.
    async setInterfaceLanguage(language: InterfaceLanguage | null): Promise<AppSettings> {
      return change(({ interfaceLanguage: _previous, ...settings }) =>
        language === null ? settings : { ...settings, interfaceLanguage: language }
      )
    },

    // `null` (Systemowy) usuwa wybór wyglądu z pliku.
    async setAppearance(appearance: Appearance | null): Promise<AppSettings> {
      return change(({ appearance: _previous, ...settings }) =>
        appearance === null ? settings : { ...settings, appearance }
      )
    },

    // Wynik udanego sprawdzenia nowej wersji (ADR-0006). Zamknięta wersja zostaje.
    async recordUpdateCheck({ checkedAt, latestVersion }: { checkedAt: string; latestVersion: string }): Promise<AppSettings> {
      return change((settings) => ({ ...settings, updateCheck: { ...settings.updateCheck, checkedAt, latestVersion } }))
    },

    // Wersja zamknięta w pasku Update notice. Bez wcześniejszego sprawdzenia nie ma czego zamykać.
    async dismissUpdate(version: string): Promise<AppSettings> {
      return change((settings) =>
        settings.updateCheck ? { ...settings, updateCheck: { ...settings.updateCheck, dismissedVersion: version } } : settings
      )
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
  if (!settings.clauses.some((clause) => clause.id === id)) throw new Error(`Clause does not exist: ${id}`)
}
