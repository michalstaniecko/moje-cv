import { useEffect, useSyncExternalStore } from 'react'
import type { EditorSidebar } from '../domain/schema'

type EditorSidebarSettings = {
  get(): Promise<{ editorSidebar?: EditorSidebar }>
  setEditorSidebar(sidebar: EditorSidebar): Promise<unknown>
}

type ExpandedSidebar = Exclude<EditorSidebar, 'collapsed'>

// Pasek boczny edytora CV w Edit mode (docs/specs/inline-editing-redesign.md, Q13, Q14): Outline (domyślnie), CV form
// albo szyna z ikonami. Preferencja jak szerokość formularza: pierwsze `load()` czyta plik ustawień, a wybór dokonany,
// zanim odczyt się skończy, ma pierwszeństwo. Każdy wybór jest zapisywany; nieczytelny plik ustawień nie blokuje zmiany
// w bieżącej sesji. `expand()` wraca z szyny do panelu, z którego ją zwinięto (po restarcie – do Outline).
export function createEditorSidebarPreference(settings: EditorSidebarSettings) {
  let sidebar: EditorSidebar = 'outline'
  let lastExpanded: ExpandedSidebar = 'outline'
  let loadStarted = false
  let chosenByUser = false
  const listeners = new Set<() => void>()

  const set = (next: EditorSidebar) => {
    if (next !== 'collapsed') lastExpanded = next
    if (next === sidebar) return
    sidebar = next
    listeners.forEach((listener) => listener())
  }
  const choose = (next: EditorSidebar) => {
    chosenByUser = true
    set(next)
    settings.setEditorSidebar(next).catch(() => undefined)
  }

  return {
    current: () => sidebar,
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
        .then(({ editorSidebar }) => {
          if (!chosenByUser) set(editorSidebar ?? 'outline')
        })
        .catch(() => undefined)
    },
    choose,
    expand: () => choose(lastExpanded)
  }
}

export type EditorSidebarPreference = ReturnType<typeof createEditorSidebarPreference>

// Jedna preferencja na sesję aplikacji: kolejne otwarcie CV od razu ma właściwy pasek.
let sessionPreference: EditorSidebarPreference | null = null
const preference = () => (sessionPreference ??= createEditorSidebarPreference(window.api.settings))

// Odczyt preferencji jeszcze w bibliotece CV, żeby pierwsze otwarte CV nie pokazało na chwilę Outline zamiast CV form.
export const preloadEditorSidebar = () => preference().load()

export function useEditorSidebar() {
  const store = preference()
  const sidebar = useSyncExternalStore(store.subscribe, store.current)
  useEffect(() => store.load(), [store])
  return { sidebar, choose: store.choose, expand: store.expand }
}

export type EditorSidebarControl = ReturnType<typeof useEditorSidebar>
