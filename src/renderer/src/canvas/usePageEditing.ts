import { useCallback, useEffect, useMemo, type RefObject } from 'react'
import type { Reveal } from '../domain/blocks'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import type { PageEditing } from '../template/editable'
import { DateToken, JoinedDates, type DatePopoverStore } from './DatePopover'
import { JoinedFields, PageField, type PageFieldsContext } from './PageField'
import { consentFieldOf, fragmentHasEmptyField, fragmentHasJoinedFields, pageFieldOf } from './pageFields'
import { readSelection, useActiveFragment, type ActiveFieldStore } from './useActiveField'
import './pageFields.css'

const noReveal: Reveal = new Set()

// Edycja stron w Edit mode (ADR-0010) dla `CvPages`: Page fields szablonów, odsłonięty aktywny fragment i przywracanie
// kursora po nowym podziale stron (`panel` – przewijany panel stron, w nim szukane są pola). `fields` – dla
// `PageFieldsProvider` wokół stron. Bez edytora i aktywnego pola (podgląd bez edycji) – null.
// Odsłonięty (i rozwinięty) jest aktywny fragment tylko wtedy, gdy ma puste pole: wejście w wypełniony fragment nie zmienia bloków ani
// podziału stron (W23), a strony bez aktywnego pola są dokładnie jak w Preview mode (W10).
export function usePageEditing({
  document,
  editor,
  active,
  dates,
  panel
}: {
  document: CvDocument
  editor: CvEditor | undefined
  active: ActiveFieldStore | undefined
  dates: DatePopoverStore | undefined
  panel: RefObject<HTMLElement | null>
}): { editing: PageEditing; fields: PageFieldsContext } | null {
  const t = useDictionary().editor
  const fragment = useActiveFragment(active)
  const revealed = fragment !== null && fragmentHasEmptyField(fragment, document) ? fragment : null
  const reveal = useMemo(() => (revealed === null ? noReveal : new Set([revealed])), [revealed])
  // Aktywny fragment z liniami złączonymi z kilku pól (wpis, kontakty) ma je rozwinięte w osobne pola – tylko on, bo poza nim
  // strony muszą być piksel w piksel jak w PDF (template/editable.tsx). Wejście we wpis przerysowuje więc strony (bez
  // ponownego podziału stron); wejście w inne fragmenty – nie.
  const expandedFragment = fragment !== null && fragmentHasJoinedFields(fragment) ? fragment : null
  const expanded = useMemo(() => (expandedFragment === null ? noReveal : new Set([expandedFragment])), [expandedFragment])

  const onPagesCommitted = useCallback(() => {
    if (panel.current) active?.restore(panel.current)
  }, [active, panel])
  const editing = useMemo(
    (): PageEditing => ({
      fieldOf: (block, slot, part) => pageFieldOf(block, slot, document, t, reveal, part),
      consentField: consentFieldOf(document, t),
      reveal,
      expanded,
      Field: PageField,
      Joined: JoinedFields,
      DateToken,
      JoinedDates,
      onPagesCommitted
    }),
    [document, t, reveal, expanded, onPagesCommitted]
  )
  const fields = useMemo(() => (editor && active && dates ? { editor, active, dates } : null), [editor, active, dates])

  // Zaznaczenie aktywnego pola na bieżąco – do przywrócenia, gdy pole zostanie przemontowane; utrata fokusu pola.
  useEffect(() => {
    if (!active) return
    const onSelectionChange = () => {
      const element = window.document.activeElement
      if (!(element instanceof HTMLElement) || element.dataset['fieldKey'] !== active.get()?.key) return
      const selection = readSelection(element)
      if (selection) active.setSelection(selection)
    }
    // Utrata fokusu przez Page field – nasłuch na dokumencie, nie na polu: pole usuwane ze strony (cofnięty podział)
    // traci fokus już po odpięciu swoich obsług zdarzeń.
    const onFocusOut = (event: FocusEvent) => {
      const field = event.target
      if (!(field instanceof HTMLElement) || field.dataset['fieldKey'] === undefined || !field.closest('.cv-pages')) return
      active.blurred({ key: field.dataset['fieldKey'], fragment: field.dataset['fragment'] ?? '' }, event.relatedTarget)
    }
    window.document.addEventListener('selectionchange', onSelectionChange)
    window.document.addEventListener('focusout', onFocusOut)
    return () => {
      window.document.removeEventListener('selectionchange', onSelectionChange)
      window.document.removeEventListener('focusout', onFocusOut)
    }
  }, [active])

  return fields ? { editing, fields } : null
}
