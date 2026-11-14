import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import type { CvEditor } from '../editor/cvEditor'
import type { JoinedFieldsProps, PageFieldProps } from '../template/editable'
import { caretAfterChange, fieldValue, normalizePastedText, pastedLines, replaceSelection, type TextSelection } from './pageFieldInput'
import { fieldChange, isListField, mergeBackward, mergeForward, moveField, pasteLines, splitField, splitsOnEnter, type FieldEdit } from './pageFields'
import type { DatePopoverStore } from './DatePopover'
import { offsetOf, readSelection, writeSelection, type ActiveFieldStore } from './useActiveField'

// Page field (GLOSSARY.md; docs/specs/wysiwyg-editing.md, W5–W8, W19, W22, W24): tekst jednego pola CV edytowany wprost
// na stronie w Edit mode, w elemencie szablonu (slot `CvText`), więc zawija się jak w PDF.
// - Tylko tekst bez formatowania. `contenteditable="true"`, nie `plaintext-only`: Chromium wymusza w polach
//   `plaintext-only` `white-space: pre-wrap` (nowe linie i podwójne spacje widoczne, inne zawijanie niż w PDF), więc
//   czysty tekst pilnują obsługi zdarzeń: `beforeinput` przepuszcza tylko wpisywanie, kasowanie i kompozycję,
//   a element, który przeglądarka mimo to wstawi (np. `<br>` w wyczyszczonym polu), jest spłaszczany do tekstu.
// - Niekontrolowany w trakcie pisania: React rysuje pusty `span`, a tekst wpisuje efekt tylko wtedy, gdy wartość
//   w dokumencie różni się od tekstu pola (cofnij/ponów, zmiana z CV form) – kursor stoi wtedy na końcu zmienionego
//   zakresu. Własne pisanie nigdy nie przepisuje pola, więc kursor nie skacze.
// - `beforeinput`: nowa linia tylko w polach, w których szablon ją pokazuje (`white-space: pre-line`/`pre-wrap`),
//   gdzie indziej Enter przechodzi do następnego pola; cofnij/ponów – historia edytora (natywne cofanie pola nigdy nie
//   działa); formatowanie zablokowane. Wklejanie i upuszczanie (`paste`, `drop`) – czysty tekst ze schowka.
// - Punkty stanowiska i elementy list (W6, W11): Enter dzieli w miejscu kursora, Backspace na początku łączy
//   z poprzednim (pusty – usuwa), Delete na końcu łączy z następnym, wklejenie wielu linii tworzy kolejne elementy.
//   Kontakty: Enter w wartości dodaje za kontaktem nowy (kursor w jego etykiecie), Backspace w pustym kontakcie go usuwa.
//   Każda taka zmiana to osobny krok cofania, a kursor staje we wskazanym polu po nowym podziale stron
//   (`active.expect` – nowe pole powstaje dopiero z nowymi blokami).
// - ⌥⇧↑/↓ przenosi punkt albo element listy o pozycję, a w polu wpisu – cały wpis; kursor zostaje w polu.
// - Strzałki: ←/→ na początku/końcu pola, ↑/↓ w jego pierwszej/ostatniej linii przechodzą do poprzedniego/następnego
//   Page field w kolejności stron (też przez granicę stron, W8). Shift+F10 / klawisz menu otwiera menu uchwytu
//   fragmentu pola (jeśli fragment ma uchwyt, W22).
// - Kompozycja (IME): w trakcie nic nie trafia do edytora i nikt nie przepisuje pola; po niej jedna zmiana.
// - Puste pole pokazuje placeholder (`::before` z `data-placeholder`, pageFields.css) – tylko w odsłoniętym fragmencie,
//   bo tylko tam szablon rysuje pusty element pola.
// W kontenerze pomiarowym (`measuring`) – ten sam tekst i placeholder w zwykłym `span` (ta sama geometria).

// `dates` – otwarty Field popover daty (DatePopover.tsx).
export type PageFieldsContext = { editor: CvEditor; active: ActiveFieldStore; dates: DatePopoverStore }

const Context = createContext<PageFieldsContext | null>(null)
export const PageFieldsProvider = Context.Provider

export function usePageFieldsContext(): PageFieldsContext {
  const context = useContext(Context)
  if (!context) throw new Error('Page field poza PageFieldsProvider')
  return context
}

export function PageField({ field, text, measuring }: PageFieldProps) {
  if (measuring) {
    return (
      <span className="cv-page-field" data-placeholder={field.placeholder}>
        {text}
      </span>
    )
  }
  return <LiveField field={field} text={text} />
}

// Linia złączona z kilku pól poza aktywnym fragmentem (np. „firma – miejscowość” wpisu bez fokusu): ten sam węzeł
// tekstowy co w dokumencie, w jednym `span`. Klik w nią albo fokus z klawiatury (Tab, strzałki) rozwija fragment – jego
// pola stają się osobnymi Page fields – i stawia kursor w polu pod klikniętym znakiem (z Shift+Tab – na końcu
// ostatniego pola). W kontenerze pomiarowym – sam `span` z tekstem (ta sama geometria).
export function JoinedFields({ fields, separator, text, measuring }: JoinedFieldsProps) {
  if (measuring) return <span>{text}</span>
  return <DormantJoined fields={fields} separator={separator} text={text} />
}

function DormantJoined({ fields, separator, text }: Omit<JoinedFieldsProps, 'measuring'>) {
  const context = useContext(Context)
  if (!context) throw new Error('JoinedFields poza PageFieldsProvider')
  const { active } = context
  const element = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const span = element.current
    if (!span) return
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      const point = window.document.caretPositionFromPoint(event.clientX, event.clientY)
      activateJoined(span, point && span.contains(point.offsetNode) ? offsetOf(span, point.offsetNode, point.offset) : 0, active)
    }
    const onFocus = (event: FocusEvent) => {
      // Fokus z dalszego miejsca w dokumencie (Shift+Tab) – kursor na końcu ostatniego pola.
      const from = event.relatedTarget
      const backward = from instanceof Node && from.isConnected && (span.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      activateJoined(span, backward ? (span.textContent ?? '').length : 0, active)
    }
    span.addEventListener('mousedown', onMouseDown)
    span.addEventListener('focus', onFocus)
    return () => {
      span.removeEventListener('mousedown', onMouseDown)
      span.removeEventListener('focus', onFocus)
    }
  }, [active])
  return (
    <span
      ref={element}
      className="cv-page-joined"
      tabIndex={0}
      role="textbox"
      aria-label={fields.map((field) => field.label).join(', ')}
      data-fragment={fields[0]?.fragment}
      data-joined={JSON.stringify(fields.map((field) => [field.key, field.value.length]))}
      data-separator={separator.length}
    >
      {text}
    </span>
  )
}

// Rozwija fragment linii złączonej `span` i stawia kursor w polu pod znakiem `offset` tej linii (w separatorze – na
// bliższym brzegu sąsiedniego pola). Fokus pole dostaje po przerysowaniu stron z rozwiniętym fragmentem.
export function activateJoined(span: HTMLElement, offset: number, active: ActiveFieldStore) {
  const target = joinedTarget(span, offset)
  const fragment = span.dataset['fragment']
  if (!target || fragment === undefined) return
  active.expect({ key: target.key, fragment }, { start: target.caret, end: target.caret })
}

// Pole linii złączonej `span` pod znakiem `offset` i miejsce w nim (null – linia bez pól).
export function joinedTarget(span: HTMLElement, offset: number): { key: string; caret: number } | null {
  const parts = JSON.parse(span.dataset['joined'] ?? '[]') as [string, number][]
  const separator = Number(span.dataset['separator'] ?? 0)
  if (parts.length === 0) return null
  let start = 0
  for (const [index, [key, length]] of parts.entries()) {
    const end = start + length
    const nextStart = end + separator
    if (offset <= end || index === parts.length - 1) return { key, caret: Math.max(0, Math.min(offset - start, length)) }
    if (offset < nextStart && offset - end <= nextStart - offset) return { key, caret: length }
    start = nextStart
  }
  return { key: parts[0]![0], caret: 0 }
}

const multilineWhiteSpace = new Set(['pre', 'pre-line', 'pre-wrap', 'break-spaces'])
// Wielowierszowe jest pole, w którym szablon pokazuje nową linię (podsumowanie w Modern i Bold, nie w Classic).
const isMultiline = (element: HTMLElement) => multilineWhiteSpace.has(getComputedStyle(element).whiteSpace)

function LiveField({ field, text }: Omit<PageFieldProps, 'measuring'>) {
  const context = useContext(Context)
  if (!context) throw new Error('PageField poza PageFieldsProvider')
  const { editor, active } = context
  const element = useRef<HTMLSpanElement>(null)
  const composing = useRef(false)
  // Bieżące pole dla obsługi zdarzeń (podpięte raz, natywnie – `beforeinput` niesie `inputType` tylko natywnie).
  const latest = useRef(field)
  useEffect(() => {
    latest.current = field
  })

  // Tekst z dokumentu do pola – tylko gdy się różni (i nigdy w trakcie kompozycji).
  useLayoutEffect(() => {
    const span = element.current
    if (!span || composing.current || fieldValue(span.textContent ?? '') === fieldValue(text)) return
    const previous = span.textContent ?? ''
    span.textContent = text
    // Po zmianie struktury kursor ustawi przywrócenie fokusu po nowym podziale stron (`active.expect`).
    if (window.document.activeElement === span && !active.isPending(field.key)) {
      const caret = caretAfterChange(previous, text)
      writeSelection(span, { start: caret, end: caret })
      active.setSelection({ start: caret, end: caret })
    }
  })

  // Obsługa zdarzeń podpięta przed malowaniem: nowe pole (np. punkt z podziału) dostaje fokus z przywrócenia po podziale
  // stron w tym samym commicie (`CvPages` – efekt rodzica, po efektach pól) i musi już słyszeć `focus`.
  useLayoutEffect(() => {
    const span = element.current
    if (!span) return
    const current = () => ({ key: latest.current.key, fragment: latest.current.fragment })

    // Zaznaczenie zapamiętane od razu (`selectionchange` przychodzi później): klawisz, który zmienia dokument (⌘Z),
    // może przemontować pole jeszcze w tym samym zadaniu.
    const rememberSelection = () => {
      const selection = readSelection(span)
      if (selection) active.setSelection(selection)
    }
    // Nowa wartość pola do dokumentu, z kluczem łączenia kroków cofania pola (te same kroki co w CV form).
    const commit = () => {
      flatten(span)
      const value = fieldValue(span.textContent ?? '')
      rememberSelection()
      editor.edit(fieldChange(latest.current.key, value), latest.current.key)
    }
    // Wstawia tekst w miejsce zaznaczenia (albo `range`) sami, bez przeglądarki.
    const insert = (insertText: string, range?: TextSelection | null) => {
      const selection = range ?? readSelection(span)
      if (!selection) return
      const next = replaceSelection(span.textContent ?? '', selection, insertText)
      span.textContent = next.value
      writeSelection(span, { start: next.caret, end: next.caret })
      commit()
    }
    const documentNow = () => editor.store.getState().document
    // Zmiana struktury: osobny krok cofania (bez klucza łączenia), kursor we wskazanym polu po nowym podziale stron.
    const restructure = (edit: FieldEdit | null) => {
      if (!edit) return false
      active.expect({ key: edit.focus.key, fragment: latest.current.fragment }, { start: edit.focus.caret, end: edit.focus.caret })
      editor.edit(edit.change)
      return true
    }
    // Wklejony albo upuszczony tekst: w punkcie i elemencie listy wiele linii to kolejne elementy (W6).
    const paste = (text: string, range?: TextSelection | null) => {
      if (!isListField(latest.current.key)) {
        insert(normalizePastedText(text, isMultiline(span)), range)
        return
      }
      const lines = pastedLines(text)
      const selection = range ?? readSelection(span)
      if (lines.length < 2 || !selection) {
        if (lines.length > 0) insert(lines.join(' '), range)
        return
      }
      restructure(pasteLines(latest.current.key, documentNow(), selection, lines))
    }

    const onBeforeInput = (event: InputEvent) => {
      const type = event.inputType
      if (type === 'historyUndo' || type === 'historyRedo') {
        event.preventDefault()
        if (type === 'historyUndo') editor.undo()
        else editor.redo()
      } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
        event.preventDefault()
        if (splitsOnEnter(latest.current.key)) {
          // Enter dzieli punkt albo element listy, a w wartości kontaktu dodaje za nim nowy kontakt; Shift+Enter nic nie
          // robi (szablon nie pokazuje w nich nowej linii).
          const selection = readSelection(span)
          if (type === 'insertParagraph' && selection) restructure(splitField(latest.current.key, documentNow(), selection))
        } else if (isMultiline(span)) insert('\n')
        else focusNextField(span, active)
      } else if (!plainTextInput(type)) {
        // Formatowanie, listy, linki; wklejanie i upuszczanie obsługują `paste` i `drop` (czysty tekst ze schowka).
        event.preventDefault()
      }
    }
    // Wklejenie: zawsze `text/plain` ze schowka, znormalizowany (W6).
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault()
      const pasted = event.clipboardData?.getData('text/plain') ?? ''
      if (pasted) paste(pasted)
    }
    // Upuszczenie tekstu działa jak wklejenie w miejscu upuszczenia; upuszczenie pliku – nic.
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const dropped = event.dataTransfer?.types.includes('Files') ? '' : (event.dataTransfer?.getData('text/plain') ?? '')
      if (!dropped) return
      const point = window.document.caretPositionFromPoint(event.clientX, event.clientY)
      const at = point && span.contains(point.offsetNode) ? offsetOf(span, point.offsetNode, point.offset) : (span.textContent ?? '').length
      span.focus({ preventScroll: true })
      paste(dropped, { start: at, end: at })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      rememberSelection()
      if (event.isComposing || event.keyCode === 229) return
      const key = latest.current.key
      // ⌥⇧↑/↓ – ten sam skrót co w CV form i na uchwycie (editor/moveShortcut.ts).
      const move =
        event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey
          ? event.key === 'ArrowUp'
            ? -1
            : event.key === 'ArrowDown'
              ? 1
              : undefined
          : undefined
      if (move) {
        event.preventDefault()
        const change = moveField(key, documentNow(), move)
        const selection = readSelection(span)
        if (change && selection) {
          active.expect({ key, fragment: latest.current.fragment }, selection)
          editor.edit(change)
        }
        return
      }
      if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
        const handle = fragmentHandle(span, latest.current.fragment)
        if (handle) {
          event.preventDefault()
          handle.click()
        }
        return
      }
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      const selection = readSelection(span)
      if (!selection || selection.start !== selection.end) return
      const length = (span.textContent ?? '').length
      const atStart = selection.start === 0
      const atEnd = selection.start === length
      if (event.key === 'Backspace' && atStart) {
        if (restructure(mergeBackward(key, documentNow()))) event.preventDefault()
      } else if (event.key === 'Delete' && atEnd) {
        if (restructure(mergeForward(key, documentNow()))) event.preventDefault()
      } else if ((event.key === 'ArrowLeft' && atStart) || (event.key === 'ArrowUp' && onEdgeLine(span, 'first'))) {
        if (focusSibling(span, -1, event.key === 'ArrowUp', active)) event.preventDefault()
      } else if ((event.key === 'ArrowRight' && atEnd) || (event.key === 'ArrowDown' && onEdgeLine(span, 'last'))) {
        if (focusSibling(span, 1, event.key === 'ArrowDown', active)) event.preventDefault()
      }
    }
    const onInput = (event: Event) => {
      if (composing.current || (event as InputEvent).isComposing) return
      commit()
    }
    const onCompositionStart = () => {
      composing.current = true
    }
    const onCompositionEnd = () => {
      composing.current = false
      commit()
    }
    const onFocus = () => active.focused(current(), span)

    span.addEventListener('beforeinput', onBeforeInput)
    span.addEventListener('input', onInput)
    span.addEventListener('compositionstart', onCompositionStart)
    span.addEventListener('compositionend', onCompositionEnd)
    span.addEventListener('focus', onFocus)
    span.addEventListener('keydown', onKeyDown)
    span.addEventListener('pointerup', rememberSelection)
    span.addEventListener('paste', onPaste)
    span.addEventListener('drop', onDrop)
    return () => {
      span.removeEventListener('beforeinput', onBeforeInput)
      span.removeEventListener('input', onInput)
      span.removeEventListener('compositionstart', onCompositionStart)
      span.removeEventListener('compositionend', onCompositionEnd)
      span.removeEventListener('focus', onFocus)
      span.removeEventListener('keydown', onKeyDown)
      span.removeEventListener('pointerup', rememberSelection)
      span.removeEventListener('paste', onPaste)
      span.removeEventListener('drop', onDrop)
    }
  }, [editor, active])

  return (
    <span
      ref={element}
      className="cv-page-field"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={field.label}
      aria-placeholder={field.placeholder}
      data-field-key={field.key}
      data-fragment={field.fragment}
      data-placeholder={field.placeholder}
      spellCheck={field.spellcheck}
    />
  )
}

// Zmiany, które przeglądarka robi sama: wpisywanie (także poprawka pisowni i kompozycja) i kasowanie.
const plainTextInput = (type: string) =>
  type === 'insertText' || type === 'insertReplacementText' || type === 'insertCompositionText' || type.startsWith('delete')

// Pole to jeden węzeł tekstowy (albo nic – placeholder `:empty`): element wstawiony przez przeglądarkę (np. `<br>`
// w wyczyszczonym polu) jest zastępowany samym tekstem, z zachowanym kursorem.
function flatten(span: HTMLElement) {
  const only = span.firstChild
  if (span.childNodes.length === 1 && only?.nodeType === Node.TEXT_NODE && only.textContent !== '') return
  if (span.childNodes.length === 0) return
  const selection = readSelection(span)
  const text = span.textContent ?? ''
  span.replaceChildren(...(text === '' ? [] : [text]))
  if (selection && window.document.activeElement === span) writeSelection(span, selection)
}

// Page fields, żetony dat i linie złączone (poza aktywnym fragmentem) stron w kolejności dokumentu (= kolejność czytania
// szablonu, przez granice stron).
function pageFields(span: HTMLElement): HTMLElement[] {
  const root = span.closest('.cv-pages')
  return root ? [...root.querySelectorAll<HTMLElement>('[data-field-key], [data-joined]')] : []
}

// Kursor w polu `target` (albo w polu linii złączonej pod znakiem `caret`).
function focusAt(target: HTMLElement, caret: number, active: ActiveFieldStore) {
  if (target.dataset['joined'] !== undefined) {
    activateJoined(target, caret, active)
    return
  }
  target.focus({ preventScroll: true })
  // Żeton daty to przycisk – bez kursora tekstowego.
  if (target.isContentEditable) writeSelection(target, { start: caret, end: caret })
  target.scrollIntoView({ block: 'nearest' })
}

// Enter w polu jednowierszowym: następne Page field w kolejności dokumentu (też na kolejnej stronie), kursor na początku.
export function focusNextField(span: HTMLElement, active: ActiveFieldStore) {
  const fields = pageFields(span)
  const next = fields[fields.indexOf(span) + 1]
  if (next) focusAt(next, 0, active)
}

// Prostokąt kursora (zwiniętego zaznaczenia) w oknie; null – przeglądarka go nie zna (np. puste pole).
function caretRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(false)
  const rect = range.getClientRects()[0]
  return rect && rect.height > 0 ? rect : null
}

// Czy kursor stoi w pierwszej (ostatniej) linii pola – wtedy ↑ (↓) wychodzi z pola. Linie pola (element `inline`) to
// jego prostokąty; puste pole ma jedną linię.
function onEdgeLine(span: HTMLElement, edge: 'first' | 'last'): boolean {
  const lines = [...span.getClientRects()].filter((rect) => rect.height > 0)
  const caret = caretRect()
  if (lines.length <= 1 || !caret) return true
  const middle = (caret.top + caret.bottom) / 2
  return edge === 'first' ? middle < lines[0]!.bottom : middle > lines.at(-1)!.top
}

// ←/→, ↑/↓ na krawędzi pola: poprzednie (`-1`) albo następne (`1`) Page field. Strzałka w pionie zachowuje położenie
// kursora w poziomie (kursor w ostatniej linii poprzedniego / pierwszej linii następnego pola), w poziomie – kursor
// na końcu poprzedniego / początku następnego.
export function focusSibling(span: HTMLElement, direction: -1 | 1, vertical: boolean, active: ActiveFieldStore): boolean {
  const fields = pageFields(span)
  const target = fields[fields.indexOf(span) + direction]
  if (!target) return false
  const length = (target.textContent ?? '').length
  let caret = direction === -1 ? length : 0
  const from = vertical ? caretRect() : null
  const lines = [...target.getClientRects()].filter((rect) => rect.height > 0)
  const line = direction === -1 ? lines.at(-1) : lines[0]
  if (from && line) {
    const x = Math.min(Math.max(from.left, line.left + 1), line.right - 1)
    const point = window.document.caretPositionFromPoint(x, (line.top + line.bottom) / 2)
    if (point && target.contains(point.offsetNode)) caret = offsetOf(target, point.offsetNode, point.offset)
  }
  focusAt(target, caret, active)
  return true
}

// Uchwyt menu fragmentu pola w warstwie edycji (tytuł sekcji, wpis) – Shift+F10 z pola go „klika”.
export function fragmentHandle(span: HTMLElement, fragment: string): HTMLButtonElement | null {
  const panel = span.closest('.preview')
  return panel?.querySelector<HTMLButtonElement>(`.edit-layer .edit-handle[data-fragment="${CSS.escape(fragment)}"] .row-handle`) ?? null
}
