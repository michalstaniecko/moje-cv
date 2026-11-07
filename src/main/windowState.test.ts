import { describe, expect, test } from 'vitest'
import { defaultBounds, restoreBounds } from './windowState'

const laptop = { x: 0, y: 25, width: 1440, height: 875 }
// Drugi monitor po prawej stronie laptopa.
const external = { x: 1440, y: 0, width: 2560, height: 1415 }
const minSize = { width: 960, height: 640 }

describe('restoring the saved window bounds', () => {
  test('a window fully on a screen opens where it was left', () => {
    const saved = { x: 100, y: 80, width: 1000, height: 700 }

    expect(restoreBounds(saved, [laptop], minSize)).toEqual(saved)
  })

  test('a window left on a disconnected monitor is not restored', () => {
    expect(restoreBounds({ x: -1800, y: 100, width: 1200, height: 800 }, [laptop], minSize)).toBeUndefined()
  })

  test('a window whose title bar is off the screen is not restored', () => {
    // Widoczne tylko 50 px paska tytułu przy lewej krawędzi – za mało, żeby chwycić okno.
    expect(restoreBounds({ x: -1150, y: 100, width: 1200, height: 800 }, [laptop], minSize)).toBeUndefined()
    // Pasek tytułu ponad górną krawędzią ekranu.
    expect(restoreBounds({ x: 100, y: -500, width: 1200, height: 520 }, [laptop], minSize)).toBeUndefined()
  })

  test('a window that sticks out a little is moved fully onto the screen', () => {
    expect(restoreBounds({ x: 900, y: 300, width: 1000, height: 700 }, [laptop], minSize)).toEqual({
      x: 440,
      y: 200,
      width: 1000,
      height: 700
    })
  })

  test('a window larger than the screen is shrunk to it', () => {
    expect(restoreBounds({ x: 0, y: 25, width: 2560, height: 1415 }, [laptop], minSize)).toEqual(laptop)
  })

  test('saved dimensions below the minimum size are raised to it', () => {
    expect(restoreBounds({ x: 100, y: 80, width: 400, height: 300 }, [laptop], minSize)).toEqual({
      x: 100,
      y: 80,
      width: 960,
      height: 640
    })
  })

  test('a window on the second of two screens is restored there', () => {
    const saved = { x: 2000, y: 200, width: 1200, height: 900 }

    expect(restoreBounds(saved, [laptop, external], minSize)).toEqual(saved)
  })
})

describe('the default window bounds', () => {
  test('are 1280×900 centred on the primary screen when they fit', () => {
    expect(defaultBounds(external, { width: 1280, height: 900 })).toEqual({
      x: 2080,
      y: 258,
      width: 1280,
      height: 900
    })
  })

  test('are shrunk to a small screen', () => {
    const small = { x: 0, y: 25, width: 1280, height: 775 }

    expect(defaultBounds(small, { width: 1280, height: 900 })).toEqual(small)
  })
})
