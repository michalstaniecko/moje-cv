import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/en'
import { generateBlocks } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument } from '../domain/schema'
import type { SlotName } from '../template/editable'
import { templates } from '../template/templates'
import {
  fieldChange,
  fragmentHasEmptyField,
  isListField,
  mergeBackward,
  mergeForward,
  moveField,
  pageFieldKey,
  pageFieldOf,
  pageFieldTarget,
  pasteLines,
  splitField
} from './pageFields'

const sample = sampleCvs.en
const t = en.editor

// Pola, które rysują sloty nagłówka i tytułów wszystkich bloków Sample CV w danej geometrii.
function fieldsOf(document: CvDocument, template: keyof typeof templates, slots: SlotName[] = ['fullName', 'summary', 'title']) {
  return generateBlocks(document, templates[template].geometry).flatMap((block) =>
    slots.flatMap((slot) => {
      const parts = slot === 'item' && block.kind === 'listRow' ? block.items.map((item) => item.id) : [undefined]
      return parts.flatMap((part) => {
        const field = pageFieldOf(block, slot, document, t, undefined, part)
        return field ? [{ block: block.id, slot, ...field }] : []
      })
    })
  )
}

const entrySlots: SlotName[] = ['role', 'company', 'location', 'bullet', 'level', 'field', 'institution', 'item']
const sectionOf = (document: CvDocument, id: string) => document.sections.find((section) => section.id === id)!
const bulletTexts = (document: CvDocument, itemId: string) => {
  const section = sectionOf(document, 'experience')
  return section.type === 'experience' ? section.items.find((item) => item.id === itemId)!.bullets.map((bullet) => bullet.text) : []
}
const listTexts = (document: CvDocument, sectionId: string) => {
  const section = sectionOf(document, sectionId)
  return section.type === 'list' ? section.items.map((item) => item.text) : []
}

describe('pageFieldOf', () => {
  it('gives the name, the summary and every section title of the Sample CV, with the title beside a list in its first row only', () => {
    expect(fieldsOf(sample, 'classic')).toEqual([
      { block: 'header', slot: 'fullName', key: 'header:fullName', fragment: 'fullName', label: 'Full name', placeholder: 'Full name', spellcheck: false, value: 'Jane Example' },
      { block: 'header', slot: 'summary', key: 'header:summary', fragment: 'summary', label: 'Summary', placeholder: 'Summary', spellcheck: true, value: sample.header.summary },
      expect.objectContaining({ block: 'experience:title', key: 'section:experience:title', fragment: 'sectionTitle:experience', label: 'Section title “Work experience”', placeholder: 'Work experience' }),
      expect.objectContaining({ block: 'education:title', key: 'section:education:title', placeholder: 'Education' }),
      expect.objectContaining({ block: 'skills:s1', slot: 'title', key: 'section:skills:title', fragment: 'sectionTitle:skills', placeholder: 'List' }),
      expect.objectContaining({ block: 'languages:l1', slot: 'title', key: 'section:languages:title' })
    ])
    // Tytuł nad listą to osobny blok. (Pierwszy wiersz listy też wskazuje pole tytułu, ale w tym układzie żaden szablon
    // nie rysuje tytułu w wierszu – slot pyta o nie tylko przy tytule obok listy, template/editable.tsx.)
    expect(fieldsOf(sample, 'modern').map((field) => field.block)).toEqual([
      'header',
      'header',
      'experience:title',
      'education:title',
      'skills:title',
      'skills:s1',
      'languages:title',
      'languages:l1'
    ])
  })

  it('names a section without a title by its type', () => {
    const untitled = { ...sample, sections: sample.sections.map((section) => ({ ...section, title: '' })) }
    const reveal = new Set(['sectionTitle:experience'])
    const block = generateBlocks(untitled, templates.classic.geometry, { reveal }).find((candidate) => candidate.id === 'experience:title')!
    expect(pageFieldOf(block, 'title', untitled, t)).toEqual(
      expect.objectContaining({ label: 'Section title “Work experience”', placeholder: 'Work experience' })
    )
  })

  it('gives every text field of the positions, education entries and lists, named after the field and the part of the CV', () => {
    const fields = fieldsOf(sample, 'classic', entrySlots)
    expect(fields.filter((field) => field.block === 'e1' || field.block === 'e1:e1-b2')).toEqual([
      { block: 'e1', slot: 'role', key: 'experience:e1:role', fragment: 'item:e1', label: 'Job title – Position “Senior Procurement Specialist”', placeholder: 'Job title', spellcheck: true, value: 'Senior Procurement Specialist' },
      expect.objectContaining({ slot: 'company', key: 'experience:e1:company', label: 'Company – Position “Senior Procurement Specialist”', placeholder: 'Company', value: 'Fictional Manufacturing Ltd' }),
      expect.objectContaining({ slot: 'location', key: 'experience:e1:location', placeholder: 'City', value: 'Manchester' }),
      expect.objectContaining({ slot: 'bullet', key: 'experience:e1:bullet:e1-b1', fragment: 'item:e1', label: 'Bullet 1 – Position “Senior Procurement Specialist”', placeholder: 'Bullet 1' }),
      expect.objectContaining({ block: 'e1:e1-b2', slot: 'bullet', key: 'experience:e1:bullet:e1-b2' })
    ])
    expect(fields.filter((field) => field.block === 'ed2')).toEqual([
      expect.objectContaining({ slot: 'level', key: 'education:ed2:level', fragment: 'item:ed2', label: 'Level – Education “Master’s degree, Logistics”', placeholder: 'Level' }),
      expect.objectContaining({ slot: 'field', key: 'education:ed2:field', placeholder: 'Field of study', value: 'Logistics' }),
      expect.objectContaining({ slot: 'institution', key: 'education:ed2:institution', placeholder: 'School', value: 'Fictional Academy' })
    ])
    expect(fields.filter((field) => field.block.startsWith('languages:'))).toEqual([
      expect.objectContaining({ slot: 'item', key: 'list:l1:text', fragment: 'list:languages', label: 'Item 1 – List “Languages”', placeholder: 'Item 1', value: 'English – native' }),
      expect.objectContaining({ slot: 'item', key: 'list:l2:text', label: 'Item 2 – List “Languages”' })
    ])
    // Każdy punkt Sample CV ma jedno pole (pierwszy w bloku wpisu, kolejne we własnych blokach).
    const bullets = sample.sections[0]!.type === 'experience' ? sample.sections[0]!.items.flatMap((item) => item.bullets) : []
    expect(fields.filter((field) => field.slot === 'bullet').map((field) => field.value)).toEqual(bullets.map((bullet) => bullet.text))
  })

  it('gives the first bullet on the page to the entry block: the first filled one, or the first one in a revealed entry', () => {
    const withEmptyFirst: CvDocument = {
      ...sample,
      sections: sample.sections.map((section) =>
        section.type === 'experience'
          ? { ...section, items: section.items.map((item, index) => (index === 0 ? { ...item, bullets: [{ id: 'empty', text: '' }, ...item.bullets] } : item)) }
          : section
      )
    }
    const entry = (reveal: Set<string>) => generateBlocks(withEmptyFirst, templates.classic.geometry, { reveal }).find((block) => block.id === 'e1')!
    expect(pageFieldOf(entry(new Set()), 'bullet', withEmptyFirst, t)!.key).toBe('experience:e1:bullet:e1-b1')
    const revealed = new Set(['item:e1'])
    expect(pageFieldOf(entry(revealed), 'bullet', withEmptyFirst, t, revealed)!.key).toBe('experience:e1:bullet:empty')
  })

  it('gives no field for a slot of another block or a block from outside the document', () => {
    const blocks = generateBlocks(sample, templates.classic.geometry)
    const entry = blocks.find((block) => block.id === 'e1')!
    const title = blocks.find((block) => block.id === 'experience:title')!
    expect(pageFieldOf(entry, 'title', sample, t)).toBeNull()
    expect(pageFieldOf(title, 'fullName', sample, t)).toBeNull()
    expect(pageFieldOf({ ...title, id: 'gone:title' }, 'title', sample, t)).toBeNull()
  })
})

describe('field keys', () => {
  it('are the undo merge keys of the same fields in the CV form', () => {
    const source = (file: string) => readFileSync(join(__dirname, '../editor/fields', file), 'utf8')
    expect(source('FullNameField.tsx')).toContain(`'header:fullName'`)
    expect(source('SummaryField.tsx')).toContain(`'header:summary'`)
    expect(source('SectionTitleField.tsx')).toContain('`section:${section.id}:title`')
    expect(source('ExperienceItemFields.tsx')).toContain('`experience:${item.id}:${field}`')
    expect(source('ExperienceItemFields.tsx')).toContain('mergeKey(`bullet:${bullet.id}`)')
    expect(source('EducationItemFields.tsx')).toContain('`education:${item.id}:${field}`')
    expect(source('ListItemsFields.tsx')).toContain('`list:${item.id}:text`')
  })

  it('map to the part of the CV and back', () => {
    const titled = { ...sample, sections: [...sample.sections, { ...sample.sections[2]!, id: 'a:b' }] }
    const targets = [
      { kind: 'fullName' },
      { kind: 'summary' },
      { kind: 'sectionTitle', sectionId: 'a:b' },
      { kind: 'experienceItem', sectionId: 'experience', itemId: 'e2', field: 'company' },
      { kind: 'experienceItem', sectionId: 'experience', itemId: 'e2', bulletId: 'e2-b3' },
      { kind: 'educationItem', sectionId: 'education', itemId: 'ed1', field: 'institution' },
      { kind: 'listSection', sectionId: 'skills', itemId: 's2' }
    ] as const
    for (const target of targets) expect(pageFieldTarget(pageFieldKey(target)!, titled)).toEqual(target)
    expect(pageFieldKey({ kind: 'photo' })).toBeNull()
    // Wpis bez pola tekstowego (np. z kliknięcia w datę) – jeszcze karta.
    expect(pageFieldKey({ kind: 'experienceItem', sectionId: 'experience', itemId: 'e1', field: 'start' })).toBeNull()
    expect(pageFieldKey({ kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' })).toBeNull()
    expect(pageFieldKey({ kind: 'listSection', sectionId: 'languages' }, sample)).toBe('list:l1:text')
    expect(pageFieldTarget('experience:gone:role', sample)).toBeNull()
    expect(pageFieldTarget('list:e1:text', sample)).toBeNull()
  })
})

describe('fieldChange', () => {
  it('writes the new value into its field', () => {
    expect(fieldChange('header:fullName', 'Ann')(sample).header.fullName).toBe('Ann')
    expect(fieldChange('header:summary', 'Line 1\nLine 2')(sample).header.summary).toBe('Line 1\nLine 2')
    const changed = fieldChange('section:education:title', 'Studies')(sample)
    expect(changed.sections.find((section) => section.id === 'education')!.title).toBe('Studies')
    expect(fieldChange('unknown', 'x')(sample)).toBe(sample)
    const position = (document: CvDocument) => (sectionOf(document, 'experience').items as { id: string }[])[1] as unknown as Record<string, unknown>
    expect(position(fieldChange('experience:e2:location', 'Hull')(sample))['location']).toBe('Hull')
    expect(bulletTexts(fieldChange('experience:e2:bullet:e2-b2', 'New')(sample), 'e2')[1]).toBe('New')
    const education = fieldChange('education:ed1:field', 'Physics')(sample)
    expect((sectionOf(education, 'education').items[0] as { field: string }).field).toBe('Physics')
    expect(listTexts(fieldChange('list:l2:text', 'French')(sample), 'languages')).toEqual(['English – native', 'French'])
    expect(fieldChange('experience:gone:role', 'x')(sample)).toBe(sample)
  })
})

describe('fragmentHasEmptyField', () => {
  it('tells whether entering a fragment needs revealing it', () => {
    const empty = { ...sample, header: { ...sample.header, fullName: ' ', summary: '' }, sections: [{ ...sample.sections[0]!, title: '' }] }
    for (const fragment of ['fullName', 'summary', 'sectionTitle:experience']) {
      expect(fragmentHasEmptyField(fragment, sample), fragment).toBe(false)
      expect(fragmentHasEmptyField(fragment, empty), fragment).toBe(true)
    }
    expect(fragmentHasEmptyField('sectionTitle:gone', empty)).toBe(false)
    expect(fragmentHasEmptyField('item:gone', empty)).toBe(false)

    for (const fragment of ['item:e1', 'item:ed1', 'list:skills']) expect(fragmentHasEmptyField(fragment, sample), fragment).toBe(false)
    expect(fragmentHasEmptyField('item:e2', fieldChange('experience:e2:location', ' ')(sample))).toBe(true)
    expect(fragmentHasEmptyField('item:e2', fieldChange('experience:e2:bullet:e2-b4', '')(sample))).toBe(true)
    expect(fragmentHasEmptyField('item:ed2', fieldChange('education:ed2:level', '')(sample))).toBe(true)
    expect(fragmentHasEmptyField('list:skills', fieldChange('list:s3:text', '')(sample))).toBe(true)
  })
})

describe('revealing', () => {
  it('uses the fragment keys of the editing layer, which generateBlocks understands', () => {
    const empty: CvDocument = {
      ...sample,
      header: { fullName: '', photo: null, contacts: [], summary: '' },
      sections: sample.sections.map((section) => ({ ...section, title: '' }))
    }
    const geometry = templates.modern.geometry
    const header = generateBlocks(empty, geometry, { reveal: new Set([pageFieldOf(generateBlocks(sample, geometry)[0]!, 'fullName', sample, t)!.fragment]) })
    expect(header[0]).toEqual(expect.objectContaining({ kind: 'header', fullName: '' }))
    const title = generateBlocks(sample, geometry).find((block) => block.id === 'education:title')!
    const revealed = generateBlocks(empty, geometry, { reveal: new Set([pageFieldOf(title, 'title', sample, t)!.fragment]) })
    expect(revealed.map((block) => block.id)).toContain('education:title')
  })
})

describe('the structure of bullets and list items from the keyboard', () => {
  it('tells bullets and list items from other fields', () => {
    expect(['experience:e1:bullet:b1', 'list:s1:text'].map(isListField)).toEqual([true, true])
    expect(['experience:e1:role', 'header:summary', 'section:skills:title'].map(isListField)).toEqual([false, false, false])
  })

  it('splits at the caret with Enter and puts the caret at the start of the new element; an empty one or another field does not split', () => {
    const split = splitField('experience:e1:bullet:e1-b1', sample, { start: 5, end: 9 }, 'new')!
    expect(split.focus).toEqual({ key: 'experience:e1:bullet:new', caret: 0 })
    const texts = bulletTexts(split.change(sample), 'e1')
    expect(texts.slice(0, 2)).toEqual([bulletTexts(sample, 'e1')[0]!.slice(0, 5), bulletTexts(sample, 'e1')[0]!.slice(9)])

    const list = splitField('list:l1:text', sample, { start: 7, end: 7 }, 'l-new')!
    expect(listTexts(list.change(sample), 'languages')).toEqual(['English', ' – native', 'German – B2'])
    expect(list.focus).toEqual({ key: 'list:l-new:text', caret: 0 })

    expect(splitField('list:l1:text', fieldChange('list:l1:text', ' ')(sample), { start: 1, end: 1 })).toBeNull()
    expect(splitField('experience:e1:role', sample, { start: 1, end: 1 })).toBeNull()
  })

  it('joins with the previous element on Backspace at the start, or removes an empty element; the first one stays', () => {
    const merged = mergeBackward('list:l2:text', sample)!
    expect(listTexts(merged.change(sample), 'languages')).toEqual(['English – nativeGerman – B2'])
    expect(merged.focus).toEqual({ key: 'list:l1:text', caret: 'English – native'.length })

    const withEmpty = fieldChange('experience:e1:bullet:e1-b2', '')(sample)
    const removed = mergeBackward('experience:e1:bullet:e1-b2', withEmpty)!
    expect(bulletTexts(removed.change(withEmpty), 'e1')).toEqual(bulletTexts(sample, 'e1').filter((_, index) => index !== 1))
    expect(removed.focus).toEqual({ key: 'experience:e1:bullet:e1-b1', caret: bulletTexts(sample, 'e1')[0]!.length })

    expect(mergeBackward('list:l1:text', sample)).toBeNull()
    expect(mergeBackward('header:summary', sample)).toBeNull()
  })

  it('joins the next element on Delete at the end; the last one stays', () => {
    const merged = mergeForward('list:l1:text', sample)!
    expect(listTexts(merged.change(sample), 'languages')).toEqual(['English – nativeGerman – B2'])
    expect(merged.focus).toEqual({ key: 'list:l1:text', caret: 'English – native'.length })
    expect(mergeForward('list:l2:text', sample)).toBeNull()
  })

  it('pastes several lines as new elements after the current one, with the caret at the end of the last line', () => {
    const pasted = pasteLines('list:l1:text', sample, { start: 7, end: 16 }, ['', 'French', 'Spanish'], ['n1', 'n2'])
    expect(pasted).not.toBeNull()
    expect(listTexts(pasted!.change(sample), 'languages')).toEqual(['English', 'French', 'Spanish', 'German – B2'])
    expect(pasted!.focus).toEqual({ key: 'list:n2:text', caret: 'Spanish'.length })
    expect(pasteLines('list:l1:text', sample, { start: 0, end: 0 }, ['one'])).toBeNull()
    expect(pasteLines('experience:e1:company', sample, { start: 0, end: 0 }, ['a', 'b'])).toBeNull()
  })

  it('moves a bullet or a list item by one place, and a whole entry from any of its fields, with Alt+Shift+arrows', () => {
    expect(listTexts(moveField('list:l1:text', sample, 1)!(sample), 'languages')).toEqual(['German – B2', 'English – native'])
    expect(moveField('list:l1:text', sample, -1)).toBeNull()
    expect(bulletTexts(moveField('experience:e1:bullet:e1-b2', sample, -1)!(sample), 'e1')[0]).toBe(bulletTexts(sample, 'e1')[1])
    const moved = moveField('experience:e2:company', sample, -1)!(sample)
    expect(sectionOf(moved, 'experience').items.map((item) => item.id)).toEqual(['e2', 'e1', 'e3', 'e4'])
    expect(moveField('experience:e1:role', sample, -1)).toBeNull()
    expect(sectionOf(moveField('education:ed1:level', sample, 1)!(sample), 'education').items.map((item) => item.id)).toEqual(['ed2', 'ed1'])
    expect(moveField('header:fullName', sample, 1)).toBeNull()
  })
})
