import { useEffect, useRef } from 'react'
import type { EditSession } from '../canvas/useEditSession'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { useDictionary } from '../i18n'
import { elementRowSelector } from './CvElements'
import { DocumentPanel } from './DocumentPanel'
import { ElementPanel } from './ElementPanel'
import { openOnPage, type CvElement } from './openOnPage'
import { useInspectorSelection } from './useInspectorSelection'

// Inspector (GLOSSARY.md, ADR-0012): stała kolumna opcji CV po prawej stronie stron, w Edit mode i w Preview mode.
// Bez zaznaczenia pokazuje panel „Dokument” (CV design i „CV elements”), a z zaznaczoną częścią CV (na stronie albo na
// liście, useInspectorSelection.ts) – jej panel ze ścieżką „‹ Dokument / nazwa” (ElementPanel.tsx); w Preview mode tylko
// panel „Dokument”. Nie edytuje treści CV poza tytułem sekcji – ta jest na stronach (Page fields). Treść przewija się
// w samym Inspektorze, niezależnie od stron; nagłówek panelu zostaje na górze.
export function Inspector({ editor, document, session }: { editor: CvEditor; document: CvDocument; session: EditSession }) {
  const t = useDictionary().editor.inspector
  const editable = session.mode === 'edit'
  const [selection, select] = useInspectorSelection(document, session)
  const aside = useRef<HTMLElement>(null)
  // Część, z której panelu wrócono przyciskiem „‹ Dokument” – po przejściu fokus na jej wierszu na liście.
  const returnTo = useRef<CvElement | null>(null)

  // Klik w wiersz „CV elements” (tylko Edit mode): panel tej części (także ukrytej i pustej) i skok do niej na stronie.
  // Po anulowanym wyborze zdjęcia fokus wraca na wiersz, a gdy go już nie ma – na tytuł panelu.
  const open = (element: CvElement, from: () => HTMLElement | null) => {
    select(element)
    openOnPage(element, {
      editor,
      session,
      from: () => from() ?? aside.current?.querySelector<HTMLElement>('.inspector-title') ?? null
    })
  }
  const back = () => {
    returnTo.current = selection
    select(null)
  }

  // Nowy panel zaczyna przewinięty do góry.
  useEffect(() => {
    if (aside.current) aside.current.scrollTop = 0
    const element = returnTo.current
    if (selection !== null || !element) return
    returnTo.current = null
    const row = aside.current?.querySelector<HTMLElement>(elementRowSelector(element))
    const safePlace = aside.current?.querySelector<HTMLElement>('[data-safe-focus]')
    ;(row && row.offsetParent !== null ? row : safePlace)?.focus()
  }, [selection])

  return (
    <aside ref={aside} className="inspector" aria-label={t.label}>
      {selection ? (
        <ElementPanel
          key={selection.kind === 'section' ? `section:${selection.id}` : selection.kind}
          element={selection}
          onBack={back}
          editor={editor}
          document={document}
          session={session}
        />
      ) : (
        <>
          <h2 className="inspector-title">{t.document}</h2>
          <DocumentPanel editor={editor} document={document} editable={editable} onOpen={open} />
        </>
      )}
    </aside>
  )
}
