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

import { cvFontFamilies } from '../../../shared/cvFonts'
import type { CvDocument } from '../domain/schema'

export type Font = CvDocument['settings']['font']

// Nazwa rodziny w CSS – zarazem nazwa fontu pokazywana w formularzu (wspólna z DOCX export, więc w shared).
export const fontFamilies = cvFontFamilies

// Font zastępczy dla znaków, których nie ma wybrany font (Lato nie ma cyrylicy ani pełnego wietnamskiego):
// dołączony Source Sans 3 zamiast fontu systemowego, który byłby inny na każdym komputerze.
const fallbacks: Record<Font, Font[]> = {
  lato: ['source-sans-3'],
  'source-sans-3': [],
  arimo: []
}

const families = (font: Font): string[] => [font, ...fallbacks[font]].map((family) => fontFamilies[family])

// Wartość `font-family` CV: wybrany font, jego font zastępczy i w ostateczności sans-serif.
export const fontStack = (font: Font): string => [...families(font).map((family) => `"${family}"`), 'sans-serif'].join(', ')

// Znaki ze wszystkich podzbiorów fontów, których mogą używać CV language: łaciński z polskimi i tureckimi literami,
// cyrylica i wietnamski. Font ładuje tylko podzbiory, które ma.
const FONT_SAMPLE = 'AaŁłĄąĘęŚśŻżŹźĆćŃńÓóİıŞşĞğ' + 'ЖжЩщЇїЄєҐґ' + 'ẠạẾếỆệỖỗỰựĐđ'

// Czeka na załadowanie wszystkich krojów używanych przez szablon (we wszystkich podzbiorach znaków, także fontu
// zastępczego), zanim zmierzymy bloki.
export async function loadTemplateFonts(font: Font): Promise<void> {
  await Promise.all(
    families(font).flatMap((family) =>
      ['', 'italic ', 'bold ', 'italic bold '].map((style) => document.fonts.load(`${style}10pt "${family}"`, FONT_SAMPLE))
    )
  )
  await document.fonts.ready
}
