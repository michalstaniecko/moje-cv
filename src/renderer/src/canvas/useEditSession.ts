import { useCallback, useEffect, useRef, useState } from 'react'
import type { CvDocument } from '../domain/schema'
import { sectionShown } from './addOnPage'
import { fragmentKey, targetExists, type EditTarget } from './editTargets'
import { pageFieldKey } from './pageFields'
import { createActiveFieldStore } from './useActiveField'

// Edit mode (strony z kontrolkami edycji i paskiem bocznym) albo Preview mode (strony dokładnie jak w PDF) – GLOSSARY.md.
export type EditorMode = 'edit' | 'preview'

// Otwarta Edit card: co edytuje (`target`) i przy czym jest zakotwiczona (`anchor` – klucz fragmentu strony,
// `fragmentKey`; po nim karta znajduje fragment po każdym podziale stron).
export type OpenCard = { target: EditTarget; anchor: string }

export type EditSession = ReturnType<typeof useEditSession>

// Stan sesji ekranu edytora CV poza historią dokumentu (`zundo`): nie trafia do cofania ani do pliku CV i nie jest
// preferencją – każde otwarcie CV startuje w Edit mode bez otwartej karty (docs/specs/inline-editing-redesign.md, Q16,
// Q17, Q21). Tryb jest zgłaszany procesowi głównemu dla zaznaczenia Widok → Podgląd.
// - Jedna karta naraz: otwarcie innej zastępuje bieżącą; przejście do Preview mode zamyka kartę (powrót jej nie otwiera).
// - Po każdej zmianie dokumentu (także cofnij/ponów) sesja sprawdza, czy część CV z karty nadal istnieje; jeśli nie,
//   zamyka kartę i woła `onCardGone` (edytor przenosi fokus w bezpieczne miejsce).
// - Aktywne pole (`activeField`, useActiveField.ts): Page field z fokusem na stronach (docs/specs/wysiwyg-editing.md).
//   Części CV edytowane już na stronie (imię i nazwisko, podsumowanie, tytuł sekcji) nie mają karty: „otwarcie” ich
//   z Outline, „Add to CV” czy menu stawia kursor w ich polu na stronie (pusta część jest odsłaniana). Karta tytułu
//   zostaje tylko dla sekcji, której nie ma na stronach (ukrytej albo pustej) – do czasu odsłaniania sekcji (S5).
export function useEditSession(document: CvDocument, { onCardGone }: { onCardGone?: () => void } = {}) {
  const [mode, setModeState] = useState<EditorMode>('edit')
  const [card, setCard] = useState<OpenCard | null>(null)
  const [activeField] = useState(createActiveFieldStore)
  const cardGone = useRef(onCardGone)
  const latestDocument = useRef(document)
  useEffect(() => {
    cardGone.current = onCardGone
    latestDocument.current = document
  })

  useEffect(() => window.api.menu.setPreviewMode(mode === 'preview'), [mode])

  useEffect(() => {
    if (card && !targetExists(card.target, document)) {
      setCard(null)
      cardGone.current?.()
    }
  }, [card, document])

  const setMode = useCallback(
    (next: EditorMode) => {
      setModeState(next)
      if (next === 'preview') {
        setCard(null)
        activeField.leave()
      }
    },
    [activeField]
  )
  const togglePreview = useCallback(() => {
    setModeState((current) => (current === 'edit' ? 'preview' : 'edit'))
    setCard(null)
    activeField.leave()
  }, [activeField])
  const openCard = useCallback(
    (target: EditTarget, anchor: string) => {
      const key = pageFieldKey(target)
      if (key !== null && onPages(target, latestDocument.current)) {
        setCard(null)
        activeField.request({ key, fragment: fragmentKey(target) }, window.document)
      } else setCard({ target, anchor })
    },
    [activeField]
  )
  const closeCard = useCallback(() => setCard(null), [])

  return { mode, setMode, togglePreview, card, openCard, closeCard, activeField }
}

// Czy część CV edytowana na stronie może tam dostać kursor: nagłówek zawsze (pusty jest odsłaniany), tytuł sekcji –
// gdy sekcja jest na stronach (nie ukryta i z treścią).
function onPages(target: EditTarget, document: CvDocument): boolean {
  if (target.kind !== 'sectionTitle') return true
  const section = document.sections.find((candidate) => candidate.id === target.sectionId)
  return section !== undefined && sectionShown(section, document)
}
