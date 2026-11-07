import { describe, expect, it } from 'vitest'
import { formatDateRange, isEndBeforeStart } from './dates'

describe('formatDateRange', () => {
  it('writes an ongoing range with "present" in the CV language', () => {
    expect(formatDateRange({ year: 2021, month: 3 }, 'present', 'en')).toBe('03.2021 – present')
    expect(formatDateRange({ year: 2021, month: 3 }, 'present', 'pl')).toBe('03.2021 – obecnie')
    expect(formatDateRange({ year: 2021, month: 3 }, 'present', 'ru')).toBe('03.2021 – по настоящее время')
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

describe('isEndBeforeStart', () => {
  it('is true when the end month comes before the start month, also by one month across a year boundary', () => {
    expect(isEndBeforeStart({ year: 2022, month: 5 }, { year: 2020, month: 8 })).toBe(true)
    expect(isEndBeforeStart({ year: 2021, month: 4 }, { year: 2021, month: 3 })).toBe(true)
    expect(isEndBeforeStart({ year: 2021, month: 1 }, { year: 2020, month: 12 })).toBe(true)
  })

  it('is false for the same month and for an end after the start', () => {
    expect(isEndBeforeStart({ year: 2021, month: 3 }, { year: 2021, month: 3 })).toBe(false)
    expect(isEndBeforeStart({ year: 2020, month: 12 }, { year: 2021, month: 1 })).toBe(false)
    expect(isEndBeforeStart({ year: 2019, month: 2 }, { year: 2023, month: 1 })).toBe(false)
  })

  it('is false for an ongoing range and when either date is missing', () => {
    expect(isEndBeforeStart({ year: 2021, month: 3 }, 'present')).toBe(false)
    expect(isEndBeforeStart(null, { year: 2020, month: 1 })).toBe(false)
    expect(isEndBeforeStart({ year: 2021, month: 3 }, null)).toBe(false)
    expect(isEndBeforeStart(null, null)).toBe(false)
  })
})
