// Fonty dołączone do aplikacji (pliki z pakietu @fontsource, nie fonty systemowe).
import '@fontsource/lato/400.css'
import '@fontsource/lato/400-italic.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/700-italic.css'

import type { CvDocument } from '../domain/schema'

type Font = CvDocument['settings']['font']

// Source Sans 3 i Arimo dojdą razem z wyborem fontu; do tego czasu wszystkie warianty używają Lato.
export const fontFamilies: Record<Font, string> = {
  lato: 'Lato',
  'source-sans-3': 'Lato',
  arimo: 'Lato'
}

const FONT_SAMPLE = 'AaŁłĄąĘęŚśŻżŹźĆćŃńÓó'

// Czeka na załadowanie wszystkich krojów używanych przez szablon (w tym podzbioru z polskimi znakami),
// zanim zmierzymy bloki.
export async function loadTemplateFonts(font: Font): Promise<void> {
  const family = fontFamilies[font]
  await Promise.all(
    ['', 'italic ', 'bold ', 'italic bold '].map((style) =>
      document.fonts.load(`${style}10pt "${family}"`, FONT_SAMPLE)
    )
  )
  await document.fonts.ready
}
