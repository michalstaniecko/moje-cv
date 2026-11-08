import { describe, expect, test } from 'vitest'
import { consentText } from './consent'

const withConsent = (enabled: boolean, text: string) => ({ consent: { enabled, clauseId: null, text } })

describe('consentText', () => {
  test('is the clause text when the clause is enabled and has text', () => {
    expect(consentText(withConsent(true, 'I consent to the processing of my personal data.'))).toBe(
      'I consent to the processing of my personal data.'
    )
  })

  test('is null when the clause is disabled, even with text', () => {
    expect(consentText(withConsent(false, 'I consent to the processing of my personal data.'))).toBeNull()
  })

  test('is null when the enabled clause is empty or only whitespace', () => {
    expect(consentText(withConsent(true, ''))).toBeNull()
    expect(consentText(withConsent(true, '  \n\t '))).toBeNull()
  })
})
