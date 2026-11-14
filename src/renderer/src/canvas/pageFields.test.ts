import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/en'
import { generateBlocks } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument } from '../domain/schema'
import type { SlotName } from '../template/editable'
import { templates } from '../template/templates'
import { fieldChange, fragmentHasEmptyField, pageFieldKey, pageFieldOf, pageFieldTarget } from './pageFields'

const sample = sampleCvs.en
const t = en.editor

// Pola, które rysują sloty wszystkich bloków Sample CV w danej geometrii.
function fieldsOf(document: CvDocument, template: keyof typeof templates) {
  const slots: SlotName[] = ['fullName', 'summary', 'title']
  return generateBlocks(document, templates[template].geometry).flatMap((block) =>
    slots.flatMap((slot) => {
      const field = pageFieldOf(block, slot, document, t)
      return field ? [{ block: block.id, slot, ...field }] : []
    })
  )
}

describe('pageFieldOf', () => {
  it('gives the name, the summary and every section title of the Sample CV, with the title beside a list in its first row only', () => {
    expect(fieldsOf(sample, 'classic')).toEqual([
      { block: 'header', slot: 'fullName', key: 'header:fullName', fragment: 'fullName', label: 'Full name', placeholder: 'Full name', spellcheck: false },
      { block: 'header', slot: 'summary', key: 'header:summary', fragment: 'summary', label: 'Summary', placeholder: 'Summary', spellcheck: true },
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
  })

  it('map to the part of the CV and back', () => {
    for (const target of [{ kind: 'fullName' }, { kind: 'summary' }, { kind: 'sectionTitle', sectionId: 'a:b' }] as const) {
      expect(pageFieldTarget(pageFieldKey(target)!)).toEqual(target)
    }
    expect(pageFieldKey({ kind: 'photo' })).toBeNull()
    expect(pageFieldTarget('experience:e1:role')).toBeNull()
  })
})

describe('fieldChange', () => {
  it('writes the new value into its field', () => {
    expect(fieldChange('header:fullName', 'Ann')(sample).header.fullName).toBe('Ann')
    expect(fieldChange('header:summary', 'Line 1\nLine 2')(sample).header.summary).toBe('Line 1\nLine 2')
    const changed = fieldChange('section:education:title', 'Studies')(sample)
    expect(changed.sections.find((section) => section.id === 'education')!.title).toBe('Studies')
    expect(fieldChange('unknown', 'x')(sample)).toBe(sample)
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
    expect(fragmentHasEmptyField('item:e1', empty)).toBe(false)
  })
})
