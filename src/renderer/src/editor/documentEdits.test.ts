import { describe, expect, it } from 'vitest'
import { sampleCv } from '../domain/sampleCv'
import {
  addEducationItem,
  addListItem,
  applyClause,
  moveBullet,
  moveItem,
  moveSection,
  removeEducationItem,
  removeListItem,
  updateEducationItem,
  updateConsent,
  updateListItem,
  updateSection
} from './documentEdits'

const sectionIds = (document: typeof sampleCv) => document.sections.map((section) => section.id)

describe('moveSection', () => {
  it('moves a section to the given position', () => {
    expect(sectionIds(moveSection('skills', 0)(sampleCv))).toEqual([
      'skills',
      'experience',
      'education',
      'languages',
      'hobby'
    ])
  })
})

describe('updateSection', () => {
  it('changes the title, visibility and page break of one section only', () => {
    const edited = updateSection('skills', { title: 'Kompetencje', hidden: true, pageBreakBefore: true })(sampleCv)
    expect(edited.sections.find((section) => section.id === 'skills')).toMatchObject({
      title: 'Kompetencje',
      hidden: true,
      pageBreakBefore: true,
      items: sampleCv.sections.find((section) => section.id === 'skills')!.items
    })
    expect(edited.sections.find((section) => section.id === 'languages')).toBe(
      sampleCv.sections.find((section) => section.id === 'languages')
    )
  })
})

const educationItems = (document: typeof sampleCv) => {
  const section = document.sections.find((section) => section.id === 'education')
  if (section?.type !== 'education') throw new Error('brak sekcji wykształcenia')
  return section.items
}

describe('education items', () => {
  it('adds an empty entry at the end, edits it and removes it', () => {
    const added = addEducationItem('education')(sampleCv)
    const entry = educationItems(added).at(-1)!
    expect(educationItems(added).map((item) => item.id).slice(0, -1)).toEqual(['ed1', 'ed2'])
    expect(entry).toMatchObject({ level: '', field: '', institution: '', start: null, end: null, pageBreakBefore: false })

    const edited = updateEducationItem('education', entry.id, { level: 'Licencjat', end: { year: 2010, month: 6 } })(added)
    expect(educationItems(edited).at(-1)).toMatchObject({ level: 'Licencjat', end: { year: 2010, month: 6 } })

    expect(educationItems(removeEducationItem('education', entry.id)(edited))).toEqual(educationItems(sampleCv))
  })
})

const listTexts = (document: typeof sampleCv, sectionId: string) =>
  document.sections.find((section) => section.id === sectionId)!.items.map((item) => ('text' in item ? item.text : ''))

describe('list items', () => {
  it('adds an empty item at the end, edits it and removes it', () => {
    const added = addListItem('languages')(sampleCv)
    expect(listTexts(added, 'languages')).toEqual(['Angielski – C1', 'Niemiecki – A2', ''])

    const newItemId = added.sections.find((section) => section.id === 'languages')!.items.at(-1)!.id
    const edited = updateListItem('languages', newItemId, 'Hiszpański – B1')(added)
    expect(listTexts(edited, 'languages')).toEqual(['Angielski – C1', 'Niemiecki – A2', 'Hiszpański – B1'])

    expect(listTexts(removeListItem('languages', 'l1')(edited), 'languages')).toEqual([
      'Niemiecki – A2',
      'Hiszpański – B1'
    ])
    expect(listTexts(edited, 'skills')).toEqual(listTexts(sampleCv, 'skills'))
  })
})

const itemIds = (document: typeof sampleCv, sectionId: string) =>
  document.sections.find((section) => section.id === sectionId)!.items.map((item) => item.id)

describe('moveItem', () => {
  it('reorders entries within a section of any type', () => {
    expect(itemIds(moveItem('experience', 'e1', 2)(sampleCv), 'experience')).toEqual(['e2', 'e3', 'e1', 'e4'])
    expect(itemIds(moveItem('education', 'ed2', 0)(sampleCv), 'education')).toEqual(['ed2', 'ed1'])
    expect(itemIds(moveItem('languages', 'l2', 0)(sampleCv), 'languages')).toEqual(['l2', 'l1'])
  })
})

describe('moveBullet', () => {
  it('reorders bullets within an experience entry', () => {
    const moved = moveBullet('experience', 'e4', 'e4-b4', 0)(sampleCv)
    const entry = moved.sections[0]!.items.find((item) => item.id === 'e4')!
    expect('bullets' in entry && entry.bullets.map((bullet) => bullet.id)).toEqual(['e4-b4', 'e4-b1', 'e4-b2', 'e4-b3'])
  })
})

describe('consent', () => {
  const talent = { id: 'talent', name: 'Talent Partners', text: 'Wyrażam zgodę dla Talent Partners.' }

  it('can be switched off and on without losing its text', () => {
    const off = updateConsent({ enabled: false })(sampleCv)
    expect(off.consent).toEqual({ ...sampleCv.consent, enabled: false })
    expect(updateConsent({ enabled: true })(off).consent).toEqual(sampleCv.consent)
  })

  it('takes a copy of the text of the clause chosen from the library', () => {
    expect(applyClause(talent)(sampleCv).consent).toEqual({
      enabled: true,
      clauseId: 'talent',
      text: 'Wyrażam zgodę dla Talent Partners.'
    })
  })

  it('keeps local edits in the CV and gets the library text back on restore', () => {
    const chosen = applyClause(talent)(sampleCv)
    const edited = updateConsent({ text: 'Wyrażam zgodę dla Talent Partners i Banku.' })(chosen)
    expect(edited.consent).toEqual({ enabled: true, clauseId: 'talent', text: 'Wyrażam zgodę dla Talent Partners i Banku.' })
    expect(talent.text).toBe('Wyrażam zgodę dla Talent Partners.')

    expect(applyClause(talent)(edited).consent).toEqual(chosen.consent)
  })
})
