import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { DEFAULT_FORM_WIDTH, displayedFormWidth } from './formWidth'

type FormWidthSettings = {
  get(): Promise<{ formWidth?: number }>
  setFormWidth(width: number): Promise<unknown>
}

// Preferowana szerokość formularza w bieżącej sesji. Pierwsze `load()` czyta plik ustawień; szerokość wybrana przez
// użytkownika, zanim odczyt się skończy, ma pierwszeństwo przed wczytaną wartością.
export function createFormWidthPreference(settings: FormWidthSettings) {
  let width = DEFAULT_FORM_WIDTH
  let loadStarted = false
  let chosenByUser = false
  const listeners = new Set<() => void>()

  const set = (next: number) => {
    width = next
    listeners.forEach((listener) => listener())
  }

  return {
    current: () => width,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load() {
      if (loadStarted) return
      loadStarted = true
      settings
        .get()
        .then(({ formWidth }) => {
          if (!chosenByUser) set(formWidth ?? DEFAULT_FORM_WIDTH)
        })
        .catch(() => undefined)
    },
    // W trakcie przeciągania: zmienia szerokość bez zapisu.
    preview(next: number) {
      chosenByUser = true
      set(next)
    },
    // Zmienia szerokość i zapisuje ją w ustawieniach. Nieczytelny plik ustawień nie blokuje zmiany w bieżącej sesji.
    commit(next: number) {
      chosenByUser = true
      set(next)
      settings.setFormWidth(next).catch(() => undefined)
    }
  }
}

// Jedna preferencja na sesję: kolejne otwarcie CV od razu ma właściwą szerokość.
let sessionPreference: ReturnType<typeof createFormWidthPreference> | null = null
const preference = () => (sessionPreference ??= createFormWidthPreference(window.api.settings))

export type FormWidth = ReturnType<typeof useFormWidth>

// Szerokość formularza w edytorze: preferencja (jedna dla całej aplikacji, zapisywana w ustawieniach) ograniczona do
// tego, co mieści bieżąca szerokość obu kolumn. Zmniejszenie okna zmienia tylko wyświetlaną szerokość.
export function useFormWidth(panes: RefObject<HTMLElement | null>) {
  const store = preference()
  const preferred = useSyncExternalStore(store.subscribe, store.current)
  const panesWidth = useElementWidth(panes)
  useEffect(() => store.load(), [store])

  return {
    width: displayedFormWidth(preferred, panesWidth),
    panesWidth,
    preview: store.preview,
    commit: store.commit
  }
}

// Szerokość elementu, aktualizowana przy zmianie rozmiaru okna (przed pierwszym malowaniem).
function useElementWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const current = element.current
    if (!current) return
    const update = () => setWidth(current.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(current)
    return () => observer.disconnect()
  }, [element])
  return width
}
