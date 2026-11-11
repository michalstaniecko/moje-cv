import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { moveShortcutOffset } from './listFieldKeys'
import type { DragHandleProps } from './SortableList'

// Pozycja menu wiersza. `run` wykonuje się po zamknięciu menu i sam decyduje o fokusie (np. przeniesienie wraca na
// uchwyt przeniesionego wiersza); wyłączona pozycja jest widoczna, ale pomijana przez strzałki.
export type RowMenuAction = { label: string; disabled?: boolean; run: () => void }

// Uchwyt wiersza listy będący zarazem przyciskiem menu (wzór: menu przy „Nowe CV” w bibliotece).
// - przeciągnięcie myszą zmienia kolejność (zdarzenia dnd-kit z `handleProps`), kliknięcie, Enter i spacja otwierają menu,
// - fokus przy otwarciu na pierwszej dostępnej pozycji, strzałki ↑/↓ (oraz Home/End) między dostępnymi pozycjami,
//   Enter/spacja wybiera,
// - Escape i kliknięcie poza menu zamykają je i wracają na uchwyt (kliknięte pole i tak przejmie fokus),
//   przejście fokusu poza menu (Tab) zamyka je bez przenoszenia fokusu,
// - ⌥⇧↑/↓ na uchwycie przenosi wiersz od razu (`onMoveShortcut`), bez otwierania menu.
// Menu jest w warstwie górnej (`popover`) i ma pozycję liczoną od uchwytu, więc przewijany panel formularza go nie
// ucina; przy braku miejsca pod uchwytem otwiera się nad nim.
export function RowMenu({
  label,
  actions,
  handleRef,
  handleProps,
  onMoveShortcut
}: {
  label: string
  actions: RowMenuAction[]
  handleRef: Ref<HTMLButtonElement>
  handleProps: DragHandleProps
  onMoveShortcut: (offset: -1 | 1) => void
}) {
  const [open, setOpen] = useState(false)
  const handle = useRef<HTMLButtonElement | null>(null)
  const menu = useRef<HTMLUListElement>(null)

  const close = (focusHandle: boolean) => {
    setOpen(false)
    if (focusHandle) handle.current?.focus()
  }

  useLayoutEffect(() => {
    const element = menu.current
    if (!open || !element || !handle.current) return
    element.showPopover()
    const place = () => {
      const anchor = handle.current!.getBoundingClientRect()
      const height = element.offsetHeight
      const below = anchor.bottom + 4
      const top = below + height <= window.innerHeight || anchor.top - 4 - height < 0 ? below : anchor.top - 4 - height
      const left = Math.max(4, Math.min(anchor.left, window.innerWidth - element.offsetWidth - 4))
      element.style.top = `${top}px`
      element.style.left = `${left}px`
    }
    place()
    element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !handle.current?.contains(target)) close(true)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const focus = (index: number) => items[(index + items.length) % items.length]?.focus()
    if (event.key === 'Escape') close(true)
    else if (event.key === 'ArrowDown') focus(current + 1)
    else if (event.key === 'ArrowUp') focus(current - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(items.length - 1)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <>
      <button
        ref={(element) => {
          handle.current = element
          handleProps.setActivatorNodeRef(element)
          if (typeof handleRef === 'function') handleRef(element)
          else if (handleRef) handleRef.current = element
        }}
        type="button"
        className="row-handle"
        aria-label={label}
        title={label}
        aria-describedby={handleProps.describedBy}
        aria-haspopup="menu"
        aria-expanded={open}
        {...handleProps.listeners}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          const offset = moveShortcutOffset(event)
          if (!offset) return
          // Na krańcu listy nic się nie dzieje, ale strzałka i tak nie przewija panelu.
          event.preventDefault()
          onMoveShortcut(offset)
        }}
      >
        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" focusable="false">
          {[3, 8, 13].map((y) =>
            [2.5, 7.5].map((x) => <circle key={`${x}:${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />)
          )}
        </svg>
      </button>
      {open && (
        <ul
          ref={menu}
          popover="manual"
          className="row-menu"
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null
            // Kliknięcie uchwytu przy otwartym menu zamyka je w `onClick` (inaczej menu zamknęłoby się i od razu otworzyło).
            if (!menu.current?.contains(next) && next !== handle.current) close(false)
          }}
        >
          {actions.map((action) => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                // Pozycje menu nie są w kolejności Tab (przechodzi się po nich strzałkami), więc Tab wychodzi z menu.
                tabIndex={-1}
                disabled={action.disabled}
                onClick={() => {
                  close(false)
                  action.run()
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
