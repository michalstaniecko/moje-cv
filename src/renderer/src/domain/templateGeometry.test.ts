import { describe, expect, it } from 'vitest'
import { paginate } from './paginate'
import { pageMetricsPx, PX_PER_MM, type TemplateGeometry } from './templateGeometry'
import { testGeometry, withMargins } from './testGeometry'

describe('template geometry', () => {
  it('derives the content area of an A4 page from the page margins', () => {
    const metrics = pageMetricsPx(withMargins({ top: 20, right: 25, bottom: 20, left: 25 }))
    expect(metrics.contentWidth).toBeCloseTo(160 * PX_PER_MM)
    expect(metrics.contentHeight).toBeCloseTo(257 * PX_PER_MM)
  })

  it('gives a narrower measuring width with wider side margins', () => {
    const narrow = pageMetricsPx(withMargins({ top: 10, right: 30, bottom: 10, left: 30 }))
    expect(narrow.contentWidth).toBeCloseTo(150 * PX_PER_MM)
    expect(pageMetricsPx(testGeometry).contentWidth).toBeCloseTo(190 * PX_PER_MM)
  })

  it('converts the consent gap to CSS pixels', () => {
    expect(pageMetricsPx({ ...testGeometry, consentGapMm: 25.4 }).consentGap).toBeCloseTo(96)
  })
})

describe('pagination with template geometry', () => {
  // Te same zmierzone bloki: 4 bloki po 70 mm.
  const blocks = ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    height: 70 * PX_PER_MM,
    keepWithNext: false,
    breakBefore: false
  }))
  const pagesFor = (geometry: TemplateGeometry) =>
    paginate({ blocks, pageHeight: pageMetricsPx(geometry).contentHeight, consent: null }).pages

  it('fits three 70 mm blocks on a page with 10 mm margins', () => {
    expect(pagesFor(testGeometry)).toEqual([['a', 'b', 'c'], ['d']])
  })

  it('splits the same blocks differently with larger vertical margins', () => {
    expect(pagesFor(withMargins({ top: 40, right: 10, bottom: 50, left: 10 }))).toEqual([['a', 'b'], ['c', 'd']])
  })
})
