import { useEffect, useRef, useState } from 'react'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { updateHeader } from '../editor/documentEdits'
import { usePhotoPicker } from '../editor/fields/PhotoField'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { FieldPopover, focusAfter } from './FieldPopover'
import type { Fragment } from './fragmentRects'

// Zdjęcie na stronie w Edit mode (docs/specs/wysiwyg-editing.md, W13): nad `img.cv-photo` leży w warstwie edycji
// przezroczysty przycisk „Photo”, a klik, Enter albo spacja otwiera przy nim Field popover zdjęcia: „Change photo”
// (wybór pliku i kadrowanie), „Crop photo” (ponowne kadrowanie zdjęcia z CV) i „Remove photo” (z „Removed. Undo”).
// Okno kadrowania zostaje modalnym `dialog` jak w CV form (`usePhotoPicker`); po nim fokus wraca na przycisk, który je
// otworzył. Escape zamyka popover i wraca na przycisk zdjęcia; „Undo” po usunięciu – też na niego, gdy wróci na stronę.
// `button(fragment)` – przycisk zdjęcia na jego fragmencie (warstwa rysuje go w kolejności fragmentów, czyli czytania
// strony); `popover` – otwarty Field popover zdjęcia albo nic.
export function usePhotoEditing({
  editor,
  photo,
  onRemove,
  onFocusLost
}: {
  editor: CvEditor
  photo: CvDocument['header']['photo']
  onRemove: RemoveWithUndo
  onFocusLost: () => void
}) {
  const t = useDictionary().editor.photo
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement | null>(null)
  const shown = open && photo !== null

  // Po „Undo” usunięcia fokus na przycisku zdjęcia, gdy zdjęcie znów jest na stronie (po pomiarze fragmentów).
  const focusWhenBack = useRef(false)
  const onButton = (element: HTMLButtonElement | null) => {
    button.current = element
    if (element && focusWhenBack.current) {
      focusWhenBack.current = false
      element.focus()
    }
  }
  useEffect(() => {
    if (open && !photo) setOpen(false)
  }, [open, photo])

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) button.current?.focus()
  }
  const remove = () => {
    setOpen(false)
    onRemove(updateHeader({ photo: null }), {
      entryId: 'photo',
      listId: 'photo',
      restore: () => {
        focusWhenBack.current = true
      }
    })
    onFocusLost()
  }

  const photoButton = ({ key, page, rect }: Fragment) => (
    <button
      ref={onButton}
      type="button"
      className="edit-photo"
      data-fragment={key}
      data-page={page}
      aria-haspopup="dialog"
      aria-expanded={shown}
      style={{ top: rect.top, left: rect.left, width: rect.right - rect.left, height: rect.bottom - rect.top }}
      onClick={() => setOpen((current) => !current)}
    >
      {/* Nazwa z (ukrytej) treści – jak przyciski fragmentów: `getByLabel('Photo')` wskazuje tylko pola formularza. */}
      <span className="visually-hidden">{t.legend}</span>
    </button>
  )
  const popover = shown && <PhotoPanel editor={editor} dataUrl={photo.dataUrl} anchor={() => button.current} onClose={close} onRemove={remove} />
  return { button: photoButton, popover }
}

function PhotoPanel({
  editor,
  dataUrl,
  anchor,
  onClose,
  onRemove
}: {
  editor: CvEditor
  dataUrl: string
  anchor: () => HTMLElement | null
  onClose: (returnFocus: boolean) => void
  onRemove: () => void
}) {
  const t = useDictionary().editor.photo
  // Przycisk, który otworzył okno kadrowania – po jego zamknięciu wraca na niego fokus.
  const opener = useRef<HTMLButtonElement | null>(null)
  const { pick, crop, error, cropper } = usePhotoPicker(editor, { onCropEnd: () => opener.current?.focus() })
  const tabOut = (backward: boolean) => {
    onClose(true)
    const element = anchor()
    if (!backward && element) focusAfter(element)
  }

  return (
    <FieldPopover anchor={anchor} label={t.legend} className="field-popover--menu" onClose={onClose} onTabOut={tabOut}>
      <button
        type="button"
        onClick={(event) => {
          opener.current = event.currentTarget
          void pick()
        }}
      >
        {t.change}
      </button>
      <button
        type="button"
        onClick={(event) => {
          opener.current = event.currentTarget
          void crop(dataUrl)
        }}
      >
        {t.crop}
      </button>
      <button type="button" className="danger" onClick={onRemove}>
        {t.remove}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {t.errors[error]}
        </p>
      )}
      {cropper}
    </FieldPopover>
  )
}
