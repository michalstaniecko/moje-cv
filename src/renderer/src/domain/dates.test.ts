import { describe, expect, it } from 'vitest'
import { formatDateRange } from './dates'

describe('formatDateRange', () => {
  it('writes an ongoing range with "present" in the CV language', () => {
    expect(formatDateRange({ year: 2021, month: 3 }, 'present', 'en')).toBe('03.2021 – present')
    expect(formatDateRange({ year: 2021, month: 3 }, 'present', 'pl')).toBe('03.2021 – obecnie')
  })

  it('writes dates as numeric MM.YYYY in every CV language', () => {
    for (const language of ['en', 'pl'] as const) {
      expect(formatDateRange({ year: 2019, month: 2 }, { year: 2023, month: 11 }, language)).toBe('02.2019 – 11.2023')
    }
  })

  it('gives just the one date when the other is missing, and nothing without dates', () => {
    expect(formatDateRange(null, 'present', 'en')).toBe('present')
    expect(formatDateRange({ year: 2020, month: 9 }, null, 'en')).toBe('09.2020')
    expect(formatDateRange(null, null, 'en')).toBe('')
  })
})
