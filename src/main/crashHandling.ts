import { app, dialog, type BrowserWindow } from 'electron'
import type { Dictionary } from '../shared/i18n/en'
import { createCrashGuard } from './crashGuard'
import { loadRenderer } from './windows'

// Lokalna obsługa awarii, bez telemetrii i ruchu sieciowego: logi idą tylko na konsolę procesu (po angielsku).

// Awarie renderera okna aplikacji: do trzech w ciągu minuty okno przeładowuje się samo, czwarta pyta użytkownika,
// zamiast przeładowywać w pętli. Wspólny licznik dla kolejnych okien aplikacji (po zamknięciu i „activate”).
const rendererCrashes = createCrashGuard({ limit: 3, windowMs: 60_000 })

// Tylko okno aplikacji – awarie ukrytych okien wydruku obsługuje eksport PDF.
export function reloadAfterRendererCrash(window: BrowserWindow, dictionary: () => Dictionary): void {
  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    console.error(`The app window renderer process is gone (${details.reason}, exit code ${details.exitCode})`)
    if (rendererCrashes.record() === 'reload') return void loadRenderer(window)
    void askAfterRepeatedCrashes(window, dictionary())
  })
}

async function askAfterRepeatedCrashes(window: BrowserWindow, { appName, crash, menu }: Dictionary): Promise<void> {
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    message: crash.repeated.message(appName),
    detail: crash.repeated.detail,
    buttons: [crash.reload, menu.quit(appName)],
    defaultId: 0,
    cancelId: 1
  })
  if (response !== 0) return app.quit()
  rendererCrashes.reset()
  if (!window.isDestroyed()) void loadRenderer(window)
}

// Nieobsłużony wyjątek i odrzucona obietnica w procesie głównym: log i natywne okno błędu w języku interfejsu,
// najwyżej raz na minutę (kolejne błędy w tym czasie są tylko logowane). Proces się nie kończy.
// Rejestrować jak najwcześniej; przed ustaleniem języka interfejsu `dictionary` zwraca słownik angielski.
export function reportMainProcessErrors(dictionary: () => Dictionary): void {
  const dialogs = createCrashGuard({ limit: 1, windowMs: 60_000 })
  const report = (label: string) => (reason: unknown) => {
    console.error(label, reason)
    if (dialogs.record() === 'ask') return
    const { appName, crash } = dictionary()
    // Szczegóły po angielsku i bez stosu wywołań – do wklejenia w zgłoszenie.
    const details = reason instanceof Error ? reason.message : String(reason)
    dialog.showErrorBox(crash.unexpected.title, `${crash.unexpected.message(appName)}\n\nDetails: ${details}`)
  }
  process.on('uncaughtException', report('Uncaught exception in the main process'))
  process.on('unhandledRejection', report('Unhandled promise rejection in the main process'))
}
