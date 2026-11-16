import { useId } from 'react'
import { plural } from '../../../shared/i18n/plural'
import { addContactElement } from '../canvas/AddControls'
import { setPhotoHidden } from '../editor/documentEdits'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'
import { focusOnPage } from './openOnPage'
import { AddPhotoButton } from './PhotoPanel'

// Panel nagłówka Inspektora (#141). Nie edytuje treści CV, tylko do niej prowadzi:
// - „Go to”: kursor w imieniu i nazwisku, w pierwszym kontakcie albo w podsumowaniu na stronie (pusta część jest
//   odsłaniana); przy kontaktach liczba kontaktów z wartością (dla czytnika ekranu – opis „4 contacts”); bez kontaktów
//   przycisk jest nieaktywny;
// - „+ Add contact”: jak pasek „Add to CV” – kontakt bez wartości albo nowy, z kursorem w nim;
// - zdjęcie: „Show photo on CV” (ukrycie zachowuje obraz) i przycisk do panelu zdjęcia, a bez zdjęcia – „Add photo”.
// Fokus na stronie zaznacza nagłówek, więc panel zostaje otwarty.
export function HeaderPanel({ editor, document, session, onSelect }: PanelProps) {
  const t = useDictionary().editor
  const language = useInterfaceLanguage()
  const goTo = useId()
  const countId = useId()
  const { contacts, photo } = document.header
  const filled = contacts.filter((contact) => contact.value.trim() !== '').length

  return (
    <>
      <div className="inspector-field">
        <span id={goTo} className="inspector-label">
          {t.inspector.header.goTo}
        </span>
        <ul className="inspector-items" aria-labelledby={goTo}>
          <li>
            <button type="button" className="inspector-item" onClick={() => focusOnPage(session, { kind: 'fullName' })}>
              {t.fullName}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="inspector-item"
              aria-describedby={countId}
              disabled={contacts.length === 0}
              onClick={() => focusOnPage(session, { kind: 'contacts' })}
            >
              {t.inspector.header.contacts}
              <span className="cv-element-count" aria-hidden="true">
                {filled}
              </span>
            </button>
            <span id={countId} hidden>
              {plural(language, t.inspector.header.contactCount, filled)}
            </span>
          </li>
          <li>
            <button type="button" className="inspector-item" onClick={() => focusOnPage(session, { kind: 'summary' })}>
              {t.summary}
            </button>
          </li>
        </ul>
        <button type="button" className="inspector-action" onClick={() => focusOnPage(session, addContactElement(editor))}>
          + {t.addContact}
        </button>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">{t.photo.legend}</span>
        {photo ? (
          <>
            <InspectorSwitch
              label={t.outline.showPhoto}
              part="photo"
              checked={!photo.hidden}
              onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
            />
            <button type="button" className="inspector-action" onClick={() => onSelect({ kind: 'photo' })}>
              {t.inspector.header.photoOptions}
              <span aria-hidden="true"> ›</span>
            </button>
          </>
        ) : (
          <AddPhotoButton session={session} />
        )}
      </div>
    </>
  )
}
