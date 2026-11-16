import { generateBlocks } from '../domain/blocks'
import { consentText } from '../domain/consent'
import type { CvDocument, Section } from '../domain/schema'
import { templates } from '../template/templates'
import { sectionOf } from './editTargets'
import type { Fragment } from './fragmentRects'

// Dodawanie na stronach w Edit mode (docs/specs/inline-editing-redesign.md, Q8, Q10): czysta logika – czego brakuje
// w CV (pasek „Add to CV” pod ostatnią stroną), czy CV jest zupełnie puste (podpowiedź na pierwszej stronie) i gdzie
// stoją pigułki „+” pod sekcjami. Bez DOM, żeby dało się testować w Node.

// Brakująca część CV z przyciskiem w pasku „Add to CV”. `key` – stały identyfikator przycisku.
export type AddToCvItem =
  | { kind: 'fullName'; key: 'fullName' }
  | { kind: 'photo'; key: 'photo' }
  | { kind: 'contacts'; key: 'contacts' }
  | { kind: 'summary'; key: 'summary' }
  | { kind: 'section'; key: string; sectionId: string }
  | { kind: 'consent'; key: 'consent' }

const isFilled = (text: string) => text.trim() !== ''

// Bloki dokumentu – te same reguły co strony i PDF (puste pola, wpisy i sekcje oraz sekcje ukryte są pomijane).
const blocksOf = (document: CvDocument) => generateBlocks(document, templates[document.settings.template].geometry)

const withOnly = (document: CvDocument, section: Section): CvDocument => ({
  ...document,
  header: { fullName: '', photo: null, contacts: [], summary: '' },
  sections: [section]
})

// Czy sekcja coś pokazuje na stronach (ma wpis lub element z treścią i nie jest ukryta).
export const sectionShown = (section: Section, document: CvDocument) => blocksOf(withOnly(document, section)).length > 0

// Czy sekcja jest pusta – nie miałaby nic na stronach nawet pokazana (bez wpisów albo tylko z pustymi). Ukrycie nie ma
// znaczenia: ukryta sekcja z treścią nie jest pusta.
export const sectionEmpty = (section: Section, document: CvDocument) => !sectionShown({ ...section, hidden: false }, document)

// Czego brakuje w CV, w kolejności dokumentu: puste części nagłówka (imię i nazwisko, zdjęcie, kontakt – żaden kontakt
// nie ma wartości, podsumowanie), widoczne sekcje bez treści i klauzula zgody, której nie ma na stronie (wyłączona albo
// bez tekstu). Sekcji ukrytych tu nie ma – są na liście „CV elements”.
export function addToCvItems(document: CvDocument): AddToCvItem[] {
  const { header } = document
  const items: AddToCvItem[] = []
  if (!isFilled(header.fullName)) items.push({ kind: 'fullName', key: 'fullName' })
  if (!header.photo) items.push({ kind: 'photo', key: 'photo' })
  if (!header.contacts.some((contact) => isFilled(contact.value))) items.push({ kind: 'contacts', key: 'contacts' })
  if (!isFilled(header.summary)) items.push({ kind: 'summary', key: 'summary' })
  for (const section of document.sections) {
    if (!section.hidden && !sectionShown(section, document)) {
      items.push({ kind: 'section', key: `section:${section.id}`, sectionId: section.id })
    }
  }
  if (consentText(document) === null) items.push({ kind: 'consent', key: 'consent' })
  return items
}

// Zupełnie puste CV (np. „New CV”): na stronach nie ma niczego – ani bloku, ani klauzuli zgody.
export const isEmptyCv = (document: CvDocument) => blocksOf(document).length === 0 && consentText(document) === null

// Pigułka „+” sekcji: pod ostatnim fragmentem sekcji na stronach (`after` – za nim stoi też w kolejności Tab), od lewej
// krawędzi fragmentów sekcji na tej stronie (tytuł obok listy stoi bardziej w lewo niż jej elementy).
export type SectionPill = { sectionId: string; after: Fragment; top: number; left: number }

export function sectionPills(fragments: Fragment[]): SectionPill[] {
  const last = new Map<string, Fragment>()
  for (const fragment of fragments) {
    const sectionId = sectionOf(fragment.target)
    if (sectionId !== null) last.set(sectionId, fragment)
  }
  return [...last].map(([sectionId, after]) => ({
    sectionId,
    after,
    top: after.rect.bottom,
    left: Math.min(
      ...fragments
        .filter((fragment) => sectionOf(fragment.target) === sectionId && fragment.page === after.page)
        .map((fragment) => fragment.rect.left)
    )
  }))
}
