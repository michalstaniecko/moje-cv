import { useEffect, useRef } from 'react'
import type { Dictionary } from '../../../shared/i18n/en'
import type { ClauseLibrary } from '../canvas/ConsentToolbar'
import type { EditSession } from '../canvas/useEditSession'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { sectionName } from '../editor/fields/SectionTitleField'
import { useDictionary } from '../i18n'
import { ConsentPanel } from './ConsentPanel'
import { HeaderPanel } from './HeaderPanel'
import { PhotoPanel } from './PhotoPanel'
import { SectionPanel } from './SectionPanel'
import { findSection, type CvElement } from './selection'

// Co dostaje panel elementu: edytor (każda zmiana przez `editor.edit` – jeden krok cofania), bieżący dokument i sesję
// edycji (np. `focusOnPage` z openOnPage.ts – kursor w części CV na stronie). Do tego to, co mają akcje na stronach:
// usunięcie z „Removed. Undo” (`onRemove`), biblioteka klauzul (`library`), a także `onSelect` – panel innej części CV.
export type PanelProps = {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  onRemove: RemoveWithUndo
  library: ClauseLibrary
  onSelect: (element: CvElement) => void
}

// Panel elementu Inspektora (#139): ścieżka „‹ Dokument / nazwa” (przycisk wraca do panelu „Dokument”) i panel części
// CV – każdy rodzaj w osobnym pliku. Element jest w dokumencie (zaznaczenie bez swojej części to panel „Dokument” –
// selection.ts). Inspector montuje panel od nowa dla każdej części (`key`), więc zaczyna przewinięty do góry.
export function ElementPanel({ element, onBack, ...props }: PanelProps & { element: CvElement; onBack: () => void }) {
  const t = useDictionary().editor
  const heading = useRef<HTMLHeadingElement>(null)

  // Otwarty z listy „CV elements”: kliknięty wiersz zniknął razem z panelem „Dokument”, więc fokus – jeśli nie trafił na
  // stronę – staje na tytule panelu.
  useEffect(() => {
    const active = window.document.activeElement
    if (!active || active === window.document.body) heading.current?.focus()
  }, [])

  return (
    <>
      <div className="inspector-head">
        {/* Bezpieczne miejsce fokusu edytora (CvScreen.focusSafePlace), gdy panel „Dokument” jest zakryty. */}
        <button type="button" className="inspector-back" onClick={onBack} data-safe-focus>
          <span aria-hidden="true">‹ </span>
          {t.inspector.document}
        </button>
        <span className="inspector-path-separator" aria-hidden="true">
          /
        </span>
        <h2 ref={heading} className="inspector-title" tabIndex={-1}>
          {elementName(element, props.document, t)}
        </h2>
      </div>
      <div className="inspector-panel">
        <PanelBody element={element} {...props} />
      </div>
    </>
  )
}

function PanelBody({ element, ...props }: PanelProps & { element: CvElement }) {
  switch (element.kind) {
    case 'section': {
      const section = findSection(props.document, element.id)
      return section ? <SectionPanel {...props} section={section} /> : null
    }
    case 'header':
      return <HeaderPanel {...props} />
    case 'photo':
      return <PhotoPanel {...props} />
    case 'consent':
      return <ConsentPanel {...props} />
  }
}

// Nazwa części CV w ścieżce panelu – jak na liście „CV elements”.
export function elementName(element: CvElement, document: CvDocument, t: Dictionary['editor']): string {
  switch (element.kind) {
    case 'section': {
      const section = findSection(document, element.id)
      return section ? sectionName(section, t) : ''
    }
    case 'header':
      return t.header
    case 'photo':
      return t.photo.legend
    case 'consent':
      return t.consent.title
  }
}
