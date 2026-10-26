import { A4_MM, PX_PER_MM } from '../domain/templateGeometry'

// Szerokość strony A4 w pikselach CSS – ta sama co w pages.css.
const PAGE_WIDTH_PX = A4_MM.width * PX_PER_MM

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
const MIN_SCALE = ZOOM_LEVELS[0]!
const MAX_SCALE = ZOOM_LEVELS.at(-1)!

// Odstęp strony od krawędzi panelu i między stronami w podglądzie (przekazywany do CSS jako --page-gap).
export const PREVIEW_MARGIN_PX = 24

// Kolejny poziom powiększenia powyżej bieżącej skali (także gdy skala pochodzi z dopasowania do panelu).
export const zoomIn = (scale: number): number => ZOOM_LEVELS.find((level) => level > scale) ?? scale

export const zoomOut = (scale: number): number => [...ZOOM_LEVELS].reverse().find((level) => level < scale) ?? scale

// Skala, przy której strona A4 z marginesami wypełnia szerokość panelu – w zakresie poziomów powiększenia.
export const fitScale = (panelWidth: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, (panelWidth - 2 * PREVIEW_MARGIN_PX) / PAGE_WIDTH_PX))
