import { describe, expect, test } from 'vitest'
import { compareVersions, isNewer, parseReleaseTag } from './versions'

describe('release tag', () => {
  test('a tag vX.Y.Z gives the version X.Y.Z', () => {
    expect(parseReleaseTag('v1.1.0')).toBe('1.1.0')
    expect(parseReleaseTag('v10.0.12')).toBe('10.0.12')
  })

  test.each(['1.1.0', 'v1.1', 'v1.1.0-beta.1', 'v1.1.0 ', ' v1.1.0', '', 'v1.1.0.0', 'vx.y.z'])(
    '%j is not a release tag',
    (tag) => {
      expect(parseReleaseTag(tag)).toBeNull()
    }
  )
})

describe('version comparison', () => {
  test('segments are compared as numbers', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1)
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  test('a newer release is newer than the running version', () => {
    expect(isNewer('1.1.0', '1.0.0')).toBe(true)
    expect(isNewer('1.0.10', '1.0.9')).toBe(true)
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
  })

  test('the same or an older release is not newer', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
  })

  test('a running version that is not plain X.Y.Z (development build) never gets a notice', () => {
    expect(isNewer('9.0.0', '1.0.0-dev')).toBe(false)
    expect(isNewer('9.0.0', '')).toBe(false)
  })

  test('a candidate that is not plain X.Y.Z is never newer', () => {
    expect(isNewer('9.0.0-rc.1', '1.0.0')).toBe(false)
  })
})
