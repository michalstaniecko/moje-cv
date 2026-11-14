import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument } from '../domain/schema'
import { templates } from '../template/templates'
import { blockTarget, CONSENT_BLOCK_ID, fragmentKey, fragmentTarget, hitTarget, targetExists, type EditTarget } from './editTargets'

const sample = sampleCvs.en
const none = { part: null, index: 0 }

describe('blockTarget', () => {
  // Każdy blok Sample CV w każdej geometrii (tytuł obok listy w 1 kolumnie, tytuł nad listą w 2 kolumnach) ma cel.
  for (const [id, template] of Object.entries(templates)) {
    it(`maps every block of the Sample CV in the ${id} template to a part of the CV`, () => {
      const blocks = generateBlocks(sample, template.geometry)
      const targets = blocks.map((block) => [block.id, blockTarget(block.id, sample)] as const)
      for (const [blockId, target] of targets) expect(target, blockId).not.toBeNull()
      // Fragmenty w kolejności dokumentu: nagłówek, tytuły, wpisy, listy (bez ukrytej sekcji Hobby).
      const keys = [...new Set(targets.map(([, target]) => fragmentKey(target!)))]
      const titles = template.geometry.listSectionLayout.title === 'above'
      expect(keys).toEqual([
        'fullName',
        'sectionTitle:experience',
        'item:e1',
        'item:e2',
        'item:e3',
        'item:e4',
        'sectionTitle:education',
        'item:ed1',
        'item:ed2',
        ...(titles ? ['sectionTitle:skills'] : []),
        'list:skills',
        ...(titles ? ['sectionTitle:languages'] : []),
        'list:languages'
      ])
    })
  }

  it('reads the source from the block id: header, section title, entry, bullet and list row', () => {
    expect(blockTarget('header', sample)).toEqual({ kind: 'fullName' })
    expect(blockTarget('experience:title', sample)).toEqual({ kind: 'sectionTitle', sectionId: 'experience' })
    expect(blockTarget('e2', sample)).toEqual({ kind: 'experienceItem', sectionId: 'experience', itemId: 'e2' })
    expect(blockTarget('e2:e2-b3', sample)).toEqual({
      kind: 'experienceItem',
      sectionId: 'experience',
      itemId: 'e2',
      bulletId: 'e2-b3'
    })
    expect(blockTarget('ed1', sample)).toEqual({ kind: 'educationItem', sectionId: 'education', itemId: 'ed1' })
    expect(blockTarget('skills:s3', sample)).toEqual({ kind: 'listSection', sectionId: 'skills' })
  })

  it('maps the consent clause on the last page (not a block of the document) to the consent card', () => {
    expect(blockTarget(CONSENT_BLOCK_ID, sample)).toEqual({ kind: 'consent' })
    expect(fragmentKey({ kind: 'consent' })).toBe('consent')
  })

  it('returns null for a block no longer in the document', () => {
    expect(blockTarget('gone', sample)).toBeNull()
    expect(blockTarget('gone:title', sample)).toBeNull()
    expect(blockTarget('e1:gone', sample)).toBeNull()
    expect(blockTarget('skills:gone', sample)).toBeNull()
  })
})

describe('hitTarget', () => {
  it('splits the header by the markup contract and finds the clicked contact among the shown ones', () => {
    expect(hitTarget('header', { part: 'name', index: 0 }, sample)).toEqual({ kind: 'fullName' })
    expect(hitTarget('header', { part: 'photo', index: 0 }, sample)).toEqual({ kind: 'photo' })
    expect(hitTarget('header', { part: 'summary', index: 0 }, sample)).toEqual({ kind: 'summary' })
    // Kontakt bez wartości nie jest na stronie, więc n-te dziecko `.cv-contact` to n-ty kontakt z wartością.
    const withEmptyContact: CvDocument = {
      ...sample,
      header: { ...sample.header, contacts: [{ id: 'empty', label: 'Fax', value: ' ' }, ...sample.header.contacts] }
    }
    expect(hitTarget('header', { part: 'contact', index: 1 }, withEmptyContact)).toEqual({ kind: 'contacts', contactId: 'c2' })
    expect(hitTarget('header', none, sample)).toEqual({ kind: 'fullName' })
  })

  it('focuses the clicked field of an entry, and the clicked bullet', () => {
    const entry = { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' } as const
    expect(hitTarget('e1', { part: 'role', index: 0 }, sample)).toEqual({ ...entry, field: 'role' })
    expect(hitTarget('e1', { part: 'company', index: 0 }, sample)).toEqual({ ...entry, field: 'company' })
    expect(hitTarget('e1', { part: 'date', index: 0 }, sample)).toEqual({ ...entry, field: 'start' })
    // Pierwszy punkt jest w bloku wpisu, kolejne w swoich blokach.
    expect(hitTarget('e1', { part: 'item', index: 0 }, sample)).toEqual({ ...entry, bulletId: 'e1-b1' })
    expect(hitTarget('e1:e1-b4', { part: 'item', index: 0 }, sample)).toEqual({ ...entry, bulletId: 'e1-b4' })
    expect(hitTarget('e1', none, sample)).toEqual(entry)
    // Kliknięty punkt dalej w bloku wpisu (np. trzeci) – po bloku punktu, nie po numerze dziecka.
    expect(hitTarget('e2:e2-b3', { part: 'item', index: 0 }, sample)).toEqual({
      kind: 'experienceItem',
      sectionId: 'experience',
      itemId: 'e2',
      bulletId: 'e2-b3'
    })

    const education = { kind: 'educationItem', sectionId: 'education', itemId: 'ed2' } as const
    expect(hitTarget('ed2', { part: 'educationLevel', index: 0 }, sample)).toEqual({ ...education, field: 'level' })
    expect(hitTarget('ed2', { part: 'date', index: 0 }, sample)).toEqual({ ...education, field: 'start' })
    expect(hitTarget('ed2', none, sample)).toEqual(education)
  })

  it('finds the clicked item of a list row in every column layout, and the section title beside the list', () => {
    // Bold i Modern: 2 kolumny – drugi wiersz zaczyna się od trzeciego elementu.
    const twoColumns = generateBlocks(sample, templates.bold.geometry).filter((block) => block.kind === 'listRow')
    expect(twoColumns.map((block) => block.id)).toEqual(['skills:s1', 'skills:s3', 'skills:s5', 'languages:l1'])
    expect(hitTarget('skills:s3', { part: 'item', index: 1 }, sample)).toEqual({
      kind: 'listSection',
      sectionId: 'skills',
      itemId: 's4'
    })
    // Classic: tytuł obok listy, w pierwszym wierszu.
    expect(hitTarget('skills:s1', { part: 'sectionTitle', index: 0 }, sample)).toEqual({
      kind: 'sectionTitle',
      sectionId: 'skills'
    })
    expect(hitTarget('skills:s1', { part: 'item', index: 0 }, sample)).toEqual({
      kind: 'listSection',
      sectionId: 'skills',
      itemId: 's1'
    })
    expect(hitTarget('skills:s1', none, sample)).toEqual({ kind: 'listSection', sectionId: 'skills' })
  })
})

describe('fragmentKey and fragmentTarget', () => {
  it('give one fragment for an entry with its bullets, whatever field was clicked', () => {
    const bullet: EditTarget = { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1', bulletId: 'e1-b2' }
    const role: EditTarget = { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1', field: 'role' }
    expect(fragmentKey(bullet)).toBe(fragmentKey(role))
    expect(fragmentTarget(bullet)).toEqual({ kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' })
    expect(fragmentKey({ kind: 'contacts', contactId: 'c1' })).toBe('contacts')
    expect(fragmentKey({ kind: 'sectionTitle', sectionId: 'skills' })).not.toBe(fragmentKey({ kind: 'listSection', sectionId: 'skills' }))
  })
})

describe('targetExists', () => {
  const withoutSection = (sectionId: string): CvDocument => ({
    ...sample,
    sections: sample.sections.filter((section) => section.id !== sectionId)
  })
  const withoutEntry: CvDocument = {
    ...sample,
    sections: sample.sections.map((section) =>
      section.type === 'experience' ? { ...section, items: section.items.filter((item) => item.id !== 'e2') } : section
    )
  }
  const emptyHeader: CvDocument = { ...sample, header: { fullName: '', photo: null, contacts: [], summary: '' } }

  it('keeps the header parts and the consent clause even when they are no longer on the page', () => {
    for (const target of [
      { kind: 'fullName' },
      { kind: 'photo' },
      { kind: 'contacts', contactId: 'c1' },
      { kind: 'summary' },
      { kind: 'consent' }
    ] as const) {
      expect(targetExists(target, emptyHeader)).toBe(true)
    }
  })

  it('tells whether the section or the entry is still in the CV after a change (also after undo)', () => {
    const title: EditTarget = { kind: 'sectionTitle', sectionId: 'skills' }
    const list: EditTarget = { kind: 'listSection', sectionId: 'skills', itemId: 's1' }
    const entry: EditTarget = { kind: 'experienceItem', sectionId: 'experience', itemId: 'e2', bulletId: 'e2-b1' }
    const education: EditTarget = { kind: 'educationItem', sectionId: 'education', itemId: 'ed1' }
    for (const target of [title, list, entry, education]) expect(targetExists(target, sample)).toBe(true)
    expect(targetExists(title, withoutSection('skills'))).toBe(false)
    expect(targetExists(list, withoutSection('skills'))).toBe(false)
    expect(targetExists(entry, withoutEntry)).toBe(false)
    expect(targetExists({ ...entry, itemId: 'e1' }, withoutEntry)).toBe(true)
    expect(targetExists(education, withoutSection('education'))).toBe(false)
  })

  it('keeps an entry or a list card open when only one of its bullets or items is removed', () => {
    const withoutBullet: CvDocument = {
      ...sample,
      sections: sample.sections.map((section) =>
        section.type === 'experience'
          ? { ...section, items: section.items.map((item) => ({ ...item, bullets: item.bullets.filter((bullet) => bullet.id !== 'e2-b1') })) }
          : section
      )
    }
    const withoutListItem: CvDocument = {
      ...sample,
      sections: sample.sections.map((section) =>
        section.type === 'list' ? { ...section, items: section.items.filter((item) => item.id !== 's1') } : section
      )
    }
    expect(targetExists({ kind: 'experienceItem', sectionId: 'experience', itemId: 'e2', bulletId: 'e2-b1' }, withoutBullet)).toBe(true)
    expect(targetExists({ kind: 'listSection', sectionId: 'skills', itemId: 's1' }, withoutListItem)).toBe(true)
    // Wpis wykształcenia nie jest stanowiskiem – cel innego rodzaju o tym samym id nie istnieje.
    expect(targetExists({ kind: 'experienceItem', sectionId: 'education', itemId: 'ed1' }, sample)).toBe(false)
  })
})
