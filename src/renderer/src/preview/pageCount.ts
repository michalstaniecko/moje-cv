// Liczba stron z polską formą liczby mnogiej: 1 strona, 2–4 strony, 5–21 stron, 22–24 strony…
export function pageCountLabel(count: number): string {
  if (count === 1) return '1 strona'
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  const few = lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
  return `${count} ${few ? 'strony' : 'stron'}`
}
