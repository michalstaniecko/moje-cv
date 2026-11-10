import { describe, expect, test } from 'vitest'
import { exportDocumentTitle } from './exportDocumentTitle'

describe('exportDocumentTitle', () => {
  test('is "CV – " followed by the full name', () => {
    expect(exportDocumentTitle('Ewa Nowak-Żelazna')).toBe('CV – Ewa Nowak-Żelazna')
  })

  test('is just "CV" without a full name', () => {
    expect(exportDocumentTitle('')).toBe('CV')
  })
})
