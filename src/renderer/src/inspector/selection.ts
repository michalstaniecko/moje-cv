import type { CvDocument, Section } from '../domain/schema'

// Część CV w Inspektorze (#136): wiersz listy „CV elements” i zaznaczenie – panel tej części.
export type CvElement = { kind: 'header' } | { kind: 'photo' } | { kind: 'section'; id: string } | { kind: 'consent' }

// Zaznaczenie Inspektora (#136, #139): część CV, której panel Inspektor pokazuje; null – panel „Dokument”.
export type InspectorSelection = CvElement | null

// Stały klucz części CV: rodzaj, a dla sekcji – z jej id (np. `section:education`).
export const elementKey = (element: CvElement) => (element.kind === 'section' ? `section:${element.id}` : element.kind)

export const findSection = (document: CvDocument, id: string): Section | undefined =>
  document.sections.find((section) => section.id === id)

const SECTION_PREFIXES = ['sectionTitle:', 'list:'] as const
const ITEM_PREFIX = 'item:'

// Część CV fragmentu strony (klucz `fragmentKey` z canvas/editTargets.ts) – czysta funkcja:
// - imię i nazwisko, kontakty, podsumowanie → nagłówek; zdjęcie → zdjęcie; klauzula zgody → klauzula;
// - tytuł sekcji i sekcja listowa → ta sekcja; wpis → sekcja, w której jest;
// - nieznany klucz albo część, której nie ma już w dokumencie → null (panel „Dokument”).
export function selectionOfFragment(fragment: string, document: CvDocument): InspectorSelection {
  switch (fragment) {
    case 'fullName':
    case 'contacts':
    case 'summary':
      return { kind: 'header' }
    case 'photo':
      return { kind: 'photo' }
    case 'consent':
      return { kind: 'consent' }
  }
  for (const prefix of SECTION_PREFIXES) {
    if (!fragment.startsWith(prefix)) continue
    const id = fragment.slice(prefix.length)
    return findSection(document, id) ? { kind: 'section', id } : null
  }
  if (fragment.startsWith(ITEM_PREFIX)) {
    const itemId = fragment.slice(ITEM_PREFIX.length)
    const section = document.sections.find((candidate) => candidate.items.some((item) => item.id === itemId))
    return section ? { kind: 'section', id: section.id } : null
  }
  return null
}

// Zaznaczenie, które nadal ma swoją część w dokumencie; sekcja, która zniknęła, daje null – Inspektor wraca do panelu
// „Dokument”. Ukryte części zostają (ich panel je pokazuje). Zdjęcie zostaje także bez zdjęcia: wiersz „Photo” jest na
// liście „CV elements” zawsze, a panel zdjęcia bez zdjęcia proponuje „Add photo” (#141) – także po usunięciu albo
// cofnięciu dodania zdjęcia.
export function selectionInDocument(selection: InspectorSelection, document: CvDocument): InspectorSelection {
  return selection?.kind === 'section' && !findSection(document, selection.id) ? null : selection
}

export const sameSelection = (a: InspectorSelection, b: InspectorSelection) =>
  a === b || (a !== null && b !== null && elementKey(a) === elementKey(b))
