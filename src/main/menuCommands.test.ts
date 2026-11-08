import { expect, test } from 'vitest'
import { enabledMenuCommands } from './menuCommands'

test('Export to DOCX… is enabled only in the CV editor, like the other exports', () => {
  expect(enabledMenuCommands('editor').has('export-docx')).toBe(true)
  for (const screen of ['library', 'clauses', undefined] as const) {
    expect(enabledMenuCommands(screen).has('export-docx')).toBe(false)
  }
})
