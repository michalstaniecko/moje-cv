import { dictionaryFor } from '../../../shared/i18n/languages'
import type { CvLanguage, YearMonth } from './schema'

// Daty są numeryczne (MM.RRRR) w każdym CV language – bez nazw miesięcy.
export const formatYearMonth = ({ year, month }: YearMonth): string =>
  `${String(month).padStart(2, '0')}.${year}`

// Zakres dat w kolumnie daty, np. „03.2021 – present”. Słowo dla trwającego zakresu pochodzi z CV language.
// Pusty napis, gdy brak obu dat.
export function formatDateRange(
  start: YearMonth | null,
  end: YearMonth | 'present' | null,
  language: CvLanguage
): string {
  const endText = end === 'present' ? dictionaryFor(language).cvText.present : end ? formatYearMonth(end) : ''
  const startText = start ? formatYearMonth(start) : ''
  if (startText && endText) return `${startText} – ${endText}`
  return startText || endText
}

// Odwrócony zakres dat (koniec przed początkiem) – podstawa ostrzeżenia w formularzu, nie blokady. Tylko dla dwóch
// pełnych dat: ten sam miesiąc, „present” i brak jednej z dat nie są błędem.
export function isEndBeforeStart(start: YearMonth | null, end: YearMonth | 'present' | null): boolean {
  if (!start || !end || end === 'present') return false
  return end.year < start.year || (end.year === start.year && end.month < start.month)
}
