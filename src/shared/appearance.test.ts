import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { darkWindowBackground, isAppearance, lightWindowBackground, resolveAppearance } from './appearance'

describe('appearance', () => {
  test('a forced appearance beats the user preference', () => {
    expect(resolveAppearance('dark', 'light')).toBe('dark')
    expect(resolveAppearance('light', 'dark')).toBe('light')
  })

  test('without a forced appearance, the user preference wins', () => {
    expect(resolveAppearance(undefined, 'dark')).toBe('dark')
    expect(resolveAppearance(undefined, 'light')).toBe('light')
  })

  test('without a forced appearance and a preference, the app follows the system', () => {
    expect(resolveAppearance(undefined, undefined)).toBe('system')
  })

  test('only light and dark are valid forced values; anything else is ignored', () => {
    expect(isAppearance('light')).toBe(true)
    expect(isAppearance('dark')).toBe(true)
    expect(isAppearance('system')).toBe(false)
    expect(isAppearance('DARK')).toBe(false)
    expect(isAppearance('')).toBe(false)
    expect(isAppearance(undefined)).toBe(false)
  })
})

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
  test('light window background equals the light --ui-app-bg token from app.css', () => {
    expect(token(lightCss, '--ui-app-bg')).toBeDefined()
    expect(lightWindowBackground).toBe(token(lightCss, '--ui-app-bg'))
  })

  test('dark window background equals the --ui-app-bg token under prefers-color-scheme: dark', () => {
    expect(token(darkCss, '--ui-app-bg')).toBeDefined()
    expect(darkWindowBackground).toBe(token(darkCss, '--ui-app-bg'))
    expect(darkWindowBackground).not.toBe(lightWindowBackground)
  })
})
