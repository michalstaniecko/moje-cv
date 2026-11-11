import { describe, expect, it, vi } from 'vitest'
import { createFormWidthPreference } from './useFormWidth'

function fakeSettings(stored: number | undefined) {
  let resolveGet: () => void = () => undefined
  const get = vi.fn(() => new Promise<{ formWidth?: number }>((resolve) => (resolveGet = () => resolve({ formWidth: stored }))))
  const setFormWidth = vi.fn(async () => undefined)
  return { settings: { get, setFormWidth }, finishLoading: () => resolveGet() }
}

const settled = () => new Promise((resolve) => setTimeout(resolve))

describe('form width preference', () => {
  it('starts at the default width and switches to the saved width once settings load', async () => {
    const { settings, finishLoading } = fakeSettings(520)
    const preference = createFormWidthPreference(settings)
    preference.load()
    expect(preference.current()).toBe(440)
    finishLoading()
    await vi.waitFor(() => expect(preference.current()).toBe(520))
  })

  it('reads the settings file only once per session', async () => {
    const { settings, finishLoading } = fakeSettings(520)
    const preference = createFormWidthPreference(settings)
    preference.load()
    finishLoading()
    await vi.waitFor(() => expect(preference.current()).toBe(520))
    preference.load()
    expect(settings.get).toHaveBeenCalledTimes(1)
  })

  it('keeps the width the user chose before the saved width loaded', async () => {
    const { settings, finishLoading } = fakeSettings(520)
    const preference = createFormWidthPreference(settings)
    preference.load()
    preference.commit(600)
    finishLoading()
    await settled()
    expect(preference.current()).toBe(600)
  })

  it('keeps a width being dragged before the saved width loaded', async () => {
    const { settings, finishLoading } = fakeSettings(520)
    const preference = createFormWidthPreference(settings)
    preference.load()
    preference.preview(600)
    finishLoading()
    await settled()
    expect(preference.current()).toBe(600)
  })

  it('saves only committed widths, not the ones previewed while dragging', () => {
    const { settings } = fakeSettings(undefined)
    const preference = createFormWidthPreference(settings)
    preference.preview(500)
    preference.preview(520)
    expect(settings.setFormWidth).not.toHaveBeenCalled()
    preference.commit(530)
    expect(settings.setFormWidth).toHaveBeenCalledExactlyOnceWith(530)
  })

  it('notifies subscribers of every change', () => {
    const { settings } = fakeSettings(undefined)
    const preference = createFormWidthPreference(settings)
    const listener = vi.fn()
    const unsubscribe = preference.subscribe(listener)
    preference.preview(500)
    preference.commit(500)
    unsubscribe()
    preference.commit(510)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
