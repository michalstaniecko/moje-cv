import { describe, expect, test } from 'vitest'
import { resolveInterfaceLanguage } from './languages'

describe('interface language', () => {
  test('a chosen language beats the system languages', () => {
    expect(resolveInterfaceLanguage('en', ['pl-PL'])).toBe('en')
    expect(resolveInterfaceLanguage('pl', ['en-US'])).toBe('pl')
  })

  test('without a choice, a Polish system gets Polish', () => {
    expect(resolveInterfaceLanguage(undefined, ['pl'])).toBe('pl')
  })

  test('without a choice, an unsupported system language falls back to English', () => {
    expect(resolveInterfaceLanguage(undefined, ['de'])).toBe('en')
    expect(resolveInterfaceLanguage(undefined, [])).toBe('en')
  })

  test('the first supported language in the system list wins', () => {
    expect(resolveInterfaceLanguage(undefined, ['de-DE', 'pl-PL', 'en-US'])).toBe('pl')
    expect(resolveInterfaceLanguage(undefined, ['fr', 'en-GB', 'pl'])).toBe('en')
  })

  test('regional variants map to their base language', () => {
    expect(resolveInterfaceLanguage(undefined, ['pl-PL'])).toBe('pl')
    expect(resolveInterfaceLanguage(undefined, ['en-GB'])).toBe('en')
    expect(resolveInterfaceLanguage(undefined, ['pl_PL'])).toBe('pl')
  })
})
