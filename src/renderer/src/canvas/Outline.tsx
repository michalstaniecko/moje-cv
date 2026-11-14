import { useId, useRef, type ReactNode } from 'react'
import { plural } from '../../../shared/i18n/plural'
import type { CvDocument, Section } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { moveSection, updateConsent, updateSection } from '../editor/documentEdits'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { RowMenuAction } from '../editor/RowMenu'
import { SortableList } from '../editor/SortableList'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import { addSectionElement, type AddedAnchor } from './AddControls'
import { sectionShown } from './addOnPage'
import { sectionFragmentKeys } from './blockMoves'
import { fragmentKey, type EditTarget } from './editTargets'
import type { EditSession } from './useEditSession'

// Outline (GLOSSARY.md; docs/specs/inline-editing-redesign.md, Q13): wąski pasek boczny Edit mode z konspektem CV –
// to, czego nie widać na kartkach, i szybki skok do części CV.
// - „Nagłówek” otwiera kartę imienia i nazwiska.
// - Sekcje w kolejności CV (także ukryte i puste) z liczbą wpisów (czytnik ekranu słyszy ją jako opis „3 elementy”)
//   i oznaczeniem „ukryta” / „pusta”. Uchwyt: przeciąganie
//   myszą i menu („Przenieś wyżej/niżej”, „Nowa strona przed”, „Ukryj sekcję” z zaznaczeniem, „Dodaj …”) – każda zmiana
//   to jeden krok cofania. Klik w sekcję przewija strony do jej tytułu i otwiera kartę tytułu przy nim; sekcja ukryta
//   albo pusta (bez tytułu na stronie) dostaje kartę przy swoim wierszu Outline.
// - „Klauzula zgody” otwiera jej kartę; przełącznik „Pokaż na CV” włącza ją i wyłącza.
// Karty otwierane stąd mają kotwicę w wierszu Outline (`added`); gdy część CV jest na stronie, karta stoi przy jej
// fragmencie (warstwa edycji szuka najpierw fragmentu). Nie pokazuje treści CV poza nazwami.
export function Outline({
  editor,
  document,
  session,
  added,
  footer
}: {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  added: AddedAnchor
  footer: ReactNode
}) {
  const t = useDictionary().editor
  const language = useInterfaceLanguage()
  const countId = useId()
  const outline = useRef<HTMLElement>(null)
  const find = (selector: string) => () => outline.current?.querySelector<HTMLElement>(selector) ?? null
  const rowSelector = (key: string) => `[data-outline-row="${CSS.escape(key)}"]`

  // Karta części CV: przy jej fragmencie na stronie (strony przewinięte do niego), a bez fragmentu – przy `from`.
  const openCard = (target: EditTarget, from: () => HTMLElement | null) => {
    const key = fragmentKey(target)
    added.remember(key, from)
    window.document
      .querySelector(`.edit-layer .edit-fragment[data-fragment="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ block: 'center' })
    session.openCard(target, key)
  }
  const openRow = (target: EditTarget) => openCard(target, find(rowSelector(fragmentKey(target))))

  const isEmpty = (section: Section) => !sectionShown({ ...section, hidden: false }, document)

  const sectionActions = (section: Section, focusHandle: () => void): RowMenuAction[] => {
    const handle = find(`[data-outline-section="${CSS.escape(section.id)}"] .row-handle`)
    const addLabel = { experience: t.addPosition, education: t.addEducation, list: t.addListItem }[section.type]
    return [
      {
        label: t.pageBreakBeforeSection,
        checked: section.pageBreakBefore,
        run: () => {
          editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
          focusHandle()
        }
      },
      {
        label: t.hideSection,
        checked: section.hidden,
        run: () => {
          // Karta przy fragmencie sekcji, która znika ze stron, zamyka się (jak „Ukryj sekcję” w menu na stronie).
          if (!section.hidden && session.card && sectionFragmentKeys(section).has(session.card.anchor)) session.closeCard()
          editor.edit(updateSection(section.id, { hidden: !section.hidden }))
          focusHandle()
        }
      },
      {
        label: addLabel,
        run: () => {
          // Pusta sekcja dostaje swój istniejący, pusty element zamiast kolejnego (jak pasek „Add to CV”).
          const target = addSectionElement(editor, section, { reuseEmpty: isEmpty(section) })
          if (target) openCard(target, handle)
        }
      }
    ]
  }

  return (
    <nav ref={outline} className="outline" aria-label={t.outline.title}>
      <div className="outline-body">
        <button
          type="button"
          className="outline-row-button outline-header"
          data-outline-row={fragmentKey({ kind: 'fullName' })}
          data-safe-focus
          aria-haspopup="dialog"
          onClick={() => openRow({ kind: 'fullName' })}
        >
          <span className="outline-row-name">{t.header}</span>
        </button>
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
          moreActions={sectionActions}
        >
          {(section, row) => {
            const empty = isEmpty(section)
            const target: EditTarget = { kind: 'sectionTitle', sectionId: section.id }
            return (
              <div
                className="outline-section"
                data-outline-section={section.id}
                data-hidden={section.hidden || undefined}
                data-empty={empty || undefined}
              >
                {row.handle}
                <button
                  type="button"
                  className="outline-row-button"
                  data-outline-row={fragmentKey(target)}
                  aria-haspopup="dialog"
                  aria-describedby={section.items.length > 0 ? `${countId}-${section.id}` : undefined}
                  onClick={() => openRow(target)}
                >
                  <span className="outline-row-name">{sectionName(section, t)}</span>
                  {section.hidden ? (
                    <span className="outline-badge">{t.outline.hidden}</span>
                  ) : (
                    empty && <span className="outline-badge">{t.outline.empty}</span>
                  )}
                  {section.items.length > 0 && (
                    <span className="outline-count" aria-hidden="true">
                      {section.items.length}
                    </span>
                  )}
                </button>
              </div>
            )
          }}
        </SortableList>
        <div className="outline-consent">
          <button
            type="button"
            className="outline-row-button"
            data-outline-row={fragmentKey({ kind: 'consent' })}
            aria-haspopup="dialog"
            onClick={() => openRow({ kind: 'consent' })}
          >
            <span className="outline-row-name">{t.consent.title}</span>
          </button>
          <label className="outline-switch">
            <input
              type="checkbox"
              role="switch"
              checked={document.consent.enabled}
              onChange={(event) => editor.edit(updateConsent({ enabled: event.target.checked }))}
            />
            <span>{t.outline.showOnCv}</span>
          </label>
        </div>
      </div>
      {/* Liczba wpisów dla czytnika ekranu („3 elementy”) jako opis wiersza sekcji – na ekranie sama liczba. Poza
          wierszami, żeby ich tekst został nazwą sekcji z oznaczeniem i liczbą. */}
      <div hidden>
        {document.sections.map(
          (section) =>
            section.items.length > 0 && (
              <span key={section.id} id={`${countId}-${section.id}`}>
                {plural(language, t.outline.items, section.items.length)}
              </span>
            )
        )}
      </div>
      {footer}
    </nav>
  )
}
