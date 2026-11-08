import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// ADR-0008: proces main (w tym DOCX export) nie importuje żadnego modułu Template'u – te importują CSS, a nowy
// Template nie może wymagać pracy przy DOCX. Main bierze treść z `domain` (bloki), nigdy z `template`.
test('no module of the main process imports a Template module', () => {
  const files = readdirSync(__dirname, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts'))
  const offenders = files.filter((file) =>
    /from '[^']*renderer\/src\/template\//.test(readFileSync(join(__dirname, file), 'utf8'))
  )
  expect(offenders).toEqual([])
})
