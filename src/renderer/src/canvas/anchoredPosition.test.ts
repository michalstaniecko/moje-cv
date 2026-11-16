import { describe, expect, it } from 'vitest'
import { anchoredPosition } from './anchoredPosition'

const viewport = { width: 1200, height: 800 }
const anchor = { top: 300, left: 400, right: 700, bottom: 340 }
const panel = { width: 320, height: 200 }

describe('anchoredPosition', () => {
  it('puts the panel below the anchor, aligned with its left edge', () => {
    expect(anchoredPosition({ anchor, panel, viewport })).toEqual({ top: 344, left: 400, placement: 'below' })
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
  it('with `prefer: above`, puts the panel above its anchor, and below it when there is no room above', () => {
    expect(anchoredPosition({ anchor, panel, viewport, prefer: 'above' })).toEqual({ top: anchor.top - 4 - panel.height, left: anchor.left, placement: 'above' })
    const nearTop = { ...anchor, top: 20, bottom: 40 }
    expect(anchoredPosition({ anchor: nearTop, panel, viewport, prefer: 'above' })).toEqual({ top: 44, left: anchor.left, placement: 'below' })
  })
})
