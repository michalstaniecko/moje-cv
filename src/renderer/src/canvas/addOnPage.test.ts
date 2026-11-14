import { describe, expect, it } from 'vitest'
import { emptyCv } from '../domain/emptyCv'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument, Section } from '../domain/schema'
import { addToCvItems, isEmptyCv, sectionPills } from './addOnPage'
import type { Fragment, Rect } from './fragmentRects'

const sample = sampleCvs.en
let nextId = 0
const fresh = emptyCv({ language: 'en', now: new Date('2026-01-01T00:00:00Z'), newId: () => `id${++nextId}` })
const [experience, education, skills, languages] = fresh.sections as [Section, Section, Section, Section]

const withSections = (document: CvDocument, change: (section: Section) => Section): CvDocument => ({
  ...document,
  sections: document.sections.map(change)
})

describe('addToCvItems', () => {
  it('lists every part of a new CV: the empty header parts, all its sections and the consent clause', () => {
    expect(addToCvItems(fresh)).toEqual([
      { kind: 'fullName', key: 'fullName' },
      { kind: 'photo', key: 'photo' },
      // Nowe CV ma etykiety kontaktów bez wartości – na stronie nie ma żadnego kontaktu.
      { kind: 'contacts', key: 'contacts' },
      { kind: 'summary', key: 'summary' },
      ...[experience, education, skills, languages].map((section) => ({
        kind: 'section',
        key: `section:${section.id}`,
        sectionId: section.id
      })),
      { kind: 'consent', key: 'consent' }
    ])
  })

  it('lists only the disabled consent clause for the English Sample CV: its hidden section is not missing', () => {
    expect(sample.sections.find((section) => section.id === 'hobby')?.hidden).toBe(true)
    expect(addToCvItems(sample)).toEqual([{ kind: 'consent', key: 'consent' }])
  })

  it('drops a part as soon as it shows on the page', () => {
    const header = (patch: Partial<CvDocument['header']>) => addToCvItems({ ...fresh, header: { ...fresh.header, ...patch } })
    const kinds = (items: ReturnType<typeof addToCvItems>) => items.map((item) => item.kind)
    expect(kinds(header({ fullName: 'Jane' }))).not.toContain('fullName')
    expect(kinds(header({ fullName: '   ' }))).toContain('fullName')
    expect(kinds(header({ photo: { dataUrl: 'data:image/png;base64,' } }))).not.toContain('photo')
    expect(kinds(header({ summary: 'Buyer' }))).not.toContain('summary')
    // Kontakt z samą etykietą albo pusty nowy kontakt nie jest na stronie.
    expect(kinds(header({ contacts: [{ id: 'c1', label: 'Email', value: '' }] }))).toContain('contacts')
    expect(kinds(header({ contacts: [{ id: 'c1', label: '', value: 'jane@example.com' }] }))).not.toContain('contacts')

    // Sekcja z pustym wpisem (dodanym, ale jeszcze bez treści) nadal jest pusta; z treścią – już nie.
    const withItem = (item: (section: Section) => Section) => addToCvItems(withSections(fresh, item)).map((entry) => entry.key)
    const emptyItems = withItem((section) =>
      section.type === 'list' ? { ...section, items: [{ id: `${section.id}-1`, text: ' ' }] } : section
    )
    expect(emptyItems).toContain(`section:${skills.id}`)
    const filled = withItem((section) =>
      section.id === languages.id && section.type === 'list' ? { ...section, items: [{ id: 'l1', text: 'English' }] } : section
    )
    expect(filled).not.toContain(`section:${languages.id}`)
    expect(filled).toContain(`section:${skills.id}`)

    // Klauzula włączona, ale bez tekstu, nie jest na stronie.
    expect(kinds(addToCvItems({ ...fresh, consent: { enabled: true, clauseId: null, text: '' } }))).toContain('consent')
    expect(kinds(addToCvItems({ ...fresh, consent: { enabled: true, clauseId: null, text: 'I agree.' } }))).not.toContain('consent')
  })

  it('leaves out hidden sections even when they are empty', () => {
    const hidden = withSections(fresh, (section) => (section.id === languages.id ? { ...section, hidden: true } : section))
    expect(addToCvItems(hidden).map((item) => item.key)).not.toContain(`section:${languages.id}`)
  })
})

describe('isEmptyCv', () => {
  it('is true only while nothing shows on the pages', () => {
    expect(isEmptyCv(fresh)).toBe(true)
    expect(isEmptyCv(sample)).toBe(false)
    expect(isEmptyCv({ ...fresh, header: { ...fresh.header, fullName: 'J' } })).toBe(false)
    expect(isEmptyCv({ ...fresh, consent: { enabled: true, clauseId: null, text: 'I agree.' } })).toBe(false)
    expect(isEmptyCv({ ...fresh, consent: { enabled: true, clauseId: null, text: '' } })).toBe(true)
  })
})

describe('sectionPills', () => {
  const rect = (top: number, bottom: number, left = 10, right = 200): Rect => ({ top, left, right, bottom })
  const fragment = (key: string, target: Fragment['target'], page: number, measured: Rect): Fragment => ({
    key,
    target,
    page,
    rect: measured
  })

  it('puts the pill of each section under its last fragment, at the left edge of the section on that page', () => {
    const name = fragment('fullName', { kind: 'fullName' }, 0, rect(10, 30))
    const title = fragment('sectionTitle:experience', { kind: 'sectionTitle', sectionId: 'experience' }, 0, rect(50, 60))
    const first = fragment('item:e1', { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' }, 0, rect(60, 200))
    // Wpis rozdzielony podziałem stron: pigułka pod jego częścią na drugiej stronie.
    const split = fragment('item:e1', { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' }, 1, rect(10, 40, 20))
    const skillsTitle = fragment('sectionTitle:skills', { kind: 'sectionTitle', sectionId: 'skills' }, 1, rect(60, 70, 10, 60))
    const skillsList = fragment('list:skills', { kind: 'listSection', sectionId: 'skills' }, 1, rect(60, 90, 80))
    const consent = fragment('consent', { kind: 'consent' }, 1, rect(700, 720))

    expect(sectionPills([name, title, first, split, skillsTitle, skillsList, consent])).toEqual([
      { sectionId: 'experience', after: split, top: 40, left: 20 },
      { sectionId: 'skills', after: skillsList, top: 90, left: 10 }
    ])
  })
})
