import type { Dictionary } from '../../../../shared/i18n/en'
import type { CvDocument, EducationItem } from '../../domain/schema'

// Nazwy wpisów w interfejsie (legenda w CV form, uchwyt i komunikaty kolejności, nazwy Page fields): pusta nazwa –
// „Nowe stanowisko” / „Nowe wykształcenie”.
export const entryName = (text: string, fallback: string) => text.trim() || fallback

export const educationName = (item: EducationItem, t: Dictionary['editor']) =>
  entryName([item.level, item.field].filter((part) => part.trim()).join(', '), t.newEducation)

// Pozycja usuwania kontaktu w menu uchwytu kontaktów (docs/specs/outline-instead-of-cv-form.md, D5): kontakt nazwany
// etykietą, bez niej – wartością, a bez obu – numerem („Remove contact 3”, jak w CV form; `index` od zera).
export const removeContactLabel = (
  contact: Pick<CvDocument['header']['contacts'][number], 'label' | 'value'>,
  index: number,
  t: Dictionary['editor']
) => {
  const name = contact.label.trim() || contact.value.trim()
  return name ? t.removeContactNamed(name) : t.removeContact(index + 1)
}
