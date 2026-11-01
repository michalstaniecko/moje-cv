import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { darkWindowBackground, lightWindowBackground } from './interfaceLook'

// Kolor tła okna Electrona musi być równy tokenowi tła aplikacji z arkusza interfejsu – inaczej okno błyska inną
// barwą przy starcie. Źródłem prawdy jest app.css: paleta jasna na `:root`, ciemna pod `prefers-color-scheme: dark`.
const css = readFileSync(join(__dirname, '../renderer/src/app.css'), 'utf8')
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
const lightCss = darkStart === -1 ? css : css.slice(0, darkStart)
const darkCss = darkStart === -1 ? '' : css.slice(darkStart)

function token(source: string, name: string): string | undefined {
  return source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]
}

describe('window background', () => {
  it('light window background equals the light --ui-app-bg token from app.css', () => {
    expect(token(lightCss, '--ui-app-bg')).toBeDefined()
    expect(lightWindowBackground).toBe(token(lightCss, '--ui-app-bg'))
  })

  it('dark window background equals the --ui-app-bg token under prefers-color-scheme: dark', () => {
    expect(token(darkCss, '--ui-app-bg')).toBeDefined()
    expect(darkWindowBackground).toBe(token(darkCss, '--ui-app-bg'))
    expect(darkWindowBackground).not.toBe(lightWindowBackground)
  })
})
