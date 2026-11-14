import { useId, useRef, type ReactNode } from 'react'
import { plural } from '../../../shared/i18n/plural'
import type { CvDocument, Section } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { moveSection, updateConsent, updateSection } from '../editor/documentEdits'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { RowMenuAction } from '../editor/RowMenu'
import { SortableList } from '../editor/SortableList'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import { addSectionElement } from './AddControls'
import { sectionShown } from './addOnPage'
import { fragmentKey, type EditTarget } from './editTargets'
import type { EditSession } from './useEditSession'

// Outline (GLOSSARY.md; docs/specs/inline-editing-redesign.md, Q13): wąski pasek boczny Edit mode z konspektem CV –
// to, czego nie widać na kartkach, i szybki skok do części CV.
// - „Nagłówek” stawia kursor w imieniu i nazwisku na stronie (Page field; puste jest odsłaniane).
// - Sekcje w kolejności CV (także ukryte i puste) z liczbą wpisów (czytnik ekranu słyszy ją jako opis „3 elementy”)
//   i oznaczeniem „ukryta” / „pusta”. Uchwyt: przeciąganie
//   myszą i menu („Przenieś wyżej/niżej”, „Nowa strona przed”, „Ukryj sekcję” z zaznaczeniem, „Dodaj …”) – każda zmiana
//   to jeden krok cofania. Klik w sekcję przewija strony do jej tytułu i stawia kursor na jego końcu (Page field);
//   w pustą sekcję (bez treści na stronach) – odsłania jej pierwszy element (a bez elementów dodaje go) z kursorem w nim
//   (docs/specs/wysiwyg-editing.md, W21). Ukrytej sekcji nie ma na stronach, więc nie ma czego edytować: jej wiersz ma
//   przełącznik „Pokaż na CV” (klik w wiersz przenosi na niego fokus, opis wiersza mówi, że trzeba ją pokazać), a
//   pokazanie od razu stawia kursor w niej na stronie.
// - „Klauzula zgody” stawia kursor w jej tekście na stronie (pusty jest odsłaniany), a wyłączona – przenosi fokus na
//   przełącznik „Pokaż na CV”, który ją włącza i wyłącza.
// Nie pokazuje treści CV poza nazwami.
export function Outline({
  editor,
  document,
  session,
  footer
}: {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  footer: ReactNode
}) {
  const t = useDictionary().editor
  const language = useInterfaceLanguage()
  const countId = useId()
  const consentSwitch = useRef<HTMLInputElement>(null)

  // Kursor w części CV na stronie (strony przewinięte do jej fragmentu, jeśli już tam jest).
  const focusPart = (target: EditTarget) => {
    window.document
      .querySelector(`.cv-pages [data-fragment="${CSS.escape(fragmentKey(target))}"]`)
      ?.scrollIntoView({ block: 'center' })
    session.focusPart(target)
  }

  const isEmpty = (section: Section, current = document) => !sectionShown({ ...section, hidden: false }, current)

  // Klik w sekcję: kursor na końcu jej tytułu na stronie, a w pustej – w jej pierwszym elemencie (odsłoniętym, a bez
  // elementów – nowym). Ukryta – fokus na jej przełączniku „Pokaż na CV”.
  const switches = useRef(new Map<string, HTMLInputElement>())
  const openSection = (section: Section, current = document) => {
    if (section.hidden) {
      switches.current.get(section.id)?.focus()
      return
    }
    if (!isEmpty(section, current)) {
      focusPart({ kind: 'sectionTitle', sectionId: section.id })
      return
    }
    const target = addSectionElement(editor, section, { reuseEmpty: true })
    if (target) focusPart(target)
  }
  const show = (section: Section) => {
    editor.edit(updateSection(section.id, { hidden: false }))
    const current = editor.store.getState().document
    const shown = current.sections.find((candidate) => candidate.id === section.id)
    if (shown) openSection(shown, current)
  }

  const sectionActions = (section: Section, focusHandle: () => void): RowMenuAction[] => {
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
          editor.edit(updateSection(section.id, { hidden: !section.hidden }))
          focusHandle()
        }
      },
      {
        label: addLabel,
        run: () => {
          // Pusta sekcja dostaje swój istniejący, pusty element zamiast kolejnego (jak pasek „Add to CV”). Ukrytej nie
          // ma na stronach – nowy element czeka w niej, a fokus idzie na jej przełącznik „Pokaż na CV”.
          const target = addSectionElement(editor, section, { reuseEmpty: isEmpty(section) })
          if (section.hidden) switches.current.get(section.id)?.focus()
          else if (target) focusPart(target)
        }
      }
    ]
  }

  return (
    <nav className="outline" aria-label={t.outline.title}>
      <div className="outline-body">
        <button
          type="button"
          className="outline-row-button outline-header"
          data-safe-focus
          onClick={() => focusPart({ kind: 'fullName' })}
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
            const described = [
              section.items.length > 0 ? `${countId}-${section.id}` : '',
              section.hidden ? `${countId}-show-to-edit` : ''
            ].join(' ').trim()
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
                  aria-describedby={described || undefined}
                  onClick={() => openSection(section)}
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
                {section.hidden && (
                  <label className="outline-switch outline-section-switch">
                    <input
                      ref={(element) => {
                        if (element) switches.current.set(section.id, element)
                        else switches.current.delete(section.id)
                      }}
                      type="checkbox"
                      role="switch"
                      checked={false}
                      aria-label={t.outline.showSection(sectionName(section, t))}
                      onChange={() => show(section)}
                    />
                    <span aria-hidden="true">{t.outline.showOnCv}</span>
                  </label>
                )}
              </div>
            )
          }}
        </SortableList>
        <div className="outline-consent">
          <button
            type="button"
            className="outline-row-button"
            onClick={() => (document.consent.enabled ? focusPart({ kind: 'consent' }) : consentSwitch.current?.focus())}
          >
            <span className="outline-row-name">{t.consent.title}</span>
          </button>
          <label className="outline-switch">
            <input
              ref={consentSwitch}
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
        <span id={`${countId}-show-to-edit`}>{t.outline.showToEdit}</span>
      </div>
      {footer}
    </nav>
  )
}
