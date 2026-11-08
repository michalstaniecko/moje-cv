import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cvFontIds, type CvFontId } from '../../shared/cvFonts'

// Pliki fontów osadzanych w DOCX export (zob. ADR-0008): niezmienione statyczne TTF od upstreamu w `resources/fonts/<font>/`
// razem z `OFL.txt` i `SOURCES.md` (URL, wersja, SHA-256). W paczce ten katalog to `Contents/Resources/fonts`
// (`extraResources` w electron-builder.yml). Moduł bez Electrona – katalog podaje docxFonts.ts.

// Katalog fontów względem katalogu głównego projektu (w dev i w testach).
export const FONTS_SOURCE_DIRECTORY = 'resources/fonts'

// Cztery kroje fontu: zwykły, pogrubiony, kursywa i pogrubiona kursywa.
export type FontFaces = { regular: Buffer; bold: Buffer; italic: Buffer; boldItalic: Buffer }
type Face = keyof FontFaces

// Kroje każdego fontu CV – po jednym pliku TTF na krój, w nazwach upstreamu.
export type DocxFonts = Record<CvFontId, FontFaces>

export const fontFaceFiles: Record<CvFontId, Record<Face, string>> = {
  lato: {
    regular: 'lato/Lato-Regular.ttf',
    bold: 'lato/Lato-Bold.ttf',
    italic: 'lato/Lato-Italic.ttf',
    boldItalic: 'lato/Lato-BoldItalic.ttf'
  },
  'source-sans-3': {
    regular: 'source-sans-3/SourceSans3-Regular.ttf',
    bold: 'source-sans-3/SourceSans3-Bold.ttf',
    italic: 'source-sans-3/SourceSans3-It.ttf',
    boldItalic: 'source-sans-3/SourceSans3-BoldIt.ttf'
  },
  arimo: {
    regular: 'arimo/Arimo-Regular.ttf',
    bold: 'arimo/Arimo-Bold.ttf',
    italic: 'arimo/Arimo-Italic.ttf',
    boldItalic: 'arimo/Arimo-BoldItalic.ttf'
  }
}

async function readFaces(directory: string, font: CvFontId): Promise<FontFaces> {
  const files = fontFaceFiles[font]
  const [regular, bold, italic, boldItalic] = await Promise.all(
    [files.regular, files.bold, files.italic, files.boldItalic].map((file) => readFile(join(directory, file)))
  )
  return { regular: regular!, bold: bold!, italic: italic!, boldItalic: boldItalic! }
}

// Kroje wszystkich fontów CV z katalogu fontów.
export async function readDocxFonts(directory: string): Promise<DocxFonts> {
  const faces = await Promise.all(cvFontIds.map((font) => readFaces(directory, font)))
  return Object.fromEntries(cvFontIds.map((font, index) => [font, faces[index]!])) as DocxFonts
}
