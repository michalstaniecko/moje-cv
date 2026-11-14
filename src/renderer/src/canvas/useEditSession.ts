import { useCallback, useEffect, useRef, useState } from 'react'
import type { CvDocument } from '../domain/schema'
import { sectionShown } from './addOnPage'
import { fragmentKey, type EditTarget } from './editTargets'
import { pageFieldKey } from './pageFields'
import { createDatePopoverStore } from './DatePopover'
import { createActiveFieldStore } from './useActiveField'
import { createAnnouncer } from './announcer'

// Edit mode (strony z kontrolkami edycji i paskiem bocznym) albo Preview mode (strony dokładnie jak w PDF) – GLOSSARY.md.
export type EditorMode = 'edit' | 'preview'

export type EditSession = ReturnType<typeof useEditSession>

// Stan sesji ekranu edytora CV poza historią dokumentu (`zundo`): nie trafia do cofania ani do pliku CV i nie jest
// preferencją – każde otwarcie CV startuje w Edit mode (docs/specs/inline-editing-redesign.md, Q16, Q17, Q21). Tryb
// jest zgłaszany procesowi głównemu dla zaznaczenia Widok → Podgląd.
// - Aktywne pole (`activeField`, useActiveField.ts): Page field z fokusem na stronach (docs/specs/wysiwyg-editing.md).
//   Gdy z dokumentu zniknie aktywne pole, a fokus nie ma dokąd wrócić (np. cofnięte dodanie wpisu z kursorem w nim),
//   sesja woła `onFocusLost` (edytor przenosi fokus w bezpieczne miejsce).
// - Otwarty Field popover daty (`datePopover`, DatePopover.tsx) – zamykany przy przejściu do Preview mode.
// - `focusPart` stawia kursor w części CV na stronie (Outline, „Add to CV”, pigułki „+”, menu uchwytu): w jej polu,
//   a pustą część – także nowy wpis – odsłania (W10, W21). Edit card nie ma (W20).
// - `announcer` – komunikaty `aria-live` o zmianach struktury z klawiatury i z menu uchwytu (W22, announcer.tsx).
// `current` – bieżący dokument edytora: część CV dodana tuż przed „otwarciem” (nowy kontakt, włączona klauzula) jest już
// w nim, choć `document` z ostatniego renderu jeszcze jej nie ma.
export function useEditSession(
  document: CvDocument,
  { onFocusLost, current }: { onFocusLost?: () => void; current?: () => CvDocument } = {}
) {
  const [mode, setModeState] = useState<EditorMode>('edit')
  const focusLost = useRef(onFocusLost)
  const [activeField] = useState(() => createActiveFieldStore({ onLost: () => focusLost.current?.() }))
  const [datePopover] = useState(createDatePopoverStore)
  const [announcer] = useState(createAnnouncer)
  const latestDocument = useRef(document)
  const currentDocument = useRef(current)
  useEffect(() => {
    focusLost.current = onFocusLost
    latestDocument.current = document
    currentDocument.current = current
  })

  useEffect(() => window.api.menu.setPreviewMode(mode === 'preview'), [mode])

  const setMode = useCallback(
    (next: EditorMode) => {
      setModeState(next)
      if (next === 'preview') {
        datePopover.close()
        activeField.leave()
      }
    },
    [activeField, datePopover]
  )
  const togglePreview = useCallback(() => {
    setModeState((current) => (current === 'edit' ? 'preview' : 'edit'))
    datePopover.close()
    activeField.leave()
  }, [activeField, datePopover])
  // Kursor w części CV na stronie; część, której nie ma na stronach (ukryta sekcja, wyłączona klauzula, nagłówek bez
  // kontaktów), i zdjęcie (bez pola) – nic.
  const focusPart = useCallback(
    (target: EditTarget) => {
      const now = currentDocument.current?.() ?? latestDocument.current
      const key = pageFieldKey(target, now)
      if (key !== null && onPages(target, now)) activeField.request({ key, fragment: fragmentKey(target) }, window.document)
    },
    [activeField]
  )

  return { mode, setMode, togglePreview, focusPart, activeField, datePopover, announcer }
}

// Czy część CV edytowana na stronie może tam dostać kursor: nagłówek (imię i nazwisko, podsumowanie, kontakty) zawsze
// (pusty jest odsłaniany), klauzula zgody – włączona (pusta jest odsłaniana), tytuł sekcji –
// gdy sekcja jest na stronach (nie ukryta i z treścią), wpis i element listy – gdy ich sekcja nie jest ukryta (pusty
// jest odsłaniany razem z sekcją).
function onPages(target: EditTarget, document: CvDocument): boolean {
  if (target.kind === 'fullName' || target.kind === 'summary' || target.kind === 'contacts') return true
  if (target.kind === 'consent') return document.consent.enabled
  const section = 'sectionId' in target ? document.sections.find((candidate) => candidate.id === target.sectionId) : undefined
  if (!section) return false
  return target.kind === 'sectionTitle' ? sectionShown(section, document) : !section.hidden
}
