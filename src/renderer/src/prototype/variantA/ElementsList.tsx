// PROTOTYP – wariant A „Inspektor”: „Elementy CV” w panelu Dokument – zarazem konspekt CV (po usunięciu lewego paska).
// Nagłówek, Zdjęcie, wszystkie sekcje (także ukryte i puste) i Klauzula zgody, w kolejności CV. W każdym wierszu:
// - nazwa (przycisk): otwiera opcje części w Inspektorze – także ukrytej i pustej – i przewija do niej strony; część
//   widoczna na stronie dostaje kursor (`session.focusPart`, jak Outline.tsx),
// - oznaczenia „ukryta” / „pusta” / „brak” i liczba elementów,
// - przełącznik „Pokaż na CV” (nagłówek go nie ma),
// - w sekcjach uchwyt ⋮⋮: przeciąganie i menu (Przenieś wyżej/niżej, ⌥⇧↑/↓, „Nowa strona przed”).
// W Preview mode wiersze nie są przyciskami (nie ma czego edytować), a uchwytów nie ma; przełączniki działają.
import type { ReactNode } from 'react'
import type { EditTarget } from '../../canvas/editTargets'
import type { Section } from '../../domain/schema'
import { moveSection, setPhotoHidden, updateConsent, updateSection } from '../../editor/documentEdits'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { SortableList } from '../../editor/SortableList'
import { useDictionary } from '../../i18n'
import { Switch } from './controls'
import type { InspectorProps } from './Inspector'
import { focusOnPage, isEmptySection, scrollToFragment } from './navigation'
import type { InspectorSelection } from './useInspectorSelection'

export function ElementsList({ editor, document, session, onSelect, preview }: InspectorProps) {
  const t = useDictionary().editor
  const { photo } = document.header
  const open = (selection: InspectorSelection, target: EditTarget | null) => {
    onSelect(selection)
    if (target) focusOnPage(session, target)
  }
  const consentOn = document.consent.enabled && document.consent.text.trim() !== ''

  const sectionRow = (section: Section, handle?: ReactNode) => {
    const empty = isEmptySection(section, document)
    const name = sectionName(section, t)
    return (
      <ElementRow
        handle={handle}
        name={name}
        off={section.hidden}
        badges={[section.hidden && 'ukryta', !section.hidden && empty && 'pusta', section.pageBreakBefore && '↧ nowa strona']}
        count={empty ? undefined : section.items.length}
        onOpen={
          preview
            ? undefined
            : () => open({ kind: 'section', id: section.id }, section.hidden || empty ? null : { kind: 'sectionTitle', sectionId: section.id })
        }
        toggle={
          <Switch
            label={t.outline.showSection(name)}
            checked={!section.hidden}
            onChange={(shown) => editor.edit(updateSection(section.id, { hidden: !shown }))}
          />
        }
      />
    )
  }

  return (
    <div className="pa-elements" data-preview={preview || undefined}>
      <ElementRow name={t.header} onOpen={preview ? undefined : () => open({ kind: 'header' }, { kind: 'fullName' })} />
      <ElementRow
        child
        name={t.photo.legend}
        off={!photo || photo.hidden}
        badges={[!photo && 'brak', photo?.hidden && 'ukryte']}
        onOpen={
          preview
            ? undefined
            : () => {
                onSelect({ kind: 'photo' })
                if (photo && !photo.hidden) scrollToFragment('photo')
              }
        }
        toggle={
          <Switch
            label={t.outline.showPhoto}
            checked={photo !== null && !photo.hidden}
            disabled={photo === null}
            onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
          />
        }
      />
      {preview ? (
        document.sections.map((section) => <div key={section.id}>{sectionRow(section)}</div>)
      ) : (
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
          moreActions={(section, focusHandle) => [
            {
              label: t.pageBreakBeforeSection,
              checked: section.pageBreakBefore,
              run: () => {
                editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
                focusHandle()
              }
            }
          ]}
        >
          {(section, row) => sectionRow(section, row.handle)}
        </SortableList>
      )}
      <ElementRow
        name={t.consent.title}
        off={!consentOn}
        badges={[!document.consent.enabled && 'wyłączona']}
        onOpen={preview ? undefined : () => open({ kind: 'consent' }, consentOn ? { kind: 'consent' } : null)}
        toggle={
          <Switch
            label="Pokaż klauzulę zgody na CV"
            checked={document.consent.enabled}
            onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
          />
        }
      />
      {!preview && <p className="pa-hint pa-elements-hint">Kliknij nazwę, by przejść do części CV i zobaczyć jej opcje. ⋮⋮ – kolejność.</p>}
    </div>
  )
}

function ElementRow({
  handle,
  name,
  child,
  off,
  badges = [],
  count,
  onOpen,
  toggle
}: {
  handle?: ReactNode
  name: string
  child?: boolean
  off?: boolean
  badges?: (string | false | undefined)[]
  count?: number
  onOpen?: () => void
  toggle?: ReactNode
}) {
  const content = (
    <>
      <span className="pa-element-text">{name}</span>
      {badges.filter(Boolean).map((badge) => (
        <span key={badge as string} className="pa-badge">
          {badge}
        </span>
      ))}
      {count !== undefined && count > 0 && (
        <span className="pa-element-count" aria-label={`, ${count}`}>
          {count}
        </span>
      )}
    </>
  )
  return (
    <div className="pa-element" data-child={child || undefined} data-off={off || undefined}>
      <span className="pa-element-handle">{handle}</span>
      {onOpen ? (
        <button type="button" className="pa-element-name" onClick={onOpen}>
          {content}
          <span className="pa-element-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        <span className="pa-element-name">{content}</span>
      )}
      <span className="pa-element-toggle">{toggle}</span>
    </div>
  )
}
