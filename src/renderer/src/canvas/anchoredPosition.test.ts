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

  it('with `contain`, puts a panel that fits neither below nor above beside the anchor itself, right or left', () => {
    // Wysoki fragment (wpis z punktami) i wysoki panel: ani pod, ani nad nim nie ma miejsca, obok strony też nie.
    const tallAnchor = { top: 100, left: 400, right: 700, bottom: 600 }
    const card = { width: 340, height: 500 }
    expect(anchoredPosition({ anchor: tallAnchor, panel: card, viewport, contain: true })).toEqual({
      top: 100,
      left: 704,
      placement: 'side'
    })
    // Po prawej brak miejsca – po lewej (nad paskiem bocznym), w pionie w oknie.
    expect(anchoredPosition({ anchor: { ...tallAnchor, left: 500, right: 1000 }, panel: card, viewport, contain: true })).toEqual({
      top: 100,
      left: 156,
      placement: 'side'
    })
    expect(
      anchoredPosition({ anchor: { top: 500, left: 500, right: 1000, bottom: 790 }, panel: card, viewport, contain: true })
    ).toEqual({ top: 296, left: 156, placement: 'side' })
    // Gdy się mieści, `contain` niczego nie zmienia.
    expect(anchoredPosition({ anchor, panel, viewport, contain: true })).toEqual(anchoredPosition({ anchor, panel, viewport }))
  })

  it('with `contain` and no room beside the anchor, makes the panel lower below or above it rather than cover it', () => {
    // Fragment na prawie całą szerokość okna.
    const wide = { left: 200, right: 1000 }
    const card = { width: 340, height: 500 }
    expect(anchoredPosition({ anchor: { ...wide, top: 100, bottom: 500 }, panel: card, viewport, contain: true })).toEqual({
      top: 504,
      left: 200,
      placement: 'below',
      maxHeight: 292
    })
    expect(anchoredPosition({ anchor: { ...wide, top: 400, bottom: 700 }, panel: card, viewport, contain: true })).toEqual({
      top: 4,
      left: 200,
      placement: 'above',
      maxHeight: 392
    })
  })

  it('with `contain`, covers part of an anchor almost as tall as the window, on the roomier side, inside the window', () => {
    const card = { width: 340, height: 500 }
    const huge = { left: 200, right: 1000 }
    expect(anchoredPosition({ anchor: { ...huge, top: 50, bottom: 700 }, panel: card, viewport, contain: true })).toEqual({
      top: 296,
      left: 200,
      placement: 'below'
    })
    expect(anchoredPosition({ anchor: { ...huge, top: 150, bottom: 790 }, panel: card, viewport, contain: true })).toEqual({
      top: 4,
      left: 200,
      placement: 'above'
    })
  })

  it('with `contain`, keeps the panel in the window when its anchor has scrolled out of it', () => {
    // Fragment przewinięty nad okno (np. wyższe strony obok wąskiego Outline): panel z fokusem nie ucieka z ekranu.
    const scrolledAbove = { top: -400, left: 400, right: 700, bottom: -360 }
    expect(anchoredPosition({ anchor: scrolledAbove, panel, viewport, contain: true })).toEqual({ top: 4, left: 400, placement: 'below' })
    const scrolledBelow = { top: 900, left: 400, right: 700, bottom: 940 }
    expect(anchoredPosition({ anchor: scrolledBelow, panel, viewport, contain: true })).toEqual({
      top: 800 - 200 - 4,
      left: 400,
      placement: 'above'
    })
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
