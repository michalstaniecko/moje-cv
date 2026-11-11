import { describe, expect, it } from 'vitest'
import { sampleCvs } from '../domain/sampleCv'
import {
  addEducationItem,
  addListItem,
  applyClause,
  moveBullet,
  moveItem,
  moveSection,
  removeEducationItem,
  removeListItem,
  splitBullet,
  splitListItem,
  textSplit,
  updateEducationItem,
  updateConsent,
  updateListItem,
  updateName,
  updateSection
} from './documentEdits'

const sampleCv = sampleCvs.pl

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

const bullets = (document: typeof sampleCv, itemId: string) => {
  const entry = document.sections.find((section) => section.id === 'experience')!.items.find((item) => item.id === itemId)
  if (!entry || !('bullets' in entry)) throw new Error('brak wpisu doświadczenia')
  return entry.bullets
}

describe('splitBullet', () => {
  it('keeps the text before the cursor and puts the rest in a new bullet right below', () => {
    const split = splitBullet('experience', 'e2', 'e2-b3', textSplit(27, 27, 'e2-new'))(sampleCv)
    expect(bullets(split, 'e2').map((bullet) => bullet.text).slice(1, 5)).toEqual([
      'Wyszukiwanie i kwalifikacja nowych dostawców w Polsce i w Azji.',
      'Negocjowanie umów ramowych ',
      'i warunków płatności.',
      'Kontrola terminowości dostaw i rozwiązywanie problemów logistycznych.'
    ])
    expect(bullets(split, 'e2').map((bullet) => bullet.id)).toEqual([
      'e2-b1',
      'e2-b2',
      'e2-b3',
      'e2-new',
      'e2-b4',
      'e2-b5',
      'e2-b6',
      'e2-b7'
    ])
  })

  it('adds an empty bullet when split at the end and moves the whole text down when split at the start', () => {
    const text = 'Raportowanie oszczędności zakupowych do zarządu.'
    const atEnd = bullets(splitBullet('experience', 'e1', 'e1-b7', textSplit(text.length))(sampleCv), 'e1')
    expect(atEnd.slice(6, 9).map((bullet) => bullet.text)).toEqual([text, '', 'Wdrażanie nowych pracowników działu zakupów.'])

    const atStart = bullets(splitBullet('experience', 'e1', 'e1-b7', textSplit(0))(sampleCv), 'e1')
    expect(atStart.slice(6, 9).map((bullet) => bullet.text)).toEqual(['', text, 'Wdrażanie nowych pracowników działu zakupów.'])
  })

  it('drops the selected text and splits where the selection started', () => {
    const split = bullets(splitBullet('experience', 'e2', 'e2-b3', textSplit(13, 27))(sampleCv), 'e2')
    expect(split.slice(2, 4).map((bullet) => bullet.text)).toEqual(['Negocjowanie ', 'i warunków płatności.'])
  })

  it('leaves other entries and sections alone', () => {
    const split = splitBullet('experience', 'e2', 'e2-b3', textSplit(27))(sampleCv)
    expect(bullets(split, 'e1')).toBe(bullets(sampleCv, 'e1'))
    expect(split.sections.slice(1)).toEqual(sampleCv.sections.slice(1))
  })
})

describe('splitListItem', () => {
  it('splits an item at the cursor into two, the new one right below', () => {
    const split = splitListItem('languages', 'l1', textSplit(10, 10, 'l-new'))(sampleCv)
    expect(listTexts(split, 'languages')).toEqual(['Angielski ', '– C1', 'Niemiecki – A2'])
    expect(itemIds(split, 'languages')).toEqual(['l1', 'l-new', 'l2'])
    expect(split.sections.filter((section) => section.id !== 'languages')).toEqual(
      sampleCv.sections.filter((section) => section.id !== 'languages')
    )
  })

  it('gives the new item a fresh id unless one is given', () => {
    const ids = itemIds(splitListItem('languages', 'l2', textSplit(0))(sampleCv), 'languages')
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })

  it('adds an empty item when split at the end', () => {
    expect(listTexts(splitListItem('languages', 'l1', textSplit(14))(sampleCv), 'languages')).toEqual([
      'Angielski – C1',
      '',
      'Niemiecki – A2'
    ])
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

describe('updateName', () => {
  it('renames the CV with the name trimmed and leaves the rest of the document alone', () => {
    const renamed = updateName('  CV – bank  ')(sampleCv)
    expect(renamed.name).toBe('CV – bank')
    expect({ ...renamed, name: sampleCv.name }).toEqual(sampleCv)
  })

  it('leaves the document unchanged for an empty name or one made of spaces', () => {
    expect(updateName('')(sampleCv)).toBe(sampleCv)
    expect(updateName('   ')(sampleCv)).toBe(sampleCv)
  })
})
