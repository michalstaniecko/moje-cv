import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from './cvEditor'
import { updateHeader } from './documentEdits'
import { clampView, cropRect, initialView, MAX_ZOOM, outputSize, PHOTO_ASPECT, type CropView } from './photoCrop'

const PICK_ERRORS = {
  unsupported: 'Nie udało się wczytać zdjęcia – wybierz plik JPEG, PNG lub WebP.',
  'too-large': 'Nie udało się wczytać zdjęcia – plik jest za duży (maks. 30 MB).',
  undecodable: 'Nie udało się wczytać zdjęcia – plik jest uszkodzony, niedostępny albo ma nieobsługiwany format.'
}
const JPEG_QUALITY = 0.9
const FRAME_WIDTH_PX = 240
const FRAME_HEIGHT_PX = FRAME_WIDTH_PX / PHOTO_ASPECT

// Zdjęcie w nagłówku: wybór z dysku, kadrowanie przed zapisem i usunięcie (nagłówek bez kolumny na zdjęcie).
export function PhotoField({ editor, photo }: { editor: CvEditor; photo: CvDocument['header']['photo'] }) {
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick() {
    setError(null)
    try {
      const result = await window.api.photo.pick()
      if (result.status === 'canceled') return
      if (result.status !== 'picked') {
        setError(PICK_ERRORS[result.status])
        return
      }
      const image = new Image()
      image.src = result.dataUrl
      await image.decode()
      setSource(image)
    } catch {
      // Plik nie dał się odczytać z dysku albo zdekodować jako obraz.
      setError(PICK_ERRORS.undecodable)
    }
  }

  return (
    <fieldset className="form-group">
      <legend>Zdjęcie</legend>
      <div className="form-row photo-field">
        {photo && <img className="photo-thumbnail" src={photo.dataUrl} alt="Zdjęcie w CV" />}
        <button type="button" onClick={() => void pick()}>
          {photo ? 'Zmień zdjęcie' : 'Wybierz zdjęcie'}
        </button>
        {photo && (
          <button type="button" onClick={() => editor.edit(updateHeader({ photo: null }))}>
            Usuń zdjęcie
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {source && (
        <PhotoCropper
          source={source}
          onApply={(dataUrl) => {
            editor.edit(updateHeader({ photo: { dataUrl } }))
            setSource(null)
          }}
          onCancel={() => setSource(null)}
        />
      )}
    </fieldset>
  )
}

// Okno kadrowania: przeciąganie przesuwa zdjęcie w kadrze, suwak powiększa.
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

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const pxPerFramePx = rect.width / FRAME_WIDTH_PX
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current = { x: event.clientX, y: event.clientY }
    update((current) => ({ ...current, centerX: current.centerX - dx * pxPerFramePx, centerY: current.centerY - dy * pxPerFramePx }))
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
      aria-label="Kadrowanie zdjęcia"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 className="form-section-title">Kadrowanie zdjęcia</h2>
      <p className="library-hint">Przeciągnij zdjęcie, żeby ustawić kadr.</p>
      <canvas
        ref={canvas}
        className="photo-cropper-frame"
        role="img"
        aria-label="Podgląd kadru"
        style={{ width: FRAME_WIDTH_PX, height: FRAME_HEIGHT_PX }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <label className="form-field">
        <span>Powiększenie</span>
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
          Anuluj
        </button>
        <button type="button" onClick={apply}>
          Zastosuj
        </button>
      </div>
    </dialog>
  )
}
