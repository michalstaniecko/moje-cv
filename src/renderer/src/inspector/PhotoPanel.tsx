import { useEffect, useRef, useState } from 'react'
import type { EditSession } from '../canvas/useEditSession'
import { setPhotoHidden, updateHeader } from '../editor/documentEdits'
import { usePhotoPicker } from '../editor/fields/PhotoField'
import { useDictionary } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'

// „Remove photo” w panelu zdjęcia – tu wraca fokus po „Undo” w komunikacie „Removed.”.
const REMOVE_SELECTOR = '.inspector [data-photo-action="remove"]'

// Panel zdjęcia Inspektora (#141) – te same akcje co Field popover zdjęcia na stronie (canvas/PhotoPopover.tsx):
// - ze zdjęciem: miniatura, „Change photo” (wybór pliku i kadrowanie), „Crop photo” (ponowne kadrowanie – to samo okno
//   co na stronie, `usePhotoPicker`; po nim fokus wraca na przycisk, który je otworzył), „Remove photo” (z „Removed.
//   Undo” jak na stronie; fokus na „Add photo”, a po „Undo” – z powrotem na „Remove photo”) i „Show on CV” (ukrycie
//   zachowuje obraz; tu wraca fokus po „Hide photo” w popoverze);
// - bez zdjęcia: „Add photo” jak pasek „Add to CV”.
export function PhotoPanel({ editor, document, session, onRemove }: PanelProps) {
  const t = useDictionary().editor
  const { photo } = document.header
  // Przycisk, który otworzył okno kadrowania – po jego zamknięciu wraca na niego fokus.
  const opener = useRef<HTMLButtonElement | null>(null)
  const { pick, crop, error, cropper } = usePhotoPicker(editor, { onCropEnd: () => opener.current?.focus() })
  // Zdjęcie usunięte w tym panelu: fokus na „Add photo”, który zajmuje miejsce przycisków.
  const [removed, setRemoved] = useState(false)
  useEffect(() => {
    if (photo && removed) setRemoved(false)
  }, [photo, removed])

  if (!photo) return <AddPhotoButton session={session} autoFocus={removed} />

  const remove = () => {
    setRemoved(true)
    onRemove(updateHeader({ photo: null }), {
      entryId: 'photo',
      listId: 'photo',
      // Panel zamknięty w międzyczasie – fokus na zdjęciu na stronie.
      restore: () => {
        const button = window.document.querySelector<HTMLElement>(REMOVE_SELECTOR)
        if (button) button.focus()
        else session.photo.focus()
      }
    })
  }

  return (
    <>
      <div className="inspector-field">
        <img className="inspector-photo" src={photo.dataUrl} alt={t.photo.thumbnail} />
        <div className="inspector-actions">
          <button
            type="button"
            onClick={(event) => {
              opener.current = event.currentTarget
              void pick()
            }}
          >
            {t.photo.change}
          </button>
          <button
            type="button"
            onClick={(event) => {
              opener.current = event.currentTarget
              void crop(photo.dataUrl)
            }}
          >
            {t.photo.crop}
          </button>
          <button type="button" className="danger" data-photo-action="remove" onClick={remove}>
            {t.photo.remove}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {t.photo.errors[error]}
          </p>
        )}
      </div>
      <InspectorSwitch
        label={t.inspector.showOnCv}
        part="photo"
        checked={!photo.hidden}
        onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
      />
      {cropper}
    </>
  )
}

// „Add photo” (panel zdjęcia i panel nagłówka bez zdjęcia): to samo co „Photo” w pasku „Add to CV” – od razu wybór
// pliku i okno kadrowania; po zatwierdzeniu fokus na zdjęciu na stronie, po anulowaniu wraca tu, a pliku, którego nie
// da się wczytać, dotyczy komunikat przy tym przycisku (photoRequests.ts). Tu wraca też fokus po anulowanym wyborze
// zdjęcia z wiersza „Photo” listy „CV elements” (Inspector.tsx).
export function AddPhotoButton({ session, autoFocus = false }: { session: EditSession; autoFocus?: boolean }) {
  const t = useDictionary().editor.inspector.photo
  const button = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={button}
      type="button"
      className="inspector-action"
      data-photo-action="add"
      autoFocus={autoFocus}
      onClick={() => session.photo.add(() => (button.current?.isConnected ? button.current : null))}
    >
      {t.add}
    </button>
  )
}
