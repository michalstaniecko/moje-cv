import type { WebContents } from 'electron'
import type { AppScreen } from '../shared/api'

// Bieżący ekran okien (według id webContents) zgłaszany przez renderer – wspólne źródło prawdy dla menu (aktywność
// pozycji Plik, Cofnij / Ponów) i strażnika zamknięcia okna. `clear` odpina nasłuchiwanie zamknięcia i przeładowania
// okna i usuwa wpis.
const screens = new Map<number, { screen: AppScreen; clear: () => void }>()

// Ekran znika razem z oknem i przy przeładowaniu strony (renderer zgłosi go ponownie po starcie); wtedy wywoływane
// jest `onClear`.
export function trackScreen(contents: WebContents, screen: AppScreen, onClear: () => void): void {
  const id = contents.id
  const tracked = screens.get(id)
  if (tracked) {
    tracked.screen = screen
    return
  }
  const onNavigation = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
    if (details.isMainFrame && !details.isSameDocument) clear()
  }
  const clear = () => {
    screens.delete(id)
    onClear()
    if (contents.isDestroyed()) return
    contents.off('did-start-navigation', onNavigation)
    contents.off('destroyed', clear)
  }
  contents.on('did-start-navigation', onNavigation)
  contents.once('destroyed', clear)
  screens.set(id, { screen, clear })
}

// Ekran, od którego zależy aktywność menu Plik: ekran okna, na którym działa menu (okna z fokusem). Bez okna z fokusem
// (np. okno pokazane bez fokusu w testach e2e) – ekran jedynego okna aplikacji; przy kilku oknach żaden, bo nie
// wiadomo, do którego trafiłaby komenda.
export function menuScreen(focused: Pick<WebContents, 'id'> | undefined): AppScreen | undefined {
  if (focused) return screens.get(focused.id)?.screen
  const [only, ...others] = screens.values()
  return others.length === 0 ? only?.screen : undefined
}

// Ekran danego okna (np. tego, do którego trafia komenda menu); okno bez zgłoszonego ekranu – żaden.
export function screenOf(contents: Pick<WebContents, 'id'>): AppScreen | undefined {
  return screens.get(contents.id)?.screen
}

// Czy w oknie jest otwarty edytor CV (Cofnij / Ponów działają na historii CV, zamknięcie czeka na zapis).
export function isEditorActive(contents: WebContents): boolean {
  return screenOf(contents) === 'editor'
}
