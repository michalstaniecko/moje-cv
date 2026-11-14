import { useCallback, useEffect, useMemo, type RefObject } from 'react'
import type { Reveal } from '../domain/blocks'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import type { PageEditing } from '../template/editable'
import { PageField, type PageFieldsContext } from './PageField'
import { fragmentHasEmptyField, pageFieldOf } from './pageFields'
import { readSelection, useActiveFragment, type ActiveFieldStore } from './useActiveField'
import './pageFields.css'

const noReveal: Reveal = new Set()

// Edycja stron w Edit mode (ADR-0010) dla `CvPages`: Page fields szablonów, odsłonięty aktywny fragment i przywracanie
// kursora po nowym podziale stron (`panel` – przewijany panel stron, w nim szukane są pola). `fields` – dla
// `PageFieldsProvider` wokół stron. Bez edytora i aktywnego pola (podgląd bez edycji) – null.
// Odsłonięty jest aktywny fragment tylko wtedy, gdy ma puste pole: wejście w wypełniony fragment nie zmienia bloków ani
// podziału stron (W23), a strony bez aktywnego pola są dokładnie jak w Preview mode (W10).
export function usePageEditing({
  document,
  editor,
  active,
  panel
}: {
  document: CvDocument
  editor: CvEditor | undefined
  active: ActiveFieldStore | undefined
  panel: RefObject<HTMLElement | null>
}): { editing: PageEditing; fields: PageFieldsContext } | null {
  const t = useDictionary().editor
  const fragment = useActiveFragment(active)
  const revealed = fragment !== null && fragmentHasEmptyField(fragment, document) ? fragment : null
  const reveal = useMemo(() => (revealed === null ? noReveal : new Set([revealed])), [revealed])

  const onPagesCommitted = useCallback(() => {
    if (panel.current) active?.restore(panel.current)
  }, [active, panel])
  const editing = useMemo(
    (): PageEditing => ({
      fieldOf: (block, slot) => pageFieldOf(block, slot, document, t),
      reveal,
      Field: PageField,
      onPagesCommitted
    }),
    [document, t, reveal, onPagesCommitted]
  )
  const fields = useMemo(() => (editor && active ? { editor, active } : null), [editor, active])

  // Zaznaczenie aktywnego pola na bieżąco – do przywrócenia, gdy pole zostanie przemontowane.
  useEffect(() => {
    if (!active) return
    const onSelectionChange = () => {
      const element = window.document.activeElement
      if (!(element instanceof HTMLElement) || element.dataset['fieldKey'] !== active.get()?.key) return
      const selection = readSelection(element)
      if (selection) active.setSelection(selection)
    }
    window.document.addEventListener('selectionchange', onSelectionChange)
    return () => window.document.removeEventListener('selectionchange', onSelectionChange)
  }, [active])

  return fields ? { editing, fields } : null
}
