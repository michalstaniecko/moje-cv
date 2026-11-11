// Szerokość formularza w edytorze CV (separator między formularzem a podglądem). Preferencja jest jedna dla całej
// aplikacji; wyświetlana szerokość to preferencja ograniczona do tego, co mieści bieżące okno.

export const DEFAULT_FORM_WIDTH = 440
const MIN_FORM_WIDTH = 360
const MIN_PREVIEW_WIDTH = 360
const KEY_STEP = 16
const SHIFT_KEY_STEP = 64

// Granice szerokości formularza przy danej szerokości obu kolumn. W zbyt wąskim oknie wygrywa minimum formularza.
export function formWidthBounds(panesWidth: number): { min: number; max: number } {
  return { min: MIN_FORM_WIDTH, max: Math.max(MIN_FORM_WIDTH, panesWidth - MIN_PREVIEW_WIDTH) }
}

export function displayedFormWidth(preferred: number, panesWidth: number): number {
  const { min, max } = formWidthBounds(panesWidth)
  return Math.round(Math.min(max, Math.max(min, preferred)))
}

// Nowa szerokość po klawiszu na separatorze (←/→ o 16 px, ze Shiftem o 64 px, Home – minimum, End – maksimum)
// albo `null`, gdy klawisz nie zmienia szerokości.
export function formWidthAfterKey(
  { key, shiftKey }: { key: string; shiftKey: boolean },
  current: number,
  panesWidth: number
): number | null {
  const { min, max } = formWidthBounds(panesWidth)
  const step = shiftKey ? SHIFT_KEY_STEP : KEY_STEP
  switch (key) {
    case 'ArrowLeft':
      return displayedFormWidth(current - step, panesWidth)
    case 'ArrowRight':
      return displayedFormWidth(current + step, panesWidth)
    case 'Home':
      return min
    case 'End':
      return max
    default:
      return null
  }
}
