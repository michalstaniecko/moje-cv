import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useDictionary } from '../i18n'
import { DEFAULT_FORM_WIDTH, displayedFormWidth, formWidthAfterKey, formWidthBounds } from './formWidth'

// Preferencja z pliku ustawień zapamiętana na czas sesji: kolejne otwarcie CV od razu ma właściwą szerokość.
let knownPreference: number | null = null

// Szerokość formularza w edytorze: preferencja (jedna dla całej aplikacji, zapisywana w ustawieniach) ograniczona do
// tego, co mieści bieżąca szerokość obu kolumn. Zmniejszenie okna zmienia tylko wyświetlaną szerokość.
export function useFormWidth(panes: RefObject<HTMLElement | null>) {
  const [preferred, setPreferred] = useState(knownPreference ?? DEFAULT_FORM_WIDTH)
  const panesWidth = useElementWidth(panes)

  useEffect(() => {
    if (knownPreference !== null) return
    let current = true
    window.api.settings
      .get()
      .then(({ formWidth }) => {
        knownPreference = formWidth ?? DEFAULT_FORM_WIDTH
        if (current) setPreferred(knownPreference)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [])

  // `save: false` w trakcie przeciągania – zapis dopiero po puszczeniu separatora.
  const change = (width: number, { save = true } = {}) => {
    knownPreference = width
    setPreferred(width)
    // Nieczytelny plik ustawień nie blokuje zmiany szerokości w bieżącej sesji.
    if (save) window.api.settings.setFormWidth(width).catch(() => undefined)
  }

  return { width: displayedFormWidth(preferred, panesWidth), panesWidth, change }
}

// Pionowy separator między formularzem a podglądem: przeciąganie myszą, strzałki ←/→ (ze Shiftem większy krok),
// Home/End – minimum/maksimum, podwójne kliknięcie – szerokość domyślna.
export function PaneSeparator({
  width,
  panesWidth,
  onChange
}: {
  width: number
  panesWidth: number
  onChange: (width: number, options?: { save?: boolean }) => void
}) {
  const t = useDictionary().editor
  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null)
  const { min, max } = formWidthBounds(panesWidth)

  return (
    <div
      className="pane-separator"
      role="separator"
      aria-orientation="vertical"
      aria-label={t.resizePanes}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { startX: event.clientX, startWidth: width, width }
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const next = displayedFormWidth(drag.current.startWidth + event.clientX - drag.current.startX, panesWidth)
        if (next === drag.current.width) return
        drag.current.width = next
        onChange(next, { save: false })
      }}
      onPointerUp={() => {
        if (!drag.current) return
        const { startWidth, width: dragged } = drag.current
        drag.current = null
        if (dragged !== startWidth) onChange(dragged)
      }}
      onPointerCancel={() => {
        if (drag.current) onChange(drag.current.width)
        drag.current = null
      }}
      onDoubleClick={() => onChange(DEFAULT_FORM_WIDTH)}
      onKeyDown={(event) => {
        const next = formWidthAfterKey(event, width, panesWidth)
        if (next === null) return
        event.preventDefault()
        onChange(next)
      }}
    />
  )
}

// Szerokość elementu, aktualizowana przy zmianie rozmiaru okna (przed pierwszym malowaniem).
function useElementWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const current = element.current
    if (!current) return
    const update = () => setWidth(current.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(current)
    return () => observer.disconnect()
  }, [element])
  return width
}
