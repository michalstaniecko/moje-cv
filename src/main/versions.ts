// Wersje aplikacji w postaci „X.Y.Z” (bez importu `electron`, testowane w vitest). Wydanie to GitHub Release z tagiem
// dokładnie `vX.Y.Z`; wszystko inne (sufiksy pre-release, brak „v”, spacje) nie jest wydaniem (ADR-0006).
const releaseTag = /^v(\d+)\.(\d+)\.(\d+)$/
const plainVersion = /^(\d+)\.(\d+)\.(\d+)$/

export function parseReleaseTag(tag: string): string | null {
  const match = releaseTag.exec(tag)
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null
}

function segments(version: string): [number, number, number] | null {
  const match = plainVersion.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

// Porównanie numeryczne po segmentach (1.0.10 > 1.0.9). Obie wersje muszą być czystym „X.Y.Z”.
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = segments(a)
  const right = segments(b)
  if (!left || !right) throw new Error(`Not a version X.Y.Z: ${left ? b : a}`)
  for (let index = 0; index < 3; index++) {
    if (left[index]! > right[index]!) return 1
    if (left[index]! < right[index]!) return -1
  }
  return 0
}

// Czy `candidate` jest nowsze od `current`. Wersja spoza „X.Y.Z” (np. build deweloperski z sufiksem) nigdy nie daje
// powiadomienia.
export function isNewer(candidate: string, current: string): boolean {
  if (!segments(candidate) || !segments(current)) return false
  return compareVersions(candidate, current) === 1
}
