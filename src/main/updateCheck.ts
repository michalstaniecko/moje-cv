import { z } from 'zod'
import type { AppSettings } from '../renderer/src/domain/schema'
import { LATEST_RELEASE_API_URL } from '../shared/links'
import type { SettingsRepository } from './settingsRepository'
import { isNewer, parseReleaseTag } from './versions'

// Sprawdzanie nowej wersji w buildzie `.dmg` (ADR-0006). Bez importu `electron`: sieć (`net.fetch`), zegar i ustawienia
// są wstrzykiwane, więc całość działa w vitest bez prawdziwego ruchu sieciowego. Serwis tylko informuje – nic nie
// pobiera ani nie instaluje.

export type UpdateCheckResult =
  | { status: 'newer'; version: string }
  | { status: 'up-to-date'; version: string }
  | { status: 'failed' }

export type UpdateCheck = ReturnType<typeof createUpdateCheck>

const checkInterval = 24 * 60 * 60 * 1000
const startupDelayMs = 10_000

// Jak działa sprawdzanie w danym buildzie. W Mac App Store nie ma go wcale (`null`: brak serwisu, timera, pozycji menu
// i ruchu sieciowego – ADR-0005, ADR-0006). `override` to zmienna `MOJE_CV_UPDATE_URL` (testy): „off” wyłącza
// sprawdzanie przy starcie, a adres `http://` na pętli zwrotnej zastępuje GitHuba i sprawdza od razu. Inne wartości
// są ignorowane, więc zmienna nie przekieruje zapytania do obcego serwera.
export function updateCheckConfig({
  macAppStore,
  override
}: {
  macAppStore: boolean
  override: string | undefined
}): { feedUrl: string; checkAtStartup: boolean; startupDelayMs: number } | null {
  if (macAppStore) return null
  if (override === 'off') return { feedUrl: LATEST_RELEASE_API_URL, checkAtStartup: false, startupDelayMs }
  if (override !== undefined && isLoopbackHttpUrl(override)) {
    return { feedUrl: override, checkAtStartup: true, startupDelayMs: 0 }
  }
  return { feedUrl: LATEST_RELEASE_API_URL, checkAtStartup: true, startupDelayMs }
}

function isLoopbackHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    url.username === '' &&
    url.password === ''
  )
}

// Z odpowiedzi GitHuba liczy się tylko tag; reszta pól (w tym `html_url`) jest ignorowana.
const latestReleaseSchema = z.object({ tag_name: z.string() })

export function createUpdateCheck({
  currentVersion,
  feedUrl,
  fetch,
  now,
  settings,
  timeoutMs = 10_000
}: {
  currentVersion: string
  feedUrl: string
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  now: () => Date
  settings: Pick<SettingsRepository, 'get' | 'recordUpdateCheck' | 'dismissUpdate'>
  timeoutMs?: number
}) {
  // Stan z ustawień; nieczytelny plik ustawień oznacza „nic nie wiadomo”.
  async function saved(): Promise<AppSettings['updateCheck']> {
    try {
      return (await settings.get()).updateCheck
    } catch {
      return undefined
    }
  }

  // Najnowsza opublikowana wersja albo `null`, gdy repo nie ma wydań (404). Każdy inny problem to wyjątek.
  async function latestVersion(): Promise<string | null> {
    const response = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `CV-Press/${currentVersion}`
      },
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (response.status === 404) return null
    if (response.status !== 200) throw new Error(`Unexpected status ${response.status}`)
    const { tag_name } = latestReleaseSchema.parse(await response.json())
    const version = parseReleaseTag(tag_name)
    if (!version) throw new Error(`Not a release tag: ${JSON.stringify(tag_name)}`)
    return version
  }

  async function request(): Promise<UpdateCheckResult> {
    let latest: string | null
    try {
      latest = await latestVersion()
    } catch {
      return { status: 'failed' }
    }
    const known = latest ?? currentVersion
    try {
      await settings.recordUpdateCheck({ checkedAt: now().toISOString(), latestVersion: known })
    } catch (error) {
      console.error('Failed to save the update check', error)
    }
    return latest !== null && isNewer(latest, currentVersion)
      ? { status: 'newer', version: latest }
      : { status: 'up-to-date', version: currentVersion }
  }

  // Równoczesne sprawdzenia (np. start i menu) dzielą jedno zapytanie.
  let pending: Promise<UpdateCheckResult> | null = null
  function check(): Promise<UpdateCheckResult> {
    pending ??= request().finally(() => {
      pending = null
    })
    return pending
  }

  async function notice(): Promise<string | null> {
    const state = await saved()
    const latest = state?.latestVersion
    if (!latest || latest === state.dismissedVersion || !isNewer(latest, currentVersion)) return null
    return latest
  }

  return {
    check,

    // Przy starcie: sieć najwyżej raz na 24 h. Znacznik z przyszłości (cofnięty zegar) nie blokuje sprawdzenia.
    async checkIfDue(): Promise<UpdateCheckResult | { status: 'skipped' }> {
      const checkedAt = Date.parse((await saved())?.checkedAt ?? '')
      const elapsed = now().getTime() - checkedAt
      if (elapsed >= 0 && elapsed < checkInterval) return { status: 'skipped' }
      return check()
    },

    // Wersja do pokazania w pasku Update notice – z ustawień, bez sieci.
    notice,

    async dismiss(): Promise<void> {
      const version = await notice()
      if (version === null) return
      try {
        await settings.dismissUpdate(version)
      } catch (error) {
        console.error('Failed to save the dismissed update', error)
      }
    }
  }
}
