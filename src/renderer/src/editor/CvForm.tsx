import { useId, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { CvDocument, EducationItem, ExperienceItem, Section, TextItem } from '../domain/schema'
import type { CvEditor } from './cvEditor'
import {
  addBullet,
  addContact,
  addEducationItem,
  addExperienceItem,
  addListItem,
  moveBullet,
  moveItem,
  moveSection,
  removeBullet,
  removeContact,
  removeEducationItem,
  removeExperienceItem,
  removeListItem,
  updateBullet,
  updateContact,
  updateEducationItem,
  updateExperienceItem,
  updateHeader,
  updateListItem,
  updateSection
} from './documentEdits'
import { MonthField } from './MonthField'
import { SortableList } from './SortableList'

const CONTACT_LABEL_SUGGESTIONS = ['Tel', 'E-mail', 'LinkedIn', 'Miasto']

const SECTION_TYPE_NAMES: Record<Section['type'], string> = {
  experience: 'Doświadczenie zawodowe',
  education: 'Wykształcenie',
  list: 'Lista'
}

const sectionName = (section: Section) => section.title.trim() || SECTION_TYPE_NAMES[section.type]

// Formularz edycji CV: nagłówek i sekcje w kolejności z CV. Każda zmiana trafia do edytora (historia + autozapis).
export function CvForm({ editor }: { editor: CvEditor }) {
  const document = useStore(editor.store, (state) => state.document)

  return (
    <div className="form">
      <HeaderFields editor={editor} header={document.header} />
      <SortableList
        items={document.sections}
        label={(section) => `sekcję „${sectionName(section)}”`}
        onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
      >
        {(section, orderControls) => <SectionFields editor={editor} section={section} orderControls={orderControls} />}
      </SortableList>
    </div>
  )
}

function HeaderFields({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const suggestionsId = useId()

  return (
    <section className="form-section">
      <h2 className="form-section-title">Nagłówek</h2>
      <label className="form-field">
        <span>Imię i nazwisko</span>
        <input
          value={header.fullName}
          onChange={(event) => editor.edit(updateHeader({ fullName: event.target.value }), 'header:fullName')}
        />
      </label>

      <fieldset className="form-group">
        <legend>Kontakt</legend>
        <datalist id={suggestionsId}>
          {CONTACT_LABEL_SUGGESTIONS.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        {header.contacts.map((contact, index) => (
          <div key={contact.id} className="form-row">
            <input
              className="form-contact-label"
              aria-label={`Etykieta kontaktu ${index + 1}`}
              placeholder="Etykieta"
              list={suggestionsId}
              value={contact.label}
              onChange={(event) =>
                editor.edit(updateContact(contact.id, { label: event.target.value }), `contact:${contact.id}:label`)
              }
            />
            <input
              aria-label={`Wartość kontaktu ${index + 1}`}
              placeholder="Wartość"
              value={contact.value}
              onChange={(event) =>
                editor.edit(updateContact(contact.id, { value: event.target.value }), `contact:${contact.id}:value`)
              }
            />
            <button type="button" aria-label={`Usuń kontakt ${index + 1}`} onClick={() => editor.edit(removeContact(contact.id))}>
              Usuń
            </button>
          </div>
        ))}
        <button type="button" onClick={() => editor.edit(addContact())}>
          Dodaj kontakt
        </button>
      </fieldset>

      <label className="form-field">
        <span>Podsumowanie</span>
        <textarea
          rows={4}
          value={header.summary}
          onChange={(event) => editor.edit(updateHeader({ summary: event.target.value }), 'header:summary')}
        />
      </label>
    </section>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="form-checkbox">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

// Sekcja w formularzu: tytuł, kolejność, ukrycie i nowa strona, a pod nimi wpisy zależne od typu sekcji.
// Ukryta sekcja zostaje w formularzu, ale znika z podglądu i PDF.
function SectionFields({ editor, section, orderControls }: { editor: CvEditor; section: Section; orderControls: ReactNode }) {
  const name = sectionName(section)

  return (
    <section className={section.hidden ? 'form-section form-section--hidden' : 'form-section'} aria-label={name}>
      <div className="form-section-header">
        {orderControls}
        <input
          className="form-section-title-input"
          aria-label={`Tytuł sekcji „${name}”`}
          placeholder={SECTION_TYPE_NAMES[section.type]}
          value={section.title}
          onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
        />
      </div>
      <div className="form-row">
        <Checkbox
          label="Ukryj sekcję"
          checked={section.hidden}
          onChange={(hidden) => editor.edit(updateSection(section.id, { hidden }))}
        />
        <Checkbox
          label="Nowa strona przed tą sekcją"
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

  switch (section.type) {
    case 'experience':
      return (
        <>
          <SortableList items={section.items} label={(item) => `stanowisko „${entryName(item.role, 'Nowe stanowisko')}”`} onMove={onMove}>
            {(item, orderControls) => (
              <ExperienceItemFields editor={editor} sectionId={section.id} item={item} orderControls={orderControls} />
            )}
          </SortableList>
          <button type="button" onClick={() => editor.edit(addExperienceItem(section.id))}>
            Dodaj stanowisko
          </button>
        </>
      )
    case 'education':
      return (
        <>
          <SortableList items={section.items} label={(item) => `wpis „${educationName(item)}”`} onMove={onMove}>
            {(item, orderControls) => (
              <EducationItemFields editor={editor} sectionId={section.id} item={item} orderControls={orderControls} />
            )}
          </SortableList>
          <button type="button" onClick={() => editor.edit(addEducationItem(section.id))}>
            Dodaj wykształcenie
          </button>
        </>
      )
    case 'list':
      return <ListItemsFields editor={editor} sectionId={section.id} items={section.items} />
  }
}

const entryName = (text: string, fallback: string) => text.trim() || fallback

const educationName = (item: EducationItem) =>
  entryName([item.level, item.field].filter((part) => part.trim()).join(', '), 'Nowe wykształcenie')

function ExperienceItemFields({
  editor,
  sectionId,
  item,
  orderControls
}: {
  editor: CvEditor
  sectionId: string
  item: ExperienceItem
  orderControls: ReactNode
}) {
  const mergeKey = (field: string) => `experience:${item.id}:${field}`
  const patchItem = (patch: Partial<ExperienceItem>, field?: string) =>
    editor.edit(
      updateExperienceItem(sectionId, item.id, (current) => ({ ...current, ...patch })),
      field ? mergeKey(field) : undefined
    )
  const textField = (label: string, field: 'role' | 'company' | 'location') => (
    <label className="form-field">
      <span>{label}</span>
      <input value={item[field]} onChange={(event) => patchItem({ [field]: event.target.value }, field)} />
    </label>
  )
  // Data końca sprzed zaznaczenia „obecnie” – wraca po odznaczeniu.
  const endBeforePresent = useRef<ExperienceItem['end']>(null)
  const togglePresent = (present: boolean) => {
    if (present) endBeforePresent.current = item.end
    editor.edit(
      updateExperienceItem(sectionId, item.id, (current) => ({
        ...current,
        end: present ? 'present' : endBeforePresent.current
      }))
    )
  }

  return (
    <fieldset className="form-group">
      <legend>
        {orderControls}
        {entryName(item.role, 'Nowe stanowisko')}
      </legend>
      {textField('Stanowisko', 'role')}
      <div className="form-row">
        {textField('Firma', 'company')}
        {textField('Miasto', 'location')}
      </div>
      <div className="form-row">
        <MonthField label="Od" value={item.start} onChange={(start) => patchItem({ start }, 'start')} />
        <MonthField
          label="Do"
          value={item.end === 'present' ? null : item.end}
          disabled={item.end === 'present'}
          onChange={(end) => patchItem({ end }, 'end')}
        />
        <Checkbox label="obecnie" checked={item.end === 'present'} onChange={togglePresent} />
      </div>

      <div className="form-bullets">
        <span>Punkty</span>
        <SortableList
          items={item.bullets}
          label={(_bullet, index) => `punkt ${index + 1}`}
          onMove={(bulletId, toIndex) => editor.edit(moveBullet(sectionId, item.id, bulletId, toIndex))}
        >
          {(bullet, orderControls, index) => (
            <div className="form-row">
              {orderControls}
              <textarea
                rows={2}
                aria-label={`Punkt ${index + 1}`}
                value={bullet.text}
                onChange={(event) =>
                  editor.edit(
                    updateBullet(sectionId, item.id, bullet.id, event.target.value),
                    mergeKey(`bullet:${bullet.id}`)
                  )
                }
              />
              <button
                type="button"
                aria-label={`Usuń punkt ${index + 1}`}
                onClick={() => editor.edit(removeBullet(sectionId, item.id, bullet.id))}
              >
                Usuń
              </button>
            </div>
          )}
        </SortableList>
        <button type="button" onClick={() => editor.edit(addBullet(sectionId, item.id))}>
          Dodaj punkt
        </button>
      </div>

      <div className="form-row form-row--spread">
        <Checkbox
          label="Nowa strona przed tym wpisem"
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button type="button" className="danger" onClick={() => editor.edit(removeExperienceItem(sectionId, item.id))}>
          Usuń stanowisko
        </button>
      </div>
    </fieldset>
  )
}

function EducationItemFields({
  editor,
  sectionId,
  item,
  orderControls
}: {
  editor: CvEditor
  sectionId: string
  item: EducationItem
  orderControls: ReactNode
}) {
  const patchItem = (patch: Partial<Omit<EducationItem, 'id'>>, field?: string) =>
    editor.edit(updateEducationItem(sectionId, item.id, patch), field ? `education:${item.id}:${field}` : undefined)
  const textField = (label: string, field: 'level' | 'field' | 'institution', placeholder: string) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        placeholder={placeholder}
        value={item[field]}
        onChange={(event) => patchItem({ [field]: event.target.value }, field)}
      />
    </label>
  )

  return (
    <fieldset className="form-group">
      <legend>
        {orderControls}
        {educationName(item)}
      </legend>
      {textField('Poziom', 'level', 'np. Studia magisterskie')}
      {textField('Kierunek', 'field', 'np. Logistyka')}
      {textField('Uczelnia', 'institution', 'np. Uniwersytet Ekonomiczny')}
      <div className="form-row">
        <MonthField label="Od (opcjonalnie)" value={item.start} onChange={(start) => patchItem({ start }, 'start')} />
        <MonthField label="Data ukończenia" value={item.end} onChange={(end) => patchItem({ end }, 'end')} />
      </div>
      <div className="form-row form-row--spread">
        <Checkbox
          label="Nowa strona przed tym wpisem"
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button type="button" className="danger" onClick={() => editor.edit(removeEducationItem(sectionId, item.id))}>
          Usuń wykształcenie
        </button>
      </div>
    </fieldset>
  )
}

function ListItemsFields({ editor, sectionId, items }: { editor: CvEditor; sectionId: string; items: TextItem[] }) {
  return (
    <div className="form-bullets">
      <SortableList
        items={items}
        label={(_item, index) => `element ${index + 1}`}
        onMove={(id, toIndex) => editor.edit(moveItem(sectionId, id, toIndex))}
      >
        {(item, orderControls, index) => (
          <div className="form-row">
            {orderControls}
            <input
              aria-label={`Element ${index + 1}`}
              value={item.text}
              onChange={(event) =>
                editor.edit(updateListItem(sectionId, item.id, event.target.value), `list:${item.id}:text`)
              }
            />
            <button
              type="button"
              aria-label={`Usuń element ${index + 1}`}
              onClick={() => editor.edit(removeListItem(sectionId, item.id))}
            >
              Usuń
            </button>
          </div>
        )}
      </SortableList>
      <button type="button" onClick={() => editor.edit(addListItem(sectionId))}>
        Dodaj element
      </button>
    </div>
  )
}
