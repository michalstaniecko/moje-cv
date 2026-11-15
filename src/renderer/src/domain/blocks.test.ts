import { describe, expect, it } from 'vitest'
import { generateBlocks } from './blocks'
import { sampleCvs } from './sampleCv'
import type { CvDocument, Section } from './schema'
import type { ListSectionLayout } from './templateGeometry'
import { testGeometry, withSpacing } from './testGeometry'

// Odstępy sprawdzane niżej (reszta z geometrii testowej).
const spacing = withSpacing({
  afterHeader: 10,
  beforeSectionTitle: 12,
  afterSectionTitle: 3,
  betweenBullets: 1,
  afterExperienceItem: 8,
  afterEducationItem: 2,
  afterEducationSection: 7,
  betweenListItems: 0.5,
  afterListSection: 4
})

const geometry = (listSectionLayout: ListSectionLayout = { title: 'beside', columns: 1 }) => ({
  ...testGeometry,
  blockSpacingMm: spacing,
  listSectionLayout
})

const spaceAfter = (blocks: ReturnType<typeof generateBlocks>, id: string) =>
  blocks.find((block) => block.id === id)?.spaceAfterMm

// Dokument z samymi podanymi sekcjami (bez nagłówka).
const withSections = (...sections: Section[]): CvDocument => ({
  ...sampleCvs.en,
  header: { fullName: '', photo: null, contacts: [], summary: '' },
  sections
})

const listSection = (overrides: Partial<Extract<Section, { type: 'list' }>> = {}): Section => ({
  id: 'skills',
  type: 'list',
  title: 'Skills',
  hidden: false,
  pageBreakBefore: false,
  items: ['A', 'B', 'C', 'D', 'E'].map((text) => ({ id: text.toLowerCase(), text })),
  ...overrides
})

const educationSection = sampleCvs.en.sections.find(
  (section): section is Extract<Section, { type: 'education' }> => section.type === 'education'
)!

describe('generateBlocks', () => {
  it('takes the spacing between blocks from the template geometry', () => {
    const blocks = generateBlocks(sampleCvs.en, geometry())
    // Po nagłówku 10 mm, ale przed tytułem sekcji 12 mm – liczy się większy odstęp.
    expect(spaceAfter(blocks, 'header')).toBe(12)
    expect(spaceAfter(blocks, 'experience:title')).toBe(3)
    expect(spaceAfter(blocks, 'e1')).toBe(1)
    // Ostatni punkt wpisu: odstęp między punktami + odstęp po wpisie.
    expect(spaceAfter(blocks, 'e1:e1-b8')).toBe(9)
    expect(spaceAfter(blocks, 'ed1')).toBe(2)
    expect(spaceAfter(blocks, 'ed2')).toBe(7)
    expect(spaceAfter(blocks, 'skills:s1')).toBe(0.5)
    expect(spaceAfter(blocks, 'skills:s5')).toBe(4.5)
    // Ostatni blok dokumentu nie ma odstępu.
    expect(spaceAfter(blocks, 'languages:l2')).toBe(0)
  })

  describe('a list section with the title above the list in two columns', () => {
    const twoColumns = geometry({ title: 'above', columns: 2 })

    it('gives a section title block followed by rows of two items, the last row with the odd item', () => {
      const blocks = generateBlocks(withSections(listSection(), listSection({ id: 'languages', title: 'Languages' })), twoColumns)

      expect(blocks.slice(0, 4)).toEqual([
        { kind: 'sectionTitle', id: 'skills:title', title: 'Skills', keepWithNext: true, breakBefore: false, spaceAfterMm: 3 },
        expect.objectContaining({ kind: 'listRow', id: 'skills:a', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], keepWithNext: false, spaceAfterMm: 0.5 }),
        expect.objectContaining({ kind: 'listRow', id: 'skills:c', items: [{ id: 'c', text: 'C' }, { id: 'd', text: 'D' }], spaceAfterMm: 0.5 }),
        // Po ostatnim wierszu: odstęp między elementami + po sekcji, ale przed kolejnym tytułem 12 mm.
        expect.objectContaining({ kind: 'listRow', id: 'skills:e', items: [{ id: 'e', text: 'E' }], spaceAfterMm: 12 })
      ])
      expect(blocks.at(-1)).toMatchObject({ id: 'languages:e', spaceAfterMm: 0 })
    })

    it('leaves out empty items and, with an empty title, the title block', () => {
      const section = listSection({ title: '  ', items: [{ id: 'a', text: 'A' }, { id: 'x', text: ' ' }, { id: 'b', text: 'B' }] })

      expect(generateBlocks(withSections(section), twoColumns).map((block) => block.id)).toEqual(['skills:a'])
    })

    it('puts a page break forced on the section on its first block', () => {
      const blocks = generateBlocks(withSections(listSection({ pageBreakBefore: true })), twoColumns)

      expect(blocks.map((block) => block.breakBefore)).toEqual([true, false, false, false])
    })
  })

  it('beside the list in one column, a list section gives one block per item with the title on the first', () => {
    const blocks = generateBlocks(withSections(listSection({ items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] })), geometry())

    expect(blocks).toEqual([
      { kind: 'listRow', id: 'skills:a', title: 'Skills', items: [{ id: 'a', text: 'A' }], keepWithNext: false, breakBefore: false, spaceAfterMm: 0.5 },
      { kind: 'listRow', id: 'skills:b', title: '', items: [{ id: 'b', text: 'B' }], keepWithNext: false, breakBefore: false, spaceAfterMm: 0 }
    ])
  })

  describe('position of the entry blocks in their section', () => {
    const positions = (document: CvDocument) =>
      generateBlocks(document, geometry())
        .filter((block) => 'sectionPosition' in block)
        .map((block) => [block.id, 'sectionPosition' in block && block.sectionPosition])
    const experience = sampleCvs.en.sections.find(
      (section): section is Extract<Section, { type: 'experience' }> => section.type === 'experience'
    )!
    const education = educationSection

    it('marks the first and the last entry of experience and education, and the blocks after the last entry', () => {
      expect(positions(withSections(experience, education))).toEqual([
        ['e1', 'first'],
        ...['e1:e1-b2', 'e1:e1-b3', 'e1:e1-b4', 'e1:e1-b5', 'e1:e1-b6', 'e1:e1-b7', 'e1:e1-b8', 'e2'].map((id) => [id, 'middle']),
        ...['e2:e2-b2', 'e2:e2-b3', 'e2:e2-b4', 'e2:e2-b5', 'e2:e2-b6', 'e2:e2-b7', 'e3'].map((id) => [id, 'middle']),
        ...['e3:e3-b2', 'e3:e3-b3', 'e3:e3-b4', 'e3:e3-b5'].map((id) => [id, 'middle']),
        // Linia kończy się przy kropce ostatniego wpisu, a nie przy jego ostatnim punkcie.
        ['e4', 'last'],
        ...['e4:e4-b2', 'e4:e4-b3', 'e4:e4-b4'].map((id) => [id, 'afterLast']),
        ['ed1', 'first'],
        ['ed2', 'last']
      ])
    })

    it('marks the only entry of a section, skipping empty entries', () => {
      const oneEntry = {
        ...education,
        items: [education.items[0]!, { ...education.items[1]!, level: ' ', field: '', institution: '', start: null, end: null }]
      }

      expect(positions(withSections(oneEntry))).toEqual([['ed1', 'only']])
    })

    it('marks the points of an only entry as after it, so the section has just the dot', () => {
      const oneEntry = { ...experience, items: [experience.items[3]!] }

      expect(positions(withSections(oneEntry))).toEqual([
        ['e4', 'only'],
        ...['e4:e4-b2', 'e4:e4-b3', 'e4:e4-b4'].map((id) => [id, 'afterLast'])
      ])
    })
  })

  describe('a hidden photo', () => {
    const withPhoto = (photo: CvDocument['header']['photo'], header: Partial<CvDocument['header']> = {}): CvDocument => ({
      ...sampleCvs.en,
      header: { ...sampleCvs.en.header, ...header, photo }
    })
    const photoUrl = 'data:image/png;base64,iVBORw0KGgo='

    it('is left out of the header, while a shown photo is in it', () => {
      expect(generateBlocks(withPhoto({ dataUrl: photoUrl, hidden: false }), geometry())[0]).toMatchObject({ kind: 'header', photoUrl })
      expect(generateBlocks(withPhoto({ dataUrl: photoUrl, hidden: true }), geometry())[0]).toMatchObject({ kind: 'header', photoUrl: null })
    })

    it('alone gives no header block, like no photo at all', () => {
      const onlyPhoto = (hidden: boolean) => withPhoto({ dataUrl: photoUrl, hidden }, { fullName: '', contacts: [], summary: '' })

      expect(generateBlocks(onlyPhoto(false), geometry())[0]).toMatchObject({ kind: 'header' })
      expect(generateBlocks(onlyPhoto(true), geometry()).some((block) => block.kind === 'header')).toBe(false)
    })
  })

  it('writes the end of an ongoing entry in the CV language, leaving the section titles as they are', () => {
    const inLanguage = (language: CvDocument['settings']['language']) =>
      generateBlocks({ ...sampleCvs.en, settings: { ...sampleCvs.en.settings, language } }, geometry())

    expect(inLanguage('en')).toContainEqual(expect.objectContaining({ id: 'e1', dates: '03.2023 – present' }))
    expect(inLanguage('pl')).toContainEqual(expect.objectContaining({ id: 'e1', dates: '03.2023 – obecnie' }))
    expect(inLanguage('pl')).toContainEqual(expect.objectContaining({ id: 'experience:title', title: 'Work experience' }))
  })

  it('keeps the level of an education entry apart from the rest of its line', () => {
    const education = educationSection
    const item = { ...education.items[0]!, level: 'Master’s degree', field: 'Logistics', institution: ' ' }
    const noLevel = { ...item, id: 'ed2', level: '', institution: 'Fictional Academy' }

    expect(generateBlocks(withSections({ ...education, items: [item, noLevel] }), geometry()).slice(1)).toEqual([
      expect.objectContaining({ id: 'ed1', level: 'Master’s degree', details: 'Logistics' }),
      expect.objectContaining({ id: 'ed2', level: '', details: 'Logistics, Fictional Academy' })
    ])
  })

  describe('the parts of a CV revealed in Edit mode (`reveal`)', () => {
    const emptyHeader = { fullName: '', photo: null, contacts: [{ id: 'c1', label: 'Phone', value: '' }], summary: '' }
    const withEmptyTitle = (section: Section): Section => ({ ...section, title: '' })
    const experience = sampleCvs.en.sections[0]!
    const twoColumns = geometry({ title: 'above', columns: 2 })

    it('changes nothing without revealed parts, for every Sample CV and both list layouts', () => {
      for (const document of Object.values(sampleCvs)) {
        for (const layout of [geometry(), twoColumns]) {
          expect(generateBlocks(document, layout, { reveal: new Set() })).toEqual(generateBlocks(document, layout))
        }
      }
    })

    it('gives an empty header a block when its full name or summary is revealed', () => {
      const document = { ...withSections(listSection()), header: emptyHeader }

      expect(generateBlocks(document, geometry()).map((block) => block.id)).not.toContain('header')
      for (const part of ['fullName', 'summary']) {
        expect(generateBlocks(document, geometry(), { reveal: new Set([part]) })[0]).toEqual(
          expect.objectContaining({ kind: 'header', id: 'header', fullName: '', summary: '', contacts: [] })
        )
      }
    })

    it('gives the header a block with every contact, the empty ones too, when the contacts are revealed', () => {
      const document = { ...withSections(listSection()), header: { ...emptyHeader, contacts: [...emptyHeader.contacts, { id: 'c2', label: '', value: 'jane@example.com' }] } }

      expect(generateBlocks(document, geometry())[0]).toEqual(
        expect.objectContaining({ kind: 'header', contacts: [{ id: 'c2', label: '', value: 'jane@example.com' }] })
      )
      expect(generateBlocks(document, geometry(), { reveal: new Set(['contacts']) })[0]).toEqual(
        expect.objectContaining({ kind: 'header', contacts: document.header.contacts })
      )
      const noContacts = { ...withSections(listSection()), header: emptyHeader }
      expect(generateBlocks(noContacts, geometry(), { reveal: new Set(['contacts']) })[0]).toEqual(
        expect.objectContaining({ kind: 'header', id: 'header', contacts: emptyHeader.contacts })
      )
    })

    it('gives a section with entries a title block for its empty title when the title is revealed', () => {
      const document = withSections(withEmptyTitle(experience), withEmptyTitle(listSection()))
      const reveal = new Set(['sectionTitle:experience', 'sectionTitle:skills'])

      expect(generateBlocks(document, twoColumns).map((block) => block.id)).not.toContain('experience:title')
      const blocks = generateBlocks(document, twoColumns, { reveal })
      expect(blocks[0]).toEqual(expect.objectContaining({ kind: 'sectionTitle', id: 'experience:title', title: '', keepWithNext: true }))
      expect(blocks.map((block) => block.id)).toContain('skills:title')
      // Odstęp przed odsłoniętym tytułem jak przed każdym innym tytułem sekcji.
      expect(spaceAfter(blocks, 'e4:e4-b4')).toBe(12)
    })

    it('reveals no title of a section without entries on the pages, nor beside a list (the title is in its first row)', () => {
      const emptySection = { ...withEmptyTitle(experience), items: [] }
      const document = withSections(emptySection, withEmptyTitle(listSection()))
      const reveal = new Set(['sectionTitle:experience', 'sectionTitle:skills'])

      expect(generateBlocks(document, geometry(), { reveal })).toEqual(generateBlocks(document, geometry()))
    })

    it('gives a revealed position a block with all its fields and bullets, the empty ones too', () => {
      const position = experience.type === 'experience' ? experience.items[0]! : null
      const emptied = {
        ...position!,
        role: '',
        company: '',
        location: '',
        start: null,
        end: null,
        bullets: [
          { id: 'b1', text: '' },
          { id: 'b2', text: 'Second' },
          { id: 'b3', text: ' ' }
        ]
      }
      const document = withSections({ ...experience, items: [emptied] } as Section)

      expect(generateBlocks(document, geometry()).map((block) => block.id)).toEqual(['experience:title', 'e1'])
      const blocks = generateBlocks(document, geometry(), { reveal: new Set(['item:e1']) })
      expect(blocks.map((block) => block.id)).toEqual(['experience:title', 'e1', 'e1:b2', 'e1:b3'])
      expect(blocks[1]).toEqual(expect.objectContaining({ kind: 'experienceEntry', role: '', companyLine: '', dates: '', firstBullet: '' }))
      expect(blocks[3]!.spaceAfterMm).toBe(0)

      // Bez punktów – sam wpis.
      const bare = withSections({ ...experience, items: [{ ...emptied, bullets: [] }] } as Section)
      expect(generateBlocks(bare, geometry()).map((block) => block.id)).toEqual([])
      expect(generateBlocks(bare, geometry(), { reveal: new Set(['item:e1']) })).toEqual([
        expect.objectContaining({ id: 'experience:title' }),
        expect.objectContaining({ id: 'e1', firstBullet: null })
      ])
    })

    it('gives a revealed empty education entry a block', () => {
      const entry = { ...educationSection.items[0]!, level: '', field: '', institution: '', start: null, end: null }
      const document = withSections({ ...educationSection, items: [entry] })

      expect(generateBlocks(document, geometry())).toEqual([])
      expect(generateBlocks(document, geometry(), { reveal: new Set([`item:${entry.id}`]) })[1]).toEqual(
        expect.objectContaining({ kind: 'educationEntry', id: entry.id, level: '', details: '', dates: '' })
      )
    })

    it('gives every item of a revealed list a place in the rows, the empty ones too, with the title beside the first row', () => {
      const items = ['', 'B', ' ', 'D'].map((text, index) => ({ id: `i${index}`, text }))
      const document = withSections(listSection({ items }))
      const reveal = new Set(['list:skills'])

      expect(generateBlocks(document, geometry()).map((block) => block.id)).toEqual(['skills:i1', 'skills:i3'])
      expect(generateBlocks(document, geometry(), { reveal })).toEqual([
        expect.objectContaining({ id: 'skills:i0', title: 'Skills', items: [{ id: 'i0', text: '' }] }),
        expect.objectContaining({ id: 'skills:i1', title: '', items: [{ id: 'i1', text: 'B' }] }),
        expect.objectContaining({ id: 'skills:i2', title: '' }),
        expect.objectContaining({ id: 'skills:i3', title: '' })
      ])
      expect(generateBlocks(document, twoColumns, { reveal }).map((block) => block.id)).toEqual(['skills:title', 'skills:i0', 'skills:i2'])
    })
  })
})
