import { describe, expect, it } from 'vitest'
import { nudgeView } from './photoCrop'

// Zdjęcie poziome 1200 × 800: największy kadr 3:4 ma 600 × 800, więc środek kadru może chodzić w poziomie od 300 do 900.
const image = { width: 1200, height: 800 }
const centered = { zoom: 1, centerX: 600, centerY: 400 }

describe('nudgeView', () => {
  it('moves the photo right in the frame, so the frame shows more of its left side', () => {
    expect(nudgeView(image, centered, 50, 0)).toEqual({ zoom: 1, centerX: 550, centerY: 400 })
  })

  it('moves the photo left in the frame, so the frame shows more of its right side', () => {
    expect(nudgeView(image, centered, -50, 0)).toEqual({ zoom: 1, centerX: 650, centerY: 400 })
  })

  it('moves the photo up and down in the frame when the frame is smaller than the photo', () => {
    const zoomed = { zoom: 2, centerX: 600, centerY: 400 }
    expect(nudgeView(image, zoomed, 0, 40)).toEqual({ zoom: 2, centerX: 600, centerY: 360 })
    expect(nudgeView(image, zoomed, 0, -40)).toEqual({ zoom: 2, centerX: 600, centerY: 440 })
  })

  it('stops at the edge of the photo', () => {
    expect(nudgeView(image, centered, 1000, 0)).toEqual({ zoom: 1, centerX: 300, centerY: 400 })
    expect(nudgeView(image, centered, -1000, 0)).toEqual({ zoom: 1, centerX: 900, centerY: 400 })
    expect(nudgeView(image, centered, 0, 30)).toEqual({ zoom: 1, centerX: 600, centerY: 400 })
  })
})
