import type { BlockSpacingMm, PageMarginsMm, TemplateGeometry } from './templateGeometry'

// Geometria szablonu do testów (tylko testy): okrągłe marginesy 10 mm i odstępy bliskie „Klasycznemu”.
// Test zmienia tylko wartości, które sprawdza – przez `withMargins` / `withSpacing`.
export const testGeometry: TemplateGeometry = {
  pageMarginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  blockSpacingMm: {
    afterHeader: 6,
    beforeSectionTitle: 6,
    afterSectionTitle: 3,
    betweenBullets: 0.5,
    afterExperienceEntryWithoutBullets: 2,
    afterExperienceItem: 5,
    afterEducationItem: 2,
    afterEducationSection: 6,
    betweenListItems: 0.5,
    afterListSection: 4
  },
  listSectionLayout: { title: 'beside', columns: 1 },
  consentGapMm: 6
}

export const withMargins = (pageMarginsMm: PageMarginsMm): TemplateGeometry => ({ ...testGeometry, pageMarginsMm })

export const withSpacing = (spacing: Partial<BlockSpacingMm>): BlockSpacingMm => ({
  ...testGeometry.blockSpacingMm,
  ...spacing
})
