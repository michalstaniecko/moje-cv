import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// Konfiguracja electron-buildera czytana tym samym parserem YAML, którego używa electron-builder (js-yaml z jego zależności).
type BuilderConfig = {
  appId: string
  mac: { identity: string; notarize?: boolean; entitlementsInherit?: string; extendInfo: { ElectronTeamID: string } }
  mas: { notarize?: boolean; entitlementsInherit?: string }
}
function builderConfig(): BuilderConfig {
  const fromBuilder = createRequire(createRequire(__filename).resolve('electron-builder'))
  const yaml = createRequire(fromBuilder.resolve('app-builder-lib'))('js-yaml') as { load(text: string): unknown }
  return yaml.load(readFileSync(join(__dirname, '../electron-builder.yml'), 'utf8')) as BuilderConfig
}

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
    expect(plist(name)['com.apple.security.application-groups']).toEqual(['8A9ZJPAGY8.com.michalstaniecko.cvdrawer'])
  })

  test('Electron helpers in both channels inherit the sandbox of the app and get no access of their own', () => {
    const config = builderConfig()
    // Jeden plik dla `.dmg` i Mac App Store: `mas` dziedziczy `entitlementsInherit` z `mac`.
    expect(config.mac.entitlementsInherit).toBe('build/entitlements.inherit.plist')
    expect(config.mas.entitlementsInherit).toBeUndefined()
    const entitlements = granted('entitlements.inherit.plist')
    expect(entitlements).toEqual(expect.arrayContaining(['com.apple.security.app-sandbox', 'com.apple.security.inherit']))
    expect(entitlements.filter((key) => key.startsWith('com.apple.security.files.') || key.startsWith('com.apple.security.network.'))).toEqual([])
  })

  test.each(['entitlements.mac.plist', 'entitlements.mas.plist', 'entitlements.inherit.plist'])(
    '%s has no temporary exceptions',
    (name) => {
      expect(Object.keys(plist(name)).filter((key) => key.includes('temporary-exception'))).toEqual([])
    }
  )
})

// Identyfikator zespołu Apple Developer jest w kilku miejscach, których nie da się wspólnie sparametryzować (YAML
// i pliki entitlements); muszą się zgadzać, inaczej podpis wybierze inny certyfikat albo Electron nie wystartuje w sandboksie.
describe('Apple Developer team ID', () => {
  test('ElectronTeamID, the Developer ID signing identity and the app group of every build agree', () => {
    const config = builderConfig()
    const team = config.mac.extendInfo.ElectronTeamID
    expect(team).toMatch(/^[A-Z0-9]{10}$/)
    expect(config.mac.identity).toBe(team)
    for (const name of ['entitlements.mac.plist', 'entitlements.mas.plist', 'entitlements.e2e.plist']) {
      expect(plist(name)['com.apple.security.application-groups'], name).toEqual([`${team}.${config.appId}`])
    }
  })
})

describe('Mac App Store build', () => {
  // `mas` dziedziczy `mac`, w tym `notarize: true`; aplikacje ze sklepu sprawdza App Review, nie notaryzacja.
  test('is not notarized', () => {
    const config = builderConfig()
    expect(config.mac.notarize).toBe(true)
    expect(config.mas.notarize).toBe(false)
  })
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
