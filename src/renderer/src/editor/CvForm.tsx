import { useId, useRef } from 'react'
import { useStore } from 'zustand'
import type { CvDocument, ExperienceItem } from '../domain/schema'
import type { CvEditor } from './cvEditor'
import {
  addBullet,
  addContact,
  addExperienceItem,
  removeBullet,
  removeContact,
  removeExperienceItem,
  updateBullet,
  updateContact,
  updateExperienceItem,
  updateHeader
} from './documentEdits'
import { MonthField } from './MonthField'

const CONTACT_LABEL_SUGGESTIONS = ['Tel', 'E-mail', 'LinkedIn', 'Miasto']

// Formularz edycji CV: nagłówek i sekcje doświadczenia. Każda zmiana trafia do edytora (historia + autozapis).
export function CvForm({ editor }: { editor: CvEditor }) {
  const document = useStore(editor.store, (state) => state.document)

  return (
    <div className="form">
      <HeaderFields editor={editor} header={document.header} />
      {document.sections.map(
        (section) =>
          section.type === 'experience' && (
            <ExperienceFields key={section.id} editor={editor} sectionId={section.id} title={section.title} items={section.items} />
          )
      )}
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

function ExperienceFields({
  editor,
  sectionId,
  title,
  items
}: {
  editor: CvEditor
  sectionId: string
  title: string
  items: ExperienceItem[]
}) {
  return (
    <section className="form-section">
      <h2 className="form-section-title">{title || 'Doświadczenie'}</h2>
      {items.map((item) => (
        <ExperienceItemFields key={item.id} editor={editor} sectionId={sectionId} item={item} />
      ))}
      <button type="button" onClick={() => editor.edit(addExperienceItem(sectionId))}>
        Dodaj stanowisko
      </button>
    </section>
  )
}

function ExperienceItemFields({ editor, sectionId, item }: { editor: CvEditor; sectionId: string; item: ExperienceItem }) {
  const mergeKey = (field: string) => `experience:${item.id}:${field}`
  const patchItem = (patch: Partial<ExperienceItem>, field: string) =>
    editor.edit(updateExperienceItem(sectionId, item.id, (current) => ({ ...current, ...patch })), mergeKey(field))
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
      <legend>{item.role.trim() || 'Nowe stanowisko'}</legend>
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
        <label className="form-checkbox">
          <input type="checkbox" checked={item.end === 'present'} onChange={(event) => togglePresent(event.target.checked)} />
          obecnie
        </label>
      </div>

      <div className="form-bullets">
        <span>Punkty</span>
        {item.bullets.map((bullet, index) => (
          <div key={bullet.id} className="form-row">
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
        ))}
        <button type="button" onClick={() => editor.edit(addBullet(sectionId, item.id))}>
          Dodaj punkt
        </button>
      </div>

      <button type="button" className="danger" onClick={() => editor.edit(removeExperienceItem(sectionId, item.id))}>
        Usuń stanowisko
      </button>
    </fieldset>
  )
}
