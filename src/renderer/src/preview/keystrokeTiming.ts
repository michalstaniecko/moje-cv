// Pomiar odpowiedzi podglądu na klawisz (User Timing API): od zmiany pola formularza (`cv:input`, czas zdarzenia) do
// namalowania podglądu z nowym podziałem stron (`cv:preview-painted`) jako `cv:keystroke-to-preview`.
// Znaczniki zostają w kodzie produkcyjnym: kosztują mikrosekundy i niczego nie wysyłają. Odczytuje je
// test `e2e/performance.spec.ts` (próg 100 ms, zob. .docs/spec.md, sekcja „Pomiar”).
export const KEYSTROKE_TO_PREVIEW = 'cv:keystroke-to-preview'

// Bez limitu bufor wpisów rósłby z każdym klawiszem przez całą sesję.
const MAX_MEASURES = 1000

// Najwcześniejszy klawisz, którego zmiana nie jest jeszcze namalowana w podglądzie.
let pendingInput: PerformanceMark | null = null

// `timeStamp` – `event.timeStamp` zdarzenia pola (ten sam zegar co `performance.now()`).
export function markInput(timeStamp: number): void {
  pendingInput ??= performance.mark('cv:input', { startTime: timeStamp })
}

// Wywoływane po namalowaniu klatki z nowym podziałem stron. Kilka klawiszy namalowanych razem to jeden pomiar,
// liczony od pierwszego z nich (czekał najdłużej).
export function markPreviewPainted(): void {
  const painted = performance.mark('cv:preview-painted')
  if (pendingInput) {
    if (performance.getEntriesByName(KEYSTROKE_TO_PREVIEW, 'measure').length >= MAX_MEASURES) {
      performance.clearMeasures(KEYSTROKE_TO_PREVIEW)
    }
    performance.measure(KEYSTROKE_TO_PREVIEW, { start: pendingInput.startTime, end: painted.startTime })
    pendingInput = null
  }
  performance.clearMarks('cv:input')
  performance.clearMarks('cv:preview-painted')
}

// Wywołuje `callback` po namalowaniu najbliższej klatki: `requestAnimationFrame` startuje przed malowaniem,
// a kolejny task – już po nim.
export function afterNextPaint(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(callback, 0)
  })
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
  }
}
