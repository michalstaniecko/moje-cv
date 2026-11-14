import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { anchoredPosition } from '../canvas/anchoredPosition'
import type { CvDocument } from '../domain/schema'
import { useDictionary } from '../i18n'
import type { CvEditor } from './cvEditor'
import { CvDesignFields } from './fields/CvDesignFields'

// Przycisk „Projekt CV” w pasku narzędzi z niemodalnym panelem CV design (kolor akcentu, font, Template, CV language)
// – w Edit mode i w Preview mode (docs/specs/inline-editing-redesign.md, Q18). Zmiany idą przez edytor, więc są od razu
// na kartkach, w autozapisie i w historii cofania – jak w CV form.
// - Panel w warstwie górnej (`popover`, jak RowMenu i Edit card), pod przyciskiem (`anchoredPosition`); stoi w DOM
//   zaraz za przyciskiem, więc Tab z przycisku wchodzi do panelu, a z ostatniego pola – do dalszej części paska.
// - Otwarcie: fokus na pierwszym polu i `onOpen` (edytor zamyka otwartą Edit card – jeden pływający panel naraz).
// - Escape i klik poza panelem zamykają go i wracają na przycisk (kliknięta kontrolka zatrzymuje fokus); kliknięcie
//   przycisku przy otwartym panelu też go zamyka. Fokus przeniesiony poza panel (Tab) zamyka go bez przenoszenia fokusu;
//   utrata fokusu przez okno (natywny wybór koloru) – nie.
const KEEPS_FOCUS = 'input, select, textarea, button, a[href], [contenteditable], [tabindex]:not([tabindex="-1"])'

export function CvDesignButton({ editor, document, onOpen }: { editor: CvEditor; document: CvDocument; onOpen: () => void }) {
  const t = useDictionary().editor
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = (focusButton: boolean) => {
    setOpen(false)
    if (focusButton) button.current?.focus()
  }

  useLayoutEffect(() => {
    const element = panel.current
    if (!open || !element || !button.current) return
    element.showPopover()
    const place = () => {
      const { top, left } = anchoredPosition({
        anchor: button.current!.getBoundingClientRect(),
        panel: { width: element.offsetWidth, height: element.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: 8,
        contain: true
      })
      element.style.top = `${top}px`
      element.style.left = `${left}px`
    }
    place()
    element.querySelector<HTMLElement>('input, select, button')?.focus()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || button.current?.contains(target)) return
      close(false)
      // Fokus wraca na przycisk, chyba że klik trafił w kontrolkę (pole, przycisk, fragment strony), która go przejęła;
      // przewijany panel stron albo tło nie są takim miejscem.
      requestAnimationFrame(() => {
        const active = window.document.activeElement
        if (!active?.matches(KEEPS_FOCUS)) button.current?.focus()
      })
    }
    window.document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="cv-design-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen()
          setOpen(!open)
        }}
      >
        {t.cvDesignButton}
      </button>
      {open && (
        <div
          ref={panel}
          popover="manual"
          className="cv-design-panel"
          role="dialog"
          aria-label={t.cvDesign}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null
            if (next && !panel.current?.contains(next) && next !== button.current) close(false)
          }}
        >
          <div className="form">
            <CvDesignFields editor={editor} document={document} />
          </div>
        </div>
      )}
    </>
  )
}
