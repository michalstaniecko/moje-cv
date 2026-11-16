import { useCallback, useEffect, useRef, useState } from 'react'
import { blockTarget, fragmentKey } from '../canvas/editTargets'
import { useActiveFragment } from '../canvas/useActiveField'
import type { EditSession } from '../canvas/useEditSession'
import type { CvDocument } from '../domain/schema'
import { sameSelection, selectionInDocument, selectionOfFragment, type InspectorSelection } from './selection'

// Elementy w panelu stron, których klik i fokus nie zmieniają zaznaczenia: Field popovers, menu uchwytów, dialogi
// (np. kadrowanie zdjęcia), pasek podglądu, pasek „Add to CV” i pigułki „+”.
const KEEPS_SELECTION = '.field-popover, [data-field-popover], .row-menu, dialog, .preview-bar, .add-to-cv, .edit-pill'

// Zaznaczenie Inspektora (#139): część CV, której panel pokazuje Inspector (null – panel „Dokument”). Źródła:
// - aktywny Page field (klik, Tab, skok z listy) – jego fragment;
// - klik albo fokus w element strony z fragmentem (np. przycisk zdjęcia, uchwyt) albo w blok strony – jego część;
//   klik w tło stron (poza blokami i kontrolkami warstwy edycji) – null;
// - `select` – wprost (wiersz „CV elements”, „‹ Dokument”), także dla części ukrytych i pustych, których nie ma na stronach.
// Klik i fokus w samym Inspektorze, poza panelem stron i w KEEPS_SELECTION zaznaczenia nie zmieniają. Część, która
// zniknęła z dokumentu (np. po cofnięciu), i Preview mode – null.
export function useInspectorSelection(document: CvDocument, session: EditSession) {
  const [stored, setStored] = useState<InspectorSelection>(null)
  const latestDocument = useRef(document)
  useEffect(() => {
    latestDocument.current = document
  })
  const editing = session.mode === 'edit'

  const select = useCallback(
    (next: InspectorSelection) => setStored((current) => (sameSelection(current, next) ? current : next)),
    []
  )

  // Aktywny Page field. Dokument celowo nie jest zależnością – zaznaczenie zmienia tylko zmiana pola.
  const fragment = useActiveFragment(session.activeField)
  useEffect(() => {
    if (fragment !== null) select(selectionOfFragment(fragment, latestDocument.current))
  }, [fragment, select])

  useEffect(() => {
    if (!editing) return
    const pagesElement = (target: EventTarget | null) =>
      target instanceof Element && target.closest('.preview') && !target.closest(KEEPS_SELECTION) ? target : null
    const onPointerDown = (event: PointerEvent) => {
      const target = pagesElement(event.target)
      if (!target) return
      const selection = selectionOfPageElement(target, latestDocument.current)
      // Kontrolka warstwy edycji bez części CV (np. ostrzeżenie daty) – zaznaczenie zostaje.
      if (selection === undefined) return
      select(selection)
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = pagesElement(event.target)
      const selection = target ? selectionOfPageElement(target, latestDocument.current) : undefined
      // Fokus bez części CV (np. Escape z Page field na panel stron) zaznaczenia nie zmienia.
      if (selection) select(selection)
    }
    window.document.addEventListener('pointerdown', onPointerDown, true)
    window.document.addEventListener('focusin', onFocusIn, true)
    return () => {
      window.document.removeEventListener('pointerdown', onPointerDown, true)
      window.document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [editing, select])

  const selection = editing ? selectionInDocument(stored, document) : null
  // Zaznaczenie bez części w dokumencie i Preview mode zapominają zaznaczenie: cofnięta część po ponowieniu ani powrót
  // do Edit mode nie otwierają jej panelu z powrotem.
  useEffect(() => {
    if (stored !== null && selection === null) setStored(null)
  }, [stored, selection])

  return [selection, select] as const
}

// Część CV elementu w panelu stron: fragment (`data-fragment`) albo blok strony (`data-block-id`); tło stron – null;
// inna kontrolka warstwy edycji – undefined (bez zmiany).
function selectionOfPageElement(target: Element, document: CvDocument): InspectorSelection | undefined {
  const fragment = target.closest<HTMLElement>('[data-fragment]')?.dataset['fragment']
  if (fragment) return selectionOfFragment(fragment, document)
  const blockId = target.closest<HTMLElement>('.cv-pages [data-block-id]')?.dataset['blockId']
  if (blockId) {
    const block = blockTarget(blockId, document)
    return block ? selectionOfFragment(fragmentKey(block), document) : null
  }
  if (target.closest('.edit-layer')) return undefined
  return null
}
