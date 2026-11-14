import { describe, expect, it } from 'vitest'
import { sampleCvs } from '../domain/sampleCv'
import { fragmentRects, sameFragments, type MeasuredBlock, type Rect } from './fragmentRects'

const sample = sampleCvs.en
const rect = (top: number, bottom: number, left = 10, right = 200): Rect => ({ top, left, right, bottom })
const block = (blockId: string, page: number, measured: Rect, parts: MeasuredBlock['parts'] = []): MeasuredBlock => ({
  blockId,
  page,
  rect: measured,
  parts
})

describe('fragmentRects', () => {
  it('joins an entry with its bullets into one fragment per page', () => {
    const fragments = fragmentRects(
      [
        block('e1', 0, rect(100, 130)),
        block('e1:e1-b2', 0, rect(130, 140, 20, 190)),
        block('e1:e1-b3', 0, rect(140, 150)),
        // Podział stron: reszta punktów na drugiej stronie.
        block('e1:e1-b4', 1, rect(20, 30)),
        block('e1:e1-b5', 1, rect(30, 40)),
        block('e2', 1, rect(45, 70))
      ],
      sample
    )
    expect(fragments).toEqual([
      { key: 'item:e1', target: { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' }, page: 0, rect: rect(100, 150) },
      { key: 'item:e1', target: { kind: 'experienceItem', sectionId: 'experience', itemId: 'e1' }, page: 1, rect: rect(20, 40) },
      { key: 'item:e2', target: { kind: 'experienceItem', sectionId: 'experience', itemId: 'e2' }, page: 1, rect: rect(45, 70) }
    ])
  })

  it('joins all rows of a list section on a page, and splits the section title beside the list from its items', () => {
    const title = rect(300, 310, 10, 60)
    const fragments = fragmentRects(
      [
        block('skills:s1', 0, rect(300, 312), [
          { part: 'sectionTitle', rect: title },
          { part: 'items', rect: rect(300, 312, 80, 200) }
        ]),
        block('skills:s2', 0, rect(312, 322, 10, 200), [{ part: 'items', rect: rect(312, 322, 80, 200) }]),
        block('skills:s3', 1, rect(10, 20), [{ part: 'items', rect: rect(10, 20, 80, 200) }])
      ],
      sample
    )
    expect(fragments.map(({ key, page, rect }) => ({ key, page, rect }))).toEqual([
      { key: 'sectionTitle:skills', page: 0, rect: title },
      // Wiersz bez tytułu obok – cały blok (tytuł obok listy zostawia w nim pustą kolumnę).
      { key: 'list:skills', page: 0, rect: rect(300, 322, 10, 200) },
      { key: 'list:skills', page: 1, rect: rect(10, 20) }
    ])
  })

  it('splits the header by the markup contract in DOM order, or keeps it whole as the full name without the classes', () => {
    const parts: MeasuredBlock['parts'] = [
      { part: 'name', rect: rect(10, 30, 10, 150) },
      { part: 'contact', rect: rect(32, 60, 10, 150) },
      { part: 'summary', rect: rect(62, 90, 10, 150) },
      { part: 'photo', rect: rect(10, 60, 160, 200) }
    ]
    const split = fragmentRects([block('header', 0, rect(10, 90), parts)], sample)
    expect(split.map(({ key, rect }) => ({ key, rect }))).toEqual([
      { key: 'fullName', rect: parts[0]!.rect },
      { key: 'contacts', rect: parts[1]!.rect },
      { key: 'summary', rect: parts[2]!.rect },
      { key: 'photo', rect: parts[3]!.rect }
    ])
    expect(fragmentRects([block('header', 0, rect(10, 90))], sample)).toEqual([
      { key: 'fullName', target: { kind: 'fullName' }, page: 0, rect: rect(10, 90) }
    ])
  })

  it('skips blocks that are no longer in the document', () => {
    expect(fragmentRects([block('removed', 0, rect(0, 10)), block('experience:title', 0, rect(10, 20))], sample)).toEqual([
      { key: 'sectionTitle:experience', target: { kind: 'sectionTitle', sectionId: 'experience' }, page: 0, rect: rect(10, 20) }
    ])
  })
})

describe('sameFragments', () => {
  it('compares keys, pages and rectangles', () => {
    const measure = (top: number) => fragmentRects([block('experience:title', 0, rect(top, top + 10))], sample)
    expect(sameFragments(measure(10), measure(10))).toBe(true)
    expect(sameFragments(measure(10), measure(11))).toBe(false)
    expect(sameFragments(measure(10), [])).toBe(false)
  })
})
