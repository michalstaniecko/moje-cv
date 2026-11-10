import type { CvDocument } from './schema'

// Tekst klauzuli zgody na dokumencie: widoczna tylko włączona i z niepustym tekstem (białe znaki się nie liczą).
// Ta sama reguła w podglądzie / PDF i w DOCX export; `null` = brak klauzuli.
export function consentText(document: Pick<CvDocument, 'consent'>): string | null {
  const { enabled, text } = document.consent
  return enabled && text.trim() ? text : null
}
