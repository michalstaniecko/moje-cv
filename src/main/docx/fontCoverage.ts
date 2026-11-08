import type { CvFontId } from '../../shared/cvFonts'

// Pokrycie fontu w DOCX export (zob. docs/specs/issue-84-grilling.md, Q15): Word nie ma stosu fontów jak CSS, więc
// builder sam dzieli tekst na odcinki – font CV albo font zastępczy (Source Sans 3), tak jak `fallbacks` w
// `template/fonts.ts` w podglądzie.

// Zakresy Unicode podzbiorów `latin` i `latin-ext` z `@fontsource/lato` (te same w krojach 400/700, prosty i kursywa,
// które ładuje renderer). Test porównuje je z `unicode-range` w CSS pakietu – przy aktualizacji Lato skopiuj zakresy.
export const LATO_UNICODE_RANGES: readonly (readonly [number, number])[] = [
  // latin
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
  // latin-ext
  [0x0100, 0x02ba],
  [0x02bd, 0x02c5],
  [0x02c7, 0x02cc],
  [0x02ce, 0x02d7],
  [0x02dd, 0x02ff],
  [0x1d00, 0x1dbf],
  [0x1e00, 0x1e9f],
  [0x1ef2, 0x1eff],
  [0x2020, 0x2020],
  [0x20a0, 0x20ab],
  [0x20ad, 0x20c0],
  [0x2113, 0x2113],
  [0x2c60, 0x2c7f],
  [0xa720, 0xa7ff]
]

// Fonty CV z luką w pokryciu znaków CV language. Arimo i Source Sans 3 mają wszystkie – bez podziału.
const coverage: Record<CvFontId, readonly (readonly [number, number])[] | null> = {
  lato: LATO_UNICODE_RANGES,
  'source-sans-3': null,
  arimo: null
}

// Odcinek tekstu: `fallback` – znaki, których nie ma font CV, piszemy fontem zastępczym.
export type FontSegment = { text: string; fallback: boolean }

const covered = (ranges: readonly (readonly [number, number])[], codePoint: number) =>
  ranges.some(([from, to]) => codePoint >= from && codePoint <= to)

// Dzieli tekst na kolejne odcinki font CV / font zastępczy (po code pointach, więc pary surogatów zostają razem).
export function splitByFontCoverage(text: string, font: CvFontId): FontSegment[] {
  const ranges = coverage[font]
  if (text === '') return []
  if (ranges === null) return [{ text, fallback: false }]
  const segments: FontSegment[] = []
  for (const char of text) {
    const fallback = !covered(ranges, char.codePointAt(0)!)
    const last = segments.at(-1)
    if (last?.fallback === fallback) last.text += char
    else segments.push({ text: char, fallback })
  }
  return segments
}
