import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// Pliki pakowania macOS (ADR-0003, ADR-0006) czytane tak jak przez `codesign` i system: przez `plutil` (tylko macOS).
function plist(name: string): Record<string, unknown> {
  return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(__dirname, name)], { encoding: 'utf8' }))
}

// Entitlementy przyznane przez plik (klucze z wartością `true`).
function granted(name: string): string[] {
  return Object.entries(plist(name))
    .filter(([, value]) => value === true)
    .map(([key]) => key)
}

describe('sandbox entitlements', () => {
  test('the Developer ID .dmg is sandboxed, reaches user-chosen files and may ask GitHub for a new version', () => {
    expect(granted('entitlements.mac.plist')).toEqual(
      expect.arrayContaining([
        'com.apple.security.app-sandbox',
        'com.apple.security.files.user-selected.read-write',
        'com.apple.security.network.client'
      ])
    )
  })

  test('the Mac App Store build is sandboxed and reaches user-chosen files, but has no network access', () => {
    const entitlements = granted('entitlements.mas.plist')
    expect(entitlements).toEqual(
      expect.arrayContaining(['com.apple.security.app-sandbox', 'com.apple.security.files.user-selected.read-write'])
    )
    expect(Object.keys(plist('entitlements.mas.plist')).filter((key) => key.startsWith('com.apple.security.network.'))).toEqual([])
  })

  // Electron rejestruje usługi Mach pod nazwą `<ElectronTeamID>.<bundle ID>.…`; w sandboksie wolno to tylko w obrębie
  // grupy aplikacji o tej nazwie, inaczej aplikacja kończy się przy starcie.
  test.each(['entitlements.mac.plist', 'entitlements.mas.plist'])('%s has the app group Electron needs in the sandbox', (name) => {
    expect(plist(name)['com.apple.security.application-groups']).toEqual(['8A9ZJPAGY8.com.michalstaniecko.mojecv'])
  })

  test.each(['entitlements.mac.inherit.plist','entitlements.mas.inherit.plist'])(
    'Electron helpers in %s inherit the sandbox of the app and get no access of their own',
    (name) => {
      const entitlements = granted(name)
      expect(entitlements).toEqual(expect.arrayContaining(['com.apple.security.app-sandbox', 'com.apple.security.inherit']))
      expect(entitlements.filter((key) => key.startsWith('com.apple.security.files.') || key.startsWith('com.apple.security.network.'))).toEqual([])
    }
  )

  test.each(['entitlements.mac.plist', 'entitlements.mas.plist', 'entitlements.mac.inherit.plist', 'entitlements.mas.inherit.plist'])(
    '%s has no temporary exceptions',
    (name) => {
      expect(Object.keys(plist(name)).filter((key) => key.includes('temporary-exception'))).toEqual([])
    }
  )
})

describe('e2e build', () => {
  // Testy na spakowanej aplikacji mają sprawdzać ten sam sandbox co `.dmg`; dodatki służą tylko Playwrightowi
  // (inspektor Node i CDP nasłuchują na localhost) i katalogom tymczasowym testów.
  test('has the entitlements of the .dmg plus only what Playwright and test temp folders need', () => {
    expect(plist('entitlements.e2e.plist')).toEqual({
      ...plist('entitlements.mac.plist'),
      'com.apple.security.network.server': true,
      'com.apple.security.temporary-exception.files.absolute-path.read-write': ['/private/var/folders/']
    })
  })
})

describe('container migration', () => {
  test('moves the data folder of the earlier unsandboxed versions into the container', () => {
    expect(plist('container-migration.plist')).toEqual({ Move: ['${ApplicationSupport}/Moje CV'] })
  })
})
