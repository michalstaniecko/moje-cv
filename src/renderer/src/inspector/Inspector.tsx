import type { EditSession } from '../canvas/useEditSession'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import { DocumentPanel } from './DocumentPanel'
import { openOnPage, type CvElement } from './openOnPage'

// Inspector (GLOSSARY.md, ADR-0012): stała kolumna opcji CV po prawej stronie stron, w Edit mode i w Preview mode.
// Bez zaznaczenia pokazuje panel „Dokument” (CV design i „CV elements”). Nie edytuje treści CV – ta jest na stronach
// (Page fields). Treść przewija się w samym Inspektorze, niezależnie od stron; nagłówek panelu zostaje na górze.
export function Inspector({ editor, document, session }: { editor: CvEditor; document: CvDocument; session: EditSession }) {
  const t = useDictionary().editor.inspector
  const editable = session.mode === 'edit'

  // Klik w wiersz „CV elements” (tylko Edit mode): skok do części CV na stronie.
  const open = (element: CvElement, from: () => HTMLElement | null) => openOnPage(element, { editor, session, from })

  return (
    <aside className="inspector" aria-label={t.label}>
      <h2 className="inspector-title">{t.document}</h2>
      <DocumentPanel editor={editor} document={document} editable={editable} onOpen={open} />
    </aside>
  )
}
