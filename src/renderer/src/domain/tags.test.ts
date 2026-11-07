import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeTags, tagKey } from './tags'

// Język systemu wpływa na toLocaleLowerCase() bez podanego języka. Test udaje system turecki („I” → „ı”).
function withSystemLanguage(language: string) {
  const original = String.prototype.toLocaleLowerCase
  vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function (this: string, locales) {
    return original.call(this, locales ?? language)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tag key', () => {
  it('does not depend on the system language', () => {
    withSystemLanguage('tr')

    expect(tagKey('IT')).toBe('it')
    expect(tagKey('Istanbul')).toBe(tagKey('istanbul'))
  })

  it('tags differing only in letter case are one tag, also on a Turkish system', () => {
    withSystemLanguage('tr')

    expect(normalizeTags(['Istanbul', 'istanbul', 'IT', 'it'])).toEqual(['Istanbul', 'IT'])
  })
})
