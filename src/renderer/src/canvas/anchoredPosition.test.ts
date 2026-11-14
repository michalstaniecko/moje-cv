import { describe, expect, it } from 'vitest'
import { anchoredPosition } from './anchoredPosition'

const viewport = { width: 1200, height: 800 }
const anchor = { top: 300, left: 400, right: 700, bottom: 340 }
const panel = { width: 320, height: 200 }

describe('anchoredPosition', () => {
  it('puts the panel beside the page, level with the anchor, when it fits before the edge of the pages panel', () => {
    expect(anchoredPosition({ anchor, panel, viewport, beside: { edge: 800, limit: 1180 } })).toEqual({
      top: 300,
      left: 804,
      placement: 'beside'
    })
    // Beside, ale nie wyżej ani niżej niż okno.
    expect(anchoredPosition({ anchor: { ...anchor, top: -50 }, panel, viewport, beside: { edge: 800, limit: 1180 } }).top).toBe(4)
    expect(anchoredPosition({ anchor: { ...anchor, top: 700 }, panel, viewport, beside: { edge: 800, limit: 1180 } }).top).toBe(596)
  })

  it('puts the panel below the anchor when there is no room beside the page', () => {
    expect(anchoredPosition({ anchor, panel, viewport, beside: { edge: 900, limit: 1180 } })).toEqual({
      top: 344,
      left: 400,
      placement: 'below'
    })
  })

  it('puts the panel above the anchor when it does not fit below, unless it does not fit above either', () => {
    const low = { top: 650, left: 400, right: 700, bottom: 690 }
    expect(anchoredPosition({ anchor: low, panel, viewport })).toEqual({ top: 446, left: 400, placement: 'above' })
    const tall = { width: 320, height: 760 }
    expect(anchoredPosition({ anchor: low, panel: tall, viewport })).toEqual({ top: 694, left: 400, placement: 'below' })
  })

  it('keeps the panel inside the window horizontally', () => {
    expect(anchoredPosition({ anchor: { ...anchor, left: 1000 }, panel, viewport }).left).toBe(876)
    expect(anchoredPosition({ anchor: { ...anchor, left: -20 }, panel, viewport }).left).toBe(4)
  })
})
