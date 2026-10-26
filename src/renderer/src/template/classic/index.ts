import type { TemplateDefinition } from '../templateDefinition'
import './classic.css'

// „Klasyczny” – wygląd z briefu (spec #1, „Wygląd szablonu”).
export const classicTemplate = {
  className: 'cv-template-classic',
  geometry: {
    // Marginesy 12 / 16 / 10 / 12 mm → obszar treści 182 × 275 mm.
    pageMarginsMm: { top: 12, right: 16, bottom: 10, left: 12 },
    blockSpacingMm: {
      afterHeader: 6,
      beforeSectionTitle: 6,
      afterSectionTitle: 3,
      betweenBullets: 0.6,
      afterExperienceEntryWithoutBullets: 2,
      afterExperienceItem: 5,
      afterEducationItem: 2,
      afterEducationSection: 6,
      betweenListItems: 0.6,
      afterListSection: 4
    },
    consentGapMm: 6
  },
  blockViews: {}
} as const satisfies TemplateDefinition
