import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { cvFontIds } from '../../shared/cvFonts'
import { FONTS_SOURCE_DIRECTORY, fontFaceFiles, readDocxFonts } from './fontFiles'

// Katalog fontów względem tego pliku, a nie katalogu roboczego (test działa uruchomiony z dowolnego miejsca).
const fontsDirectory = fileURLToPath(new URL(`../../../${FONTS_SOURCE_DIRECTORY}`, import.meta.url))

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex')

// Tagi tabel z katalogu tabel pliku sfnt (16 bajtów na tabelę od bajtu 12).
const tableTags = (data: Buffer): string[] =>
  Array.from({ length: data.readUInt16BE(4) }, (_, index) => data.toString('latin1', 12 + index * 16, 16 + index * 16))

// Wiersze tabeli w SOURCES.md: „| `plik` | źródło | `sha256` |”.
const recordedHashes = (family: string): Map<string, string> =>
  new Map(
    [...readFileSync(join(fontsDirectory, family, 'SOURCES.md'), 'utf8').matchAll(/^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|$/gm)].map(
      ([, file, hash]) => [file!, hash!]
    )
  )

describe('font files for the DOCX export', () => {
  test.each(cvFontIds)('%s: every committed TTF and OFL.txt matches the SHA-256 recorded in its SOURCES.md', (family) => {
    const hashes = recordedHashes(family)
    const files = readdirSync(join(fontsDirectory, family)).filter((file) => file !== 'SOURCES.md').sort()
    expect(files).toContain('OFL.txt')
    expect([...hashes.keys()].sort()).toEqual(files)
    for (const file of files) expect(sha256(readFileSync(join(fontsDirectory, family, file))), file).toBe(hashes.get(file))
  })

  test('each CV font has four static TrueType faces (regular, bold, italic, bold italic) among the committed files', () => {
    for (const font of cvFontIds) {
      const faces = Object.values(fontFaceFiles[font])
      expect(faces).toHaveLength(4)
      for (const face of faces) {
        expect(face.startsWith(`${font}/`)).toBe(true)
        const data = readFileSync(join(fontsDirectory, face))
        // Sygnatura sfnt TrueType (0x00010000) i brak tabeli `fvar` – font statyczny, nie zmienny.
        expect(data.readUInt32BE(0)).toBe(0x00010000)
        expect(tableTags(data)).not.toContain('fvar')
      }
    }
  })

  test('readDocxFonts reads the four faces of every CV font from a fonts directory', async () => {
    const fonts = await readDocxFonts(fontsDirectory)
    for (const font of cvFontIds) {
      for (const [face, file] of Object.entries(fontFaceFiles[font])) {
        expect(fonts[font][face as keyof (typeof fonts)[typeof font]].equals(readFileSync(join(fontsDirectory, file)))).toBe(true)
      }
    }
  })
})
