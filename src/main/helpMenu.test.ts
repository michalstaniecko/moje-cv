import { describe, expect, test, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { en } from '../shared/i18n/en'
import { pl } from '../shared/i18n/pl'
import { helpMenuItems } from './helpMenu'

// Pozycje tak, jak je widzi użytkownik: etykieta albo „---” dla separatora.
function visible(items: MenuItemConstructorOptions[]): string[] {
  return items.map((item) => (item.type === 'separator' ? '---' : String(item.label)))
}

// Adresy, które trafiają do przeglądarki po kliknięciu pozycji o danej etykiecie (poza MAS).
function openedBy(label: string): string[] {
  const open = vi.fn<(url: string) => void>()
  const item = helpMenuItems({ dictionary: en, macAppStore: false, open, checkForUpdates: () => {} }).find((candidate) => candidate.label === label)
  if (!item?.click) throw new Error(`Brak pozycji „${label}”`)
  item.click(undefined as never, undefined, undefined as never)
  return open.mock.calls.map(([url]) => url)
}

describe('menu Help', () => {
  test('outside the Mac App Store it lists help, privacy, reporting a problem and, after a separator, the update check and support', () => {
    const items = helpMenuItems({ dictionary: en, macAppStore: false, open: () => {}, checkForUpdates: () => {} })
    expect(visible(items)).toEqual(['CV Drawer Help', 'Privacy Policy', 'Report a Problem…', '---', 'Check for Updates…', 'Support CV Drawer…'])
  })

  test('in the Mac App Store it hides the update check, the support item and the separator before them', () => {
    const items = helpMenuItems({ dictionary: en, macAppStore: true, open: () => {}, checkForUpdates: () => {} })
    expect(visible(items)).toEqual(['CV Drawer Help', 'Privacy Policy', 'Report a Problem…'])
  })

  test('labels follow the interface language', () => {
    const items = helpMenuItems({ dictionary: pl, macAppStore: false, open: () => {}, checkForUpdates: () => {} })
    expect(visible(items)).toEqual(['Pomoc CV Drawer', 'Polityka prywatności', 'Zgłoś problem…', '---', 'Sprawdź aktualizacje…', 'Wesprzyj CV Drawer…'])
  })

  test('each item opens exactly its own fixed address', () => {
    expect(openedBy('CV Drawer Help')).toEqual(['https://ihumbak.website/cv-drawer/'])
    expect(openedBy('Privacy Policy')).toEqual(['https://ihumbak.website/cv-drawer/privacy/'])
    expect(openedBy('Report a Problem…')).toEqual(['https://github.com/michalstaniecko/moje-cv/issues/new/choose'])
    expect(openedBy('Support CV Drawer…')).toEqual(['https://github.com/sponsors/michalstaniecko'])
  })

  test('Check for Updates… checks right away and opens no address itself', () => {
    const open = vi.fn<(url: string) => void>()
    const checkForUpdates = vi.fn<(window: unknown) => void>()
    const item = helpMenuItems({ dictionary: en, macAppStore: false, open, checkForUpdates }).find(
      (candidate) => candidate.label === 'Check for Updates…'
    )

    item?.click?.(undefined as never, undefined, undefined as never)

    expect(checkForUpdates).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })
})
