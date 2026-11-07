import { describe, expect, test } from 'vitest'
import { interfaceLanguageCodes, interfaceLanguages, resolveInterfaceLanguage } from './languages'

describe('interface language', () => {
  test('a chosen language beats the system languages', () => {
    expect(resolveInterfaceLanguage('en', ['pl-PL'])).toBe('en')
    expect(resolveInterfaceLanguage('pl', ['en-US'])).toBe('pl')
  })

  test('without a choice, a Polish system gets Polish', () => {
    expect(resolveInterfaceLanguage(undefined, ['pl'])).toBe('pl')
  })

  test('without a choice, an unsupported system language falls back to English', () => {
    expect(resolveInterfaceLanguage(undefined, ['ja'])).toBe('en')
    expect(resolveInterfaceLanguage(undefined, ['zh-Hans-CN', 'ko-KR'])).toBe('en')
    expect(resolveInterfaceLanguage(undefined, [])).toBe('en')
  })

  test('the first supported language in the system list wins', () => {
    expect(resolveInterfaceLanguage(undefined, ['ja-JP', 'pl-PL', 'en-US'])).toBe('pl')
    expect(resolveInterfaceLanguage(undefined, ['ar', 'en-GB', 'pl'])).toBe('en')
  })

  test('regional variants map to their base language', () => {
    expect(resolveInterfaceLanguage(undefined, ['pl-PL'])).toBe('pl')
    expect(resolveInterfaceLanguage(undefined, ['en-GB'])).toBe('en')
    expect(resolveInterfaceLanguage(undefined, ['pl_PL'])).toBe('pl')
  })

  test.each([
    ['es-ES', 'es'],
    ['es-419', 'es'],
    ['fr-CA', 'fr'],
    ['de-AT', 'de'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['it-IT', 'it'],
    ['nl-BE', 'nl'],
    ['ru-RU', 'ru'],
    ['uk-UA', 'uk'],
    ['tr-TR', 'tr'],
    ['id-ID', 'id'],
    ['vi-VN', 'vi'],
    ['cs-CZ', 'cs'],
    ['ro-RO', 'ro'],
    ['sv-SE', 'sv']
  ])('without a choice, a %s system gets %s', (system, expected) => {
    expect(resolveInterfaceLanguage(undefined, [system, 'en-US'])).toBe(expected)
  })

  test('languages are listed by their own names, alphabetically, Latin script before Cyrillic', () => {
    expect(interfaceLanguageCodes.map((code) => interfaceLanguages[code].name)).toEqual([
      'Bahasa Indonesia',
      'Čeština',
      'Deutsch',
      'English',
      'Español',
      'Français',
      'Italiano',
      'Nederlands',
      'Polski',
      'Português',
      'Română',
      'Svenska',
      'Tiếng Việt',
      'Türkçe',
      'Русский',
      'Українська'
    ])
  })
})
