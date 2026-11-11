import type { KeyboardEvent } from 'react'

// Kierunek przeniesienia wiersza listy o jedną pozycję: −1 w górę, 1 w dół.
export type MoveOffset = -1 | 1

// Klawisz naciśnięty w trakcie kompozycji znaków (IME, klawisz martwy) należy do kompozycji, nie do skrótów.
export function isComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229
}

// ⌥⇧↑ → −1, ⌥⇧↓ → 1 (skrót przenoszenia wiersza listy, w polu i na uchwycie), inny klawisz albo klawisz w trakcie
// kompozycji znaków → `undefined`.
export function moveShortcutOffset(event: KeyboardEvent): MoveOffset | undefined {
  if (isComposing(event)) return undefined
  if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) return undefined
  return event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : undefined
}
