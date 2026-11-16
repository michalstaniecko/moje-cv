// Położenie pływającego panelu w warstwie górnej (`popover`, `position: fixed`) przy elemencie, od którego go otwarto:
// menu wiersza (RowMenu) i Field popovers. Czysta logika na prostokątach w px okna.

export type Box = { top: number; left: number; right: number; bottom: number }
export type Size = { width: number; height: number }

// Odstęp od kotwicy i minimalny margines od krawędzi okna.
const GAP = 4
const EDGE = 4

// `anchor` – prostokąt kotwicy; `panel` – rozmiar panelu; `viewport` – rozmiar okna.
// Pod kotwicą, a gdy pod nią brakuje miejsca (i jest nad nią) – nad kotwicą, wyrównany do jej lewej krawędzi.
// W poziomie zawsze w granicach okna.
// `prefer: 'above'` (pasek klauzuli nad klauzulą): najpierw nad kotwicą, a gdy nad nią brakuje miejsca – pod nią.
export function anchoredPosition({
  anchor,
  panel,
  viewport,
  gap = GAP,
  prefer = 'below'
}: {
  anchor: Box
  panel: Size
  viewport: Size
  gap?: number
  prefer?: 'below' | 'above'
}): { top: number; left: number; placement: 'below' | 'above' } {
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - panel.width - EDGE))
  const below = anchor.bottom + gap
  const above = anchor.top - gap - panel.height
  if (prefer === 'above' && above >= 0) return { top: above, left, placement: 'above' }
  if (below + panel.height <= viewport.height || above < 0) return { top: below, left, placement: 'below' }
  return { top: above, left, placement: 'above' }
}
