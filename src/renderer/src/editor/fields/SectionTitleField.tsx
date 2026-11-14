import type { Dictionary } from '../../../../shared/i18n/en'
import type { Section } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { updateSection } from '../documentEdits'

// Nazwa sekcji w interfejsie: jej tytuł, a sekcji bez tytułu – nazwa jej typu.
export const sectionName = (section: Section, t: Dictionary['editor']) => section.title.trim() || t.sectionTypes[section.type]

// Tytuł sekcji w CV form – samo pole obok uchwytu sekcji (nazwa dostępna z `aria-label`). Ten sam klucz łączenia kroków
// cofania co Page field tytułu na stronie.
export function SectionTitleField({ editor, section }: { editor: CvEditor; section: Section }) {
  const t = useDictionary().editor
  return (
    <input
      className="form-section-title-input"
      aria-label={t.sectionTitle(sectionName(section, t))}
      placeholder={t.sectionTypes[section.type]}
      value={section.title}
      onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
    />
  )
}
