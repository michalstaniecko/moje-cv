// Położenie pływającego panelu w warstwie górnej (`popover`, `position: fixed`) przy elemencie, od którego go otwarto:
// menu wiersza (RowMenu) i Edit card. Czysta logika na prostokątach w px okna.

export type Box = { top: number; left: number; right: number; bottom: number }
export type Size = { width: number; height: number }

// Odstęp od kotwicy i minimalny margines od krawędzi okna.
const GAP = 4
const EDGE = 4
// Najniższy panel, który przy `contain` może jeszcze stanąć pod lub nad kotwicą zamiast ją zasłonić (kilka pól karty).
export const MIN_CONTAINED_HEIGHT = 180

// `anchor` – prostokąt kotwicy; `panel` – rozmiar panelu; `viewport` – rozmiar okna.
// `beside` (Edit card): obok kartki po prawej (`edge` – prawa krawędź kartki), jeśli zmieści się przed `limit`
// (prawa krawędź panelu stron), na wysokości kotwicy; inaczej – i zawsze bez `beside` – pod kotwicą, a gdy pod nią
// brakuje miejsca (i jest nad nią) – nad kotwicą, wyrównany do jej lewej krawędzi. W poziomie zawsze w granicach okna.
// `contain` (Edit card przy wysokim fragmencie): gdy panel nie mieści się ani pod, ani nad kotwicą, nie może zasłonić
// kotwicy (spec Q5), więc kolejno:
// 1. staje obok samej kotwicy w oknie – po jej prawej, a gdy tam brak miejsca, po lewej (np. nad paskiem bocznym),
// 2. staje pod albo nad kotwicą (gdzie więcej miejsca), niższy: `maxHeight` – panel przewija się w środku – o ile
//    zostaje mu co najmniej `MIN_CONTAINED_HEIGHT`,
// 3. dopiero gdy i to się nie da (kotwica prawie na całą wysokość okna), staje po stronie z większą ilością miejsca,
//    przesunięty tak, żeby był cały w oknie (zasłania wtedy część kotwicy, ale nie ucieka z ekranu).
// Przy kotwicy przewiniętej poza okno panel stoi przy jego krawędzi.
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
}): { top: number; left: number; placement: 'beside' | 'side' | 'below' | 'above'; maxHeight?: number } {
  const left = (preferred: number) => Math.max(EDGE, Math.min(preferred, viewport.width - panel.width - EDGE))
  if (beside && beside.edge + gap + panel.width <= beside.limit) {
    const top = Math.max(EDGE, Math.min(anchor.top, viewport.height - panel.height - EDGE))
    return { top, left: beside.edge + gap, placement: 'beside' }
  }
  const below = anchor.bottom + gap
  const above = anchor.top - gap - panel.height
  if (contain && below + panel.height > viewport.height && above < 0) {
    const top = (preferred: number) => Math.max(EDGE, Math.min(preferred, viewport.height - panel.height - EDGE))
    if (anchor.right + gap + panel.width <= viewport.width - EDGE) {
      return { top: top(anchor.top), left: anchor.right + gap, placement: 'side' }
    }
    if (anchor.left - gap - panel.width >= EDGE) {
      return { top: top(anchor.top), left: anchor.left - gap - panel.width, placement: 'side' }
    }
    const roomBelow = viewport.height - EDGE - below
    const roomAbove = anchor.top - gap - EDGE
    if (Math.max(roomBelow, roomAbove) >= MIN_CONTAINED_HEIGHT) {
      return roomBelow >= roomAbove
        ? { top: below, left: left(anchor.left), placement: 'below', maxHeight: roomBelow }
        : { top: EDGE, left: left(anchor.left), placement: 'above', maxHeight: roomAbove }
    }
    return viewport.height - anchor.bottom >= anchor.top
      ? { top: top(below), left: left(anchor.left), placement: 'below' }
      : { top: top(above), left: left(anchor.left), placement: 'above' }
  }
  // `contain`: kotwica przewinięta poza okno nie wyprowadza panelu z ekranu – panel zostaje przy krawędzi okna.
  const inWindow = (top: number) => (contain ? Math.max(EDGE, Math.min(top, viewport.height - panel.height - EDGE)) : top)
  if (below + panel.height <= viewport.height || above < 0) return { top: inWindow(below), left: left(anchor.left), placement: 'below' }
  return { top: inWindow(above), left: left(anchor.left), placement: 'above' }
}
