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
  it('starts collapsed to the rail and switches to the saved sidebar once settings load', async () => {
    const { settings, finishLoading } = fakeSettings('form')
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    expect(preference.current()).toBe('collapsed')
    finishLoading()
    await vi.waitFor(() => expect(preference.current()).toBe('form'))
  })

  it('stays collapsed when nothing is saved, and reads the settings file only once per session', async () => {
    const { settings, finishLoading } = fakeSettings(undefined)
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    finishLoading()
    await settled()
    preference.load()
    expect(preference.current()).toBe('collapsed')
    expect(settings.get).toHaveBeenCalledTimes(1)
  })

  it('shows a saved Outline, which is gone, as the collapsed sidebar without rewriting the settings file', async () => {
    const { settings, finishLoading } = fakeSettings('outline')
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    finishLoading()
    await settled()
    expect(preference.current()).toBe('collapsed')
    expect(settings.setEditorSidebar).not.toHaveBeenCalled()
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

  it('expands the rail to the CV form, also after a restart', async () => {
    const { settings, finishLoading } = fakeSettings('collapsed')
    const preference = createEditorSidebarPreference(settings)
    preference.load()
    finishLoading()
    await settled()
    preference.expand()
    expect(preference.current()).toBe('form')
    expect(settings.setEditorSidebar).toHaveBeenCalledExactlyOnceWith('form')
  })

  it('notifies subscribers of every change, and a settings file that cannot be read keeps the rail', async () => {
    const settings = { get: vi.fn(async () => Promise.reject(new Error('damaged'))), setEditorSidebar: vi.fn(async () => undefined) }
    const preference = createEditorSidebarPreference(settings)
    const listener = vi.fn()
    const unsubscribe = preference.subscribe(listener)
    preference.load()
    await settled()
    expect(preference.current()).toBe('collapsed')
    preference.choose('form')
    unsubscribe()
    preference.choose('collapsed')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
