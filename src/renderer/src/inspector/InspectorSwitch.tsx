import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { setPhotoHidden } from '../editor/documentEdits'

// Przełącznik w panelu elementu Inspektora (np. „Pokaż na CV”, „Zacznij od nowej strony”): napis i przełącznik
// w jednym wierszu, nazwa przełącznika z napisu. Wygląd jak przełączniki listy „CV elements”.
// `part` – rodzaj części CV, której widoczność przełącza (`data-switch`; np. PHOTO_SWITCH_SELECTOR w CvElements.tsx).
export function InspectorSwitch({
  label,
  checked,
  onChange,
  part
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  part?: string
}) {
  return (
    <label className="inspector-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        className="cv-element-switch"
        data-switch={part}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

// Przełącznik „Pokaż na CV” zdjęcia – na liście „CV elements”, w panelu nagłówka i w panelu zdjęcia: włączony, gdy
// zdjęcie jest na CV; wyłączenie ukrywa zdjęcie, zachowując obraz (jeden krok cofania). Bez zdjęcia – undefined.
export function photoShown(editor: CvEditor, document: CvDocument) {
  const { photo } = document.header
  if (!photo) return undefined
  return { checked: !photo.hidden, onChange: (shown: boolean) => editor.edit(setPhotoHidden(!shown)) }
}

// `photoShown` jako przełącznik panelu elementu; bez zdjęcia nic.
export function PhotoSwitch({ editor, document, label }: { editor: CvEditor; document: CvDocument; label: string }) {
  const shown = photoShown(editor, document)
  return shown ? <InspectorSwitch label={label} part="photo" {...shown} /> : null
}
