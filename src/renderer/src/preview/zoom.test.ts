import { describe, expect, it } from 'vitest'
import { fitScale, zoomIn, zoomOut } from './zoom'

describe('zoomIn', () => {
  it('goes to the next zoom level above the current scale', () => {
    expect(zoomIn(1)).toBe(1.25)
    expect(zoomIn(0.6)).toBe(0.75)
  })
})

describe('zoomOut', () => {
  it('goes to the next zoom level below the current scale', () => {
    expect(zoomOut(1)).toBe(0.75)
    expect(zoomOut(0.6)).toBe(0.5)
  })

  it('stays at the smallest zoom level', () => {
    expect(zoomOut(0.25)).toBe(0.25)
  })
})

// Strona A4 ma 210 mm = 793,7 px, a podgląd zostawia po 24 px marginesu z każdej strony.
describe('fitScale', () => {
  it('fits the page width with margins into the panel width', () => {
    expect(fitScale(841.7)).toBeCloseTo(1)
    expect(fitScale(444.85)).toBeCloseTo(0.5)
  })

  it('does not shrink the page below the smallest zoom level', () => {
    expect(fitScale(100)).toBe(0.25)
  })

  // Inaczej na bardzo szerokim panelu przycisk + nie miałby już większego poziomu.
  it('does not enlarge the page above the largest zoom level', () => {
    expect(fitScale(3000)).toBe(2)
    expect(zoomIn(fitScale(3000))).toBe(2)
    expect(zoomOut(fitScale(3000))).toBe(1.5)
  })
})
