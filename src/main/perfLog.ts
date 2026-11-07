// Pomiar czasu kroków w procesie głównym (np. autozapisu: walidacja, odczyt, sprawdzenie, zapis pliku).
// Włączany tylko przy `MOJE_CV_PERF=1` (test `e2e/performance.spec.ts` czyta wpisy przez `app.evaluate`);
// w zwykłym działaniu aplikacja niczego nie mierzy ani nie loguje.
export type PerfEntry = { name: string; duration: number }

export type PerfLog = ReturnType<typeof createPerfLog>

export function createPerfLog(now: () => number = () => performance.now()) {
  const entries: PerfEntry[] = []

  // Mierzy krok synchroniczny albo asynchroniczny (do rozstrzygnięcia obietnicy); nieudany krok też jest zapisany.
  function time<T>(name: string, operation: () => T): T {
    const start = now()
    const record = () => entries.push({ name, duration: now() - start })
    let result: T
    try {
      result = operation()
    } catch (error) {
      record()
      throw error
    }
    if (result instanceof Promise) return result.finally(record) as T
    record()
    return result
  }

  return { entries, time }
}
