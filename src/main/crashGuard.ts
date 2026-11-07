// Ogranicza powtarzające się reakcje na awarie (przeładowanie okna, okno błędu procesu głównego): najwyżej `limit`
// zdarzeń w ciągu `windowMs` dostaje `reload`, kolejne – `ask` (zapytaj użytkownika albo tylko zaloguj).
// Liczą się tylko przepuszczone zdarzenia. Czysty moduł bez Electrona; zegar wstrzykiwany dla testów.
export type CrashGuard = {
  record(): 'reload' | 'ask'
  reset(): void
}

export function createCrashGuard({
  limit,
  windowMs,
  now = Date.now
}: {
  limit: number
  windowMs: number
  now?: () => number
}): CrashGuard {
  let allowed: number[] = []
  return {
    record() {
      const time = now()
      allowed = allowed.filter((at) => time - at < windowMs)
      if (allowed.length >= limit) return 'ask'
      allowed.push(time)
      return 'reload'
    },
    reset() {
      allowed = []
    }
  }
}
