// PROTOTYP – wariant A „Inspektor”: co jest zaznaczone na stronach, czyli czego opcje pokazuje Inspektor.
// Źródła: aktywne pole sesji (Page field z fokusem, także po skoku z Outline) oraz klik/fokus w elementy stron
// z `data-fragment` (np. przycisk zdjęcia, który nie jest polem). Fokus wędrujący do samego Inspektora NIE czyści
// zaznaczenia – inaczej każdy klik w opcję przełączałby Inspektor z powrotem na „Dokument”.
import { useEffect, useState, type RefObject } from 'react'
import { useActiveFragment } from '../../canvas/useActiveField'
import type { EditSession } from '../../canvas/useEditSession'
import type { CvDocument } from '../../domain/schema'

export type InspectorSelection =
  | { kind: 'section'; id: string }
  | { kind: 'photo' }
  | { kind: 'header' }
  | { kind: 'consent' }
  | null

// Klucz fragmentu strony (canvas/editTargets.ts, `fragmentKey`) → element CV w Inspektorze.
export function selectionOfFragment(fragment: string | undefined | null, document: CvDocument): InspectorSelection {
  if (!fragment) return null
  if (fragment === 'photo') return { kind: 'photo' }
  if (fragment === 'consent') return { kind: 'consent' }
  if (fragment === 'fullName' || fragment === 'contacts' || fragment === 'summary') return { kind: 'header' }
  const [prefix, id] = [fragment.slice(0, fragment.indexOf(':')), fragment.slice(fragment.indexOf(':') + 1)]
  if (prefix === 'sectionTitle' || prefix === 'list') return { kind: 'section', id }
  if (prefix === 'item') {
    const section = document.sections.find((candidate) => (candidate.items as { id: string }[]).some((item) => item.id === id))
    return section ? { kind: 'section', id: section.id } : null
  }
  return null
}

// Elementy, w które klik nie zmienia zaznaczenia: popovery i menu stron (leżą w panelu stron, ale dotyczą fragmentu).
const KEEP = '.field-popover, [data-field-popover], .row-menu, dialog, .preview-bar, .add-to-cv, .edit-pill'

export function useInspectorSelection(session: EditSession, document: CvDocument, inspector: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<InspectorSelection>(null)
  const fragment = useActiveFragment(session.activeField)

  // Aktywne pole na stronach (klik, Tab, skok z Outline) – Inspektor pokazuje jego część CV.
  useEffect(() => {
    if (fragment !== null) setSelection(selectionOfFragment(fragment, document))
    // Dokument celowo poza zależnościami: zmiana treści nie zmienia zaznaczenia.
  }, [fragment])

  // Klik/fokus w stronach: fragment → jego opcje; tło stron → „Dokument”. Poza stronami (pasek, Outline, Inspektor) – bez zmian.
  useEffect(() => {
    const onEvent = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (inspector.current?.contains(target)) return
      if (!target.closest('.preview') || target.closest(KEEP)) return
      const key = target.closest<HTMLElement>('[data-fragment]')?.dataset['fragment']
      setSelection(selectionOfFragment(key, latest.document))
    }
    const latest = { document }
    window.document.addEventListener('pointerdown', onEvent, true)
    window.document.addEventListener('focusin', onEvent, true)
    return () => {
      window.document.removeEventListener('pointerdown', onEvent, true)
      window.document.removeEventListener('focusin', onEvent, true)
    }
  }, [document, inspector])

  // Preview mode: tylko „Dokument”.
  useEffect(() => {
    if (session.mode === 'preview') setSelection(null)
  }, [session.mode])

  // Zaznaczona sekcja zniknęła (cofnięcie dodania) – wracamy do „Dokument”.
  const valid =
    selection?.kind === 'section' && !document.sections.some((section) => section.id === selection.id) ? null : selection
  return [session.mode === 'preview' ? null : valid, setSelection] as const
}
