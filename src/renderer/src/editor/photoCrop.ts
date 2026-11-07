// Kadrowanie zdjęcia do nagłówka: stałe proporcje 3:4 (szerokość : wysokość), kadr zawsze w obrębie zdjęcia.
export const PHOTO_ASPECT = 3 / 4
// 42 mm (szerokość zdjęcia w CV) przy 300 dpi – większa rozdzielczość nic nie daje w druku.
const PHOTO_MAX_WIDTH_PX = Math.round((42 / 25.4) * 300)
export const MAX_ZOOM = 4

export type Size = { width: number; height: number }
export type Rect = { x: number; y: number; width: number; height: number }
// Powiększenie (1 = największy kadr mieszczący się w zdjęciu) i środek kadru w pikselach zdjęcia.
export type CropView = { zoom: number; centerX: number; centerY: number }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const initialView = (image: Size): CropView => ({ zoom: 1, centerX: image.width / 2, centerY: image.height / 2 })

// Obszar zdjęcia wycinany przy danym widoku; środek jest przesuwany tak, żeby kadr nie wychodził poza zdjęcie.
export function cropRect(image: Size, view: CropView): Rect {
  const zoom = clamp(view.zoom, 1, MAX_ZOOM)
  const fullWidth = Math.min(image.width, image.height * PHOTO_ASPECT)
  const width = fullWidth / zoom
  const height = width / PHOTO_ASPECT
  const centerX = clamp(view.centerX, width / 2, image.width - width / 2)
  const centerY = clamp(view.centerY, height / 2, image.height - height / 2)
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

// Widok poprawiony tak, żeby odpowiadał faktycznemu kadrowi (po przesunięciu poza krawędź lub zbyt dużym powiększeniu).
export function clampView(image: Size, view: CropView): CropView {
  const rect = cropRect(image, view)
  return { zoom: clamp(view.zoom, 1, MAX_ZOOM), centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 }
}

// Rozmiar zapisywanego zdjęcia: kadr bez powiększania, ale nie szerszy niż potrzeba do druku.
export function outputSize(rect: Rect): Size {
  const width = Math.max(1, Math.min(Math.round(rect.width), PHOTO_MAX_WIDTH_PX))
  return { width, height: Math.round(width / PHOTO_ASPECT) }
}

// Przesunięcie zdjęcia w ramce o (dx, dy) pikseli zdjęcia – tak jak przy przeciąganiu: dodatnie dx przesuwa zdjęcie
// w prawo, więc kadr pokazuje więcej z jego lewej strony. Kadr zatrzymuje się na krawędzi zdjęcia.
export const nudgeView = (image: Size, view: CropView, dx: number, dy: number): CropView =>
  clampView(image, { ...view, centerX: view.centerX - dx, centerY: view.centerY - dy })
