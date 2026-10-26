import type { DefaultContent } from '../../../shared/i18n/en'
import { CV_SCHEMA_VERSION, cvDocumentSchema, defaultCvSettings, type Clause, type CvDocument } from './schema'

// Puste CV z domyślnymi sekcjami i podpowiedziami kontaktu – punkt startowy przy „Nowe CV”.
// Nazwa, tytuły sekcji i etykiety kontaktu pochodzą z treści domyślnej (`content`) języka interfejsu.
// Domyślna klauzula z biblioteki jest kopiowana do CV i włączona.
export function emptyCv({
  content,
  now,
  newId,
  defaultClause = null
}: {
  content: DefaultContent
  now: Date
  newId: () => string
  defaultClause?: Clause | null
}): CvDocument {
  const titles = content.sectionTitles
  const timestamp = now.toISOString()
  const sectionDefaults = { hidden: false, pageBreakBefore: false, items: [] }
  return cvDocumentSchema.parse({
    schemaVersion: CV_SCHEMA_VERSION,
    id: newId(),
    name: content.cvName,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: defaultCvSettings,
    header: {
      fullName: '',
      photo: null,
      contacts: content.contactLabels.map((label) => ({ id: newId(), label, value: '' })),
      summary: ''
    },
    sections: [
      { ...sectionDefaults, id: newId(), type: 'experience', title: titles.experience },
      { ...sectionDefaults, id: newId(), type: 'education', title: titles.education },
      { ...sectionDefaults, id: newId(), type: 'list', title: titles.skills },
      { ...sectionDefaults, id: newId(), type: 'list', title: titles.languages }
    ],
    consent: defaultClause
      ? { enabled: true, clauseId: defaultClause.id, text: defaultClause.text }
      : { enabled: false, clauseId: null, text: '' }
  })
}
