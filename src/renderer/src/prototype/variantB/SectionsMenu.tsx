// PROTOTYP – wariant B: [Sekcje ▾] – JEDNA jednolita lista części CV: zdjęcie, każda sekcja i klauzula zgody.
// Każdy wiersz ma te same trzy kolumny: kolejność (↑/↓), „nowa strona przed” i przełącznik „widoczne na CV”.
// Zdjęcie i klauzula mają stałe miejsca w szablonie – ich strzałki i podział strony są wyłączone, ale kolumny zostają,
// więc lista czyta się jak tabela, a przełącznik zawsze znaczy to samo: „jest na CV / nie ma”.
import type { CvDocument } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { moveSection, setPhotoHidden, updateConsent, updateSection } from '../../editor/documentEdits'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { useDictionary } from '../../i18n'
import { Chevron } from './TemplateMenu'
import { PbHeading, PbPopover, PbSwitch } from './PbPopover'

export function SectionsMenu({
  editor,
  document,
  onAddPhoto
}: {
  editor: CvEditor
  document: CvDocument
  onAddPhoto: () => void
}) {
  const t = useDictionary().editor
  const { photo } = document.header
  const { sections } = document
  const hiddenCount = sections.filter((section) => section.hidden).length

  return (
    <PbPopover
      width={380}
      title="Sekcje: widoczność, kolejność, podział stron"
      trigger={
        <>
          <span className="pb-trigger-text">Sekcje</span>
          {hiddenCount > 0 && (
            <span className="pb-count" title={`Ukryte sekcje: ${hiddenCount}`}>
              {hiddenCount} ukr.
            </span>
          )}
          <Chevron />
        </>
      }
    >
      {(close) => (
        <>
          <PbHeading>Części CV</PbHeading>
          <div className="pb-rows-head" aria-hidden="true">
            <span>Kolejność</span>
            <span>Nazwa</span>
            <span title="Nowa strona przed">Str.</span>
            <span>Na CV</span>
          </div>
          <ul className="pb-rows">
            <li className="pb-row" data-hidden={!photo || photo.hidden || undefined}>
              <FixedOrder />
              <span className="pb-row-name">
                Zdjęcie <span className="pb-row-note">w nagłówku</span>
              </span>
              <PageBreakButton disabled />
              {photo ? (
                <PbSwitch
                  checked={!photo.hidden}
                  label="Pokaż zdjęcie na CV"
                  onChange={(checked) => editor.edit(setPhotoHidden(!checked))}
                />
              ) : (
                <button
                  type="button"
                  className="pb-mini-button"
                  onClick={() => {
                    close()
                    onAddPhoto()
                  }}
                >
                  Dodaj
                </button>
              )}
            </li>
            {sections.map((section, index) => {
              const name = sectionName(section, t)
              return (
                <li key={section.id} className="pb-row" data-hidden={section.hidden || undefined}>
                  <span className="pb-order">
                    <button
                      type="button"
                      className="pb-icon-button"
                      aria-label={`Przenieś wyżej: ${name}`}
                      disabled={index === 0}
                      onClick={() => editor.edit(moveSection(section.id, index - 1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="pb-icon-button"
                      aria-label={`Przenieś niżej: ${name}`}
                      disabled={index === sections.length - 1}
                      onClick={() => editor.edit(moveSection(section.id, index + 1))}
                    >
                      ↓
                    </button>
                  </span>
                  <span className="pb-row-name">
                    {name}
                    {section.items.length > 0 && <span className="pb-row-note">{section.items.length}</span>}
                  </span>
                  <PageBreakButton
                    pressed={section.pageBreakBefore}
                    label={`Nowa strona przed: ${name}`}
                    onClick={() => editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))}
                  />
                  <PbSwitch
                    checked={!section.hidden}
                    label={`Pokaż na CV: ${name}`}
                    onChange={(checked) => editor.edit(updateSection(section.id, { hidden: !checked }))}
                  />
                </li>
              )
            })}
            <li className="pb-row" data-hidden={!document.consent.enabled || undefined}>
              <FixedOrder />
              <span className="pb-row-name">
                Klauzula zgody <span className="pb-row-note">na końcu</span>
              </span>
              <PageBreakButton disabled />
              <PbSwitch
                checked={document.consent.enabled}
                label="Pokaż klauzulę zgody na CV"
                onChange={(checked) => editor.edit(updateConsent({ enabled: checked }))}
              />
            </li>
          </ul>
          <p className="pb-hint">Każda zmiana to jeden krok cofania (⌘Z).</p>
        </>
      )}
    </PbPopover>
  )
}

function FixedOrder() {
  return (
    <span className="pb-order" title="Stałe miejsce w szablonie">
      <span className="pb-pin" aria-hidden="true">
        ⎯
      </span>
    </span>
  )
}

// „Nowa strona przed” – ikona kartki z linią cięcia; wciśnięta = sekcja zaczyna nową stronę.
function PageBreakButton({
  pressed = false,
  disabled = false,
  label = 'Nie dotyczy',
  onClick
}: {
  pressed?: boolean
  disabled?: boolean
  label?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="pb-icon-button pb-break"
      aria-pressed={disabled ? undefined : pressed}
      aria-label={label}
      title={disabled ? 'Nie dotyczy' : 'Nowa strona przed'}
      disabled={disabled}
      onClick={onClick}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 1.5h8v4M3 1.5v4M3 8.5v4h8v-4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1 7h12" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" />
      </svg>
    </button>
  )
}
