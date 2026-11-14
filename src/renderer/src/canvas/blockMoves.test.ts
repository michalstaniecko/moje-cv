import { describe, expect, it } from 'vitest'
import { sampleCvs } from '../domain/sampleCv'
import { handleFragments, moveAmongShown, neighbourAfterHiding, sectionFragmentKeys } from './blockMoves'
import type { Fragment } from './fragmentRects'
import type { EditTarget } from './editTargets'

const ids = ['a', 'b', 'c', 'd', 'e']

describe('moveAmongShown', () => {
  it('moves one position up or down when every element is on the pages', () => {
    expect(moveAmongShown(ids, new Set(ids), 'c', -1)).toEqual({ toIndex: 1, position: 2, total: 5 })
    expect(moveAmongShown(ids, new Set(ids), 'c', 1)).toEqual({ toIndex: 3, position: 4, total: 5 })
  })

  it('jumps over elements that are not on the pages (hidden or empty), so every move changes the pages', () => {
    const shown = new Set(['a', 'c', 'e'])
    // c → przed a (b zostaje za nim), c → za e (d zostaje przed nim).
    expect(moveAmongShown(ids, shown, 'c', -1)).toEqual({ toIndex: 0, position: 1, total: 3 })
    expect(moveAmongShown(ids, shown, 'c', 1)).toEqual({ toIndex: 4, position: 3, total: 3 })
  })

  it('does nothing at either end of the shown elements or for an element that is not shown', () => {
    const shown = new Set(['b', 'c', 'd'])
    expect(moveAmongShown(ids, shown, 'b', -1)).toBeNull()
    expect(moveAmongShown(ids, shown, 'd', 1)).toBeNull()
    expect(moveAmongShown(ids, shown, 'a', 1)).toBeNull()
  })
})

const at = (key: string, target: EditTarget, page = 0): Fragment => ({ key, target, page, rect: { top: 0, left: 0, right: 1, bottom: 1 } })
const title = (sectionId: string, page = 0) => at(`sectionTitle:${sectionId}`, { kind: 'sectionTitle', sectionId }, page)
const position = (itemId: string, page = 0) =>
  at(`item:${itemId}`, { kind: 'experienceItem', sectionId: 'experience', itemId }, page)
const list = (sectionId: string) => at(`list:${sectionId}`, { kind: 'listSection', sectionId })

describe('handleFragments', () => {
  it('gives a handle to section titles and entries, once – on the first page an entry is on', () => {
    const fragments = [at('summary', { kind: 'summary' }), title('experience'), position('e1'), position('e1', 1), list('skills')]
    expect([...handleFragments(fragments)]).toEqual([fragments[1], fragments[2]])
  })
})

describe('sectionFragmentKeys', () => {
  it('lists the keys of everything a section shows on the pages: title, entries and list rows', () => {
    const sample = sampleCvs.en
    const experience = sample.sections.find((section) => section.id === 'experience')!
    expect(sectionFragmentKeys(experience)).toEqual(new Set(['sectionTitle:experience', 'list:experience', ...experience.items.map((item) => `item:${item.id}`)]))
  })
})

describe('neighbourAfterHiding', () => {
  const fragments = [title('experience'), position('e1'), position('e1', 1), title('skills'), list('skills')]
  const experience = new Set(['sectionTitle:experience', 'item:e1'])

  it('is the first fragment after the section', () => {
    expect(neighbourAfterHiding(fragments, experience)).toBe('sectionTitle:skills')
  })

  it('is the last fragment before the section when nothing follows it', () => {
    expect(neighbourAfterHiding(fragments, new Set(['sectionTitle:skills', 'list:skills']))).toBe('item:e1')
  })

  it('is undefined when the section was all there was', () => {
    expect(neighbourAfterHiding(fragments.slice(0, 3), experience)).toBeUndefined()
  })
})
