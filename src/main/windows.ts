import { join } from 'node:path'
import { app, type BrowserWindow, type WebContents, type WebPreferences } from 'electron'

// Ustawienia bezpieczeństwa wspólne dla wszystkich okien renderera.
export const secureWebPreferences: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

export type LoadRenderer = (window: BrowserWindow, hash?: string) => Promise<void>

// Ładuje renderer (serwer deweloperski albo zbudowane pliki) na wskazanej trasie w hashu.
export const loadRenderer: LoadRenderer = async (window, hash = '') => {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

// Żadna treść nie otwiera nowych okien ani nie przenosi okna na inny adres (upuszczony plik, `window.open`,
// `location.href`). Aplikacja sama nigdy nie nawiguje – ekrany to stan Reacta – a `loadURL` / `loadFile` /
// `webContents.reload()` nie wywołują `will-navigate`. Jedyny wyjątek to ten sam adres: `location.reload()` z ekranu
// błędu („Wczytaj ponownie”) wywołuje `will-navigate` z bieżącym adresem strony. Linki zewnętrzne idą przez
// `shell.openExternal` w procesie głównym.
export function lockNavigation(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => {
    if (event.url !== contents.getURL()) event.preventDefault()
  })
}
