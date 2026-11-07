import { app, BrowserWindow, dialog, ipcMain, net, shell } from 'electron'
import { releaseUrl, RELEASES_URL } from '../shared/links'
import type { InterfaceLanguageState } from './interfaceLanguage'
import type { SettingsRepository } from './settingsRepository'
import { createUpdateCheck, updateCheckConfig, type UpdateCheck } from './updateCheck'

// Powiadomienie o nowej wersji w `.dmg` (ADR-0006) – cienka warstwa Electrona nad `createUpdateCheck`: `net.fetch`,
// IPC dla Update notice, timer startowy i natywne dialogi „Check for Updates…”. W Mac App Store
// (`macAppStore === true`) nie powstaje serwis ani timer, więc aplikacja nie wykonuje żadnego zapytania sieciowego,
// a `updates:notice` zwraca `null`. Adresy otwiera wyłącznie proces główny, ze stałych z `src/shared/links.ts`
// i zweryfikowanej wersji – renderer nie przekazuje ani URL-a, ani numeru wersji.
export function registerUpdates({
  language,
  settings,
  macAppStore
}: {
  language: InterfaceLanguageState
  settings: SettingsRepository
  macAppStore: boolean
}): { checkForUpdates: (window?: BrowserWindow) => void } {
  const config = updateCheckConfig({ macAppStore, override: process.env['MOJE_CV_UPDATE_URL'] })
  const updates: UpdateCheck | null = config
    ? createUpdateCheck({
        currentVersion: app.getVersion(),
        feedUrl: config.feedUrl,
        fetch: (url, init) => net.fetch(url, init),
        now: () => new Date(),
        settings
      })
    : null

  ipcMain.handle('updates:notice', () => updates?.notice() ?? null)
  ipcMain.handle('updates:download', async () => {
    if (!updates) return
    const version = await updates.notice()
    await open(version ? releaseUrl(version) : RELEASES_URL)
  })
  ipcMain.handle('updates:dismiss', () => updates?.dismiss())

  // Okno wydruku PDF też dostaje zdarzenie, ale go nie słucha.
  async function sendNotice() {
    const version = await updates?.notice()
    if (!version) return
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('updates:notice-changed', version)
  }

  if (updates && config?.checkAtStartup) {
    // Najpierw wersja znana z ustawień (bez sieci), potem sprawdzenie, jeśli minęły 24 h. Błędy są ciche.
    const startupCheck = async () => {
      await sendNotice()
      const result = await updates.checkIfDue()
      if (result.status === 'newer') await sendNotice()
    }
    setTimeout(() => void startupCheck().catch((error: unknown) => console.error('Update check failed', error)), config.startupDelayMs)
  }

  async function checkForUpdates(window?: BrowserWindow) {
    if (!updates) return
    const { appName, updates: t } = language.dictionary()
    const result = await updates.check()
    const show = (options: Electron.MessageBoxOptions) =>
      window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
    if (result.status === 'up-to-date') {
      await show({ type: 'info', message: t.upToDate(appName, result.version), buttons: [t.ok] })
    } else if (result.status === 'newer') {
      await sendNotice()
      const { response } = await show({
        type: 'info',
        message: t.available(appName, result.version),
        detail: t.availableDetail(app.getVersion()),
        buttons: [t.download, t.later],
        defaultId: 0,
        cancelId: 1
      })
      if (response === 0) await open(releaseUrl(result.version))
    } else {
      const { response } = await show({
        type: 'warning',
        message: t.failed,
        detail: t.failedDetail,
        buttons: [t.openReleases, t.ok],
        defaultId: 0,
        cancelId: 1
      })
      if (response === 0) await open(RELEASES_URL)
    }
  }

  return {
    // Wywołanie z menu nie może zostawić odrzuconej obietnicy (globalna obsługa błędów pokazałaby okno błędu).
    checkForUpdates: (window) =>
      void checkForUpdates(window).catch((error: unknown) => console.error('Update check failed', error))
  }
}

function open(url: string): Promise<void> {
  return shell.openExternal(url).catch((error: unknown) => console.error('Failed to open the address', url, error))
}
