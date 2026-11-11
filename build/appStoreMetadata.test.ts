import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { HELP_URL, PRIVACY_URL } from '../src/shared/links'

// Metadane wpisu w Mac App Store wysyłane przez `fastlane mac metadata` (fastlane/Fastfile). Limity App Store Connect
// sprawdzone tutaj, a nie dopiero przy wysyłce, która odrzuca całą lokalizację.
const metadataDir = join(__dirname, '../fastlane/metadata')
// en-GB to język główny wpisu w App Store Connect.
const locales = ['en-GB', 'en-US', 'pl']

function field(locale: string, name: string): string {
  return readFileSync(join(metadataDir, locale, `${name}.txt`), 'utf8').trim()
}

const limits: Record<string, number> = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  promotional_text: 170,
  description: 4000
}

describe('App Store metadata', () => {
  test('British and American English share the same listing', () => {
    for (const name of readdirSync(join(metadataDir, 'en-GB'))) expect(field('en-US', name.replace(/\.txt$/, '')), name).toBe(field('en-GB', name.replace(/\.txt$/, '')))
  })

  test('every locale has the same fields', () => {
    const files = locales.map((locale) => readdirSync(join(metadataDir, locale)).sort())
    for (const other of files.slice(1)) expect(other).toEqual(files[0])
    expect(files[0]).toEqual(expect.arrayContaining([...Object.keys(limits), 'support_url', 'privacy_url'].map((name) => `${name}.txt`)))
  })

  for (const locale of locales) {
    test(`${locale} fits App Store Connect limits`, () => {
      for (const [name, limit] of Object.entries(limits)) {
        const value = field(locale, name)
        expect(value, `${locale}/${name}`).not.toBe('')
        expect([...value].length, `${locale}/${name}`).toBeLessThanOrEqual(limit)
      }
    })

    test(`${locale} keywords are comma-separated without spaces around commas or duplicates`, () => {
      const keywords = field(locale, 'keywords').split(',')
      expect(keywords.every((keyword) => keyword === keyword.trim() && keyword !== '')).toBe(true)
      expect(new Set(keywords).size).toBe(keywords.length)
    })

    test(`${locale} uses the app's Help and Privacy Policy URLs`, () => {
      expect(field(locale, 'support_url')).toBe(HELP_URL)
      expect(field(locale, 'privacy_url')).toBe(PRIVACY_URL)
    })
  }

  // Apple nie przyjmuje „What's New” dla pierwszej wersji w sklepie; od 1.1 dodaj release_notes.txt w każdej lokalizacji.
  test('the first store version has no release notes', () => {
    const version = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version as string
    if (version !== '1.0.0') return
    for (const locale of locales) expect(readdirSync(join(metadataDir, locale))).not.toContain('release_notes.txt')
  })
})
