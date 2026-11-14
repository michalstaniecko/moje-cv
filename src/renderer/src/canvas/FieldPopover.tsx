import { useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { anchoredPosition } from './anchoredPosition'

// Field popover (GLOSSARY.md; docs/specs/wysiwyg-editing.md, W12–W15): mała kontrolka wartości przy polu na stronie
// (data, zdjęcie, pasek klauzuli, podpowiedzi etykiety kontaktu) – nigdy formularz całej części CV. Wspólna mechanika:
// - `popover="manual"` w warstwie górnej, zawsze w skali 1:1; pokazany dopiero, gdy jest kotwica na stronie (`anchor`;
//   kotwica bywa przemontowana na innej stronie albo jeszcze jej nie ma – `anchored` rośnie, gdy pojawi się nowa);
// - położenie przy kotwicy (pod nią, a bez miejsca – nad nią; `above` – najpierw nad nią) po każdym renderze,
//   przewinięciu i zmianie rozmiaru okna;
// - `data-field-popover`: fokus w popoverze nie dezaktywuje pola (useActiveField.ts, `blurred`);
// - klik poza popoverem i kotwicą – `onClose(false)`; Escape – `onClose(true)` (fokus wraca na kotwicę);
// - Tab z ostatniej kontrolki i Shift+Tab z pierwszej – `onTabOut` (popover stoi „za” kotwicą);
// - `focusOnShow` – fokus na pierwszej kontrolce przy pokazaniu (popover daty, zdjęcia); bez niego fokus zostaje w polu
//   (podpowiedzi etykiety, pasek klauzuli).
// Okno modalne otwarte z popovera (kadrowanie zdjęcia) samo obsługuje Escape i Tab.

export const FIELD_POPOVER_CONTROLS = 'input:not(:disabled), select:not(:disabled), button:not(:disabled)'

// Elementy w kolejności Tab (bez `tabindex="-1"`, np. uchwytów i pigułek „+” na stronach).
const TABBABLE = ['button:not(:disabled)', 'input:not(:disabled)', 'select:not(:disabled)', 'textarea:not(:disabled)', 'a[href]', '[contenteditable="true"]', '[tabindex]']
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ')

// Tab z ostatniej kontrolki popovera: fokus na następnym w kolejności Tab elemencie za kotwicą `element` (pomija
// Field popovers i to, czego nie widać), jakby popover stał tuż za kotwicą.
export function focusAfter(element: HTMLElement) {
  const all = [...window.document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (candidate) => candidate === element || (!candidate.closest('[data-field-popover], [inert], [aria-hidden="true"]') && candidate.getClientRects().length > 0)
  )
  all[all.indexOf(element) + 1]?.focus()
}

export function FieldPopover({
  anchor,
  anchored = 0,
  label,
  role = 'dialog',
  id,
  className,
  above = false,
  focusOnShow = true,
  onClose,
  onTabOut,
  onKeyDown,
  children
}: {
  anchor: () => HTMLElement | null
  anchored?: number
  label: string | undefined
  role?: 'dialog' | 'toolbar' | 'listbox'
  id?: string
  className?: string
  above?: boolean
  focusOnShow?: boolean
  onClose: (returnFocus: boolean) => void
  onTabOut?: (backward: boolean) => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // Bieżące obsługi dla nasłuchów podpiętych raz.
  const latest = useRef({ anchor, onClose, above })
  useLayoutEffect(() => {
    latest.current = { anchor, onClose, above }
  })

  const place = () => {
    const element = panel.current
    const target = latest.current.anchor()
    if (!element || !target) return
    const box = target.getBoundingClientRect()
    const size = { width: element.offsetWidth, height: element.offsetHeight }
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const position = anchoredPosition({ anchor: box, panel: size, viewport, gap: 6, prefer: latest.current.above ? 'above' : 'below' })
    element.style.top = `${position.top}px`
    element.style.left = `${position.left}px`
  }
  const placeRef = useRef(place)
  useLayoutEffect(() => {
    placeRef.current = place
  })

  // Pokazanie dopiero przy kotwicy na stronie; fokus na pierwszej kontrolce raz, przy pokazaniu.
  const shown = useRef(false)
  useLayoutEffect(() => {
    const element = panel.current
    if (!element || shown.current || !latest.current.anchor()) return
    shown.current = true
    element.showPopover()
    placeRef.current()
    if (focusOnShow) element.querySelector<HTMLElement>(FIELD_POPOVER_CONTROLS)?.focus({ preventScroll: true })
  }, [anchored, focusOnShow])
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    const onMove = () => placeRef.current()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (element.contains(target) || latest.current.anchor()?.contains(target)) return
      latest.current.onClose(false)
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    window.document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      window.document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
  useLayoutEffect(() => {
    if (shown.current) placeRef.current()
  })

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('dialog')) return
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose(true)
      return
    }
    if (event.key !== 'Tab' || !onTabOut || !panel.current) return
    const controls = [...panel.current.querySelectorAll<HTMLElement>(FIELD_POPOVER_CONTROLS)]
    const edge = event.shiftKey ? controls[0] : controls.at(-1)
    if (event.target !== edge) return
    event.preventDefault()
    onTabOut(event.shiftKey)
  }

  return (
    <div
      ref={panel}
      id={id}
      popover="manual"
      className={className ? `field-popover ${className}` : 'field-popover'}
      role={role}
      aria-label={label}
      data-field-popover
      onKeyDown={keyDown}
    >
      {children}
    </div>
  )
}
