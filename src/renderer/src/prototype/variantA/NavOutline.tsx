// PROTOTYP – wariant A „Inspektor”: wąski konspekt po lewej – TYLKO nawigacja i kolejność (bez przełączników).
// Klik w część CV stawia w niej kursor na stronie (jak obecny Outline), a Inspektor pokazuje jej opcje. Ukryte części
// są wyszarzone – klik tylko otwiera ich opcje w Inspektorze, gdzie można je pokazać.
import type { EditSession } from '../../canvas/useEditSession'
import type { EditTarget } from '../../canvas/editTargets'
import type { CvDocument } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { moveSection } from '../../editor/documentEdits'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { SortableList } from '../../editor/SortableList'
import { useDictionary } from '../../i18n'
import { scrollToFragment } from './Inspector'
import type { InspectorSelection } from './useInspectorSelection'

export function NavOutline({
  editor,
  document,
  session,
  selection,
  onSelect
}: {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  selection: InspectorSelection
  onSelect: (selection: InspectorSelection) => void
}) {
  const t = useDictionary().editor
  const { photo } = document.header
  const focus = (target: EditTarget, key: string) => {
    scrollToFragment(key)
    session.focusPart(target)
  }
  const isSelected = (candidate: InspectorSelection) =>
    selection !== null &&
    candidate !== null &&
    selection.kind === candidate.kind &&
    (selection.kind !== 'section' || (candidate.kind === 'section' && candidate.id === selection.id))

  return (
    <nav className="pa-outline" aria-label="Konspekt CV">
      <h2 className="pa-outline-title">Konspekt</h2>
      <button
        type="button"
        className="pa-nav"
        aria-current={isSelected({ kind: 'header' }) || undefined}
        onClick={() => {
          onSelect({ kind: 'header' })
          focus({ kind: 'fullName' }, 'fullName')
        }}
      >
        Nagłówek
      </button>
      <button
        type="button"
        className="pa-nav pa-nav--child"
        aria-current={isSelected({ kind: 'photo' }) || undefined}
        data-off={!photo || photo.hidden || undefined}
        onClick={() => {
          onSelect({ kind: 'photo' })
          if (photo && !photo.hidden) scrollToFragment('photo')
        }}
      >
        Zdjęcie
      </button>
      <div className="pa-outline-sections">
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
        >
          {(section, row) => (
            <div className="pa-nav-row">
              {row.handle}
              <button
                type="button"
                className="pa-nav"
                aria-current={isSelected({ kind: 'section', id: section.id }) || undefined}
                data-off={section.hidden || undefined}
                onClick={() => {
                  onSelect({ kind: 'section', id: section.id })
                  if (!section.hidden) focus({ kind: 'sectionTitle', sectionId: section.id }, `sectionTitle:${section.id}`)
                }}
              >
                <span className="pa-nav-text">{sectionName(section, t)}</span>
                {section.items.length > 0 && <span className="pa-nav-count">{section.items.length}</span>}
              </button>
            </div>
          )}
        </SortableList>
      </div>
      <button
        type="button"
        className="pa-nav"
        aria-current={isSelected({ kind: 'consent' }) || undefined}
        data-off={!document.consent.enabled || undefined}
        onClick={() => {
          onSelect({ kind: 'consent' })
          if (document.consent.enabled) focus({ kind: 'consent' }, 'consent')
        }}
      >
        Klauzula zgody
      </button>
    </nav>
  )
}
