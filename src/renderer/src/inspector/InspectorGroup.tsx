import { useId, useState, type ReactNode } from 'react'

// Zwinięte grupy Inspektora – preferencja interfejsu, nie właściwość CV: pamiętana w pamięci sesji aplikacji (do
// zamknięcia aplikacji), wspólna dla wszystkich CV i obu trybów. Prostsze niż ustawienia aplikacji (#142).
const collapsedGroups = new Set<string>()

// Zwijana grupa Inspektora: nagłówek z przyciskiem `aria-expanded` (Enter / spacja / klik) i treść ukryta po zwinięciu.
// `id` – stały klucz grupy w pamięci sesji (niezależny od Interface language).
export function InspectorGroup({
  id,
  title,
  children,
  safeFocus = false
}: {
  id: string
  title: string
  children: ReactNode
  // Bezpieczne miejsce fokusu edytora (`data-safe-focus`, CvScreen.focusSafePlace) – nagłówek pierwszej grupy.
  safeFocus?: boolean
}) {
  const [open, setOpen] = useState(() => !collapsedGroups.has(id))
  const content = useId()

  const toggle = () => {
    if (open) collapsedGroups.add(id)
    else collapsedGroups.delete(id)
    setOpen(!open)
  }

  return (
    <section className="inspector-group">
      <h3 className="inspector-group-title">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={content}
          onClick={toggle}
          data-safe-focus={safeFocus || undefined}
        >
          {title}
        </button>
      </h3>
      <div id={content} className="inspector-group-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
