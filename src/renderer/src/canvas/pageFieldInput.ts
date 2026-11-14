// Edycja tekstu w Page field (docs/specs/wysiwyg-editing.md, W5, W6, W19) – czyste funkcje na wartości pola
// i przesunięciach znaków, bez DOM.

// Zaznaczenie w wartości pola jako przesunięcia znaków (`start` > `end` – zaznaczenie wstecz).
export type TextSelection = { start: number; end: number }

// Znaki sterujące poza nową linią (tabulator, znaki C0 i DEL).
const controlCharacters = new RegExp('[\\u0000-\\u0009\\u000b-\\u001f\\u007f]', 'g')

// Wklejany i upuszczany tekst: tylko czysty tekst. Końce linii ujednolicone (`\r\n`, `\r` → `\n`), tabulatory i znaki
// sterujące → spacja (niewidoczne znaki nie trafią do PDF), twarde spacje zostają. W polu jednowierszowym nowe linie
// stają się spacjami – w PDF i tak byłyby spacją.
export function normalizePastedText(text: string, multiline: boolean): string {
  const plain = text.replace(/\r\n?/g, '\n').replace(controlCharacters, ' ')
  return multiline ? plain : plain.replace(/\n/g, ' ')
}

// Linie wklejonego tekstu dla punktu stanowiska albo elementu listy: znormalizowane jak wyżej, puste linie pominięte
// (W6) – pierwsza trafia w miejsce kursora, kolejne to nowe elementy.
export function pastedLines(text: string): string[] {
  return normalizePastedText(text, true)
    .split('\n')
    .filter((line) => line.trim() !== '')
}

// Wartość po zastąpieniu zaznaczenia tekstem `insert` i kursor za wstawionym tekstem.
export function replaceSelection(value: string, selection: TextSelection, insert: string): { value: string; caret: number } {
  const start = Math.min(selection.start, selection.end)
  const end = Math.max(selection.start, selection.end)
  return { value: value.slice(0, start) + insert + value.slice(end), caret: start + insert.length }
}

// Kursor po zmianie wartości spoza pola (cofnij/ponów, zmiana z CV form): na końcu zmienionego zakresu nowej wartości –
// za wspólnym początkiem i przed wspólnym końcem starej i nowej wartości.
export function caretAfterChange(previous: string, next: string): number {
  let prefix = 0
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }
  return next.length - suffix
}

// Wartość pola z jego tekstu na stronie. Przeglądarka pisze spację na końcu tekstu i spacje obok siebie jako twarde
// (U+00A0), bo zwykłe zwinęłyby się w edytowalnym elemencie – w dokumencie to zwykłe spacje, jak z pola formularza.
// Twarda spacja między dwoma znakami (np. „10 km” wklejone) zostaje.
export function fieldValue(text: string): string {
  return text.replace(/(?<=^|[  ]) | (?=$|[  ])/g, ' ')
}
