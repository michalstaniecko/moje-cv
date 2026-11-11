import { describe, expect, it } from 'vitest'
import { DEFAULT_FORM_WIDTH, displayedFormWidth, formWidthBounds, formWidthAfterKey } from './formWidth'

describe('formWidthBounds', () => {
  it('keeps at least 360 px for the form and 360 px for the preview', () => {
    expect(formWidthBounds(960)).toEqual({ min: 360, max: 600 })
    expect(formWidthBounds(1400)).toEqual({ min: 360, max: 1040 })
  })

  it('never puts the maximum below the minimum in a window too narrow for both panes', () => {
    expect(formWidthBounds(600)).toEqual({ min: 360, max: 360 })
  })
})

describe('displayedFormWidth', () => {
  it('shows the preferred width when it fits', () => {
    expect(displayedFormWidth(500, 1200)).toBe(500)
  })

  it('narrows the form when the window is too small for the preferred width', () => {
    expect(displayedFormWidth(900, 960)).toBe(600)
  })

  it('does not go below the form minimum', () => {
    expect(displayedFormWidth(200, 1200)).toBe(360)
  })

  it('defaults to 440 px', () => {
    expect(DEFAULT_FORM_WIDTH).toBe(440)
  })
})

describe('formWidthAfterKey', () => {
  it('moves by 16 px with the arrows and by 64 px with Shift', () => {
    expect(formWidthAfterKey({ key: 'ArrowRight', shiftKey: false }, 440, 1200)).toBe(456)
    expect(formWidthAfterKey({ key: 'ArrowLeft', shiftKey: false }, 440, 1200)).toBe(424)
    expect(formWidthAfterKey({ key: 'ArrowRight', shiftKey: true }, 440, 1200)).toBe(504)
    expect(formWidthAfterKey({ key: 'ArrowLeft', shiftKey: true }, 440, 1200)).toBe(376)
  })

  it('stops at the bounds', () => {
    expect(formWidthAfterKey({ key: 'ArrowLeft', shiftKey: true }, 380, 1200)).toBe(360)
    expect(formWidthAfterKey({ key: 'ArrowRight', shiftKey: true }, 820, 1200)).toBe(840)
  })

  it('jumps to the minimum with Home and to the maximum with End', () => {
    expect(formWidthAfterKey({ key: 'Home', shiftKey: false }, 500, 1200)).toBe(360)
    expect(formWidthAfterKey({ key: 'End', shiftKey: false }, 500, 1200)).toBe(840)
  })

  it('ignores other keys', () => {
    expect(formWidthAfterKey({ key: 'Enter', shiftKey: false }, 500, 1200)).toBeNull()
  })
})
