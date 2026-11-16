import { useId } from 'react'
import type { Dictionary } from '../../../shared/i18n/en'
import { sectionEmpty } from '../canvas/addOnPage'
import type { EditTarget } from '../canvas/editTargets'
import type { EditSession } from '../canvas/useEditSession'
import type { CvDocument, Section } from '../domain/schema'
import { educationName, entryName } from '../editor/fields/entryNames'
import { useDictionary } from '../i18n'
import { focusOnPage } from './openOnPage'

// Pozycje sekcji w jej panelu Inspektora: tylko tytuły, do nawigacji (Inspector nie edytuje treści CV). Klik stawia
// kursor w pozycji na stronie; w ukrytej sekcji (nie ma jej na stronach) przyciski są nieaktywne. Sekcja bez treści
// na stronach – „Sekcja jest pusta”.
export function SectionItems({ document, section, session }: { document: CvDocument; section: Section; session: EditSession }) {
  const t = useDictionary().editor
  const label = useId()
  return (
    <div className="inspector-field">
      <span id={label} className="inspector-label">
        {t.inspector.section.items}
      </span>
      {sectionEmpty(section, document) ? (
        <p className="inspector-hint">{t.inspector.section.empty}</p>
      ) : (
        <ul className="inspector-items" aria-labelledby={label}>
          {section.items.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className="inspector-item"
                disabled={section.hidden}
                onClick={() => focusOnPage(session, sectionItemTarget(section, item.id))}
              >
                {itemTitle(section, index, t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Pozycja sekcji jako część CV na stronie: wpis albo element listy.
export function sectionItemTarget(section: Section, itemId: string): EditTarget {
  return section.type === 'list'
    ? { kind: 'listSection', sectionId: section.id, itemId }
    : { kind: section.type === 'experience' ? 'experienceItem' : 'educationItem', sectionId: section.id, itemId }
}

// Tytuł pozycji: stanowisko (bez niego – firma, a bez obu „Nowe stanowisko”), wykształcenie jak w nazwach Page fields,
// element listy – jego tekst (pusty – „Element N”).
function itemTitle(section: Section, index: number, t: Dictionary['editor']): string {
  switch (section.type) {
    case 'experience': {
      const item = section.items[index]!
      return entryName(item.role.trim() || item.company, t.newPosition)
    }
    case 'education':
      return educationName(section.items[index]!, t)
    case 'list':
      return entryName(section.items[index]!.text, t.listItem(index + 1))
  }
}
