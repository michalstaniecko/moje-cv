import { describe, expect, it } from 'vitest'
import { caretAfterChange, fieldValue, normalizePastedText, replaceSelection } from './pageFieldInput'

describe('normalizePastedText', () => {
  it('keeps plain text, unifies line ends and turns tabs and control characters into spaces, keeping no-break spaces', () => {
    expect(normalizePastedText('a\r\nb\rc\nd', true)).toBe('a\nb\nc\nd')
    expect(normalizePastedText('a\tb\u0007c d​e', true)).toBe('a b c d​e')
  })

  it('joins the lines of a single-line field with spaces', () => {
    expect(normalizePastedText('Jane\r\nExample\n', false)).toBe('Jane Example ')
  })
})

describe('replaceSelection', () => {
  it('replaces the selected characters and puts the caret after the inserted text', () => {
    expect(replaceSelection('Jane Example', { start: 5, end: 12 }, 'Doe')).toEqual({ value: 'Jane Doe', caret: 8 })
    expect(replaceSelection('ab', { start: 1, end: 1 }, '\n')).toEqual({ value: 'a\nb', caret: 2 })
  })

  it('accepts a backwards selection', () => {
    expect(replaceSelection('abcd', { start: 3, end: 1 }, 'x')).toEqual({ value: 'axd', caret: 2 })
  })
})

describe('caretAfterChange', () => {
  it('puts the caret at the end of the changed range (undo and redo, a change from the CV form)', () => {
    // Cofnięte dopisanie na końcu – kursor na końcu.
    expect(caretAfterChange('Jane Example Jr', 'Jane Example')).toBe(12)
    // Ponowione dopisanie – za dopisanym tekstem.
    expect(caretAfterChange('Jane Example', 'Jane Example Jr')).toBe(15)
    // Zmiana w środku – za zmienionym miejscem.
    expect(caretAfterChange('Jane Example', 'Jane X Example')).toBe(7)
    expect(caretAfterChange('aaa', 'aaaa')).toBe(4)
    expect(caretAfterChange('', 'abc')).toBe(3)
    expect(caretAfterChange('same', 'same')).toBe(4)
  })
})

describe('fieldValue', () => {
  it('turns the no-break spaces the browser writes for a trailing space and runs of spaces into spaces, keeping one between two characters', () => {
    expect(fieldValue('Jane\u00a0')).toBe('Jane ')
    expect(fieldValue('\u00a0Jane')).toBe(' Jane')
    expect(fieldValue('a\u00a0 \u00a0b')).toBe('a   b')
    expect(fieldValue('a \u00a0b')).toBe('a  b')
    expect(fieldValue('10\u00a0km')).toBe('10\u00a0km')
  })
})
