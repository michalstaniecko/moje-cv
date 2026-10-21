const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
const MIN_SCALE = ZOOM_LEVELS[0]!

const PAGE_WIDTH_PX = (210 * 96) / 25.4
// Odstęp strony od krawędzi panelu podglądu – po każdej stronie.
const PREVIEW_MARGIN_PX = 24

// Kolejny poziom powiększenia powyżej bieżącej skali (także gdy skala pochodzi z dopasowania do panelu).
export const zoomIn = (scale: number): number => ZOOM_LEVELS.find((level) => level > scale) ?? scale

export const zoomOut = (scale: number): number => [...ZOOM_LEVELS].reverse().find((level) => level < scale) ?? scale

// Skala, przy której strona A4 z marginesami wypełnia szerokość panelu.
export const fitScale = (panelWidth: number): number =>
  Math.max(MIN_SCALE, (panelWidth - 2 * PREVIEW_MARGIN_PX) / PAGE_WIDTH_PX)
