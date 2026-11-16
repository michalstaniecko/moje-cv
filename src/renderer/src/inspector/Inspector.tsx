import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import { DocumentPanel } from './DocumentPanel'

// Inspector (GLOSSARY.md, ADR-0012): stała kolumna opcji CV po prawej stronie stron, w Edit mode i w Preview mode.
// Bez zaznaczenia pokazuje panel „Dokument” (CV design). Nie edytuje treści CV – ta jest na stronach (Page fields).
// Treść przewija się w samym Inspektorze, niezależnie od stron; nagłówek panelu zostaje na górze.
export function Inspector({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor.inspector
  return (
    <aside className="inspector" aria-label={t.label}>
      <h2 className="inspector-title">{t.document}</h2>
      <DocumentPanel editor={editor} document={document} />
    </aside>
  )
}
