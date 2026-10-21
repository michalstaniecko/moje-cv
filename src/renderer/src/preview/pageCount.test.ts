import { describe, expect, it } from 'vitest'
import { pageCountLabel } from './pageCount'

describe('pageCountLabel', () => {
  it('uses the Polish plural form for the page count', () => {
    expect(pageCountLabel(1)).toBe('1 strona')
    expect(pageCountLabel(2)).toBe('2 strony')
    expect(pageCountLabel(4)).toBe('4 strony')
    expect(pageCountLabel(5)).toBe('5 stron')
    expect(pageCountLabel(12)).toBe('12 stron')
    expect(pageCountLabel(22)).toBe('22 strony')
  })
})
