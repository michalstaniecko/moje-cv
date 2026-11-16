import { useEffect, useRef, useState } from 'react'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { setPhotoHidden, updateHeader } from '../editor/documentEdits'
import { usePhotoPicker } from '../editor/fields/PhotoField'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { PHOTO_SWITCH_SELECTOR } from '../inspector/CvElements'
import { FieldPopover, focusAfter } from './FieldPopover'
import type { Fragment } from './fragmentRects'

// Zdjęcie na stronie w Edit mode (docs/specs/wysiwyg-editing.md, W13): nad `img.cv-photo` leży w warstwie edycji
// przezroczysty przycisk „Photo”, a klik, Enter albo spacja otwiera przy nim Field popover zdjęcia: „Change photo”
// (wybór pliku i kadrowanie), „Crop photo” (ponowne kadrowanie zdjęcia z CV), „Hide photo” (zdjęcie znika ze stron, ale
// zostaje w CV – fokus na przełącznik „Show photo on CV” na liście „CV elements” Inspektora, który je przywraca; docs/specs/
// outline-instead-of-cv-form.md, D2) i „Remove photo” (z „Removed. Undo”). Ukrytego zdjęcia nie ma na stronach, więc nie
// ma też przycisku.
// Okno kadrowania zostaje modalnym `dialog` jak w CV form (`usePhotoPicker`); po nim fokus wraca na przycisk, który je
// otworzył. Escape zamyka popover i wraca na przycisk zdjęcia; „Undo” po usunięciu – też na niego, gdy wróci na stronę.
// `button(fragment)` – przycisk zdjęcia na jego fragmencie (warstwa rysuje go w kolejności fragmentów, czyli czytania
// strony); `popover` – otwarty Field popover zdjęcia albo nic.
// `add(from)` – „Photo” w pasku „Add to CV” (W13): od razu systemowy wybór pliku i okno kadrowania. Po
// zatwierdzeniu kadru fokus przechodzi na przycisk nowego zdjęcia na stronie, po anulowaniu wraca na przycisk paska
// (`from`). Pliku, którego nie da się wczytać, dotyczy Field popover przy przycisku paska: komunikat i „Choose photo”
// (ponowny wybór); Escape wraca na przycisk paska. `adding` – okno kadrowania i ten popover (warstwa rysuje je zawsze).
// Tak samo dodaje zdjęcie wiersz „Photo” na liście „CV elements” (photoRequests.ts). `focus()` – fokus na przycisku zdjęcia na stronie
// (strony przewinięte do niego), a gdy go jeszcze nie ma – zaraz po jego pojawieniu się.
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
  const visible = photo !== null && !photo.hidden
  const shown = open && visible

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
    if (open && !visible) setOpen(false)
  }, [open, visible])

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
  // Ukrycie: fokus na przełączniku „Pokaż na CV” zdjęcia w Inspektorze (przywraca zdjęcie) – w panelu zdjęcia albo na
  // liście „CV elements”, a bez niego (np. zwinięta grupa) – w bezpieczne miejsce.
  const hide = () => {
    setOpen(false)
    editor.edit(setPhotoHidden(true))
    const showSwitch = window.document.querySelector<HTMLElement>(PHOTO_SWITCH_SELECTOR)
    showSwitch?.focus()
    if (!showSwitch || window.document.activeElement !== showSwitch) onFocusLost()
  }
  const focus = () => {
    if (!button.current) {
      focusWhenBack.current = true
      return
    }
    button.current.scrollIntoView({ block: 'center' })
    button.current.focus()
  }

  // Dodawanie zdjęcia z paska „Add to CV”.
  const addFrom = useRef<() => HTMLElement | null>(() => null)
  const [addError, setAddError] = useState(false)
  const adding = usePhotoPicker(editor, {
    onCropEnd: () => {
      if (!editor.store.getState().document.header.photo) {
        addFrom.current()?.focus()
        return
      }
      if (button.current) button.current.focus()
      else focusWhenBack.current = true
    }
  })
  const add = (from: () => HTMLElement | null) => {
    addFrom.current = from
    setAddError(true)
    void adding.pick()
  }
  const closeAddError = (returnFocus: boolean) => {
    setAddError(false)
    if (returnFocus) addFrom.current()?.focus()
  }
  const addingPanels = (
    <>
      {addError && adding.error && (
        <FieldPopover anchor={() => addFrom.current()} label={t.legend} className="field-popover--menu" onClose={closeAddError}>
          <p className="form-error" role="alert">
            {t.errors[adding.error]}
          </p>
          <button type="button" onClick={() => add(addFrom.current)}>
            {t.choose}
          </button>
        </FieldPopover>
      )}
      {adding.cropper}
    </>
  )

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
  const popover = shown && (
    <PhotoPanel editor={editor} dataUrl={photo.dataUrl} anchor={() => button.current} onClose={close} onHide={hide} onRemove={remove} />
  )
  return { button: photoButton, popover, add, focus, adding: addingPanels }
}

function PhotoPanel({
  editor,
  dataUrl,
  anchor,
  onClose,
  onHide,
  onRemove
}: {
  editor: CvEditor
  dataUrl: string
  anchor: () => HTMLElement | null
  onClose: (returnFocus: boolean) => void
  onHide: () => void
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
      <button type="button" onClick={onHide}>
        {t.hide}
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
