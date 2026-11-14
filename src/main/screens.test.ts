import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { describe, expect, test } from 'vitest'
import { menuPreviewMode, menuScreen, setPreviewMode, trackScreen } from './screens'

// Okno renderera w zakresie, którego używa śledzenie ekranów: id, zdarzenia nawigacji i zamknięcia.
function fakeWindow(id: number) {
  const events = new EventEmitter()
  let destroyed = false
  const contents = Object.assign(events, { id, isDestroyed: () => destroyed }) as unknown as WebContents
  return {
    contents,
    close() {
      destroyed = true
      events.emit('destroyed')
    }
  }
}

describe('the screen the File menu follows', () => {
  test('is the screen of the focused window, not the one reported last by another window', () => {
    const editorWindow = fakeWindow(1)
    const libraryWindow = fakeWindow(2)
    trackScreen(editorWindow.contents, 'editor', () => {})
    trackScreen(libraryWindow.contents, 'library', () => {})

    expect(menuScreen(editorWindow.contents)).toBe('editor')
    expect(menuScreen(libraryWindow.contents)).toBe('library')

    editorWindow.close()
    libraryWindow.close()
  })

  test('without a focused window it is the screen of the only app window, if there is just one', () => {
    const only = fakeWindow(3)
    trackScreen(only.contents, 'editor', () => {})
    expect(menuScreen(undefined)).toBe('editor')

    const other = fakeWindow(4)
    trackScreen(other.contents, 'library', () => {})
    expect(menuScreen(undefined)).toBeUndefined()

    only.close()
    other.close()
    expect(menuScreen(undefined)).toBeUndefined()
  })

  test('a focused window that reported no screen (e.g. before its page loaded) has none', () => {
    const app = fakeWindow(5)
    trackScreen(app.contents, 'library', () => {})

    expect(menuScreen(fakeWindow(6).contents)).toBeUndefined()

    app.close()
  })
})

describe('the checkmark of View → Preview', () => {
  test('follows the mode reported by the CV editor of the menu window', () => {
    const window = fakeWindow(7)
    trackScreen(window.contents, 'editor', () => {})
    expect(menuPreviewMode(window.contents)).toBe(false)

    setPreviewMode(window.contents, true)
    expect(menuPreviewMode(window.contents)).toBe(true)
    expect(menuPreviewMode(undefined)).toBe(true)
    setPreviewMode(window.contents, false)
    expect(menuPreviewMode(window.contents)).toBe(false)

    window.close()
  })

  test('is cleared when the window leaves the editor, and ignored outside the editor', () => {
    const window = fakeWindow(8)
    trackScreen(window.contents, 'editor', () => {})
    setPreviewMode(window.contents, true)

    trackScreen(window.contents, 'library', () => {})
    expect(menuPreviewMode(window.contents)).toBe(false)
    setPreviewMode(window.contents, true)
    expect(menuPreviewMode(window.contents)).toBe(false)

    // Każde otwarcie CV startuje w Edit mode.
    trackScreen(window.contents, 'editor', () => {})
    expect(menuPreviewMode(window.contents)).toBe(false)

    window.close()
  })

  test('a window that reported no screen is not in Preview mode', () => {
    const window = fakeWindow(9)
    setPreviewMode(window.contents, true)
    expect(menuPreviewMode(window.contents)).toBe(false)
  })
})
