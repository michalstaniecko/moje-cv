import { expect, test } from 'vitest'
import { cvLanguageCodes } from '../../renderer/src/domain/schema'
import { docxLanguageTag } from './languageTags'

test('every CV language has a full, canonical BCP 47 tag with a region for spell checking', () => {
  for (const language of cvLanguageCodes) {
    const tag = docxLanguageTag(language)
    expect(Intl.getCanonicalLocales(tag)).toEqual([tag])
    expect(tag.split('-')[0]).toBe(language)
    expect(new Intl.Locale(tag).region).toMatch(/^[A-Z]{2}$/)
  }
})

test('the region follows the dictionary variant of the language: Brazilian Portuguese, European Spanish', () => {
  expect(docxLanguageTag('en')).toBe('en-US')
  expect(docxLanguageTag('pl')).toBe('pl-PL')
  expect(docxLanguageTag('pt')).toBe('pt-BR')
  expect(docxLanguageTag('es')).toBe('es-ES')
})
