import type { Dictionary } from '../../../../shared/i18n/en'
import type { Section } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { updateSection } from '../documentEdits'

// Nazwa sekcji w interfejsie: jej tytuł, a sekcji bez tytułu – nazwa jej typu.
export const sectionName = (section: Section, t: Dictionary['editor']) => section.title.trim() || t.sectionTypes[section.type]

// Tytuł sekcji – w CV form samo pole obok uchwytu sekcji (nazwa dostępna z `aria-label`), w Edit card (`labelled`)
// pole z widoczną etykietą. Ten sam klucz łączenia kroków cofania w obu miejscach.
export function SectionTitleField({
  editor,
  section,
  labelled = false
}: {
  editor: CvEditor
  section: Section
  labelled?: boolean
}) {
  const t = useDictionary().editor
  const input = (
    <input
      className={labelled ? undefined : 'form-section-title-input'}
      aria-label={labelled ? undefined : t.sectionTitle(sectionName(section, t))}
      placeholder={t.sectionTypes[section.type]}
      value={section.title}
      onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
    />
  )
  if (!labelled) return input
  return (
    <label className="form-field">
      <span>{t.card.sectionTitle}</span>
      {input}
    </label>
  )
}
