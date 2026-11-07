import { describe, expect, test } from 'vitest'
import { createPerfLog } from './perfLog'

describe('performance log', () => {
  test('records how long each timed step took, under its name, and passes the result through', async () => {
    let clock = 0
    const log = createPerfLog(() => clock)

    const result = await log.time('cv:update/write', async () => {
      clock += 12.5
      return 'written'
    })
    const parsed = log.time('cv:update/validate', () => {
      clock += 3
      return 'parsed'
    })

    expect(result).toBe('written')
    expect(parsed).toBe('parsed')
    expect(log.entries).toEqual([
      { name: 'cv:update/write', duration: 12.5 },
      { name: 'cv:update/validate', duration: 3 }
    ])
  })

  test('a step that fails is recorded too', async () => {
    let clock = 0
    const log = createPerfLog(() => clock)

    await expect(
      log.time('cv:update', async () => {
        clock += 7
        throw new Error('disk full')
      })
    ).rejects.toThrow('disk full')
    expect(() =>
      log.time('cv:update/validate', () => {
        clock += 1
        throw new Error('invalid')
      })
    ).toThrow('invalid')

    expect(log.entries).toEqual([
      { name: 'cv:update', duration: 7 },
      { name: 'cv:update/validate', duration: 1 }
    ])
  })
})
