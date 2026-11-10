// Fonty CV (ustawienie `font` w CV). Lista żyje w shared, bo rejestr języków (shared/i18n/languages.ts)
// podaje dla każdego języka font, z którym CV w nim startuje.
export const cvFontIds = ['lato', 'source-sans-3', 'arimo'] as const

export type CvFontId = (typeof cvFontIds)[number]

// Nazwa rodziny fontu – w CSS podglądu, w formularzu i w DOCX export (font po nazwie).
export const cvFontFamilies: Record<CvFontId, string> = {
  lato: 'Lato',
  'source-sans-3': 'Source Sans 3',
  arimo: 'Arimo'
}
