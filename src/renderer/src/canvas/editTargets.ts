import type { CvDocument, Section } from '../domain/schema'

// Edycja na stronach CV (ADR-0009, ADR-0010): części CV, które pokazują fragmenty stron – dla obrysów, uchwytów menu,
// pigułek „+” i wejść stawiających kursor w części CV (`session.focusPart`). Czyste funkcje – bez DOM – żeby mapowanie
// bloków na części CV było testowalne w Node.

export type ExperienceField = 'role' | 'company' | 'location' | 'start' | 'end'
export type EducationField = 'level' | 'field' | 'institution' | 'start' | 'end'

// Część CV (fragment strony) z opcjonalnym polem, w którym ma stanąć kursor.
export type EditTarget =
  | { kind: 'fullName' }
  | { kind: 'photo' }
  | { kind: 'contacts'; contactId?: string }
  | { kind: 'summary' }
  | { kind: 'sectionTitle'; sectionId: string }
  | { kind: 'experienceItem'; sectionId: string; itemId: string; field?: ExperienceField; bulletId?: string }
  | { kind: 'educationItem'; sectionId: string; itemId: string; field?: EducationField }
  | { kind: 'listSection'; sectionId: string; itemId?: string }
  | { kind: 'consent' }

// Kontrakt znaczników edycji: klasy, których używają szablony (wspólny markup w CvBlockView i nadpisania bloków) poza
// slotami tekstu pól (template/editable.tsx, ADR-0010). Z nich warstwa edycji dzieli nagłówek na fragmenty (uchwyt
// kontaktów, przycisk zdjęcia), dzieli wiersz listy na tytuł obok i elementy, znajduje datę wpisu (⚠ odwróconych dat,
// klik obok żetonu) i klauzulę zgody. Wszystkie trzy szablony mają każdą klasę; brak klasy w nowym szablonie kosztuje
// tylko wygodę (np. nagłówek jako jeden fragment bez uchwytu kontaktów), nigdy treść – tekst edytują sloty.
// `contact` – dzieci elementu to kolejne kontakty; `item` – element wiersza listy; `consent` – klauzula zgody na dole
// ostatniej strony (rysuje ją wspólny `CvPages`, nie szablon i nie jako blok).
export const editMarkupContract = {
  name: '.cv-name',
  photo: '.cv-photo',
  contact: '.cv-contact',
  summary: '.cv-summary',
  sectionTitle: '.cv-section-title',
  date: '.cv-date',
  item: 'li',
  consent: '.cv-consent'
} as const
export type ContractPart = keyof typeof editMarkupContract

// Części nagłówka, na które warstwa dzieli blok `header` (w kolejności dokumentu ustala ją położenie na stronie).
export const headerParts = ['photo', 'name', 'contact', 'summary'] as const satisfies readonly ContractPart[]

const headerPartTargets: Record<(typeof headerParts)[number], EditTarget> = {
  photo: { kind: 'photo' },
  name: { kind: 'fullName' },
  contact: { kind: 'contacts' },
  summary: { kind: 'summary' }
}

export const headerPartTarget = (part: (typeof headerParts)[number]): EditTarget => headerPartTargets[part]

// Fragment strony: jedna część CV (wpis razem z punktami, sekcja listowa ze wszystkimi wierszami). Klucz nie zależy od
// pola ani punktu, więc uchwyt i obrys trzymają się fragmentu po każdym podziale stron.
export function fragmentKey(target: EditTarget): string {
  switch (target.kind) {
    case 'sectionTitle':
      return `sectionTitle:${target.sectionId}`
    case 'experienceItem':
    case 'educationItem':
      return `item:${target.itemId}`
    case 'listSection':
      return `list:${target.sectionId}`
    default:
      return target.kind
  }
}

// Sekcja CV, do której należy część (tytuł sekcji, wpis, sekcja listowa); nagłówek i klauzula zgody – null.
export const sectionOf = (target: EditTarget): string | null => ('sectionId' in target ? target.sectionId : null)

// Cel fragmentu bez pola i punktu.
export function fragmentTarget(target: EditTarget): EditTarget {
  switch (target.kind) {
    case 'contacts':
      return { kind: 'contacts' }
    case 'experienceItem':
    case 'educationItem':
      return { kind: target.kind, sectionId: target.sectionId, itemId: target.itemId }
    case 'listSection':
      return { kind: 'listSection', sectionId: target.sectionId }
    default:
      return target
  }
}

// Klauzula zgody nie jest blokiem dokumentu (nie ma `data-block-id`); warstwa edycji mierzy ją pod tym umownym id,
// którego nie ma żaden blok (id bloków nie zaczynają się od „#”).
export const CONSENT_BLOCK_ID = '#consent'

// Identyfikatory bloków niosą źródło (domain/blocks.ts): `header`, `<sekcja>:title`, `<wpis>`, `<wpis>:<punkt>` i
// `<sekcja>:<pierwszy element wiersza>`. Blok nagłówka bez klas kontraktu to w całości imię i nazwisko.
// Blok spoza dokumentu (np. układ sprzed ponownego podziału stron) – null.
export function blockTarget(blockId: string, document: CvDocument): EditTarget | null {
  if (blockId === 'header') return { kind: 'fullName' }
  if (blockId === CONSENT_BLOCK_ID) return { kind: 'consent' }
  const separator = blockId.indexOf(':')
  if (separator === -1) return itemTarget(blockId, document)

  const [first, rest] = [blockId.slice(0, separator), blockId.slice(separator + 1)]
  const section = document.sections.find((candidate) => candidate.id === first)
  if (section) {
    if (rest === 'title') return { kind: 'sectionTitle', sectionId: section.id }
    if (section.type === 'list' && section.items.some((item) => item.id === rest)) {
      return { kind: 'listSection', sectionId: section.id }
    }
    return null
  }
  const entry = itemTarget(first, document)
  if (entry?.kind !== 'experienceItem') return null
  const item = findItem(document, entry.itemId)
  return item && 'bullets' in item && item.bullets.some((bullet) => bullet.id === rest) ? { ...entry, bulletId: rest } : null
}

function itemTarget(itemId: string, document: CvDocument): EditTarget | null {
  for (const section of document.sections) {
    if (section.type === 'list' || !section.items.some((item) => item.id === itemId)) continue
    return { kind: section.type === 'experience' ? 'experienceItem' : 'educationItem', sectionId: section.id, itemId }
  }
  return null
}

function findItem(document: CvDocument, itemId: string) {
  for (const section of document.sections) {
    const item = (section.items as Section['items'][number][]).find((candidate) => candidate.id === itemId)
    if (item) return item
  }
  return null
}
