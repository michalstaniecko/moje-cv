import type { YearMonth } from './schema'

export const formatYearMonth = ({ year, month }: YearMonth): string =>
  `${String(month).padStart(2, '0')}.${year}`

// Zakres dat w kolumnie daty, np. „03.2021 – obecnie”. Pusty napis, gdy brak obu dat.
export function formatDateRange(start: YearMonth | null, end: YearMonth | 'present' | null): string {
  const endText = end === 'present' ? 'obecnie' : end ? formatYearMonth(end) : ''
  const startText = start ? formatYearMonth(start) : ''
  if (startText && endText) return `${startText} – ${endText}`
  return startText || endText
}
