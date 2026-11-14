import type { WebContents } from 'electron'
import type { AppScreen } from '../shared/api'

// Bieżący ekran okien (według id webContents) zgłaszany przez renderer – wspólne źródło prawdy dla menu (aktywność
// pozycji Plik, Cofnij / Ponów) i strażnika zamknięcia okna. `clear` odpina nasłuchiwanie zamknięcia i przeładowania
// okna i usuwa wpis. `previewMode` – czy edytor CV tego okna jest w Preview mode (zaznaczenie Widok → Podgląd).
const screens = new Map<number, { screen: AppScreen; previewMode: boolean; clear: () => void }>()

// Ekran znika razem z oknem i przy przeładowaniu strony (renderer zgłosi go ponownie po starcie); wtedy wywoływane
// jest `onClear`.
export function trackScreen(contents: WebContents, screen: AppScreen, onClear: () => void): void {
  const id = contents.id
  const tracked = screens.get(id)
  if (tracked) {
    // Tryb należy do otwartego edytora: zmiana ekranu go kasuje (każde otwarcie CV startuje w Edit mode).
    if (tracked.screen !== screen) tracked.previewMode = false
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
  screens.set(id, { screen, previewMode: false, clear })
}

// Ekran, od którego zależy aktywność menu Plik: ekran okna, na którym działa menu (okna z fokusem). Bez okna z fokusem
// (np. okno pokazane bez fokusu w testach e2e) – ekran jedynego okna aplikacji; przy kilku oknach żaden, bo nie
// wiadomo, do którego trafiłaby komenda.
export function menuScreen(focused: Pick<WebContents, 'id'> | undefined): AppScreen | undefined {
  return menuEntry(focused)?.screen
}

// Czy edytor CV okna, na którym działa menu (jak `menuScreen`), jest w Preview mode.
export function menuPreviewMode(focused: Pick<WebContents, 'id'> | undefined): boolean {
  return menuEntry(focused)?.previewMode ?? false
}

function menuEntry(focused: Pick<WebContents, 'id'> | undefined) {
  if (focused) return screens.get(focused.id)
  const [only, ...others] = screens.values()
  return others.length === 0 ? only : undefined
}

// Tryb edytora CV zgłoszony przez okno; poza edytorem (np. spóźnione zgłoszenie po wyjściu) pomijany.
export function setPreviewMode(contents: Pick<WebContents, 'id'>, previewMode: boolean): void {
  const tracked = screens.get(contents.id)
  if (tracked?.screen === 'editor') tracked.previewMode = previewMode
}

// Ekran danego okna (np. tego, do którego trafia komenda menu); okno bez zgłoszonego ekranu – żaden.
export function screenOf(contents: Pick<WebContents, 'id'>): AppScreen | undefined {
  return screens.get(contents.id)?.screen
}

// Czy w oknie jest otwarty edytor CV (Cofnij / Ponów działają na historii CV, zamknięcie czeka na zapis).
export function isEditorActive(contents: WebContents): boolean {
  return screenOf(contents) === 'editor'
}
