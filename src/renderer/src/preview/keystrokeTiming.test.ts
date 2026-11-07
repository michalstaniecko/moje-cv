import { beforeEach, describe, expect, test } from 'vitest'
import { KEYSTROKE_TO_PREVIEW, markInput, markPreviewPainted } from './keystrokeTiming'

const measures = () => performance.getEntriesByName(KEYSTROKE_TO_PREVIEW, 'measure')

beforeEach(() => {
  performance.clearMarks()
  performance.clearMeasures()
  markPreviewPainted() // nic nie czeka z poprzedniego testu
  performance.clearMeasures()
})

describe('keystroke-to-preview timing', () => {
  test('measures from the keystroke to the painted preview', () => {
    const typedAt = Math.max(0, performance.now() - 40)

    markInput(typedAt)
    markPreviewPainted()

    expect(measures()).toHaveLength(1)
    expect(measures()[0]!.startTime).toBe(typedAt)
    expect(measures()[0]!.duration).toBeCloseTo(performance.now() - typedAt, -1)
  })

  test('a preview painted without a keystroke (e.g. after zoom or opening the CV) is not measured', () => {
    markPreviewPainted()

    expect(measures()).toHaveLength(0)
  })

  test('keystrokes painted together are measured once, from the first one, which waited longest', () => {
    const firstAt = Math.max(0, performance.now() - 80)
    markInput(firstAt)
    markInput(firstAt + 30)
    markPreviewPainted()
    markPreviewPainted()

    expect(measures()).toHaveLength(1)
    expect(measures()[0]!.startTime).toBe(firstAt)
  })
})
