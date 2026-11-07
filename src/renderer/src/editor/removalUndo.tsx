import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { CvDocument } from '../domain/schema'
import { useDictionary } from '../i18n'
import type { CvEditor } from './cvEditor'

type Change = (document: CvDocument) => CvDocument

// Dokąd wraca fokus po „Cofnij”: do pierwszego pola przywróconej pozycji (element z `data-entry-id`), a gdy go nie ma,
// do przycisku dodawania w tej samej liście (`data-add-for`).
export type RemovalFocus = { entryId: string; listId: string }

// Usunięcie z formularza (kontakt, zdjęcie, stanowisko, punkt, wykształcenie, element listy) – z komunikatem „Usunięto. Cofnij”.
export type RemoveWithUndo = (change: Change, focus: RemovalFocus) => void

type Removal = { key: number; document: CvDocument; focus: RemovalFocus }

const REMOVAL_MESSAGE_MS = 8000

const RemoveContext = createContext<RemoveWithUndo | null>(null)
export const RemoveProvider = RemoveContext.Provider

export function useRemove(): RemoveWithUndo {
  const remove = useContext(RemoveContext)
  if (!remove) throw new Error('useRemove poza <RemoveProvider>')
  return remove
}

// Ostatnie usunięcie w edytorze. Komunikat dotyczy tylko dokumentu zaraz po usunięciu: każda kolejna zmiana (także
// Cofnij/Ponów z klawiatury lub menu) go chowa, więc „Cofnij” w komunikacie cofa zawsze dokładnie to usunięcie.
export function useRemovalUndo(editor: CvEditor) {
  const document = useStore(editor.store, (state) => state.document)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const nextKey = useRef(0)
  const focusAfterUndo = useRef<RemovalFocus | null>(null)

  const remove = useCallback<RemoveWithUndo>(
    (change, focus) => {
      editor.edit(change)
      setRemoval({ key: nextKey.current++, document: editor.store.getState().document, focus })
    },
    [editor]
  )

  useEffect(() => {
    if (removal && removal.document !== document) setRemoval(null)
  }, [removal, document])

  // Po przywróceniu pozycji (już w DOM) fokus wraca w jej okolice.
  useEffect(() => {
    if (!focusAfterUndo.current) return
    focusNear(focusAfterUndo.current)
    focusAfterUndo.current = null
  }, [document])

  const undo = useCallback(() => {
    if (!removal) return
    focusAfterUndo.current = removal.focus
    setRemoval(null)
    editor.undo()
  }, [editor, removal])

  const dismiss = useCallback(() => setRemoval(null), [])

  return { removal, remove, undo, dismiss }
}

function focusNear({ entryId, listId }: RemovalFocus) {
  const entry = window.document.querySelector(`[data-entry-id="${CSS.escape(entryId)}"]`)
  const target =
    entry?.querySelector<HTMLElement>('input:not([type="checkbox"]):not(:disabled), textarea') ??
    entry?.querySelector<HTMLElement>('button') ??
    window.document.querySelector<HTMLElement>(`[data-add-for="${CSS.escape(listId)}"]`)
  target?.focus()
}

// „Usunięto. Cofnij” na dole kolumny formularza. Kontener `role="status"` jest stale w DOM, a treść pojawia się po
// usunięciu, żeby czytnik ekranu ją ogłosił. Fokus nie jest przenoszony; „Cofnij” jest osiągalne Tabem.
export function RemovalMessage({
  removal,
  onUndo,
  onExpire
}: {
  removal: Removal | null
  onUndo: () => void
  onExpire: () => void
}) {
  return (
    <div className="removal-message" role="status">
      {removal && <RemovalMessageContent key={removal.key} onUndo={onUndo} onExpire={onExpire} />}
    </div>
  )
}

// Komunikat znika sam po 8 s, ale nie wtedy, gdy jest nad nim kursor albo fokus (WCAG 2.2.1) – wtedy liczy od nowa
// po odejściu. Nowe usunięcie (nowy `key`) zaczyna odliczanie od początku.
function RemovalMessageContent({ onUndo, onExpire }: { onUndo: () => void; onExpire: () => void }) {
  const t = useDictionary().editor
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (hovered || focused) return
    const timer = setTimeout(onExpire, REMOVAL_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [hovered, focused, onExpire])

  return (
    <div
      className="removal-message-content"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <span>{t.removed}</span>
      <button type="button" onClick={onUndo}>
        {t.undoRemoval}
      </button>
    </div>
  )
}
