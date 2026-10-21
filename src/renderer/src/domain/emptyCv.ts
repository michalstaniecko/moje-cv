import { cvDocumentSchema, defaultCvSettings, type Clause, type CvDocument } from './schema'

// Puste CV z domyślnymi sekcjami i podpowiedziami kontaktu – punkt startowy przy „Nowe CV”.
// Domyślna klauzula z biblioteki jest kopiowana do CV i włączona.
export function emptyCv({
  now,
  newId,
  defaultClause = null
}: {
  now: Date
  newId: () => string
  defaultClause?: Clause | null
}): CvDocument {
  const timestamp = now.toISOString()
  const sectionDefaults = { hidden: false, pageBreakBefore: false, items: [] }
  return cvDocumentSchema.parse({
    schemaVersion: 1,
    id: newId(),
    name: 'Nowe CV',
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: defaultCvSettings,
    header: {
      fullName: '',
      photo: null,
      contacts: ['Tel', 'E-mail', 'LinkedIn', 'Miasto'].map((label) => ({ id: newId(), label, value: '' })),
      summary: ''
    },
    sections: [
      { ...sectionDefaults, id: newId(), type: 'experience', title: 'Doświadczenie zawodowe' },
      { ...sectionDefaults, id: newId(), type: 'education', title: 'Wykształcenie' },
      { ...sectionDefaults, id: newId(), type: 'list', title: 'Umiejętności' },
      { ...sectionDefaults, id: newId(), type: 'list', title: 'Języki' }
    ],
    consent: defaultClause
      ? { enabled: true, clauseId: defaultClause.id, text: defaultClause.text }
      : { enabled: false, clauseId: null, text: '' }
  })
}
