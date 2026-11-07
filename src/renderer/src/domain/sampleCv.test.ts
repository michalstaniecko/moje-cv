import { describe, expect, test } from 'vitest'
import { dictionaryFor, interfaceLanguageCodes } from '../../../shared/i18n/languages'
import { sampleCvs } from './sampleCv'
import type { CvDocument } from './schema'

// Cyrylica i pełny wietnamski są poza Lato, więc te Sample CV startują z Source Sans 3 (issue #57).
const expectedFonts = {
  cs: 'lato',
  de: 'lato',
  en: 'lato',
  es: 'lato',
  fr: 'lato',
  id: 'lato',
  it: 'lato',
  nl: 'lato',
  pl: 'lato',
  pt: 'lato',
  ro: 'lato',
  ru: 'source-sans-3',
  sv: 'lato',
  tr: 'lato',
  uk: 'source-sans-3',
  vi: 'source-sans-3'
} as const

// Szkielet CV bez tekstów: sekcje, liczba pozycji, punktów i dat – to, co we wszystkich wariantach jest jak w `en`.
const skeleton = (cv: CvDocument) => ({
  contacts: cv.header.contacts.length,
  photo: cv.header.photo !== null,
  settings: { ...cv.settings, font: undefined, language: undefined },
  sections: cv.sections.map((section) => ({
    id: section.id,
    type: section.type,
    hidden: section.hidden,
    items: section.items.map((item) =>
      'bullets' in item
        ? { start: item.start, end: item.end, bullets: item.bullets.length }
        : 'level' in item
          ? { start: item.start, end: item.end }
          : item.id
    )
  }))
})

describe('Sample CV', () => {
  test('there is a Sample CV for every interface language', () => {
    expect(Object.keys(sampleCvs).sort()).toEqual(Object.keys(expectedFonts))
    expect([...interfaceLanguageCodes].sort()).toEqual(Object.keys(expectedFonts))
  })

  test.each(Object.entries(expectedFonts))('the %s Sample CV has its CV language and starts with %s', (language, font) => {
    const sample = sampleCvs[language as keyof typeof expectedFonts]
    expect(sample.settings.language).toBe(language)
    expect(sample.settings.font).toBe(font)
  })

  test.each(interfaceLanguageCodes)('the %s Sample CV keeps the structure and the dates of the English one', (language) => {
    expect(skeleton(sampleCvs[language])).toEqual(skeleton(sampleCvs.en))
  })

  test.each(interfaceLanguageCodes)('the %s Sample CV uses the section titles and contact labels of its Default content', (language) => {
    const { contactLabels, sectionTitles } = dictionaryFor(language).defaultContent
    expect(sampleCvs[language].header.contacts.map((contact) => contact.label)).toEqual(contactLabels)
    const { experience, education, skills, languages } = sectionTitles
    expect(sampleCvs[language].sections.filter((section) => !section.hidden).map((section) => section.title)).toEqual([
      experience,
      education,
      skills,
      languages
    ])
  })

  test.each(interfaceLanguageCodes.filter((language) => language !== 'en'))(
    'the %s Sample CV is localized, not the English one',
    (language) => {
      const sample = sampleCvs[language]
      expect(sample.name).not.toBe(sampleCvs.en.name)
      expect(sample.header.fullName).not.toBe(sampleCvs.en.header.fullName)
      expect(sample.header.summary).not.toBe(sampleCvs.en.header.summary)
      expect(sample.header.contacts[0]!.value).not.toBe(sampleCvs.en.header.contacts[0]!.value)
    }
  )

  test('only the Polish Sample CV has a consent clause', () => {
    const withClause = interfaceLanguageCodes.filter((language) => sampleCvs[language].consent.enabled)
    expect(withClause).toEqual(['pl'])
    expect(sampleCvs.pl.consent.text).toContain('RODO')
    for (const language of interfaceLanguageCodes.filter((language) => language !== 'pl')) {
      expect(sampleCvs[language].consent).toEqual({ enabled: false, clauseId: null, text: '' })
    }
  })
})
