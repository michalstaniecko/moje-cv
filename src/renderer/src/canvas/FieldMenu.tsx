import { useEffect, useState, type RefObject } from 'react'
import type { CvEditor } from '../editor/cvEditor'
import { moveShortcutHint, type MoveOffset } from '../editor/moveShortcut'
import { Menu, type RowMenuAction } from '../editor/RowMenu'
import { useDictionary } from '../i18n'
import type { Box } from './anchoredPosition'
import { fragmentHandle, joinedTarget } from './PageField'
import { fieldMoves, moveField } from './pageFields'
import type { TextSelection } from './pageFieldInput'
import { offsetOf, pageFieldElement, readSelection } from './useActiveField'
import type { EditSession } from './useEditSession'

// Menu pola na stronie (docs/specs/outline-instead-of-cv-form.md, D6): w punkcie stanowiska, elemencie listy i kontakcie
// prawy przycisk myszy i Shift+F10 / klawisz menu otwierają menu pola – „Move … up” / „Move … down” z podpowiedzią
// skrótu ⌥⇧↑/↓, a za kreską pozycje menu uchwytu fragmentu pola (wpisu albo kontaktów; elementy listy uchwytu nie mają),
// więc nic, co dawał Shift+F10, nie ginie.
// - Przeniesienie robi to samo co ⌥⇧↑/↓ w polu (`moveField`): jeden krok cofania, ten sam komunikat dla czytnika ekranu,
//   kursor zostaje w polu w tym samym miejscu (także gdy pole przechodzi na inną stronę). Na krańcu listy pozycja jest
//   wyłączona.
// - Menu stoi przy kursorze myszy (prawy przycisk) albo pod polem (z klawiatury); Escape wraca do pola.
// - Prawy przycisk w innych polach (i żetonach dat) otwiera menu uchwytu fragmentu – jak Shift+F10 w nich (PageField.tsx);
//   gdzie uchwytu nie ma (np. imię i nazwisko, skala stron poniżej 50%), zostaje zachowanie przeglądarki. Aplikacja nie
//   ma natywnego menu kontekstowego (brak obsługi `context-menu` w procesie głównym), więc nic nie jest zasłaniane.
// - Póki menu jest otwarte, pole zostaje aktywne (`data-field-popover`), jak przy menu uchwytu otwartym z pola.
// `handleActions` – pozycje menu uchwytu fragmentu (BlockMenu.tsx), `onClosed` – jak `onClosed` menu uchwytu.
export function useFieldMenu({
  panel,
  editor,
  session,
  handleActions,
  onClosed
}: {
  panel: RefObject<HTMLElement | null>
  editor: CvEditor
  session: EditSession
  handleActions: (fragment: string) => RowMenuAction[]
  onClosed: () => void
}) {
  const t = useDictionary().editor
  // Otwarte menu: pole (klucz i fragment), zaznaczenie w nim przy otwarciu i miejsce menu względem pola (`point` –
  // przesunięcie kursora myszy od lewego górnego rogu pola; bez niego – pod polem).
  const [open, setOpen] = useState<{
    key: string
    fragment: string
    selection: TextSelection | null
    point: { x: number; y: number } | null
  } | null>(null)
  const document = () => editor.store.getState().document

  useEffect(() => {
    const element = panel.current
    if (!element) return
    const fieldOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('.cv-pages [data-field-key], .cv-pages [data-joined]') : null
    const openAt = (field: HTMLElement, key: string, selection: TextSelection | null, point: { x: number; y: number } | null) => {
      const box = field.getBoundingClientRect()
      setOpen({
        key,
        fragment: field.dataset['fragment'] ?? '',
        selection,
        point: point && { x: point.x - box.left, y: point.y - box.top }
      })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return
      const field = fieldOf(event.target)
      const key = field?.dataset['fieldKey']
      if (!field || key === undefined || !fieldMoves(key, document())) return
      event.preventDefault()
      openAt(field, key, readSelection(field), null)
    }
    const onContextMenu = (event: MouseEvent) => {
      const field = fieldOf(event.target)
      if (!field) return
      const point = { x: event.clientX, y: event.clientY }
      // Linia złączona (kontakt poza aktywnym fragmentem): pole pod kursorem myszy.
      let key = field.dataset['fieldKey']
      let selection = key === undefined ? null : readSelection(field)
      if (key === undefined) {
        const at = window.document.caretPositionFromPoint(point.x, point.y)
        const target = joinedTarget(field, at && field.contains(at.offsetNode) ? offsetOf(field, at.offsetNode, at.offset) : 0)
        if (target) {
          key = target.key
          selection = { start: target.caret, end: target.caret }
        }
      }
      if (key !== undefined && fieldMoves(key, document())) {
        event.preventDefault()
        openAt(field, key, selection, point)
        return
      }
      const handle = fragmentHandle(field, field.dataset['fragment'] ?? '')
      if (!handle) return
      event.preventDefault()
      handle.click()
    }
    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('contextmenu', onContextMenu)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('contextmenu', onContextMenu)
    }
  }, [panel, editor])

  // Na wypadek zmiany przy otwartym menu: pole, którego już nie ma, zamyka menu.
  const moves = open ? fieldMoves(open.key, document()) : null
  useEffect(() => {
    if (open && !moves) setOpen(null)
  })
  if (!open || !moves) return null

  const field = () => (panel.current ? pageFieldElement(panel.current, open.key) : null)
  const move = (offset: MoveOffset) => {
    const moved = moveField(open.key, document(), offset)
    if (!moved) return
    const element = field()
    const end = (element?.textContent ?? '').length
    session.activeField.expect({ key: open.key, fragment: open.fragment }, open.selection ?? { start: end, end })
    editor.edit(moved.change)
    session.announcer.announce(moved.announce(t))
  }
  const mac = navigator.platform.startsWith('Mac')
  const actions: RowMenuAction[] = [
    { label: moves.moveUp(t), disabled: !moves.up, shortcut: moveShortcutHint(-1, mac), run: () => move(-1) },
    { label: moves.moveDown(t), disabled: !moves.down, shortcut: moveShortcutHint(1, mac), run: () => move(1) },
    ...handleActions(open.fragment).map((action, index) => (index === 0 ? { ...action, separator: true } : action))
  ]
  const anchor = (): Box | null => {
    const box = field()?.getBoundingClientRect()
    if (!box) return null
    const { point } = open
    if (!point) return box
    const [x, y] = [box.left + point.x, box.top + point.y]
    return { top: y, bottom: y, left: x, right: x }
  }
  const close = (returnFocus: boolean) => {
    setOpen(null)
    onClosed()
    if (returnFocus) field()?.focus({ preventScroll: true })
  }
  return (
    <Menu
      key={`${open.key}:${open.point?.x}:${open.point?.y}`}
      label={moves.menu(t)}
      actions={actions}
      anchor={anchor}
      opener={field}
      keepsFieldActive
      onClose={close}
    />
  )
}
