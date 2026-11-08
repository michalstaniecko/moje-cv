import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'
import { LATO_UNICODE_RANGES, splitByFontCoverage } from './fontCoverage'

// Kroje Lato, które ładuje renderer (`template/fonts.ts`) – ich `unicode-range` to zakres znaków Lato w podglądzie.
const RENDERER_LATO_CSS = ['400.css', '400-italic.css', '700.css', '700-italic.css']

const require = createRequire(import.meta.url)

const cssRanges = (file: string): [number, number][] =>
  [...readFileSync(require.resolve(`@fontsource/lato/${file}`), 'utf8').matchAll(/unicode-range:\s*([^;]+);/g)].flatMap(
    ([, ranges]) =>
      ranges!.split(',').map((range) => {
        const [from, to = from] = range.trim().replace(/^U\+/i, '').split('-')
        return [parseInt(from!, 16), parseInt(to!, 16)] as [number, number]
      })
  )

// Zbiór pokrytych code pointów – porównanie niezależne od tego, jak zakresy są pocięte i posortowane.
const codePoints = (ranges: readonly (readonly [number, number])[]): Set<number> => {
  const points = new Set<number>()
  for (const [from, to] of ranges) for (let point = from; point <= to; point++) points.add(point)
  return points
}

describe('splitByFontCoverage', () => {
  test('Latin text and Polish letters stay in Lato as one segment', () => {
    expect(splitByFontCoverage('Zażółć gęślą jaźń – Łódź, 2024 €', 'lato')).toEqual([
      { text: 'Zażółć gęślą jaźń – Łódź, 2024 €', fallback: false }
    ])
  })

  test('Cyrillic goes to the fallback font, the Latin around it stays in Lato', () => {
    expect(splitByFontCoverage('Иван (CV)', 'lato')).toEqual([
      { text: 'Иван', fallback: true },
      { text: ' (CV)', fallback: false }
    ])
  })

  test('Vietnamese letters missing from Lato go to the fallback font', () => {
    expect(splitByFontCoverage('Kế toán', 'lato')).toEqual([
      { text: 'K', fallback: false },
      { text: 'ế', fallback: true },
      { text: ' toán', fallback: false }
    ])
  })

  test('characters outside the Basic Multilingual Plane are not split in half', () => {
    expect(splitByFontCoverage('a😀', 'lato')).toEqual([
      { text: 'a', fallback: false },
      { text: '😀', fallback: true }
    ])
  })

  test('Arimo and Source Sans 3 are never split', () => {
    for (const font of ['arimo', 'source-sans-3'] as const) {
      expect(splitByFontCoverage('Иван Kế', font)).toEqual([{ text: 'Иван Kế', fallback: false }])
    }
  })

  test('empty text has no segments', () => {
    expect(splitByFontCoverage('', 'lato')).toEqual([])
  })

  test('the Lato ranges match the unicode-range of the @fontsource/lato CSS loaded by the renderer', () => {
    const fromCss = codePoints(RENDERER_LATO_CSS.flatMap(cssRanges))
    expect(fromCss.size).toBeGreaterThan(0)
    expect(codePoints(LATO_UNICODE_RANGES)).toEqual(fromCss)
  })
})
