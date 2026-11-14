import { useId } from 'react'
import type { CvDocument } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { addContact, removeContact, updateContact } from '../documentEdits'
import { useRemove } from '../removalUndo'

// Kontakty z nagłówka (etykieta z podpowiedziami + wartość, dodaj, usuń) – w CV form i w Edit card kontaktów (te same
// klucze łączenia kroków cofania). Wartość ma `data-edit-focus` = id kontaktu (fokus karty po kliknięciu kontaktu na
// stronie). W CV form – grupa z legendą; w Edit card (`inCard`) – same wiersze, bo nazwą jest nazwa karty.
// Wiersz ma `data-entry-id`, a „Dodaj kontakt” `data-add-for="contacts"`: tam wraca fokus po „Cofnij” usunięcia.
export function ContactsFields({
  editor,
  contacts,
  inCard = false
}: {
  editor: CvEditor
  contacts: CvDocument['header']['contacts']
  inCard?: boolean
}) {
  const suggestionsId = useId()
  const { editor: t, defaultContent } = useDictionary()
  const remove = useRemove()

  const fields = (
    <>
      <datalist id={suggestionsId}>
        {defaultContent.contactLabels.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      {contacts.map((contact, index) => (
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
            data-edit-focus={contact.id}
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
    </>
  )

  if (inCard) return fields
  return (
    <fieldset className="form-group">
      <legend>{t.contact}</legend>
      {fields}
    </fieldset>
  )
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
