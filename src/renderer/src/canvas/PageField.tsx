import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import type { CvEditor } from '../editor/cvEditor'
import type { PageFieldProps } from '../template/editable'
import { caretAfterChange, fieldValue, normalizePastedText, replaceSelection, type TextSelection } from './pageFieldInput'
import { fieldChange } from './pageFields'
import { offsetOf, PAGE_FIELD_SELECTOR, readSelection, writeSelection, type ActiveFieldStore } from './useActiveField'

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
// - Kompozycja (IME): w trakcie nic nie trafia do edytora i nikt nie przepisuje pola; po niej jedna zmiana.
// - Puste pole pokazuje placeholder (`::before` z `data-placeholder`, pageFields.css) – tylko w odsłoniętym fragmencie,
//   bo tylko tam szablon rysuje pusty element pola.
// W kontenerze pomiarowym (`measuring`) – ten sam tekst i placeholder w zwykłym `span` (ta sama geometria).

export type PageFieldsContext = { editor: CvEditor; active: ActiveFieldStore }

const Context = createContext<PageFieldsContext | null>(null)
export const PageFieldsProvider = Context.Provider

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
    if (window.document.activeElement === span) {
      const caret = caretAfterChange(previous, text)
      writeSelection(span, { start: caret, end: caret })
      active.setSelection({ start: caret, end: caret })
    }
  })

  useEffect(() => {
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

    const onBeforeInput = (event: InputEvent) => {
      const type = event.inputType
      if (type === 'historyUndo' || type === 'historyRedo') {
        event.preventDefault()
        if (type === 'historyUndo') editor.undo()
        else editor.redo()
      } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
        event.preventDefault()
        if (isMultiline(span)) insert('\n')
        else focusNextField(span)
      } else if (!plainTextInput(type)) {
        // Formatowanie, listy, linki; wklejanie i upuszczanie obsługują `paste` i `drop` (czysty tekst ze schowka).
        event.preventDefault()
      }
    }
    // Wklejenie: zawsze `text/plain` ze schowka, znormalizowany (W6).
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault()
      const pasted = event.clipboardData?.getData('text/plain') ?? ''
      if (pasted) insert(normalizePastedText(pasted, isMultiline(span)))
    }
    // Upuszczenie tekstu działa jak wklejenie w miejscu upuszczenia; upuszczenie pliku – nic.
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const dropped = event.dataTransfer?.types.includes('Files') ? '' : (event.dataTransfer?.getData('text/plain') ?? '')
      if (!dropped) return
      const point = window.document.caretPositionFromPoint(event.clientX, event.clientY)
      const at = point && span.contains(point.offsetNode) ? offsetOf(span, point.offsetNode, point.offset) : (span.textContent ?? '').length
      span.focus({ preventScroll: true })
      insert(normalizePastedText(dropped, isMultiline(span)), { start: at, end: at })
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
    const onBlur = () => active.blurred(current())

    span.addEventListener('beforeinput', onBeforeInput)
    span.addEventListener('input', onInput)
    span.addEventListener('compositionstart', onCompositionStart)
    span.addEventListener('compositionend', onCompositionEnd)
    span.addEventListener('focus', onFocus)
    span.addEventListener('blur', onBlur)
    span.addEventListener('keydown', rememberSelection)
    span.addEventListener('pointerup', rememberSelection)
    span.addEventListener('paste', onPaste)
    span.addEventListener('drop', onDrop)
    return () => {
      span.removeEventListener('beforeinput', onBeforeInput)
      span.removeEventListener('input', onInput)
      span.removeEventListener('compositionstart', onCompositionStart)
      span.removeEventListener('compositionend', onCompositionEnd)
      span.removeEventListener('focus', onFocus)
      span.removeEventListener('blur', onBlur)
      span.removeEventListener('keydown', rememberSelection)
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

// Enter w polu jednowierszowym: następne Page field w kolejności dokumentu (też na kolejnej stronie), kursor na początku.
function focusNextField(span: HTMLElement) {
  const root = span.closest('.cv-pages')
  if (!root) return
  const fields = [...root.ownerDocument.querySelectorAll<HTMLElement>(PAGE_FIELD_SELECTOR)].filter((candidate) => root.contains(candidate))
  const next = fields[fields.indexOf(span) + 1]
  if (!next) return
  next.focus({ preventScroll: true })
  writeSelection(next, { start: 0, end: 0 })
  next.scrollIntoView({ block: 'nearest' })
}
