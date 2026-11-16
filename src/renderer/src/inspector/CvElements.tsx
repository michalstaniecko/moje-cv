import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { plural } from '../../../shared/i18n/plural'
import { sectionEmpty } from '../canvas/addOnPage'
import type { CvDocument, Section } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { moveSection, setPhotoHidden, updateConsent, updateSection } from '../editor/documentEdits'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { RowMenuAction } from '../editor/RowMenu'
import { SortableList } from '../editor/SortableList'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import type { CvElement } from './openOnPage'

// Przełącznik „Pokaż na CV” zdjęcia w Inspektorze – na liście „CV elements” albo w panelu zdjęcia (InspectorSwitch.tsx):
// tu wraca fokus po „Ukryj zdjęcie” w popoverze zdjęcia (canvas/PhotoPopover.tsx).
export const PHOTO_SWITCH_SELECTOR = '.inspector [data-switch="photo"]'

// Przycisk wiersza części CV na liście (np. powrót fokusu z panelu tej części).
export const elementRowSelector = (element: CvElement) =>
  `.cv-elements [data-element="${element.kind}"]${element.kind === 'section' ? `[data-element-id="${CSS.escape(element.id)}"]` : ''} .cv-element-name`

// „CV elements” w panelu „Dokument” Inspektora (GLOSSARY.md, ADR-0012; zastępuje Outline): jedna lista części CV
// (dla czytnika ekranu lista „CV elements” z wierszem na część) w kolejności dokumentu – Nagłówek, Zdjęcie, każda sekcja (także ukryte i puste) i Klauzula zgody.
// - Każda część, którą da się ukryć, ma ten sam przełącznik „Pokaż na CV” nazwany jej nazwą (zdjęcie – tylko gdy jest;
//   ukryte zachowuje obraz). Ukryta część zostaje na liście z oznaczeniem „ukryta”, sekcja bez treści – „pusta”;
//   oznaczenie jest częścią nazwy wiersza, liczba wpisów sekcji – jego opisem dla czytnika ekranu.
// - Sekcje przestawia się uchwytem: przeciąganie myszą i menu (także Shift+F10) „Przenieś wyżej/niżej” i „Nowa strona
//   przed”, ⌥⇧↑/↓ na uchwycie. Każda zmiana to jeden krok cofania.
// - `editable` (Edit mode): nazwa wiersza to przycisk, który zgłasza `onOpen` (`from` – sam wiersz, np. dla fokusu po
//   anulowanym wyborze zdjęcia). W Preview mode wiersze są tylko tekstem i nie mają uchwytów, a przełączniki działają.
export function CvElements({
  editor,
  document,
  editable,
  onOpen
}: {
  editor: CvEditor
  document: CvDocument
  editable: boolean
  onOpen: (element: CvElement, from: () => HTMLElement | null) => void
}) {
  const t = useDictionary().editor
  const language = useInterfaceLanguage()
  const describedBy = useId()
  const { photo } = document.header
  const countId = (section: Section) => `${describedBy}-${section.id}`

  const sectionRow = (section: Section, handle?: ReactNode) => {
    const name = sectionName(section, t)
    return (
      <ElementRow
        element={{ kind: 'section', id: section.id }}
        name={name}
        badge={section.hidden ? t.inspector.elements.hidden : sectionEmpty(section, document) ? t.inspector.elements.empty : undefined}
        count={section.items.length}
        countId={section.items.length > 0 ? countId(section) : undefined}
        handle={handle}
        editable={editable}
        onOpen={onOpen}
        shown={{
          label: t.inspector.elements.showSection(name),
          checked: !section.hidden,
          onChange: (shown) => editor.edit(updateSection(section.id, { hidden: !shown }))
        }}
      />
    )
  }

  const sectionActions = (section: Section, focusHandle: () => void): RowMenuAction[] => [
    {
      label: t.pageBreakBeforeSection,
      checked: section.pageBreakBefore,
      run: () => {
        editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
        focusHandle()
      }
    }
  ]

  return (
    <div className="cv-elements" role="list" aria-label={t.inspector.groups.elements}>
      <ElementRow element={{ kind: 'header' }} name={t.header} editable={editable} onOpen={onOpen} />
      <ElementRow
        element={{ kind: 'photo' }}
        name={t.photo.legend}
        badge={photo?.hidden ? t.inspector.elements.hidden : undefined}
        editable={editable}
        onOpen={onOpen}
        shown={
          photo
            ? { label: t.inspector.elements.showPhoto, checked: !photo.hidden, onChange: (shown) => editor.edit(setPhotoHidden(!shown)) }
            : undefined
        }
      />
      {editable ? (
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
          moreActions={sectionActions}
        >
          {(section, row) => sectionRow(section, row.handle)}
        </SortableList>
      ) : (
        document.sections.map((section) => <div key={section.id}>{sectionRow(section)}</div>)
      )}
      <ElementRow
        element={{ kind: 'consent' }}
        name={t.consent.title}
        badge={document.consent.enabled ? undefined : t.inspector.elements.hidden}
        editable={editable}
        onOpen={onOpen}
        shown={{
          label: t.inspector.elements.showConsent,
          checked: document.consent.enabled,
          onChange: (shown) => editor.edit(updateConsent({ enabled: shown }))
        }}
      />
      {/* Liczba wpisów dla czytnika ekranu („3 elementy”) jako opis wiersza sekcji – na ekranie sama liczba. Poza
          wierszami, żeby nazwą wiersza zostały nazwa części i jej oznaczenie. */}
      <div hidden>
        {document.sections.map(
          (section) =>
            section.items.length > 0 && (
              <span key={section.id} id={countId(section)}>
                {plural(language, t.inspector.elements.items, section.items.length)}
              </span>
            )
        )}
      </div>
    </div>
  )
}

type ShowSwitch = { label: string; checked: boolean; onChange: (shown: boolean) => void }

// Shift+F10 (albo klawisz menu) w wierszu sekcji – na uchwycie, nazwie albo przełączniku – otwiera menu uchwytu; Escape
// wraca tam, skąd je otwarto.
function openMenu(event: KeyboardEvent<HTMLDivElement>) {
  if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return
  const menuHandle = event.currentTarget.querySelector<HTMLButtonElement>('.row-handle')
  if (!menuHandle || (event.target instanceof Element && event.target.closest('[role="menu"]'))) return
  event.preventDefault()
  menuHandle.click()
}

// Wiersz listy: uchwyt sekcji (albo puste miejsce na jego szerokość), nazwa z oznaczeniem i liczbą wpisów, przełącznik.
function ElementRow({
  element,
  name,
  badge,
  count = 0,
  countId,
  handle,
  editable,
  onOpen,
  shown
}: {
  element: CvElement
  name: string
  badge?: string
  count?: number
  countId?: string
  handle?: ReactNode
  editable: boolean
  onOpen: (element: CvElement, from: () => HTMLElement | null) => void
  shown?: ShowSwitch
}) {
  const content = (
    <>
      <span className="cv-element-label">{name}</span>
      {badge && <span className="cv-element-badge">{badge}</span>}
      {count > 0 && (
        <span className="cv-element-count" aria-hidden="true">
          {count}
        </span>
      )}
    </>
  )
  return (
    <div
      className="cv-element"
      role="listitem"
      data-element={element.kind}
      data-element-id={element.kind === 'section' ? element.id : undefined}
      data-muted={(shown && !shown.checked) || undefined}
      onKeyDown={handle ? openMenu : undefined}
    >
      {handle ?? <span className="cv-element-handle-space" />}
      {editable ? (
        <button
          type="button"
          className="cv-element-name"
          aria-describedby={countId}
          onClick={(event) => {
            const row = event.currentTarget
            onOpen(element, () => (row.isConnected ? row : null))
          }}
        >
          {content}
        </button>
      ) : (
        <span className="cv-element-name">{content}</span>
      )}
      {shown && (
        <input
          type="checkbox"
          role="switch"
          className="cv-element-switch"
          data-switch={element.kind}
          aria-label={shown.label}
          title={shown.label}
          checked={shown.checked}
          onChange={(event) => shown.onChange(event.target.checked)}
        />
      )}
    </div>
  )
}
