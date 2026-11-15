import { describe, expect, it } from 'vitest'
import { en } from '../../../../shared/i18n/en'
import { removeContactLabel } from './entryNames'

const t = en.editor

describe('removeContactLabel', () => {
  it('names a contact by its label', () => {
    expect(removeContactLabel({ label: 'Phone', value: '+48 600 100 200' }, 0, t)).toBe('Remove contact: Phone')
  })

  it('names a contact without a label by its value', () => {
    expect(removeContactLabel({ label: '  ', value: 'jan@example.com' }, 1, t)).toBe('Remove contact: jan@example.com')
  })

  it('names an empty contact by its position', () => {
    expect(removeContactLabel({ label: '', value: ' ' }, 2, t)).toBe('Remove contact 3')
  })
})
