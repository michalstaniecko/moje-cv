import { describe, expect, it } from 'vitest'
import { pageCountLabel } from './pageCount'

describe('pageCountLabel', () => {
  it('uses the English plural form for the page count', () => {
    expect(pageCountLabel(1, 'en')).toBe('1 page')
    expect(pageCountLabel(2, 'en')).toBe('2 pages')
    expect(pageCountLabel(5, 'en')).toBe('5 pages')
    expect(pageCountLabel(21, 'en')).toBe('21 pages')
  })

  it('uses the Polish plural form for the page count', () => {
    expect(pageCountLabel(1, 'pl')).toBe('1 strona')
    expect(pageCountLabel(2, 'pl')).toBe('2 strony')
    expect(pageCountLabel(4, 'pl')).toBe('4 strony')
    expect(pageCountLabel(5, 'pl')).toBe('5 stron')
    expect(pageCountLabel(12, 'pl')).toBe('12 stron')
    expect(pageCountLabel(22, 'pl')).toBe('22 strony')
  })
})
