import type { WebContents } from 'electron'
import type { AppScreen } from '../shared/api'

// Bieżący ekran okien (według id webContents) zgłaszany przez renderer – wspólne źródło prawdy dla menu (aktywność
// pozycji Plik, Cofnij / Ponów) i strażnika zamknięcia okna. `clear` odpina nasłuchiwanie zamknięcia i przeładowania
// okna i usuwa wpis. Kolejność wpisów to kolejność zgłoszeń – ostatni jest ekranem, na którym użytkownik właśnie jest.
const screens = new Map<number, { screen: AppScreen; clear: () => void }>()

// Ekran znika razem z oknem i przy przeładowaniu strony (renderer zgłosi go ponownie po starcie); wtedy wywoływane
// jest `onClear`.
export function trackScreen(contents: WebContents, screen: AppScreen, onClear: () => void): void {
  const id = contents.id
  const tracked = screens.get(id)
  if (tracked) {
    screens.delete(id)
    screens.set(id, { ...tracked, screen })
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

// Ekran, od którego zależy aktywność menu Plik: ostatnio zgłoszony; bez okien – żaden.
export function currentScreen(): AppScreen | undefined {
  return [...screens.values()].at(-1)?.screen
}

// Czy w oknie jest otwarty edytor CV (Cofnij / Ponów działają na historii CV, zamknięcie czeka na zapis).
export function isEditorActive(contents: WebContents): boolean {
  return screens.get(contents.id)?.screen === 'editor'
}
