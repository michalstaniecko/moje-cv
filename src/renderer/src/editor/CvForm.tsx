import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { Dictionary } from '../../../shared/i18n/en'
import { clauseName, type Clause, type ClauseContent, type CvDocument, type EducationItem, type ExperienceItem, type Section, type TextItem } from '../domain/schema'
import { useDictionary } from '../i18n'
import { fontFamilies, type Font } from '../template/fonts'
import type { CvEditor } from './cvEditor'
import {
  addBullet,
  addContact,
  addEducationItem,
  addExperienceItem,
  addListItem,
  applyClause,
  moveBullet,
  moveItem,
  moveSection,
  removeBullet,
  removeContact,
  removeEducationItem,
  removeExperienceItem,
  removeListItem,
  updateBullet,
  updateConsent,
  updateContact,
  updateEducationItem,
  updateExperienceItem,
  updateHeader,
  updateListItem,
  updateSection,
  updateSettings
} from './documentEdits'
import { MonthField } from './MonthField'
import { PhotoField } from './PhotoField'
import { SortableList } from './SortableList'
import { TemplatePicker } from './TemplatePicker'

type EditorText = Dictionary['editor']

const sectionName = (section: Section, t: EditorText) => section.title.trim() || t.sectionTypes[section.type]

// Formularz edycji CV: nagłówek, sekcje w kolejności z CV i klauzula zgody. Każda zmiana trafia do edytora (historia + autozapis).
// `clauses` – biblioteka klauzul; `onSaveClause` dodaje do niej nową klauzulę.
export function CvForm({
  editor,
  clauses,
  onSaveClause
}: {
  editor: CvEditor
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
}) {
  const document = useStore(editor.store, (state) => state.document)
  const t = useDictionary().editor

  return (
    <div className="form">
      <AppearanceFields editor={editor} document={document} />
      <HeaderFields editor={editor} header={document.header} />
      <SortableList
        items={document.sections}
        label={(section) => t.order.section(sectionName(section, t))}
        onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
      >
        {(section, orderControls) => <SectionFields editor={editor} section={section} orderControls={orderControls} />}
      </SortableList>
      <ConsentFields editor={editor} consent={document.consent} clauses={clauses} onSaveClause={onSaveClause} />
    </div>
  )
}

// Wygląd tego CV: kolor akcentu (imię, tytuły sekcji, kropki przy datach), font i template.
function AppearanceFields({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor
  const { settings } = document
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.appearance}</h2>
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
            {Object.entries(fontFamilies).map(([font, name]) => (
              <option key={font} value={font}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TemplatePicker document={document} onChange={(template) => editor.edit(updateSettings({ template }))} />
    </section>
  )
}

function HeaderFields({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const suggestionsId = useId()
  const { editor: t, defaultContent } = useDictionary()

  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.header}</h2>
      <label className="form-field">
        <span>{t.fullName}</span>
        <input
          value={header.fullName}
          onChange={(event) => editor.edit(updateHeader({ fullName: event.target.value }), 'header:fullName')}
        />
      </label>

      <PhotoField editor={editor} photo={header.photo} />

      <fieldset className="form-group">
        <legend>{t.contact}</legend>
        <datalist id={suggestionsId}>
          {defaultContent.contactLabels.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        {header.contacts.map((contact, index) => (
          <div key={contact.id} className="form-row">
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
            <button type="button" aria-label={t.removeContact(index + 1)} onClick={() => editor.edit(removeContact(contact.id))}>
              {t.remove}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => editor.edit(addContact())}>
          {t.addContact}
        </button>
      </fieldset>

      <label className="form-field">
        <span>{t.summary}</span>
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
  const t = useDictionary().editor
  const name = sectionName(section, t)

  return (
    <section className={section.hidden ? 'form-section form-section--hidden' : 'form-section'} aria-label={name}>
      <div className="form-section-header">
        {orderControls}
        <input
          className="form-section-title-input"
          aria-label={t.sectionTitle(name)}
          placeholder={t.sectionTypes[section.type]}
          value={section.title}
          onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
        />
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
          <SortableList items={section.items} label={(item) => t.order.position(entryName(item.role, t.newPosition))} onMove={onMove}>
            {(item, orderControls) => (
              <ExperienceItemFields editor={editor} sectionId={section.id} item={item} orderControls={orderControls} />
            )}
          </SortableList>
          <button type="button" onClick={() => editor.edit(addExperienceItem(section.id))}>
            {t.addPosition}
          </button>
        </>
      )
    case 'education':
      return (
        <>
          <SortableList items={section.items} label={(item) => t.order.education(educationName(item, t))} onMove={onMove}>
            {(item, orderControls) => (
              <EducationItemFields editor={editor} sectionId={section.id} item={item} orderControls={orderControls} />
            )}
          </SortableList>
          <button type="button" onClick={() => editor.edit(addEducationItem(section.id))}>
            {t.addEducation}
          </button>
        </>
      )
    case 'list':
      return <ListItemsFields editor={editor} sectionId={section.id} items={section.items} />
  }
}

const entryName = (text: string, fallback: string) => text.trim() || fallback

const educationName = (item: EducationItem, t: EditorText) =>
  entryName([item.level, item.field].filter((part) => part.trim()).join(', '), t.newEducation)

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
  const t = useDictionary().editor
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
        {entryName(item.role, t.newPosition)}
      </legend>
      {textField(t.role, 'role')}
      <div className="form-row">
        {textField(t.company, 'company')}
        {textField(t.location, 'location')}
      </div>
      <div className="form-row">
        <MonthField label={t.from} value={item.start} onChange={(start) => patchItem({ start }, 'start')} />
        <MonthField
          label={t.to}
          value={item.end === 'present' ? null : item.end}
          disabled={item.end === 'present'}
          onChange={(end) => patchItem({ end }, 'end')}
        />
        <Checkbox label={t.present} checked={item.end === 'present'} onChange={togglePresent} />
      </div>

      <div className="form-bullets">
        <span>{t.bullets}</span>
        <SortableList
          items={item.bullets}
          label={(_bullet, index) => t.order.bullet(index + 1)}
          onMove={(bulletId, toIndex) => editor.edit(moveBullet(sectionId, item.id, bulletId, toIndex))}
        >
          {(bullet, orderControls, index) => (
            <div className="form-row">
              {orderControls}
              <textarea
                rows={2}
                aria-label={t.bullet(index + 1)}
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
                aria-label={t.removeBullet(index + 1)}
                onClick={() => editor.edit(removeBullet(sectionId, item.id, bullet.id))}
              >
                {t.remove}
              </button>
            </div>
          )}
        </SortableList>
        <button type="button" onClick={() => editor.edit(addBullet(sectionId, item.id))}>
          {t.addBullet}
        </button>
      </div>

      <div className="form-row form-row--spread">
        <Checkbox
          label={t.pageBreakBeforeEntry}
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button type="button" className="danger" onClick={() => editor.edit(removeExperienceItem(sectionId, item.id))}>
          {t.removePosition}
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
  const t = useDictionary().editor
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
        {educationName(item, t)}
      </legend>
      {textField(t.level, 'level', t.levelPlaceholder)}
      {textField(t.field, 'field', t.fieldPlaceholder)}
      {textField(t.institution, 'institution', t.institutionPlaceholder)}
      <div className="form-row">
        <MonthField label={t.startOptional} value={item.start} onChange={(start) => patchItem({ start }, 'start')} />
        <MonthField label={t.graduation} value={item.end} onChange={(end) => patchItem({ end }, 'end')} />
      </div>
      <div className="form-row form-row--spread">
        <Checkbox
          label={t.pageBreakBeforeEntry}
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button type="button" className="danger" onClick={() => editor.edit(removeEducationItem(sectionId, item.id))}>
          {t.removeEducation}
        </button>
      </div>
    </fieldset>
  )
}

function ListItemsFields({ editor, sectionId, items }: { editor: CvEditor; sectionId: string; items: TextItem[] }) {
  const t = useDictionary().editor
  return (
    <div className="form-bullets">
      <SortableList
        items={items}
        label={(_item, index) => t.order.listItem(index + 1)}
        onMove={(id, toIndex) => editor.edit(moveItem(sectionId, id, toIndex))}
      >
        {(item, orderControls, index) => (
          <div className="form-row">
            {orderControls}
            <input
              aria-label={t.listItem(index + 1)}
              value={item.text}
              onChange={(event) =>
                editor.edit(updateListItem(sectionId, item.id, event.target.value), `list:${item.id}:text`)
              }
            />
            <button
              type="button"
              aria-label={t.removeListItem(index + 1)}
              onClick={() => editor.edit(removeListItem(sectionId, item.id))}
            >
              {t.remove}
            </button>
          </div>
        )}
      </SortableList>
      <button type="button" onClick={() => editor.edit(addListItem(sectionId))}>
        {t.addListItem}
      </button>
    </div>
  )
}

// Klauzula zgody tego CV: włączenie, wybór z biblioteki i edycja lokalnej kopii treści.
// Edycja w CV nie zmienia biblioteki; poprawioną treść można zapisać jako nową klauzulę albo przywrócić wersję z biblioteki.
function ConsentFields({
  editor,
  consent,
  clauses,
  onSaveClause
}: {
  editor: CvEditor
  consent: CvDocument['consent']
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
}) {
  const dictionary = useDictionary()
  const t = dictionary.editor.consent
  const libraryClause = clauses.find((clause) => clause.id === consent.clauseId) ?? null
  const modified = libraryClause !== null && libraryClause.text !== consent.text

  return (
    <section className="form-section" aria-label={t.title}>
      <h2 className="form-section-title">{t.title}</h2>
      <Checkbox
        label={t.show}
        checked={consent.enabled}
        onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
      />
      {consent.enabled && (
        <>
          <label className="form-field">
            <span>{t.fromLibrary}</span>
            <select
              value={libraryClause?.id ?? ''}
              onChange={(event) => {
                const clause = clauses.find((clause) => clause.id === event.target.value)
                if (clause) editor.edit(applyClause(clause))
              }}
            >
              <option value="" disabled>
                {consent.clauseId !== null ? t.deleted : clauses.length ? t.choose : t.emptyLibrary}
              </option>
              {clauses.map((clause) => (
                <option key={clause.id} value={clause.id}>
                  {clauseName(clause, dictionary.clauses.untitled)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t.text}</span>
            <textarea
              rows={5}
              value={consent.text}
              onChange={(event) => editor.edit(updateConsent({ text: event.target.value }), 'consent:text')}
            />
          </label>
          <div className="consent-actions">
            {modified && (
              <>
                <span className="consent-modified">{t.modified}</span>
                <button type="button" onClick={() => editor.edit(applyClause(libraryClause))}>
                  {t.restore}
                </button>
              </>
            )}
            <SaveAsNewClause
              text={consent.text}
              onSave={async (name) => editor.edit(applyClause(await onSaveClause({ name, text: consent.text })))}
            />
          </div>
        </>
      )}
    </section>
  )
}

// „Zapisz jako nową klauzulę”: pyta o nazwę w miejscu przycisku, żeby nie przerywać edycji CV oknem dialogowym.
function SaveAsNewClause({ text, onSave }: { text: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { common, editor } = useDictionary()
  const t = editor.consent
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name?.trim()) return
    try {
      await onSave(name.trim())
      setName(null)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  if (name === null) {
    return (
      <button type="button" disabled={!text.trim()} onClick={() => setName('')}>
        {t.saveAsNew}
      </button>
    )
  }
  return (
    <form className="form-row" onSubmit={submit}>
      <input
        aria-label={t.newName}
        placeholder={t.newNamePlaceholder}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setName(null)}
      />
      <button type="submit" disabled={!name.trim()}>
        {common.save}
      </button>
      <button type="button" onClick={() => setName(null)}>
        {common.cancel}
      </button>
      {failed && (
        <span className="toolbar-status--error" role="alert">
          {t.saveFailed}
        </span>
      )}
    </form>
  )
}
