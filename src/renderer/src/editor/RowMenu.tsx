import type { useSortable } from '@dnd-kit/sortable'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { anchoredPosition, type Box } from '../canvas/anchoredPosition'
import { moveShortcutOffset, type MoveOffset } from './moveShortcut'

// Pozycja menu wiersza. `run` wykonuje się po zamknięciu menu i sam decyduje o fokusie (np. przeniesienie wraca na
// uchwyt przeniesionego wiersza); `opener` – element z fokusem, z którego otwarto menu bez fokusu na uchwycie (Page field
// ze Shift+F10), null – uchwyt. Wyłączona pozycja jest widoczna, ale pomijana przez strzałki. `checked` robi z pozycji
// przełącznik (`menuitemcheckbox` z zaznaczeniem, np. „Nowa strona przed”); `danger` – pozycja destrukcyjna (np. „Usuń
// stanowisko”), w kolorze błędu; kolejne takie pozycje (np. „Usuń kontakt: …”) oddziela od pozostałych jedna kreska.
// `separator` – kreska przed pozycją (nowa grupa, np. pozycje menu uchwytu za przeniesieniami w menu pola);
// `shortcut` – podpowiedź skrótu po prawej (`text`, poza nazwą pozycji) i `aria-keyshortcuts` (`keys`).
export type RowMenuAction = {
  label: string
  disabled?: boolean
  checked?: boolean
  danger?: boolean
  separator?: boolean
  shortcut?: { text: string; keys: string }
  run: (context: { opener: HTMLElement | null }) => void
}

const ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)'

// Atrybuty i obsługa zdarzeń dnd-kit dla uchwytu. Z atrybutów dnd-kit zostaje tylko opis (instrukcja przeciągania):
// uchwyt jest przyciskiem menu, nie „sortowalnym” przyciskiem przełączanym (`aria-roledescription`, `aria-pressed`).
export type DragHandleProps = {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  describedBy: string
  listeners: ReturnType<typeof useSortable>['listeners']
}

// Uchwyt wiersza listy będący zarazem przyciskiem menu (wzór: menu przy „Nowe CV” w bibliotece).
// - przeciągnięcie myszą zmienia kolejność (zdarzenia dnd-kit z `handleProps`), kliknięcie, Enter i spacja otwierają menu,
// - fokus przy otwarciu na pierwszej dostępnej pozycji, strzałki ↑/↓ (oraz Home/End) między dostępnymi pozycjami,
//   Enter/spacja wybiera,
// - Escape i kliknięcie poza menu zamykają je i wracają na uchwyt (kliknięte pole i tak przejmie fokus),
//   przejście fokusu poza menu (Tab) zamyka je bez przenoszenia fokusu,
// - ⌥⇧↑/↓ na uchwycie przenosi wiersz od razu (`onMoveShortcut`), bez otwierania menu.
// Bez `handleProps` (uchwyt fragmentu na stronie, poza `SortableList`) uchwyt jest samym przyciskiem menu, bez przeciągania.
// `tabbable={false}` (uchwyt na stronie, docs/specs/wysiwyg-editing.md, W22): uchwyt poza kolejnością Tab, klikalny;
// z klawiatury menu otwiera Shift+F10 w polu (`handle.click()`), a Escape wraca wtedy do tego pola (`opener`).
// `keepsFieldActive` – menu jest jak Field popover pola, z którego je otwarto (`data-field-popover`): pole zostaje
// aktywne (rozwinięty wpis się nie zwija), dopóki menu jest otwarte; `onClosed` – menu się zamknęło (każdą drogą).
// Menu jest w warstwie górnej (`popover`) i ma pozycję liczoną od uchwytu, więc przewijany panel formularza go nie
// ucina; przy braku miejsca pod uchwytem otwiera się nad nim.
export function RowMenu({
  label,
  actions,
  handleRef,
  handleProps,
  onMoveShortcut,
  tabbable = true,
  keepsFieldActive = false,
  onClosed
}: {
  label: string
  actions: RowMenuAction[]
  handleRef?: (element: HTMLButtonElement | null) => void
  handleProps?: DragHandleProps
  onMoveShortcut: (offset: MoveOffset) => void
  tabbable?: boolean
  keepsFieldActive?: boolean
  onClosed?: () => void
}) {
  const [open, setOpen] = useState(false)
  const handle = useRef<HTMLButtonElement | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  // Zamknięcie z powrotem fokusu: do elementu, z którego otwarto menu (jeśli nadal jest), inaczej na uchwyt.
  const close = (focusHandle: boolean) => {
    setOpen(false)
    onClosed?.()
    if (!focusHandle) return
    const from = opener.current
    if (from?.isConnected) from.focus({ preventScroll: true })
    else handle.current?.focus()
  }
  const toggle = () => {
    if (!open) {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== handle.current && active !== document.body ? active : null
    }
    setOpen(!open)
  }

  return (
    <>
      <button
        ref={(element) => {
          handle.current = element
          handleProps?.setActivatorNodeRef(element)
          handleRef?.(element)
        }}
        type="button"
        className="row-handle"
        aria-label={label}
        title={label}
        aria-describedby={handleProps?.describedBy}
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={tabbable ? undefined : -1}
        {...handleProps?.listeners}
        onClick={toggle}
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
        <Menu
          label={label}
          actions={actions}
          anchor={() => handle.current?.getBoundingClientRect() ?? null}
          owner={handle}
          opener={() => (opener.current?.isConnected ? opener.current : null)}
          keepsFieldActive={keepsFieldActive}
          onClose={close}
        />
      )}
    </>
  )
}

// Lista pozycji menu w warstwie górnej (`popover`), przy prostokącie `anchor` (pod nim, a bez miejsca – nad nim; liczony
// na nowo przy przewijaniu i zmianie rozmiaru okna): menu wiersza (uchwyt) i menu pola na stronie (canvas/FieldMenu.tsx).
// - Fokus przy otwarciu na pierwszej dostępnej pozycji, strzałki ↑/↓ (oraz Home/End) między dostępnymi pozycjami,
//   Enter/spacja wybiera (`onClose(false)`, potem `run` z `opener()`).
// - Escape i kliknięcie poza menu – `onClose(true)` (fokus wraca tam, skąd otwarto menu); przejście fokusu poza menu
//   (Tab) – `onClose(false)`. Kliknięcie i fokus w `owner` (uchwyt) nie są „poza menu” – uchwyt sam zamyka menu.
export function Menu({
  label,
  actions,
  anchor,
  owner,
  opener,
  keepsFieldActive = false,
  onClose
}: {
  label: string
  actions: RowMenuAction[]
  anchor: () => Box | null
  owner?: { current: HTMLElement | null }
  opener: () => HTMLElement | null
  keepsFieldActive?: boolean
  onClose: (returnFocus: boolean) => void
}) {
  const menu = useRef<HTMLUListElement>(null)
  const latest = useRef({ anchor, onClose })
  useEffect(() => {
    latest.current = { anchor, onClose }
  })

  useLayoutEffect(() => {
    const element = menu.current
    if (!element) return
    element.showPopover()
    const place = () => {
      const box = latest.current.anchor()
      if (!box) return
      const { top, left } = anchoredPosition({
        anchor: box,
        panel: { width: element.offsetWidth, height: element.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
      element.style.top = `${top}px`
      element.style.left = `${left}px`
    }
    place()
    element.querySelector<HTMLButtonElement>(ITEMS)?.focus()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [])

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !owner?.current?.contains(target)) latest.current.onClose(true)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [owner])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(ITEMS)]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const focus = (index: number) => items[(index + items.length) % items.length]?.focus()
    if (event.key === 'Escape') onClose(true)
    else if (event.key === 'ArrowDown') focus(current + 1)
    else if (event.key === 'ArrowUp') focus(current - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(items.length - 1)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <ul
      ref={menu}
      popover="manual"
      className="row-menu"
      role="menu"
      aria-label={label}
      data-field-popover={keepsFieldActive || undefined}
      onKeyDown={onMenuKeyDown}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        // Kliknięcie uchwytu przy otwartym menu zamyka je w `onClick` uchwytu (inaczej menu zamknęłoby się i od razu otworzyło).
        if (!menu.current?.contains(next) && (!owner?.current || next !== owner.current)) onClose(false)
      }}
    >
      {actions.map((action, index) => [
        ((action.danger && !actions[index - 1]?.danger) || (action.separator && index > 0)) && (
          <li key={`${index}:separator`} role="separator" />
        ),
        <li key={`${index}:${action.label}`} role="none">
          <button
            type="button"
            className={action.danger ? 'danger' : undefined}
            role={action.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={action.checked}
            aria-keyshortcuts={action.shortcut?.keys}
            // Pozycje menu nie są w kolejności Tab (przechodzi się po nich strzałkami), więc Tab wychodzi z menu.
            tabIndex={-1}
            disabled={action.disabled}
            onClick={() => {
              onClose(false)
              action.run({ opener: opener() })
            }}
          >
            {action.label}
            {action.shortcut && (
              <kbd className="row-menu-shortcut" aria-hidden="true">
                {action.shortcut.text}
              </kbd>
            )}
          </button>
        </li>
      ])}
    </ul>
  )
}
