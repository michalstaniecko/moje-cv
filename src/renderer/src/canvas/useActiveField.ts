import { useSyncExternalStore } from 'react'
import type { TextSelection } from './pageFieldInput'

// Aktywne pole (docs/specs/wysiwyg-editing.md, W8, W10, W23): Page field z fokusem (albo to, do którego fokus właśnie
// idzie) i jego zaznaczenie jako przesunięcia znaków. Stan sesji edycji poza historią dokumentu, w małym magazynie
// poza stanem React: zmiana zaznaczenia nie renderuje stron, a zmiana aktywnego fragmentu – tylko tych, którzy go czytają
// (`useActiveFragment`).
// - `focused` – pole dostało fokus (klik, Tab, przywrócenie): staje się aktywne.
// - `blurred` – pole straciło fokus: przestaje być aktywne, chyba że fokus wrócił do pola o tym samym kluczu (blok
//   przeniesiony na inną stronę jest nowym węzłem, a fokus przywraca `restore` jeszcze przed malowaniem).
// - `request` – fokus z zewnątrz (Outline, „Add to CV”, menu): pole staje się aktywne od razu (jego fragment jest
//   odsłaniany), a fokus dostaje teraz albo – gdy pola jeszcze nie ma na stronach – po najbliższym podziale stron.
// - `leave` – wyjście z Edit mode: żadne pole nie jest aktywne.
// - `restore` – po każdym nowym podziale stron: oczekujący fokus albo pole aktywne, które zgubiło fokus przez
//   przemontowanie, dostaje go z powrotem z zapamiętanym zaznaczeniem, bez przewijania.

export type ActiveField = { key: string; fragment: string }

type Pending = { key: string; caret: 'start' | 'end' }

export type ActiveFieldStore = ReturnType<typeof createActiveFieldStore>

// Page fields na stronach (nigdy w kontenerze pomiarowym).
export const PAGE_FIELD_SELECTOR = '.cv-pages [data-field-key]'

export const pageFieldElement = (root: ParentNode, key: string) =>
  root.querySelector<HTMLElement>(`.cv-pages [data-field-key="${CSS.escape(key)}"]`)

export function createActiveFieldStore() {
  let active: ActiveField | null = null
  let selection: TextSelection | null = null
  let pending: Pending | null = null
  const listeners = new Set<() => void>()

  const setActive = (next: ActiveField | null) => {
    if (next?.key === active?.key && next?.fragment === active?.fragment) return
    active = next
    for (const listener of listeners) listener()
  }

  return {
    get: () => active,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    selection: () => selection,
    setSelection(next: TextSelection) {
      selection = next
    },
    focused(field: ActiveField, element: HTMLElement) {
      pending = null
      if (active?.key !== field.key) selection = null
      setActive(field)
      selection ??= readSelection(element)
    },
    blurred(field: ActiveField) {
      // Po zakończeniu bieżącego renderu: przywrócenie fokusu w nowym węźle pola dzieje się w tym samym zadaniu.
      queueMicrotask(() => {
        const element = window.document.activeElement
        if (element instanceof HTMLElement && element.dataset['fieldKey'] === field.key) return
        if (pending || active?.key !== field.key) return
        selection = null
        setActive(null)
      })
    },
    // Wyjście z Edit mode: żadne pole nie jest aktywne (strony w Preview mode nie mają pól).
    leave() {
      pending = null
      selection = null
      setActive(null)
    },
    request(field: ActiveField, root: ParentNode, caret: Pending['caret'] = 'end') {
      setActive(field)
      selection = null
      const element = pageFieldElement(root, field.key)
      if (element) {
        pending = null
        focusField(element, caret, { scroll: 'center' })
      } else pending = { key: field.key, caret }
    },
    restore(root: ParentNode) {
      if (pending) {
        const { key, caret } = pending
        pending = null
        const element = pageFieldElement(root, key)
        if (element) focusField(element, caret, { scroll: 'center' })
        else if (active?.key === key) setActive(null)
        return
      }
      if (!active) return
      const current = window.document.activeElement
      if (current instanceof HTMLElement && current.dataset['fieldKey'] === active.key) return
      // Fokus gdzie indziej (np. pole formularza) – nie zabieramy go; zgubiony (body) – wraca do pola.
      if (current && current !== window.document.body) return
      const element = pageFieldElement(root, active.key)
      if (!element) return
      element.focus({ preventScroll: true })
      if (selection) writeSelection(element, selection)
      element.scrollIntoView({ block: 'nearest' })
    }
  }
}

const noStore = () => () => {}

// Fragment aktywnego pola (null – żadne pole nie jest aktywne); komponent renderuje się tylko przy jego zmianie.
export function useActiveFragment(store: ActiveFieldStore | undefined): string | null {
  return useSyncExternalStore(store?.subscribe ?? noStore, () => store?.get()?.fragment ?? null)
}

function focusField(element: HTMLElement, caret: Pending['caret'], { scroll }: { scroll: 'center' | 'nearest' }) {
  element.focus({ preventScroll: true })
  const position = caret === 'start' ? 0 : (element.textContent ?? '').length
  writeSelection(element, { start: position, end: position })
  element.scrollIntoView({ block: scroll })
}

// Zaznaczenie w polu jako przesunięcia znaków w jego tekście (null – zaznaczenie poza polem).
export function readSelection(element: HTMLElement): TextSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection
  if (!anchorNode || !focusNode || !element.contains(anchorNode) || !element.contains(focusNode)) return null
  return { start: offsetOf(element, anchorNode, anchorOffset), end: offsetOf(element, focusNode, focusOffset) }
}

// Przesunięcie znaków punktu (węzeł, przesunięcie w nim) w tekście pola.
export function offsetOf(element: HTMLElement, node: Node, offset: number): number {
  const range = window.document.createRange()
  range.selectNodeContents(element)
  range.setEnd(node, offset)
  return range.toString().length
}

// Ustawia zaznaczenie w polu z przesunięć znaków (przycięte do długości tekstu).
export function writeSelection(element: HTMLElement, { start, end }: TextSelection) {
  const selection = window.getSelection()
  if (!selection) return
  const [anchor, focus] = [pointAt(element, start), pointAt(element, end)]
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset)
}

function pointAt(element: HTMLElement, position: number): { node: Node; offset: number } {
  const walker = window.document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let remaining = Math.max(0, position)
  let last: Text | null = null
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (remaining <= node.length) return { node, offset: remaining }
    remaining -= node.length
    last = node
  }
  return last ? { node: last, offset: last.length } : { node: element, offset: 0 }
}
