// PROTOTYP – wariant B: jeden wspólny popover paska formatowania. Natywny `popover="auto"` (warstwa górna – nie
// przycina go poziomo przewijany pasek; Esc i klik poza nim zamykają go same). Pozycja liczona z prostokąta przycisku
// w chwili otwarcia; treść renderuje się tylko, gdy popover jest otwarty (miniatury szablonów są kosztowne).
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function PbPopover({
  trigger,
  title,
  triggerClassName = 'pb-trigger',
  width = 280,
  align = 'start',
  children
}: {
  trigger: ReactNode
  title?: string
  triggerClassName?: string
  width?: number
  align?: 'start' | 'end'
  children: (close: () => void) => ReactNode
}) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})

  useEffect(() => {
    const element = panel.current
    if (!element) return
    const beforeToggle = (event: Event) => {
      const { newState } = event as ToggleEvent
      if (newState !== 'open') return
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 8
      const maxLeft = window.innerWidth - width - margin
      const left = align === 'end' ? rect.right - width : rect.left
      setPosition({ top: rect.bottom + 6, left: Math.max(margin, Math.min(left, maxLeft)), width })
    }
    const toggle = (event: Event) => setOpen((event as ToggleEvent).newState === 'open')
    element.addEventListener('beforetoggle', beforeToggle)
    element.addEventListener('toggle', toggle)
    return () => {
      element.removeEventListener('beforetoggle', beforeToggle)
      element.removeEventListener('toggle', toggle)
    }
  }, [width, align])

  const close = () => panel.current?.hidePopover()

  return (
    <>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        popoverTarget={id}
        aria-expanded={open}
        title={title}
        data-open={open || undefined}
      >
        {trigger}
      </button>
      <div ref={panel} id={id} popover="auto" className="pb-popover" style={position}>
        {open && children(close)}
      </div>
    </>
  )
}

// Nagłówek grupy w popoverze.
export function PbHeading({ children }: { children: ReactNode }) {
  return <div className="pb-popover-heading">{children}</div>
}

// Segmentowany wybór jednej wartości (do opcji z kilkoma wartościami: gęstość, format daty, kształt zdjęcia…).
export function PbSegmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="pb-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className="pb-segment"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// Przełącznik (checkbox z role="switch") w stylu macOS.
export function PbSwitch({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      className="pb-switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      title={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}
