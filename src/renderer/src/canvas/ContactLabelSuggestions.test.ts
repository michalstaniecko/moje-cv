import { describe, expect, it } from 'vitest'
import { isContactLabel, labelSuggestions, suggestionsId } from './ContactLabelSuggestions'

const labels = ['Phone', 'Email', 'LinkedIn', 'City']

describe('labelSuggestions', () => {
  it('gives every label for an empty field and the labels starting with the typed text, whatever the case', () => {
    expect(labelSuggestions(labels, '')).toEqual(labels)
    expect(labelSuggestions(labels, '  ')).toEqual(labels)
    expect(labelSuggestions(labels, 'l')).toEqual(['LinkedIn'])
    expect(labelSuggestions(labels, 'E')).toEqual(['Email'])
    expect(labelSuggestions(labels, 'GitHub')).toEqual([])
  })

  it('gives nothing for a label already typed in full', () => {
    expect(labelSuggestions(labels, 'email ')).toEqual([])
  })
})

describe('contact label fields', () => {
  it('are told from other fields and point at a list id without colons', () => {
    expect(isContactLabel('contact:c1:label')).toBe(true)
    expect(isContactLabel('contact:c1:value')).toBe(false)
    expect(suggestionsId('contact:c1:label')).toBe('suggestions-contact-c1-label')
  })
})
