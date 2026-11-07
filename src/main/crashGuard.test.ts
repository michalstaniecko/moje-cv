import { describe, expect, test } from 'vitest'
import { createCrashGuard } from './crashGuard'

// Zegar sterowany przez test.
function clock(start = 1_000_000) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    }
  }
}

describe('crash guard', () => {
  test('three crashes within a minute reload, the fourth asks', () => {
    const { now, advance } = clock()
    const guard = createCrashGuard({ limit: 3, windowMs: 60_000, now })
    expect(guard.record()).toBe('reload')
    advance(10_000)
    expect(guard.record()).toBe('reload')
    advance(10_000)
    expect(guard.record()).toBe('reload')
    advance(10_000)
    expect(guard.record()).toBe('ask')
  })

  test('crashes spread out over time never ask', () => {
    const { now, advance } = clock()
    const guard = createCrashGuard({ limit: 3, windowMs: 60_000, now })
    for (let crash = 0; crash < 20; crash++) {
      expect(guard.record()).toBe('reload')
      advance(25_000)
    }
  })

  test('after a reset the count starts again', () => {
    const { now, advance } = clock()
    const guard = createCrashGuard({ limit: 3, windowMs: 60_000, now })
    for (let crash = 0; crash < 3; crash++) guard.record()
    expect(guard.record()).toBe('ask')
    guard.reset()
    advance(1_000)
    expect(guard.record()).toBe('reload')
    expect(guard.record()).toBe('reload')
    expect(guard.record()).toBe('reload')
    expect(guard.record()).toBe('ask')
  })

  test('a limit of one lets one event through per window', () => {
    const { now, advance } = clock()
    const guard = createCrashGuard({ limit: 1, windowMs: 60_000, now })
    expect(guard.record()).toBe('reload')
    advance(30_000)
    expect(guard.record()).toBe('ask')
    advance(31_000)
    expect(guard.record()).toBe('reload')
  })
})
