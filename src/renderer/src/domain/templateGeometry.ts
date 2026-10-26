// Geometria dokumentu w szablonie (zob. „Template” w GLOSSARY.md): marginesy strony, odstępy między
// blokami i odstęp klauzuli. Wartości ma wyłącznie definicja szablonu – reszta kodu je od niej bierze.

// Strona A4 w milimetrach i przelicznik na piksele CSS (96 px na cal).
export const A4_MM = { width: 210, height: 297 } as const
export const PX_PER_MM = 96 / 25.4

export type PageMarginsMm = { top: number; right: number; bottom: number; left: number }

// Odstępy po blokach (mm). Odstęp między dwoma blokami to większy z odstępu po pierwszym
// i odstępu przed drugim (jak przy zapadaniu marginesów).
export type BlockSpacingMm = {
  afterHeader: number
  beforeSectionTitle: number
  afterSectionTitle: number
  // Między wierszami punktów doświadczenia (także po wpisie, gdy ma pierwszy punkt).
  betweenBullets: number
  // Po wpisie doświadczenia bez punktów.
  afterExperienceEntryWithoutBullets: number
  // Dodawany po ostatnim bloku wpisu doświadczenia.
  afterExperienceItem: number
  afterEducationItem: number
  // Po ostatnim wpisie sekcji wykształcenia (zamiast afterEducationItem).
  afterEducationSection: number
  betweenListItems: number
  // Dodawany po ostatnim elemencie sekcji listy.
  afterListSection: number
}

export type TemplateGeometry = {
  pageMarginsMm: PageMarginsMm
  blockSpacingMm: BlockSpacingMm
  // Minimalny odstęp klauzuli zgody od treści na ostatniej stronie.
  consentGapMm: number
}

export function contentAreaMm({ pageMarginsMm: margins }: TemplateGeometry): { width: number; height: number } {
  return {
    width: A4_MM.width - margins.left - margins.right,
    height: A4_MM.height - margins.top - margins.bottom
  }
}

// Wymiary w pikselach CSS potrzebne do pomiaru bloków i podziału na strony.
export function pageMetricsPx(geometry: TemplateGeometry): {
  contentWidth: number
  contentHeight: number
  consentGap: number
} {
  const area = contentAreaMm(geometry)
  return {
    contentWidth: area.width * PX_PER_MM,
    contentHeight: area.height * PX_PER_MM,
    consentGap: geometry.consentGapMm * PX_PER_MM
  }
}
