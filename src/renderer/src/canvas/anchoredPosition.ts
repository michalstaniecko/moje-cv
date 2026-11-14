// Położenie pływającego panelu w warstwie górnej (`popover`, `position: fixed`) przy elemencie, od którego go otwarto:
// menu wiersza (RowMenu) i Edit card. Czysta logika na prostokątach w px okna.

export type Box = { top: number; left: number; right: number; bottom: number }
export type Size = { width: number; height: number }

// Odstęp od kotwicy i minimalny margines od krawędzi okna.
const GAP = 4
const EDGE = 4

// `anchor` – prostokąt kotwicy; `panel` – rozmiar panelu; `viewport` – rozmiar okna.
// `beside` (Edit card): obok kartki po prawej (`edge` – prawa krawędź kartki), jeśli zmieści się przed `limit`
// (prawa krawędź panelu stron), na wysokości kotwicy; inaczej – i zawsze bez `beside` – pod kotwicą, a gdy pod nią
// brakuje miejsca (i jest nad nią) – nad kotwicą, wyrównany do jej lewej krawędzi. W poziomie zawsze w granicach okna.
// `contain` (Edit card przy wysokim fragmencie): gdy panel nie mieści się ani pod, ani nad kotwicą, staje po stronie
// z większą ilością miejsca, przesunięty tak, żeby był cały w oknie (zasłania wtedy część kotwicy, ale nie ucieka z ekranu).
export function anchoredPosition({
  anchor,
  panel,
  viewport,
  beside,
  gap = GAP,
  contain = false
}: {
  anchor: Box
  panel: Size
  viewport: Size
  beside?: { edge: number; limit: number }
  gap?: number
  contain?: boolean
}): { top: number; left: number; placement: 'beside' | 'below' | 'above' } {
  const left = (preferred: number) => Math.max(EDGE, Math.min(preferred, viewport.width - panel.width - EDGE))
  if (beside && beside.edge + gap + panel.width <= beside.limit) {
    const top = Math.max(EDGE, Math.min(anchor.top, viewport.height - panel.height - EDGE))
    return { top, left: beside.edge + gap, placement: 'beside' }
  }
  const below = anchor.bottom + gap
  const above = anchor.top - gap - panel.height
  if (contain && below + panel.height > viewport.height && above < 0) {
    const roomBelow = viewport.height - anchor.bottom
    const top = (preferred: number) => Math.max(EDGE, Math.min(preferred, viewport.height - panel.height - EDGE))
    return roomBelow >= anchor.top
      ? { top: top(below), left: left(anchor.left), placement: 'below' }
      : { top: top(above), left: left(anchor.left), placement: 'above' }
  }
  if (below + panel.height <= viewport.height || above < 0) return { top: below, left: left(anchor.left), placement: 'below' }
  return { top: above, left: left(anchor.left), placement: 'above' }
}
