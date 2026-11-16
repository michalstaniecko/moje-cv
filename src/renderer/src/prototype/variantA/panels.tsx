// PROTOTYP – wariant A „Inspektor”: panele części CV (sekcja, nagłówek, zdjęcie, klauzula zgody).
// Treść CV edytuje się na stronach; panele mają opcje części, listę jej elementów (skrót do nich na stronie) i dodawanie.
import { useState, type ReactNode } from 'react'
import type { EditTarget } from '../../canvas/editTargets'
import type { Section } from '../../domain/schema'
import { addContact, applyClause, moveSection, setPhotoHidden, updateConsent, updateHeader, updateSection } from '../../editor/documentEdits'
import { usePhotoPicker } from '../../editor/fields/PhotoField'
import { useDictionary } from '../../i18n'
import { useStubOptions } from '../stubOptions'
import { Group, Row, SwitchRow } from './controls'
import type { InspectorProps } from './Inspector'
import { addToSection, focusOnPage, isEmptySection, itemTarget, itemTitle, scrollToFragment } from './navigation'

// ---------- wspólne ----------

// Lista elementów części CV: tylko tytuły; klik stawia kursor w elemencie na stronie (`onOpen` brak – sam tekst).
function ItemList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="pa-items" aria-label={label}>
      {children}
    </ul>
  )
}

function Item({ title, detail, placeholder, onOpen }: { title: string; detail?: string; placeholder: string; onOpen?: () => void }) {
  const content = (
    <>
      <span className="pa-item-title" data-placeholder={title === '' || undefined}>
        {title || placeholder}
      </span>
      {detail && <span className="pa-item-detail">{detail}</span>}
    </>
  )
  return (
    <li>
      {onOpen ? (
        <button type="button" className="pa-item" onClick={onOpen} title="Pokaż na stronie">
          {content}
        </button>
      ) : (
        <span className="pa-item">{content}</span>
      )}
    </li>
  )
}

// ---------- Sekcja ----------

export function SectionPanel({ editor, document, session, section }: InspectorProps & { section: Section }) {
  const t = useDictionary().editor
  const index = document.sections.findIndex((candidate) => candidate.id === section.id)
  const count = document.sections.length
  const empty = isEmptySection(section, document)
  // Słownictwo pigułek „+” i menu uchwytu (pl.ts: addPosition / addEducation / addListItem).
  const addLabel = { experience: t.addPosition, education: t.addEducation, list: t.addListItem }[section.type]
  const placeholder = { experience: 'Nowe stanowisko', education: 'Nowa szkoła', list: 'Pusty element' }[section.type]
  const filled = empty ? 0 : section.items.length

  return (
    <>
      <Group title="Sekcja" id="section">
        <label className="pa-field">
          <span className="pa-field-label">Nazwa</span>
          <input
            className="pa-input"
            value={section.title}
            placeholder={t.sectionTypes[section.type]}
            onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
          />
        </label>
        <SwitchRow
          label="Pokaż na CV"
          checked={!section.hidden}
          onChange={(shown) => editor.edit(updateSection(section.id, { hidden: !shown }))}
          hint={section.hidden ? 'Ukrytej sekcji nie ma na stronach ani w PDF – treść zostaje.' : undefined}
        />
        <SwitchRow
          label="Zacznij od nowej strony"
          checked={section.pageBreakBefore}
          onChange={(pageBreakBefore) => editor.edit(updateSection(section.id, { pageBreakBefore }))}
        />
        <Row label="Kolejność">
          <span className="pa-stepper" role="group" aria-label="Kolejność sekcji">
            <button
              type="button"
              className="pa-button pa-button--icon"
              aria-label="Przenieś wyżej"
              title="Przenieś wyżej"
              disabled={index <= 0}
              onClick={() => editor.edit(moveSection(section.id, index - 1))}
            >
              ↑
            </button>
            <span className="pa-stepper-value">
              {index + 1} z {count}
            </span>
            <button
              type="button"
              className="pa-button pa-button--icon"
              aria-label="Przenieś niżej"
              title="Przenieś niżej"
              disabled={index >= count - 1}
              onClick={() => editor.edit(moveSection(section.id, index + 1))}
            >
              ↓
            </button>
          </span>
        </Row>
      </Group>
      <Group title="Elementy" id="section-items" aside={filled > 0 ? filled : undefined}>
        {empty ? (
          <div className="pa-empty">
            <span className="pa-empty-title">Sekcja jest pusta</span>
            <span className="pa-hint pa-hint--flush">Dodaj pierwszy element – pojawi się na stronie z kursorem w nim.</span>
          </div>
        ) : (
          <ItemList label={`Elementy sekcji`}>
            {section.items.map((item, itemIndex) => {
              const { title, detail } = itemTitle(section, itemIndex)
              return (
                <Item
                  key={item.id}
                  title={title}
                  detail={detail}
                  placeholder={placeholder}
                  onOpen={section.hidden ? undefined : () => focusOnPage(session, itemTarget(section, item.id))}
                />
              )
            })}
          </ItemList>
        )}
        <button type="button" className="pa-button pa-button--add" onClick={() => addToSection(editor, session, section)}>
          <span aria-hidden="true">+</span> {addLabel}
        </button>
        {section.hidden && <p className="pa-hint pa-hint--flush">Sekcja jest ukryta – dodanie elementu pokaże ją na CV.</p>}
        {!section.hidden && !empty && (
          <p className="pa-hint pa-hint--flush">Treść – wpisy, daty, punkty – edytujesz bezpośrednio na stronie.</p>
        )}
      </Group>
    </>
  )
}

// ---------- Nagłówek ----------

export function HeaderPanel({ editor, document, session, onSelect }: InspectorProps) {
  const t = useDictionary().editor
  const { header } = document
  const contacts = header.contacts.filter((contact) => contact.value.trim() !== '')
  const go = (target: EditTarget) => focusOnPage(session, target)
  const addNewContact = () => {
    // Kontakt bez wartości (np. etykieta nowego CV) zamiast kolejnego pustego – jak pasek „Add to CV”.
    let contact = header.contacts.find((candidate) => candidate.value.trim() === '')
    if (!contact) {
      editor.edit(addContact())
      contact = editor.store.getState().document.header.contacts.at(-1)
    }
    go({ kind: 'contacts', contactId: contact?.id })
  }
  return (
    <>
      <Group title="Na stronie" id="header-parts">
        <ItemList label="Części nagłówka">
          <Item title={t.fullName} detail={header.fullName.trim() || 'brak'} placeholder="" onOpen={() => go({ kind: 'fullName' })} />
          <Item
            title="Kontakty"
            detail={contactCount(contacts.length)}
            placeholder=""
            onOpen={() => go({ kind: 'contacts' })}
          />
          <Item title={t.summary} detail={header.summary.trim() || 'brak'} placeholder="" onOpen={() => go({ kind: 'summary' })} />
        </ItemList>
        <button type="button" className="pa-button pa-button--add" onClick={addNewContact}>
          <span aria-hidden="true">+</span> {t.addContact}
        </button>
        <p className="pa-hint pa-hint--flush">Imię, kontakty i podsumowanie edytujesz bezpośrednio na stronie.</p>
      </Group>
      <Group title="Zdjęcie" id="header-photo">
        <SwitchRow
          label="Pokaż zdjęcie"
          checked={header.photo !== null && !header.photo.hidden}
          disabled={header.photo === null}
          onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
          hint={header.photo === null ? 'CV nie ma zdjęcia.' : undefined}
        />
        <button
          type="button"
          className="pa-link"
          onClick={() => {
            onSelect({ kind: 'photo' })
            if (header.photo && !header.photo.hidden) scrollToFragment('photo')
          }}
        >
          {header.photo ? 'Zmień, kadruj lub usuń zdjęcie' : 'Dodaj zdjęcie'} ›
        </button>
      </Group>
    </>
  )
}

const contactCount = (count: number) =>
  count === 0 ? 'brak' : count === 1 ? '1 kontakt' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? `${count} kontakty` : `${count} kontaktów`

// ---------- Zdjęcie ----------

export function PhotoPanel({ editor, document }: InspectorProps) {
  const { photo } = document.header
  const errors = useDictionary().editor.photo.errors
  const { pick, crop, error, cropper } = usePhotoPicker(editor)
  const stub = useStubOptions()
  return (
    <>
      <Group title="Zdjęcie" id="photo">
        <div className="pa-photo">
          {photo ? (
            <img className="pa-photo-thumb" src={photo.dataUrl} alt="Zdjęcie w CV" data-hidden={photo.hidden || undefined} />
          ) : (
            <div className="pa-photo-thumb pa-photo-thumb--empty" aria-hidden="true">
              brak zdjęcia
            </div>
          )}
          <div className="pa-photo-actions">
            <button type="button" className={photo ? 'pa-button' : 'pa-button button-primary'} onClick={() => void pick()}>
              {photo ? 'Zmień…' : 'Dodaj zdjęcie…'}
            </button>
            {photo && (
              <button type="button" className="pa-button" onClick={() => void crop(photo.dataUrl)}>
                Kadruj…
              </button>
            )}
            {photo && (
              <button type="button" className="pa-button danger" onClick={() => editor.edit(updateHeader({ photo: null }))} title="Usuń zdjęcie z CV (⌘Z cofa)">
                Usuń
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="pa-error" role="alert">
            {errors[error]}
          </p>
        )}
        <SwitchRow
          label="Pokaż na CV"
          checked={photo !== null && !photo.hidden}
          disabled={photo === null}
          onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
          hint={photo?.hidden ? 'Ukryte zdjęcie zostaje w CV, ale nie trafia na strony ani do PDF.' : undefined}
        />
        <Row label="Kształt" stub>
          <select
            className="pa-select"
            aria-label="Kształt zdjęcia"
            value={stub.photoShape}
            onChange={(event) => stub.set({ photoShape: event.target.value as typeof stub.photoShape })}
          >
            <option value="template">Jak w szablonie</option>
            <option value="rectangle">Prostokąt</option>
            <option value="rounded">Zaokrąglony</option>
            <option value="circle">Koło</option>
          </select>
        </Row>
      </Group>
      {cropper}
    </>
  )
}

// ---------- Klauzula zgody ----------

export function ConsentPanel({ editor, document, session, clauses, saveClause }: InspectorProps) {
  const { consent } = document
  const [name, setName] = useState('')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const matching = clauses.find((clause) => clause.id === consent.clauseId)
  const edited = matching !== undefined && matching.text !== consent.text

  async function save() {
    setSaving('saving')
    const clause = await saveClause({ name: name.trim() || 'Moja klauzula', text: consent.text })
    if (!clause) {
      setSaving('failed')
      return
    }
    editor.edit(applyClause(clause))
    setName('')
    setSaving('saved')
  }

  return (
    <>
      <Group title="Klauzula" id="consent">
        <SwitchRow
          label="Pokaż na CV"
          checked={consent.enabled}
          onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
          hint={consent.enabled ? undefined : 'Wyłączonej klauzuli nie ma na stronach ani w PDF – tekst zostaje.'}
        />
        <button
          type="button"
          className="pa-link"
          disabled={!consent.enabled}
          onClick={() => focusOnPage(session, { kind: 'consent' })}
        >
          Edytuj tekst na stronie ›
        </button>
      </Group>
      <Group title="Treść z biblioteki" id="consent-library">
        {clauses.length === 0 ? (
          <p className="pa-hint pa-hint--flush">Biblioteka klauzul jest pusta. Zapisz poniżej bieżący tekst.</p>
        ) : (
          <div className="pa-clauses" role="radiogroup" aria-label="Klauzula z biblioteki">
            {clauses.map((clause) => (
              <label key={clause.id} className="pa-clause" data-checked={clause.id === consent.clauseId || undefined}>
                <input type="radio" name="pa-clause" checked={clause.id === consent.clauseId} onChange={() => editor.edit(applyClause(clause))} />
                <span className="pa-clause-name">{clause.name.trim() || 'Bez nazwy'}</span>
                <span className="pa-clause-text">{clause.text}</span>
              </label>
            ))}
          </div>
        )}
        {edited && <p className="pa-hint pa-hint--flush">Tekst na stronie różni się od wersji z biblioteki.</p>}
      </Group>
      <Group title="Zapisz jako nową klauzulę" id="consent-save" defaultOpen={clauses.length === 0}>
        <label className="pa-field">
          <span className="pa-field-label">Nazwa</span>
          <input className="pa-input" value={name} placeholder="np. Klauzula RODO – ogólna" onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="pa-actions">
          <button
            type="button"
            className="pa-button"
            disabled={saving === 'saving' || consent.text.trim() === ''}
            onClick={() => void save()}
          >
            Zapisz bieżący tekst
          </button>
          {saving === 'saved' && <span className="pa-hint pa-hint--flush">Zapisano w bibliotece.</span>}
          {saving === 'failed' && <span className="pa-error">Nie udało się zapisać.</span>}
        </div>
      </Group>
    </>
  )
}
