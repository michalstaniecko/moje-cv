import { describe, expect, it } from 'vitest'
import { onAccentColor } from './accentColor'

describe('text colour on the accent', () => {
  it('is white on the default dark accent', () => {
    expect(onAccentColor('#1a6e72')).toBe('#ffffff')
  })

  it('is black on a light accent', () => {
    expect(onAccentColor('#f2c94c')).toBe('#000000')
  })

  it('is white on black and black on white', () => {
    expect(onAccentColor('#000000')).toBe('#ffffff')
    expect(onAccentColor('#FFFFFF')).toBe('#000000')
  })

  it('switches to black right where black gives more contrast than white', () => {
    expect(onAccentColor('#757575')).toBe('#ffffff')
    expect(onAccentColor('#767676')).toBe('#000000')
  })
})
