import { useState } from 'react'
import type { YearMonth } from '../domain/schema'

// Wartość pola `<input type="month">` („2021-03”) ↔ YearMonth. Pusta lub niepoprawna wartość → null.
const toInputValue = (value: YearMonth | null): string =>
  value ? `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}` : ''

function parseInputValue(value: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null
}

// Wybór miesiąca i roku; w CV data wyświetla się jako MM.RRRR. Niedokończony wpis (np. skasowany rok)
// zostaje tylko w polu – dokument zmienia się dopiero po wpisaniu pełnej daty albo wyczyszczeniu pola.
// `describedBy` – id opisu pola (np. ostrzeżenia o kolejności dat) dla `aria-describedby`.
export function MonthField({
  label,
  value,
  disabled = false,
  describedBy,
  onChange
}: {
  label: string
  value: YearMonth | null
  disabled?: boolean
  describedBy?: string
  onChange: (value: YearMonth | null) => void
}) {
  const committed = toInputValue(value)
  const [draft, setDraft] = useState(committed)
  const [lastCommitted, setLastCommitted] = useState(committed)
  // Zmiana z zewnątrz (np. cofnięcie) zastępuje wpis w polu.
  if (committed !== lastCommitted) {
    setLastCommitted(committed)
    setDraft(committed)
  }

  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        type="month"
        value={disabled ? '' : draft}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          setDraft(event.target.value)
          if (event.target.validity.badInput) return
          const parsed = parseInputValue(event.target.value)
          if (toInputValue(parsed) !== committed) onChange(parsed)
        }}
      />
    </label>
  )
}
