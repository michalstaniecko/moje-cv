import { describe, expect, it } from 'vitest'
import { paginate, type PaginationBlock } from './paginate'

const block = (id: string, height: number, extra: Partial<PaginationBlock> = {}): PaginationBlock => ({
  id,
  height,
  keepWithNext: false,
  breakBefore: false,
  ...extra
})

describe('paginate', () => {
  it('returns a single empty page for an empty document', () => {
    expect(paginate({ blocks: [], pageHeight: 100, consent: null })).toEqual({
      pages: [[]],
      consentOnOwnPage: false,
      oversizedIds: []
    })
  })
  it('fills pages greedily in block order', () => {
    const result = paginate({
      blocks: [block('a', 40), block('b', 40), block('c', 20), block('d', 30), block('e', 80)],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a', 'b', 'c'], ['d'], ['e']])
    expect(result.oversizedIds).toEqual([])
  })
  it('moves a keepWithNext block to the next page together with the block that follows it', () => {
    const result = paginate({
      blocks: [block('a', 70), block('title', 10, { keepWithNext: true }), block('entry', 30)],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['title', 'entry']])
  })
  it('moves a whole keepWithNext chain together', () => {
    const result = paginate({
      blocks: [
        block('a', 60),
        block('t1', 10, { keepWithNext: true }),
        block('t2', 10, { keepWithNext: true }),
        block('entry', 30),
        block('b', 10)
      ],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['t1', 't2', 'entry', 'b']])
  })

  it('keeps the longest fitting prefix of a chain that is taller than a page together', () => {
    const result = paginate({
      blocks: [
        block('a', 50),
        block('title', 10, { keepWithNext: true }),
        block('b', 60, { keepWithNext: true }),
        block('c', 60)
      ],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['title', 'b'], ['c']])
  })
  it('starts a new page before a breakBefore block when the current page is not empty', () => {
    const result = paginate({
      blocks: [block('a', 10), block('b', 10, { breakBefore: true }), block('c', 10)],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['b', 'c']])
  })

  it('does not add an empty page for a breakBefore block at the top of a page', () => {
    const result = paginate({
      blocks: [block('a', 10, { breakBefore: true }), block('b', 95), block('c', 10, { breakBefore: true })],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['b'], ['c']])
  })
  it('gives a block taller than a page its own page and reports it as oversized', () => {
    const result = paginate({
      blocks: [block('a', 30), block('huge', 150), block('b', 30)],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['huge'], ['b']])
    expect(result.oversizedIds).toEqual(['huge'])
  })
  it('keeps the consent on the last page when the remaining space fits it with the gap', () => {
    const result = paginate({
      blocks: [block('a', 100), block('b', 70)],
      pageHeight: 100,
      consent: { height: 20, gap: 10 }
    })
    expect(result.pages).toEqual([['a'], ['b']])
    expect(result.consentOnOwnPage).toBe(false)
  })

  it('moves the consent to a new page when the last page has no room for it', () => {
    const result = paginate({
      blocks: [block('a', 100), block('b', 71)],
      pageHeight: 100,
      consent: { height: 20, gap: 10 }
    })
    expect(result.pages).toEqual([['a'], ['b'], []])
    expect(result.consentOnOwnPage).toBe(true)
  })
  it('adds no page for the consent when there is no consent', () => {
    const result = paginate({ blocks: [block('a', 100)], pageHeight: 100, consent: null })
    expect(result.pages).toEqual([['a']])
    expect(result.consentOnOwnPage).toBe(false)
  })

  it('puts the consent on the single page of an empty document', () => {
    expect(paginate({ blocks: [], pageHeight: 100, consent: { height: 20, gap: 10 } })).toEqual({
      pages: [[]],
      consentOnOwnPage: false,
      oversizedIds: []
    })
  })

  it('moves the consent off a page filled by an oversized block', () => {
    const result = paginate({ blocks: [block('huge', 150)], pageHeight: 100, consent: { height: 20, gap: 10 } })
    expect(result.pages).toEqual([['huge'], []])
    expect(result.consentOnOwnPage).toBe(true)
  })
  it('moves a keepWithNext chain to the new page when a block inside it has breakBefore', () => {
    const result = paginate({
      blocks: [block('a', 10), block('title', 10, { keepWithNext: true }), block('entry', 10, { breakBefore: true })],
      pageHeight: 100,
      consent: null
    })
    expect(result.pages).toEqual([['a'], ['title', 'entry']])
  })
})
