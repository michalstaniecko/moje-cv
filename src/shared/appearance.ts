// Appearance (Wygląd): jasny lub ciemny wygląd interfejsu aplikacji (ADR-0004, słowniczek).
// `light` i `dark` to wartości zapisywane w ustawieniach i dopuszczalne w `MOJE_CV_APPEARANCE`;
// `system` (brak pola w ustawieniach) oznacza podążanie za systemem i nigdy nie jest zapisywane.
export const appearances = ['light', 'dark'] as const

export type Appearance = (typeof appearances)[number]

export type ResolvedAppearance = Appearance | 'system'

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === 'string' && (appearances as readonly string[]).includes(value)
}

// Wymuszenie (zmienna środowiskowa, dla testów) ponad wybór użytkownika, a bez obu – system.
export function resolveAppearance(
  override: Appearance | undefined,
  preference: Appearance | undefined
): ResolvedAppearance {
  return override ?? preference ?? 'system'
}

// Kolory tła okna Electrona (`BrowserWindow.backgroundColor`) dla jasnego i ciemnego wyglądu – jedyny wyjątek od
// reguły „kolory tylko w app.css” (ADR-0004). Wartości muszą być równe tokenowi `--ui-app-bg` z app.css (paleta
// jasna i ciemna), żeby okno nie błyskało inną barwą przy starcie; test jednostkowy pilnuje tej zgodności.
export const lightWindowBackground = '#eef3f8'
export const darkWindowBackground = '#0f1620'
