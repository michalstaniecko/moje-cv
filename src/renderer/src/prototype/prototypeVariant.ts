// PROTOTYP – do wyrzucenia (gałąź prototype/global-options-ui). Nie łączyć z main.
// Pytanie: gdzie i jak spójnie umieścić opcje globalne CV (szablon, kolor, font, język, zdjęcie, sekcje, klauzula…)
// w edytorze WYSIWYG. Trzy warianty ekranu edytora, przełączane parametrem `?variant=` (A, B, C; `current` = obecny).
import { useEffect, useState } from 'react'

export const prototypeVariants = [
  { key: 'current', name: 'Obecny ekran (punkt odniesienia)' },
  { key: 'A', name: 'Inspektor – panel kontekstowy po prawej' },
  { key: 'B', name: 'Pasek formatowania nad stronami' },
  { key: 'C', name: 'Tryb Projekt – osobny etap wyglądu' }
] as const

export type PrototypeVariant = (typeof prototypeVariants)[number]['key']

const EVENT = 'prototype-variant-change'

export const prototypeEnabled = import.meta.env.DEV || import.meta.env.VITE_PROTOTYPE === '1'

function read(): PrototypeVariant {
  const value = new URLSearchParams(window.location.search).get('variant')
  return prototypeVariants.some((variant) => variant.key === value) ? (value as PrototypeVariant) : 'current'
}

export function setPrototypeVariant(variant: PrototypeVariant) {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', variant)
  window.history.replaceState(null, '', url)
  window.dispatchEvent(new Event(EVENT))
}

export function usePrototypeVariant(): PrototypeVariant {
  const [variant, setVariant] = useState(read)
  useEffect(() => {
    const update = () => setVariant(read())
    window.addEventListener(EVENT, update)
    return () => window.removeEventListener(EVENT, update)
  }, [])
  return prototypeEnabled ? variant : 'current'
}
