import { useCallback, useEffect, useRef, useState } from 'react'
import type { CvDocument } from '../domain/schema'
import { targetExists, type EditTarget } from './editTargets'

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
export function useEditSession(document: CvDocument, { onCardGone }: { onCardGone?: () => void } = {}) {
  const [mode, setModeState] = useState<EditorMode>('edit')
  const [card, setCard] = useState<OpenCard | null>(null)
  const cardGone = useRef(onCardGone)
  useEffect(() => {
    cardGone.current = onCardGone
  })

  useEffect(() => window.api.menu.setPreviewMode(mode === 'preview'), [mode])

  useEffect(() => {
    if (card && !targetExists(card.target, document)) {
      setCard(null)
      cardGone.current?.()
    }
  }, [card, document])

  const setMode = useCallback((next: EditorMode) => {
    setModeState(next)
    if (next === 'preview') setCard(null)
  }, [])
  const togglePreview = useCallback(() => {
    setModeState((current) => (current === 'edit' ? 'preview' : 'edit'))
    setCard(null)
  }, [])
  const openCard = useCallback((target: EditTarget, anchor: string) => setCard({ target, anchor }), [])
  const closeCard = useCallback(() => setCard(null), [])

  return { mode, setMode, togglePreview, card, openCard, closeCard }
}
