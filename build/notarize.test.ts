import { describe, expect, test } from 'vitest'
import { developerIdIdentity, notarytoolCredentials } from './notarize.mjs'

// Dane do notaryzacji `.dmg` (#43): te same zmienne środowiskowe, które czyta wbudowana notaryzacja electron-buildera.
describe('notarization credentials', () => {
  test('an App Store Connect API key', () => {
    expect(
      notarytoolCredentials({ APPLE_API_KEY: '/keys/AuthKey_ABC123.p8', APPLE_API_KEY_ID: 'ABC123', APPLE_API_ISSUER: 'issuer-uuid' })
    ).toEqual(['--key', '/keys/AuthKey_ABC123.p8', '--key-id', 'ABC123', '--issuer', 'issuer-uuid'])
  })

  test('an Apple ID with an app-specific password', () => {
    expect(
      notarytoolCredentials({ APPLE_ID: 'dev@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh-ijkl-mnop', APPLE_TEAM_ID: '8A9ZJPAGY8' })
    ).toEqual(['--apple-id', 'dev@example.com', '--password', 'abcd-efgh-ijkl-mnop', '--team-id', '8A9ZJPAGY8'])
  })

  test('a notarytool profile in the keychain, optionally in a given keychain', () => {
    expect(notarytoolCredentials({ APPLE_KEYCHAIN_PROFILE: 'cv-drawer' })).toEqual(['--keychain-profile', 'cv-drawer'])
    expect(notarytoolCredentials({ APPLE_KEYCHAIN_PROFILE: 'cv-drawer', APPLE_KEYCHAIN: '/k/release.keychain-db' })).toEqual([
      '--keychain-profile',
      'cv-drawer',
      '--keychain',
      '/k/release.keychain-db'
    ])
  })

  test('none at all is an error naming every option', () => {
    for (const name of ['APPLE_API_KEY', 'APPLE_ID', 'APPLE_KEYCHAIN_PROFILE']) {
      expect(() => notarytoolCredentials({})).toThrow(name)
    }
  })

  test('an incomplete set is an error naming what is missing', () => {
    expect(() => notarytoolCredentials({ APPLE_API_KEY: '/keys/k.p8', APPLE_API_ISSUER: 'issuer' })).toThrow(/APPLE_API_KEY_ID/)
    expect(() => notarytoolCredentials({ APPLE_ID: 'dev@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'x' })).toThrow(/APPLE_TEAM_ID/)
  })

  test('empty variables count as not set', () => {
    expect(() => notarytoolCredentials({ APPLE_KEYCHAIN_PROFILE: '' })).toThrow(/APPLE_KEYCHAIN_PROFILE/)
  })
})

// Wynik `security find-identity -v -p codesigning`.
const identities = (...names: string[]) =>
  [...names.map((name, i) => `  ${i + 1}) ${'0123456789ABCDEF0123456789ABCDEF0123456' + i} "${name}"`), `     ${names.length} valid identities found`].join('\n')

describe('Developer ID identity', () => {
  test('is the Developer ID Application certificate of the team', () => {
    expect(
      developerIdIdentity(
        identities('Apple Development: Michal Staniecko (H9539FQU24)', 'Developer ID Application: Michal Staniecko (8A9ZJPAGY8)'),
        '8A9ZJPAGY8'
      )
    ).toBe('Developer ID Application: Michal Staniecko (8A9ZJPAGY8)')
  })

  test('a development or another team certificate is not enough', () => {
    expect(() =>
      developerIdIdentity(
        identities('Apple Development: Michal Staniecko (H9539FQU24)', 'Developer ID Application: Someone Else (ZZZZZZZZZZ)'),
        '8A9ZJPAGY8'
      )
    ).toThrow(/Developer ID Application.*8A9ZJPAGY8/)
    expect(() => developerIdIdentity(identities(), '8A9ZJPAGY8')).toThrow(/dist:mac:local/)
  })
})
