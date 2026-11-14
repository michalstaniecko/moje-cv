import { useId, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { cvFontFamilies } from '../../../shared/cvFonts'
import { interfaceLanguages } from '../../../shared/i18n/languages'
import { cvLanguageCodes, type Clause, type ClauseContent, type CvDocument, type CvLanguage, type Section } from '../domain/schema'
import { useDictionary } from '../i18n'
import type { Font } from '../template/fonts'
import type { CvEditor } from './cvEditor'
import {
  addContact,
  addEducationItem,
  addExperienceItem,
  moveItem,
  moveSection,
  removeContact,
  updateContact,
  updateSection,
  updateSettings
} from './documentEdits'
import { Checkbox } from './fields/Checkbox'
import { ConsentFields } from './fields/ConsentFields'
import { EducationItemFields } from './fields/EducationItemFields'
import { educationName, entryName } from './fields/entryNames'
import { ExperienceItemFields } from './fields/ExperienceItemFields'
import { FullNameField } from './fields/FullNameField'
import { ListItemsFields } from './fields/ListItemsFields'
import { SectionTitleField, sectionName } from './fields/SectionTitleField'
import { SummaryField } from './fields/SummaryField'
import { PhotoField } from './PhotoField'
import { RemoveProvider, useRemove, type RemoveWithUndo } from './removalUndo'
import { SortableList } from './SortableList'
import { TemplatePicker } from './TemplatePicker'

// Formularz edycji CV: nagłówek, sekcje w kolejności z CV i klauzula zgody. Każda zmiana trafia do edytora (historia + autozapis).
// `clauses` – biblioteka klauzul; `onSaveClause` dodaje do niej nową klauzulę; `onRemove` wykonuje usunięcia z formularza
// (z komunikatem „Usunięto. Cofnij”).
export function CvForm({
  editor,
  clauses,
  onSaveClause,
  onRemove
}: {
  editor: CvEditor
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
  onRemove: RemoveWithUndo
}) {
  const document = useStore(editor.store, (state) => state.document)
  const t = useDictionary().editor

  return (
    <RemoveProvider value={onRemove}>
      <div className="form">
        <CvDesignFields editor={editor} document={document} />
        <HeaderFields editor={editor} header={document.header} />
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
        >
          {(section, row) => <SectionFields editor={editor} section={section} handle={row.handle} />}
        </SortableList>
        <ConsentFields editor={editor} consent={document.consent} clauses={clauses} onSaveClause={onSaveClause} />
      </div>
    </RemoveProvider>
  )
}

// CV design (zob. GLOSSARY.md): kolor akcentu (imię, tytuły sekcji, kropki przy datach), font, szablon i CV language.
// Zmiana CV language zmienia tylko stały tekst na dokumencie, nie treść CV.
function CvDesignFields({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor
  const { settings } = document
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.cvDesign}</h2>
      <div className="form-row">
        <label className="form-field">
          <span>{t.accentColor}</span>
          <input
            type="color"
            value={settings.accentColor}
            onChange={(event) => editor.edit(updateSettings({ accentColor: event.target.value }), 'settings:accentColor')}
          />
        </label>
        <label className="form-field">
          <span>{t.font}</span>
          <select
            value={settings.font}
            onChange={(event) =>
              editor.edit(updateSettings({ font: event.target.value as Font }))
            }
          >
            {Object.entries(cvFontFamilies).map(([font, name]) => (
              <option key={font} value={font}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TemplatePicker document={document} onChange={(template) => editor.edit(updateSettings({ template }))} />
      <div className="form-row">
        <label className="form-field">
          <span>{t.cvLanguage}</span>
          <select
            value={settings.language}
            onChange={(event) => editor.edit(updateSettings({ language: event.target.value as CvLanguage }))}
          >
            {cvLanguageCodes.map((language) => (
              <option key={language} value={language}>
                {interfaceLanguages[language].name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function HeaderFields({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const suggestionsId = useId()
  const { editor: t, defaultContent } = useDictionary()
  const remove = useRemove()

  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.header}</h2>
      <FullNameField editor={editor} header={header} />

      <PhotoField editor={editor} photo={header.photo} />

      <fieldset className="form-group">
        <legend>{t.contact}</legend>
        <datalist id={suggestionsId}>
          {defaultContent.contactLabels.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        {header.contacts.map((contact, index) => (
          <div key={contact.id} className="form-row" data-entry-id={contact.id}>
            <input
              className="form-contact-label"
              aria-label={t.contactLabel(index + 1)}
              placeholder={t.contactLabelPlaceholder}
              list={suggestionsId}
              value={contact.label}
              onChange={(event) =>
                editor.edit(updateContact(contact.id, { label: event.target.value }), `contact:${contact.id}:label`)
              }
            />
            <input
              aria-label={t.contactValue(index + 1)}
              placeholder={t.contactValuePlaceholder}
              value={contact.value}
              onChange={(event) =>
                editor.edit(updateContact(contact.id, { value: event.target.value }), `contact:${contact.id}:value`)
              }
            />
            <RowRemoveButton
              label={t.removeContact(index + 1)}
              onClick={() => remove(removeContact(contact.id), { entryId: contact.id, listId: 'contacts' })}
            />
          </div>
        ))}
        <button type="button" data-add-for="contacts" onClick={() => editor.edit(addContact())}>
          {t.addContact}
        </button>
      </fieldset>

      <SummaryField editor={editor} header={header} />
    </section>
  )
}

// Sekcja w formularzu: tytuł, kolejność, ukrycie i nowa strona, a pod nimi wpisy zależne od typu sekcji.
// Ukryta sekcja zostaje w formularzu, ale znika z podglądu i PDF.
function SectionFields({ editor, section, handle }: { editor: CvEditor; section: Section; handle: ReactNode }) {
  const t = useDictionary().editor
  const name = sectionName(section, t)

  return (
    <section className={section.hidden ? 'form-section form-section--hidden' : 'form-section'} aria-label={name}>
      <div className="form-section-header">
        {handle}
        <SectionTitleField editor={editor} section={section} />
      </div>
      <div className="form-row">
        <Checkbox
          label={t.hideSection}
          checked={section.hidden}
          onChange={(hidden) => editor.edit(updateSection(section.id, { hidden }))}
        />
        <Checkbox
          label={t.pageBreakBeforeSection}
          checked={section.pageBreakBefore}
          onChange={(pageBreakBefore) => editor.edit(updateSection(section.id, { pageBreakBefore }))}
        />
      </div>
      <SectionItems editor={editor} section={section} />
    </section>
  )
}

function SectionItems({ editor, section }: { editor: CvEditor; section: Section }) {
  const onMove = (id: string, toIndex: number) => editor.edit(moveItem(section.id, id, toIndex))
  const t = useDictionary().editor

  switch (section.type) {
    case 'experience':
      return (
        <>
          <SortableList
            items={section.items}
            label={(item) => t.order.position(entryName(item.role, t.newPosition))}
            handleLabel={(item) => t.order.handle.position(entryName(item.role, t.newPosition))}
            onMove={onMove}
          >
            {(item, row) => (
              <ExperienceItemFields editor={editor} sectionId={section.id} item={item} handle={row.handle} />
            )}
          </SortableList>
          <button type="button" data-add-for={section.id} onClick={() => editor.edit(addExperienceItem(section.id))}>
            {t.addPosition}
          </button>
        </>
      )
    case 'education':
      return (
        <>
          <SortableList
            items={section.items}
            label={(item) => t.order.education(educationName(item, t))}
            handleLabel={(item) => t.order.handle.education(educationName(item, t))}
            onMove={onMove}
          >
            {(item, row) => (
              <EducationItemFields editor={editor} sectionId={section.id} item={item} handle={row.handle} />
            )}
          </SortableList>
          <button type="button" data-add-for={section.id} onClick={() => editor.edit(addEducationItem(section.id))}>
            {t.addEducation}
          </button>
        </>
      )
    case 'list':
      return <ListItemsFields editor={editor} sectionId={section.id} items={section.items} />
  }
}

// Usunięcie kontaktu: kompaktowa ikona ✕ z podpowiedzią, która powtarza etykietę dostępności (np. „Usuń kontakt 3”).
// Punkty i elementy list usuwa się z menu wiersza, a całe wpisy (stanowisko, wykształcenie) tekstowym przyciskiem.
function RowRemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="row-remove" aria-label={label} title={label} onClick={onClick}>
      ✕
    </button>
  )
}
