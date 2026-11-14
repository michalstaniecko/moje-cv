import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument } from '../domain/schema'
import { templates } from '../template/templates'
import { blockTarget, CONSENT_BLOCK_ID, fragmentKey, fragmentTarget, type EditTarget } from './editTargets'

const sample = sampleCvs.en

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

  it('maps the consent clause on the last page (not a block of the document) to the consent clause', () => {
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
