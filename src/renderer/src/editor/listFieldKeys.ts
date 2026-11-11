import type { KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { textSplit, type TextSplit } from './documentEdits'

type ListField = HTMLInputElement | HTMLTextAreaElement

// Enter i Backspace w punktach stanowiska i elementach sekcji-listy, jak w edytorze tekstu:
// - Enter dzieli element w miejscu kursora (zaznaczenie znika), a fokus idzie na początek nowego elementu pod spodem;
//   w pustym elemencie (także z samych spacji) nic nie robi,
// - Shift+Enter łamie wiersz w polu wielowierszowym (`multiline`), a w jednowierszowym nic nie robi,
// - Backspace w pustym elemencie, który nie jest pierwszy (`previousId`), usuwa go bez „Usunięto. Cofnij” (`remove`)
//   i przenosi fokus na koniec poprzedniego.
// Zmiana dokumentu idzie bez klucza scalania, więc jest osobnym krokiem cofania, nie częścią wcześniejszego pisania.
export function handleListFieldKeyDown(
  event: KeyboardEvent<ListField>,
  {
    multiline,
    previousId,
    split,
    remove
  }: { multiline: boolean; previousId: string | undefined; split: (at: TextSplit) => void; remove: () => void }
) {
  // Klawisz w trakcie kompozycji znaków (IME, klawisz martwy) należy do kompozycji.
  if (event.nativeEvent.isComposing || event.keyCode === 229) return
  if (event.altKey || event.metaKey || event.ctrlKey) return
  const field = event.currentTarget
  const empty = field.value.trim() === ''

  if (event.key === 'Enter') {
    if (event.shiftKey && multiline) return
    event.preventDefault()
    if (event.shiftKey || empty) return
    const at = textSplit(field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length)
    flushSync(() => split(at))
    focusEntryField(at.newItemId, 'start')
  } else if (event.key === 'Backspace' && !event.shiftKey && empty && previousId !== undefined) {
    event.preventDefault()
    flushSync(remove)
    focusEntryField(previousId, 'end')
  }
}

// Fokus na polu tekstowym wiersza listy (`data-entry-id`) z kursorem na początku albo na końcu.
function focusEntryField(entryId: string, caret: 'start' | 'end') {
  const field = window.document
    .querySelector(`[data-entry-id="${CSS.escape(entryId)}"]`)
    ?.querySelector<ListField>('input, textarea')
  if (!field) return
  field.focus()
  const position = caret === 'start' ? 0 : field.value.length
  field.setSelectionRange(position, position)
}
