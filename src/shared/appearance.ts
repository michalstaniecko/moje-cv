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
