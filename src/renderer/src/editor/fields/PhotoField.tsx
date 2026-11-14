import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Dictionary } from '../../../../shared/i18n/en'
import type { CvDocument } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { updateHeader } from '../documentEdits'
import { useRemove } from '../removalUndo'
import { clampView, cropRect, initialView, MAX_ZOOM, nudgeView, outputSize, PHOTO_ASPECT, type CropView } from '../photoCrop'

type PickError = keyof Dictionary['editor']['photo']['errors']
const JPEG_QUALITY = 0.9
const FRAME_WIDTH_PX = 240
const FRAME_HEIGHT_PX = FRAME_WIDTH_PX / PHOTO_ASPECT
// Krok przesunięcia kadru strzałką (w pikselach ramki); z Shift większy.
const NUDGE_STEP_PX = 8
const NUDGE_STEP_SHIFT_PX = 40
const ARROW_DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

// Wybór zdjęcia z dysku i kadrowanie przed zapisem (docs/specs/wysiwyg-editing.md, W13) – wspólne dla CV form, karty
// i Field popover zdjęcia na stronie. `pick` – systemowe okno wyboru pliku, potem okno kadrowania; `crop` – ponowne
// kadrowanie zdjęcia z CV; `error` – nieudany wybór; `cropper` – okno kadrowania (modalny `dialog`) do wyrenderowania
// przez użytkownika hooka. `onCropEnd` – okno kadrowania się zamknęło (zatwierdzone albo anulowane).
export function usePhotoPicker(editor: CvEditor, { onCropEnd }: { onCropEnd?: () => void } = {}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<PickError | null>(null)

  async function open(dataUrl: string) {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    setSource(image)
  }

  async function pick() {
    setError(null)
    try {
      const result = await window.api.photo.pick()
      if (result.status === 'canceled') return
      if (result.status !== 'picked') {
        setError(result.status)
        return
      }
      await open(result.dataUrl)
    } catch {
      // Plik nie dał się odczytać z dysku albo zdekodować jako obraz.
      setError('undecodable')
    }
  }

  async function crop(dataUrl: string) {
    setError(null)
    try {
      await open(dataUrl)
    } catch {
      setError('undecodable')
    }
  }

  // Po zamknięciu okna kadrowania (już bez niego w DOM – fokus poza otwartym modalnym oknem jest zablokowany).
  const ended = useRef(false)
  const cropEnd = useRef(onCropEnd)
  useEffect(() => {
    cropEnd.current = onCropEnd
  })
  useEffect(() => {
    if (source !== null || !ended.current) return
    ended.current = false
    cropEnd.current?.()
  }, [source])
  const end = () => {
    ended.current = true
    setSource(null)
  }
  const cropper = source && (
    <PhotoCropper
      source={source}
      onApply={(dataUrl) => {
        editor.edit(updateHeader({ photo: { dataUrl } }))
        end()
      }}
      onCancel={end}
    />
  )
  return { pick, crop, error, cropper }
}

// Zdjęcie w nagłówku: wybór z dysku, kadrowanie przed zapisem i usunięcie (nagłówek bez kolumny na zdjęcie).
// W CV form – grupa z legendą; w Edit card zdjęcia (`inCard`) – same pola, bo nazwą jest nazwa karty.
// `data-entry-id="photo"`: tu wraca fokus po „Cofnij” usunięcia zdjęcia.
export function PhotoField({
  editor,
  photo,
  inCard = false
}: {
  editor: CvEditor
  photo: CvDocument['header']['photo']
  inCard?: boolean
}) {
  const t = useDictionary().editor.photo
  const remove = useRemove()
  const { pick, error, cropper } = usePhotoPicker(editor)

  const fields = (
    <>
      <div className="form-row photo-field">
        {photo && <img className="photo-thumbnail" src={photo.dataUrl} alt={t.thumbnail} />}
        <button type="button" onClick={() => void pick()}>
          {photo ? t.change : t.choose}
        </button>
        {photo && (
          <button type="button" onClick={() => remove(updateHeader({ photo: null }), { entryId: 'photo', listId: 'photo' })}>
            {t.remove}
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {t.errors[error]}
        </p>
      )}
      {cropper}
    </>
  )

  if (inCard) return <div data-entry-id="photo">{fields}</div>
  return (
    <fieldset className="form-group" data-entry-id="photo">
      <legend>{t.legend}</legend>
      {fields}
    </fieldset>
  )
}

// Okno kadrowania: przeciąganie albo strzałki (na ramce z fokusem) przesuwają zdjęcie w kadrze, suwak powiększa.
// Zatwierdzony kadr jest zapisywany jako JPEG w rozdzielczości potrzebnej do druku.
function PhotoCropper({
  source,
  onApply,
  onCancel
}: {
  source: HTMLImageElement
  onApply: (dataUrl: string) => void
  onCancel: () => void
}) {
  const image = { width: source.naturalWidth, height: source.naturalHeight }
  const [view, setView] = useState<CropView>(() => initialView(image))
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const rect = cropRect(image, view)
  const { common, editor } = useDictionary()
  const t = editor.photo

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  useLayoutEffect(() => {
    const element = canvas.current
    if (!element) return
    const scale = window.devicePixelRatio
    element.width = FRAME_WIDTH_PX * scale
    element.height = FRAME_HEIGHT_PX * scale
    element.getContext('2d')?.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, element.width, element.height)
  })

  const update = (change: (view: CropView) => CropView) => setView((current) => clampView(image, change(current)))

  // Przesuwa zdjęcie w ramce o (dx, dy) pikseli ramki, przeliczone na piksele zdjęcia przy bieżącym powiększeniu.
  const moveBy = (dx: number, dy: number) => {
    const pxPerFramePx = rect.width / FRAME_WIDTH_PX
    setView((current) => nudgeView(image, current, dx * pxPerFramePx, dy * pxPerFramePx))
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current = { x: event.clientX, y: event.clientY }
    moveBy(dx, dy)
  }

  function nudge(event: KeyboardEvent<HTMLCanvasElement>) {
    const direction = ARROW_DIRECTIONS[event.key]
    if (!direction) return
    // Bez przewijania okna dialogowego strzałką.
    event.preventDefault()
    const step = event.shiftKey ? NUDGE_STEP_SHIFT_PX : NUDGE_STEP_PX
    moveBy(direction[0] * step, direction[1] * step)
  }

  function apply() {
    const size = outputSize(rect)
    const output = document.createElement('canvas')
    output.width = size.width
    output.height = size.height
    const context = output.getContext('2d')!
    // JPEG nie ma przezroczystości – przezroczyste tło PNG staje się białe, a nie czarne.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, size.width, size.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, size.width, size.height)
    onApply(output.toDataURL('image/jpeg', JPEG_QUALITY))
  }

  return (
    <dialog
      ref={dialog}
      className="photo-cropper"
      aria-label={t.crop}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 className="form-section-title">{t.crop}</h2>
      <p className="library-hint">{t.cropHint}</p>
      <canvas
        ref={canvas}
        className="photo-cropper-frame"
        role="img"
        aria-label={t.cropPreview}
        tabIndex={0}
        style={{ width: FRAME_WIDTH_PX, height: FRAME_HEIGHT_PX }}
        onKeyDown={nudge}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <label className="form-field">
        <span>{t.zoom}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(event) => update((current) => ({ ...current, zoom: Number(event.target.value) }))}
        />
      </label>
      <div className="form-row form-row--spread">
        <button type="button" onClick={onCancel}>
          {common.cancel}
        </button>
        <button type="button" onClick={apply}>
          {t.apply}
        </button>
      </div>
    </dialog>
  )
}
