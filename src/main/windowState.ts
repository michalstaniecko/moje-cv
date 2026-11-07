// Geometria okna aplikacji bez Electrona: prostokąty to zwykłe obiekty, a ekrany to ich `workArea`.

export type Rectangle = { x: number; y: number; width: number; height: number }
export type Size = { width: number; height: number }

// Rozmiar okna przy pierwszym uruchomieniu (przycinany do ekranu głównego) i rozmiar minimalny, przy którym biblioteka,
// edytor, dialogi i Sponsor bar mieszczą się we wszystkich językach interfejsu.
export const DEFAULT_WINDOW_SIZE: Size = { width: 1280, height: 900 }
export const MIN_WINDOW_SIZE: Size = { width: 960, height: 640 }

// Okno da się chwycić i przesunąć, gdy jego górny pasek (górne 40 px) przecina ekran na co najmniej 100 px szerokości.
const TITLE_BAR_HEIGHT = 40
const MIN_GRAB_WIDTH = 100

// Prostokąt zapisanego okna dopasowany do ekranu, na którym da się je chwycić: wymiary przycięte do ekranu i podniesione
// do minimum, pozycja przesunięta tak, żeby okno w całości było na tym ekranie. `undefined`, gdy okna nie da się chwycić
// na żadnym ekranie (np. został na odłączonym monitorze) – wtedy okno dostaje rozmiar domyślny.
export function restoreBounds(saved: Rectangle, workAreas: Rectangle[], minSize: Size): Rectangle | undefined {
  const titleBar = { ...saved, height: TITLE_BAR_HEIGHT }
  const area = workAreas.find((area) => {
    const overlap = intersection(titleBar, area)
    return overlap !== undefined && overlap.width >= MIN_GRAB_WIDTH
  })
  if (!area) return undefined
  const width = Math.max(Math.min(saved.width, area.width), minSize.width)
  const height = Math.max(Math.min(saved.height, area.height), minSize.height)
  return {
    x: Math.max(area.x, Math.min(saved.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(saved.y, area.y + area.height - height)),
    width,
    height
  }
}

// Rozmiar domyślny przycięty do ekranu głównego, wyśrodkowany na nim.
export function defaultBounds(workArea: Rectangle, size: Size): Rectangle {
  const width = Math.min(size.width, workArea.width)
  const height = Math.min(size.height, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height
  }
}

function intersection(a: Rectangle, b: Rectangle): Rectangle | undefined {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined
}
