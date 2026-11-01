import { describe, expect, test } from 'vitest'
import { isAppearance, resolveAppearance } from './appearance'

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
