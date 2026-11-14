import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import { FieldPopover } from './FieldPopover'
import { fieldChange, pageFieldByKey } from './pageFields'
import { pageFieldElement, type ActiveFieldStore } from './useActiveField'

// Podpowiedzi etykiety kontaktu na stronie (docs/specs/wysiwyg-editing.md, W14): w CV form – `datalist`, na stronie –
// lista `role="listbox"` w Field popover pod polem etykiety z fokusem. Pole etykiety jest combobox z
// `aria-autocomplete="list"` (PageField.tsx): fokus zostaje w nim, a lista jest filtrowana tym, co wpisano. ↑/↓ wybierają
// podpowiedź (`aria-activedescendant`), Enter ją wstawia (osobny krok cofania), Escape i klik obok chowają listę do
// kolejnej zmiany tekstu; klik w podpowiedź wstawia ją bez zabierania fokusu polu. `aria-expanded`
// i `aria-activedescendant` pola ustawia ten komponent – jedyny, który wie, czy lista jest otwarta.

// Etykiety z treści domyślnej zaczynające się od wpisanego tekstu (bez wielkości liter i białych znaków na brzegach);
// bez etykiety równej wpisanej – nie ma czego podpowiadać.
export function labelSuggestions(labels: readonly string[], typed: string): string[] {
  const query = typed.trim().toLocaleLowerCase()
  return labels.filter((label) => {
    const candidate = label.toLocaleLowerCase()
    return candidate.startsWith(query) && candidate !== query
  })
}

export const isContactLabel = (key: string) => /^contact:.+:label$/.test(key)

// Id listy podpowiedzi pola etykiety `key` (`aria-controls` pola).
export const suggestionsId = (key: string) => `suggestions-${key.replace(/[^\w-]/g, '-')}`

export function ContactLabelSuggestions({
  editor,
  document,
  active
}: {
  editor: CvEditor
  document: CvDocument
  active: ActiveFieldStore
}) {
  const { editor: t, defaultContent } = useDictionary()
  const key = useSyncExternalStore(active.subscribe, () => active.get()?.key ?? null)
  if (key === null || !isContactLabel(key)) return null
  const field = pageFieldByKey(key, document, t)
  if (!field) return null
  return <SuggestionList key={key} fieldKey={key} label={field.label} value={field.value} labels={defaultContent.contactLabels} editor={editor} />
}

function SuggestionList({
  fieldKey,
  label,
  value,
  labels,
  editor
}: {
  fieldKey: string
  label: string
  value: string
  labels: readonly string[]
  editor: CvEditor
}) {
  const options = labelSuggestions(labels, value)
  // Tekst pola, przy którym listę schowano (Escape, klik obok) – wraca po zmianie tekstu.
  const [dismissed, setDismissed] = useState<string | null>(null)
  // Wybrana podpowiedź – dla tej samej listy podpowiedzi (nowa lista zaczyna bez wyboru).
  const signature = options.join('\n')
  const [selection, setSelection] = useState({ signature, index: -1 })
  const index = selection.signature === signature ? selection.index : -1
  const open = options.length > 0 && dismissed !== value
  const listId = suggestionsId(fieldKey)
  const optionId = (position: number) => `${listId}-${position}`
  const field = () => pageFieldElement(window.document, fieldKey)

  const choose = (option: string) => editor.edit(fieldChange(fieldKey, option))

  // Stan listy na polu (combobox).
  useLayoutEffect(() => {
    const element = field()
    if (!element) return
    element.setAttribute('aria-expanded', String(open))
    if (open && index >= 0) element.setAttribute('aria-activedescendant', optionId(index))
    else element.removeAttribute('aria-activedescendant')
  })
  useEffect(
    () => () => {
      const element = field()
      element?.setAttribute('aria-expanded', 'false')
      element?.removeAttribute('aria-activedescendant')
    },
    []
  )

  // Klawisze w polu, zanim obsłuży je samo pole (↑/↓ wyszłyby z pola, Enter przeszedłby do wartości).
  const latest = useRef({ open, options, index, value, signature })
  useLayoutEffect(() => {
    latest.current = { open, options, index, value, signature }
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (!current.open || event.target !== field() || event.isComposing || event.keyCode === 229) return
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      const count = current.options.length
      const select = (next: number) => setSelection({ signature: current.signature, index: next })
      if (event.key === 'ArrowDown') select((current.index + 1) % count)
      else if (event.key === 'ArrowUp') select(current.index <= 0 ? count - 1 : current.index - 1)
      else if (event.key === 'Enter' && current.index >= 0) choose(current.options[current.index]!)
      else if (event.key === 'Escape') setDismissed(current.value)
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.document.addEventListener('keydown', onKeyDown, true)
    return () => window.document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  if (!open) return null
  return (
    <FieldPopover
      anchor={field}
      id={listId}
      label={label}
      role="listbox"
      className="field-popover--suggestions"
      focusOnShow={false}
      onClose={() => setDismissed(value)}
    >
      {options.map((option, position) => (
        <div
          key={option}
          id={optionId(position)}
          role="option"
          aria-selected={position === index}
          className="field-popover-option"
          // Bez zabierania fokusu polu etykiety.
          onMouseDown={(event) => {
            event.preventDefault()
            choose(option)
          }}
        >
          {option}
        </div>
      ))}
    </FieldPopover>
  )
}
