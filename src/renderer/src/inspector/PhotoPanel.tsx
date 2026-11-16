import { setPhotoHidden } from '../editor/documentEdits'
import { useDictionary } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'

// Panel zdjęcia Inspektora – zaślepka (#139): na razie tylko „Pokaż na CV” (tu wraca fokus po „Ukryj zdjęcie”
// w popoverze zdjęcia). Zmień / Kadruj / Usuń i „Dodaj zdjęcie” dodaje #141. Bez zdjęcia zaznaczenie zdjęcia wraca do
// panelu „Dokument” (selection.ts).
export function PhotoPanel({ editor, document }: PanelProps) {
  const t = useDictionary().editor.inspector
  const { photo } = document.header
  if (!photo) return null
  return (
    <InspectorSwitch
      label={t.showOnCv}
      part="photo"
      checked={!photo.hidden}
      onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
    />
  )
}
