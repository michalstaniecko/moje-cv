// Kolor tekstu na wypełnieniu kolorem akcentu: czarny albo biały – ten z wyższym współczynnikiem kontrastu (WCAG 2).
export function onAccentColor(accentColor: string): '#000000' | '#ffffff' {
  const luminance = relativeLuminance(accentColor)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  return contrastWithBlack > contrastWithWhite ? '#000000' : '#ffffff'
}

// Luminancja względna koloru „#rrggbb” wg WCAG 2.
function relativeLuminance(hex: string): number {
  const channel = (start: number) => linearChannel(parseInt(hex.slice(start, start + 2), 16) / 255)
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function linearChannel(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}
