import { describe, expect, it } from 'vitest'
import { sampleCvs } from '../domain/sampleCv'
import { selectionOfFragment } from './selection'

const sample = sampleCvs.en

describe('selectionOfFragment', () => {
  it('selects the header for the full name, the contacts and the summary', () => {
    for (const fragment of ['fullName', 'contacts', 'summary']) {
      expect(selectionOfFragment(fragment, sample), fragment).toEqual({ kind: 'header' })
    }
  })

  it('selects the photo and the consent clause by their own fragments', () => {
    expect(selectionOfFragment('photo', sample)).toEqual({ kind: 'photo' })
    expect(selectionOfFragment('consent', sample)).toEqual({ kind: 'consent' })
  })

  it('selects the section of a section title and of a list section', () => {
    expect(selectionOfFragment('sectionTitle:education', sample)).toEqual({ kind: 'section', id: 'education' })
    expect(selectionOfFragment('list:skills', sample)).toEqual({ kind: 'section', id: 'skills' })
  })

  it('selects the section that holds an entry', () => {
    expect(selectionOfFragment('item:e2', sample)).toEqual({ kind: 'section', id: 'experience' })
    expect(selectionOfFragment('item:ed1', sample)).toEqual({ kind: 'section', id: 'education' })
    expect(selectionOfFragment('item:h1', sample)).toEqual({ kind: 'section', id: 'hobby' })
  })

  it('selects nothing (the Document panel) for an unknown key or a part no longer in the document', () => {
    expect(selectionOfFragment('somethingElse', sample)).toBeNull()
    expect(selectionOfFragment('', sample)).toBeNull()
    expect(selectionOfFragment('item:gone', sample)).toBeNull()
    expect(selectionOfFragment('sectionTitle:gone', sample)).toBeNull()
    expect(selectionOfFragment('list:gone', sample)).toBeNull()
  })
})
