import { randomUUID } from 'node:crypto'
import { app, dialog, ipcMain, type BrowserWindow, type WebContents } from 'electron'
import type { Dictionary } from '../shared/i18n/en'
import { requireBoolean, requireString } from './ipcArgs'
import { isEditorActive } from './screens'

// Najdłuższe czekanie na odpowiedź renderera; brak odpowiedzi to nieudany zapis.
const FLUSH_TIMEOUT_MS = 10_000

// Prośby o zapis czekające na odpowiedź renderera (według identyfikatora prośby).
const flushRequests = new Map<string, { contents: WebContents; resolve: (saved: boolean) => void }>()

// Zakończenie aplikacji w toku (Cmd+Q): po zapisie trzeba je ponowić, bo Electron anuluje Quit, gdy okno wstrzyma
// zamknięcie. „Wróć do edytora” je zeruje.
let quitting = false

let registered = false
function registerOnce() {
  if (registered) return
  registered = true
  app.on('before-quit', () => {
    quitting = true
  })
  ipcMain.on('editor:flush-result', (event, requestId: unknown, saved: unknown) => {
    const id = requireString(requestId)
    const request = flushRequests.get(id)
    if (!request || request.contents !== event.sender) return
    flushRequests.delete(id)
    request.resolve(requireBoolean(saved))
  })
}

// Zamknięcie okna (Cmd+W, czerwony przycisk, Quit) z otwartym edytorem CV najpierw czeka, aż renderer zapisze
// oczekujące zmiany (także zakolejkowane za trwającym zapisem). Gdy zapis się nie uda, pyta natywnym oknem, czy
// zamknąć mimo to. Z biblioteki CV i po awarii renderera okno zamyka się od razu.
export function guardUnsavedChanges(window: BrowserWindow, dictionary: () => Dictionary): void {
  registerOnce()
  const contents = window.webContents
  let confirmed = false
  let settling = false

  const settle = async () => {
    settling = true
    try {
      const saved = await requestFlush(contents)
      if (window.isDestroyed()) return
      if (!saved && !(await askToDiscard(window, dictionary()))) {
        quitting = false
        return
      }
      confirmed = true
      if (quitting) app.quit()
      else window.close()
    } finally {
      settling = false
    }
  }

  window.on('close', (event) => {
    if (confirmed || contents.isDestroyed() || contents.isCrashed() || !isEditorActive(contents)) return
    event.preventDefault()
    if (!settling) void settle()
  })
}

function requestFlush(contents: WebContents): Promise<boolean> {
  const requestId = randomUUID()
  return new Promise<boolean>((resolve) => {
    const finish = (saved: boolean) => {
      clearTimeout(timer)
      contents.off('destroyed', onDestroyed)
      flushRequests.delete(requestId)
      resolve(saved)
    }
    const onDestroyed = () => finish(false)
    const timer = setTimeout(() => finish(false), FLUSH_TIMEOUT_MS)
    contents.once('destroyed', onDestroyed)
    flushRequests.set(requestId, { contents, resolve: finish })
    contents.send('editor:flush-request', requestId)
  })
}

// Czy zamknąć mimo nieudanego zapisu. Domyślny i Escape: „Wróć do edytora”.
async function askToDiscard(window: BrowserWindow, { appName, dialogs }: Dictionary): Promise<boolean> {
  const texts = dialogs.unsavedChanges
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    message: texts.message,
    detail: quitting ? texts.quitDetail(appName) : texts.closeDetail,
    buttons: [quitting ? texts.quitAnyway : texts.closeAnyway, texts.backToEditor],
    defaultId: 1,
    cancelId: 1
  })
  return response === 0
}
