import { describe, expect, it, vi } from 'vitest'
import { sampleCvs } from '../domain/sampleCv'
import { createCvEditor } from './cvEditor'
import { updateName } from './documentEdits'

const sampleCv = sampleCvs.en

const openEditor = () => createCvEditor(sampleCv, () => Promise.resolve())

describe('cvEditor history', () => {
  it('has nothing to undo or redo in a freshly opened CV', () => {
    const editor = openEditor()
    expect(editor.canUndo()).toBe(false)
    expect(editor.canRedo()).toBe(false)
  })

  it('can undo a change, then redo it', () => {
    const editor = openEditor()
    editor.edit(updateName('Renamed CV'))
    expect(editor.canUndo()).toBe(true)
    expect(editor.canRedo()).toBe(false)

    editor.undo()
    expect(editor.store.getState().document.name).toBe(sampleCv.name)
    expect(editor.canUndo()).toBe(false)
    expect(editor.canRedo()).toBe(true)

    editor.redo()
    expect(editor.store.getState().document.name).toBe('Renamed CV')
    expect(editor.canUndo()).toBe(true)
    expect(editor.canRedo()).toBe(false)
  })

  it('tells its subscribers when what can be undone or redone changes', () => {
    const editor = openEditor()
    const listener = vi.fn()
    const unsubscribe = editor.subscribeHistory(listener)

    editor.edit(updateName('Renamed CV'))
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    editor.undo()
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    listener.mockClear()
    editor.redo()
    expect(listener).not.toHaveBeenCalled()
  })
})
