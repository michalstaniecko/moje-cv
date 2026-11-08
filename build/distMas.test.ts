import { describe, expect, test } from 'vitest'
import { masBuild } from './distMas'

const profile = '/Users/someone/secrets/CV_Drawer_Mac_App_Store.provisionprofile'
const devProfile = '/Users/someone/secrets/CV_Drawer_Mac_Development.provisionprofile'

describe('Mac App Store build (`pnpm dist:mas`)', () => {
  test('builds a universal mas package with the given build number and provisioning profile', () => {
    expect(masBuild('mas', { MOJE_CV_BUILD_NUMBER: '42', MOJE_CV_MAS_PROVISIONING_PROFILE: profile })).toEqual({
      profile,
      args: ['--mac', 'mas', '--universal', '-c.buildVersion=42', `-c.mas.provisioningProfile=${profile}`]
    })
  })

  test.each([undefined, '', ' ', '0', '-3', '1.2', '7a', '1e3', '042'])('refuses build number %j', (buildNumber) => {
    expect(() => masBuild('mas', { MOJE_CV_BUILD_NUMBER: buildNumber, MOJE_CV_MAS_PROVISIONING_PROFILE: profile })).toThrow(
      /MOJE_CV_BUILD_NUMBER/
    )
  })

  test('refuses to build without a provisioning profile', () => {
    expect(() => masBuild('mas', { MOJE_CV_BUILD_NUMBER: '42' })).toThrow(/MOJE_CV_MAS_PROVISIONING_PROFILE/)
  })

  test('does not take the development profile for a store build', () => {
    expect(() =>
      masBuild('mas', { MOJE_CV_BUILD_NUMBER: '42', MOJE_CV_MAS_DEV_PROVISIONING_PROFILE: devProfile })
    ).toThrow(/MOJE_CV_MAS_PROVISIONING_PROFILE/)
  })
})

describe('local Mac App Store development build (`pnpm dist:mas-dev`)', () => {
  test('builds a universal mas-dev app with the development profile and no build number', () => {
    expect(masBuild('mas-dev', { MOJE_CV_MAS_DEV_PROVISIONING_PROFILE: ` ${devProfile}\n` })).toEqual({
      profile: devProfile,
      args: ['--mac', 'mas-dev', '--universal', `-c.masDev.provisioningProfile=${devProfile}`]
    })
  })

  test('passes a build number on when one is given', () => {
    expect(masBuild('mas-dev', { MOJE_CV_BUILD_NUMBER: '7', MOJE_CV_MAS_DEV_PROVISIONING_PROFILE: devProfile }).args).toContain(
      '-c.buildVersion=7'
    )
  })

  test('refuses to build without the development profile', () => {
    expect(() => masBuild('mas-dev', { MOJE_CV_MAS_PROVISIONING_PROFILE: profile })).toThrow(
      /MOJE_CV_MAS_DEV_PROVISIONING_PROFILE/
    )
  })
})
