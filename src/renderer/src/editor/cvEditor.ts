import { temporal } from 'zundo'
import { createStore } from 'zustand/vanilla'
import type { CvDocument } from '../domain/schema'

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed'

type EditorState = { document: CvDocument; saveStatus: SaveStatus }

export type CvEditor = ReturnType<typeof createCvEditor>

const AUTOSAVE_DELAY_MS = 500
// Pisanie w jednym polu bez dłuższej przerwy to jeden krok cofania, ale nie dłuższy niż MERGE_MAX_MS.
const MERGE_PAUSE_MS = 1000
const MERGE_MAX_MS = 5000
const HISTORY_LIMIT = 200

// Edytowany dokument z historią zmian w obrębie sesji (cofnij/ponów) i autozapisem
// ~500 ms po ostatniej zmianie. Zapisy idą po kolei, więc na dysk nigdy nie trafia starsza wersja po nowszej.
export function createCvEditor(initial: CvDocument, save: (document: CvDocument) => Promise<void>) {
  const store = createStore<EditorState>()(
    temporal((): EditorState => ({ document: initial, saveStatus: 'idle' }), {
      partialize: ({ document }) => ({ document }),
      equality: (past, current) => past.document === current.document,
      limit: HISTORY_LIMIT
    })
  )
  const history = store.temporal

  let merge: { key: string; startedAt: number; lastAt: number } | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> | null = null

  // Zapisuje bieżący dokument od razu, jeśli ma niezapisane zmiany (także po nieudanym zapisie).
  // Gdy nic się nie zapisuje, zapis startuje synchronicznie – zdąży wyjść nawet przy zamykaniu okna.
  function flush(): Promise<void> {
    const unsaved = saveTimer !== null || store.getState().saveStatus === 'failed'
    if (!unsaved) return saving ?? Promise.resolve()
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = null
    store.setState({ saveStatus: 'pending' })

    const { document } = store.getState()
    const isLatest = () => saveTimer === null && store.getState().document === document
    const run = () =>
      save(document).then(
        () => isLatest() && store.setState({ saveStatus: 'saved' }),
        () => isLatest() && store.setState({ saveStatus: 'failed' })
      )
    const current = (saving ? saving.then(run) : run()).then(() => {
      if (saving === current) saving = null
    })
    saving = current
    return current
  }

  store.subscribe((state, previous) => {
    if (state.document === previous.document) return
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, AUTOSAVE_DELAY_MS)
    if (state.saveStatus !== 'pending') store.setState({ saveStatus: 'pending' })
  })

  return {
    store,

    // `mergeKey` – identyfikator edytowanego pola; pisanie w tym samym polu łączy się w jeden krok cofania.
    edit(change: (document: CvDocument) => CvDocument, mergeKey?: string) {
      const now = Date.now()
      const merging =
        merge !== null &&
        merge.key === mergeKey &&
        now - merge.lastAt < MERGE_PAUSE_MS &&
        now - merge.startedAt < MERGE_MAX_MS
      merge = mergeKey === undefined ? null : { key: mergeKey, startedAt: merging ? merge!.startedAt : now, lastAt: now }
      if (merging) history.getState().pause()
      store.setState((state) => ({ document: change(state.document) }))
      if (merging) history.getState().resume()
    },

    undo() {
      merge = null
      history.getState().undo()
    },

    redo() {
      merge = null
      history.getState().redo()
    },

    flush
  }
}
