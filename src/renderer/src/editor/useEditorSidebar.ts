import { useEffect, useSyncExternalStore } from 'react'
import type { EditorSidebar } from '../domain/schema'

type EditorSidebarSettings = {
  get(): Promise<{ editorSidebar?: EditorSidebar }>
  setEditorSidebar(sidebar: EditorSidebar): Promise<unknown>
}

// Widok paska bocznego: CV form albo szyna (zwinięty). Outline już nie ma (ADR-0012, #138) – zapisane `outline` z
// wcześniejszych wersji pokazuje szynę, a plik ustawień zmienia się dopiero przy następnym wyborze.
export type SidebarView = Exclude<EditorSidebar, 'outline'>

const viewOf = (saved: EditorSidebar | undefined): SidebarView => (saved === 'form' ? 'form' : 'collapsed')

// Pasek boczny edytora CV w Edit mode – do czasu #135 tylko widok zapasowy: CV form albo szyna, domyślnie szyna
// (strony i Inspector mają miejsce). Preferencja jak szerokość formularza: pierwsze `load()` czyta plik ustawień,
// a wybór dokonany, zanim odczyt się skończy, ma pierwszeństwo. Każdy wybór jest zapisywany; nieczytelny plik ustawień
// nie blokuje zmiany w bieżącej sesji. `expand()` rozwija szynę do CV form.
export function createEditorSidebarPreference(settings: EditorSidebarSettings) {
  let sidebar: SidebarView = 'collapsed'
  let loadStarted = false
  let chosenByUser = false
  const listeners = new Set<() => void>()

  const set = (next: SidebarView) => {
    if (next === sidebar) return
    sidebar = next
    listeners.forEach((listener) => listener())
  }
  const choose = (next: SidebarView) => {
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
          if (!chosenByUser) set(viewOf(editorSidebar))
        })
        .catch(() => undefined)
    },
    choose,
    expand: () => choose('form')
  }
}

export type EditorSidebarPreference = ReturnType<typeof createEditorSidebarPreference>

// Jedna preferencja na sesję aplikacji: kolejne otwarcie CV od razu ma właściwy pasek.
let sessionPreference: EditorSidebarPreference | null = null
const preference = () => (sessionPreference ??= createEditorSidebarPreference(window.api.settings))

// Odczyt preferencji jeszcze w bibliotece CV, żeby pierwsze otwarte CV nie pokazało na chwilę szyny zamiast CV form.
export const preloadEditorSidebar = () => preference().load()

export function useEditorSidebar() {
  const store = preference()
  const sidebar = useSyncExternalStore(store.subscribe, store.current)
  useEffect(() => store.load(), [store])
  return { sidebar, choose: store.choose, expand: store.expand }
}

export type EditorSidebarControl = ReturnType<typeof useEditorSidebar>
