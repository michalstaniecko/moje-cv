import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lightWindowBackground } from './interfaceLook'

// Kolor tła okna Electrona musi być równy tokenowi tła aplikacji z arkusza interfejsu – inaczej okno błyska inną
// barwą przy starcie. Źródłem prawdy jest app.css.
function tokenFromAppCss(name: string): string | undefined {
  const css = readFileSync(join(__dirname, '../renderer/src/app.css'), 'utf8')
  return css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]
}

describe('window background', () => {
  it('light window background equals the --ui-app-bg token from app.css', () => {
    expect(tokenFromAppCss('--ui-app-bg')).toBeDefined()
    expect(lightWindowBackground).toBe(tokenFromAppCss('--ui-app-bg'))
  })
})
