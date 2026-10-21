// Fonty dołączone do aplikacji (pliki z pakietów @fontsource, licencja OFL – nie fonty systemowe).
import '@fontsource/lato/400.css'
import '@fontsource/lato/400-italic.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/700-italic.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/400-italic.css'
import '@fontsource/source-sans-3/700.css'
import '@fontsource/source-sans-3/700-italic.css'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/400-italic.css'
import '@fontsource/arimo/700.css'
import '@fontsource/arimo/700-italic.css'

import type { CvDocument } from '../domain/schema'

export type Font = CvDocument['settings']['font']

// Nazwa rodziny w CSS – zarazem nazwa fontu pokazywana w formularzu.
export const fontFamilies: Record<Font, string> = {
  lato: 'Lato',
  'source-sans-3': 'Source Sans 3',
  arimo: 'Arimo'
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
