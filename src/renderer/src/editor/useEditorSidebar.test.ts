import { describe, expect, it, vi } from 'vitest'
import type { EditorSidebar } from '../domain/schema'
import { createEditorSidebarPreference } from './useEditorSidebar'

function fakeSettings(stored: EditorSidebar | undefined) {
  let resolveGet: () => void = () => undefined
  const get = vi.fn(
    () => new Promise<{ editorSidebar?: EditorSidebar }>((resolve) => (resolveGet = () => resolve({ editorSidebar: stored })))
  )
  const setEditorSidebar = vi.fn(async () => undefined)
  return { settings: { get, setEditorSidebar }, finishLoading: () => resolveGet() }
}

const settled = () => new Promise((resolve) => setTimeout(resolve))

describe('editor sidebar preference', () => {
  it('starts with the Outline and switches to the saved sidebar once settings load', async () => {
    const { settings, finishLoading } = fakeSettings('form')
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    expect(preference.current()).toBe('outline')
    finishLoading()
    await vi.waitFor(() => expect(preference.current()).toBe('form'))
  })

  it('stays with the Outline when nothing is saved, and reads the settings file only once per session', async () => {
    const { settings, finishLoading } = fakeSettings(undefined)
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    finishLoading()
    await settled()
    preference.load()
    expect(preference.current()).toBe('outline')
    expect(settings.get).toHaveBeenCalledTimes(1)
  })

  it('saves every choice, and a choice made before the saved sidebar loaded wins', async () => {
    const { settings, finishLoading } = fakeSettings('collapsed')
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    preference.choose('form')
    finishLoading()
    await settled()
    expect(preference.current()).toBe('form')
    expect(settings.setEditorSidebar).toHaveBeenCalledExactlyOnceWith('form')
  })

  it('expands the rail back to the panel it was collapsed from, and to the Outline after a restart', async () => {
    const preference = createEditorSidebarPreference(fakeSettings(undefined).settings)
    preference.choose('form')
    preference.choose('collapsed')
    preference.expand()
    expect(preference.current()).toBe('form')

    const { settings, finishLoading } = fakeSettings('collapsed')
    const restarted = createEditorSidebarPreference(settings)
    restarted.load()
    finishLoading()
    await vi.waitFor(() => expect(restarted.current()).toBe('collapsed'))
    restarted.expand()
    expect(restarted.current()).toBe('outline')
    expect(settings.setEditorSidebar).toHaveBeenCalledExactlyOnceWith('outline')
  })

  it('notifies subscribers of every change, and a settings file that cannot be read keeps the Outline', async () => {
    const settings = { get: vi.fn(async () => Promise.reject(new Error('damaged'))), setEditorSidebar: vi.fn(async () => undefined) }
    const preference = createEditorSidebarPreference(settings)
    const listener = vi.fn()
    const unsubscribe = preference.subscribe(listener)
    preference.load()
    await settled()
    expect(preference.current()).toBe('outline')
    preference.choose('form')
    unsubscribe()
    preference.choose('outline')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
