import { describe, expect, it } from 'vitest'
import { moveShortcutHint } from './moveShortcut'

describe('the hint of the move shortcut in a menu', () => {
  it('shows the Mac symbols on a Mac and the key names elsewhere, with the keys for assistive technology', () => {
    expect(moveShortcutHint(-1, true)).toEqual({ text: '⌥⇧↑', keys: 'Alt+Shift+ArrowUp' })
    expect(moveShortcutHint(1, true)).toEqual({ text: '⌥⇧↓', keys: 'Alt+Shift+ArrowDown' })
    expect(moveShortcutHint(-1, false)).toEqual({ text: 'Alt+Shift+↑', keys: 'Alt+Shift+ArrowUp' })
    expect(moveShortcutHint(1, false)).toEqual({ text: 'Alt+Shift+↓', keys: 'Alt+Shift+ArrowDown' })
  })
})
