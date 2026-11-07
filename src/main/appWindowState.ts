import { app, screen, type BrowserWindow } from 'electron'
import type { WindowState } from '../renderer/src/domain/schema'
import type { SettingsRepository } from './settingsRepository'
import { DEFAULT_WINDOW_SIZE, MIN_WINDOW_SIZE, defaultBounds, restoreBounds, type Rectangle } from './windowState'

// Zmiany rozmiaru i pozycji okna są zapisywane z opóźnieniem, żeby przeciąganie nie zapisywało pliku przy każdym pikselu.
const SAVE_DELAY_MS = 500

export type InitialWindowState = { bounds: Rectangle; maximized: boolean }
export type WindowStateKeeper = ReturnType<typeof createWindowStateKeeper>

// Rozmiar, pozycja i zmaksymalizowanie okna aplikacji zapamiętane w pliku ustawień. Ekrany są znane dopiero po `ready`.
export function createWindowStateKeeper(settings: SettingsRepository) {
  // Ostatni zapis musi trafić na dysk, zanim aplikacja się zakończy (jak autozapis CV w `cvLibrary.ts`).
  const pendingSaves = new Set<Promise<void>>()
  app.on('will-quit', (event) => {
    if (pendingSaves.size === 0) return
    event.preventDefault()
    void Promise.allSettled(pendingSaves).then(() => app.quit())
  })

  function save(window: BrowserWindow): void {
    // Pełny ekran nie jest zapamiętywany; zostaje stan sprzed jego włączenia.
    if (window.isDestroyed() || window.isFullScreen()) return
    const state: WindowState = {
      ...window.getNormalBounds(),
      maximized: window.isMaximized()
    }
    const saving: Promise<void> = settings.setWindowState(state).then(
      () => undefined,
      (error: unknown) => console.error('Failed to save the window state', error)
    )
    pendingSaves.add(saving)
    void saving.finally(() => pendingSaves.delete(saving))
  }

  return {
    // Zapisany stan, jeśli okno da się na którymś ekranie chwycić; inaczej rozmiar domyślny wyśrodkowany na ekranie
    // głównym. Uszkodzony plik ustawień nie blokuje startu – wtedy rozmiar domyślny.
    async initial(): Promise<InitialWindowState> {
      const saved = await settings.get().then(
        (settings) => settings.windowState,
        () => undefined
      )
      const workAreas = screen.getAllDisplays().map((display) => display.workArea)
      const restored = saved && restoreBounds(saved, workAreas, MIN_WINDOW_SIZE)
      if (saved && restored) return { bounds: restored, maximized: saved.maximized }
      return {
        bounds: defaultBounds(screen.getPrimaryDisplay().workArea, DEFAULT_WINDOW_SIZE),
        maximized: false
      }
    },

    // Zapisuje stan okna po każdej zmianie rozmiaru, położenia i maksymalizacji, a przy zamykaniu od razu.
    track(window: BrowserWindow): void {
      let timer: NodeJS.Timeout | undefined
      const saveLater = () => {
        clearTimeout(timer)
        timer = setTimeout(() => save(window), SAVE_DELAY_MS)
      }
      window.on('resized', saveLater)
      window.on('moved', saveLater)
      window.on('maximize', saveLater)
      window.on('unmaximize', saveLater)
      window.on('close', () => {
        clearTimeout(timer)
        save(window)
      })
    }
  }
}
