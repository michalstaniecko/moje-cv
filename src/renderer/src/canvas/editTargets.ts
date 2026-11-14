import type { CvDocument, Section } from '../domain/schema'

// Edycja na stronach CV (ADR-0009, docs/specs/inline-editing-redesign.md, Q6, Q21): co edytuje Edit card otwarta przy
// danym fragmencie strony. Czyste funkcje – bez DOM – żeby mapowanie bloków na części CV było testowalne w Node.

export type ExperienceField = 'role' | 'company' | 'location' | 'start' | 'end'
export type EducationField = 'level' | 'field' | 'institution' | 'start' | 'end'

// Część CV, którą edytuje jedna Edit card, z opcjonalnym polem, na które trafia fokus (kliknięte miejsce).
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

// Kontrakt znaczników edycji: klasy, których używają wszystkie szablony (wspólny markup w CvBlockView i nadpisania
// bloków). Z nich warstwa edycji dzieli nagłówek na fragmenty i rozpoznaje kliknięte pole. Brak klasy w nowym szablonie
// kosztuje tylko wygodę (fokus na pierwszym polu karty, nagłówek jako jeden fragment), nigdy treść.
// `contact` – dzieci elementu to kolejne kontakty; `item` – punkt stanowiska albo element wiersza listy.
export const editMarkupContract = {
  name: '.cv-name',
  photo: '.cv-photo',
  contact: '.cv-contact',
  summary: '.cv-summary',
  sectionTitle: '.cv-section-title',
  role: '.cv-role',
  company: '.cv-company',
  date: '.cv-date',
  educationLevel: '.cv-education-level',
  item: 'li'
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

// Fragment strony: część CV edytowana jedną kartą (wpis razem z punktami, sekcja listowa ze wszystkimi wierszami).
// Klucz nie zależy od pola ani punktu, więc karta trzyma się fragmentu po każdym podziale stron.
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

// Cel fragmentu bez pola i punktu – to, co otwiera klawiatura (fokus na pierwszym polu karty).
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

const isFilled = (text: string) => text.trim() !== ''

// Identyfikatory bloków niosą źródło (domain/blocks.ts): `header`, `<sekcja>:title`, `<wpis>`, `<wpis>:<punkt>` i
// `<sekcja>:<pierwszy element wiersza>`. Blok nagłówka bez klas kontraktu to w całości imię i nazwisko.
// Blok spoza dokumentu (np. układ sprzed ponownego podziału stron) – null.
export function blockTarget(blockId: string, document: CvDocument): EditTarget | null {
  if (blockId === 'header') return { kind: 'fullName' }
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

// Miejsce kliknięcia na stronie: najbliższa klasa kontraktu nad klikniętym elementem i numer dziecka (n-ty kontakt
// w `.cv-contact`, n-ty `li` w punktach lub wierszu listy). `part: null` – kliknięto poza klasami kontraktu.
export type ContractHit = { part: ContractPart | null; index: number }

// Cel klikniętego miejsca bloku `blockId`: cel bloku uzupełniony o pole (fokus karty) według kontraktu znaczników.
// Brak dopasowania – cel bloku bez pola (fokus na pierwszym polu karty).
export function hitTarget(blockId: string, hit: ContractHit, document: CvDocument): EditTarget | null {
  const target = blockTarget(blockId, document)
  if (!target) return null
  switch (target.kind) {
    case 'fullName': {
      // Blok nagłówka: część według klasy kontraktu.
      if (hit.part === 'photo' || hit.part === 'name' || hit.part === 'summary') return headerPartTarget(hit.part)
      if (hit.part === 'contact') {
        const contacts = document.header.contacts.filter((contact) => isFilled(contact.value))
        const contact = contacts[hit.index]
        return contact ? { kind: 'contacts', contactId: contact.id } : { kind: 'contacts' }
      }
      return target
    }
    case 'experienceItem': {
      if (hit.part === 'role') return { ...target, field: 'role' }
      if (hit.part === 'company') return { ...target, field: 'company' }
      if (hit.part === 'date') return { ...target, field: 'start' }
      // Punkt w bloku wpisu to pierwszy niepusty punkt; kolejne punkty mają własne bloki (z `bulletId`).
      if (hit.part === 'item' && !target.bulletId) {
        const item = findItem(document, target.itemId)
        const first = item && 'bullets' in item ? item.bullets.find((bullet) => isFilled(bullet.text)) : undefined
        return first ? { ...target, bulletId: first.id } : target
      }
      return target
    }
    case 'educationItem':
      if (hit.part === 'educationLevel') return { ...target, field: 'level' }
      if (hit.part === 'date') return { ...target, field: 'start' }
      return target
    case 'listSection': {
      // Tytuł obok listy (`listSectionLayout.title: 'beside'`) leży w pierwszym wierszu listy.
      if (hit.part === 'sectionTitle') return { kind: 'sectionTitle', sectionId: target.sectionId }
      if (hit.part !== 'item') return target
      const section = document.sections.find((candidate) => candidate.id === target.sectionId)
      const items = section?.type === 'list' ? section.items.filter((item) => isFilled(item.text)) : []
      const firstOfRow = items.findIndex((item) => `${target.sectionId}:${item.id}` === blockId)
      const item = items[firstOfRow + hit.index]
      return firstOfRow === -1 || !item ? target : { ...target, itemId: item.id }
    }
    default:
      return target
  }
}

// Czy część CV, którą edytuje karta, nadal istnieje (sprawdzane po każdej zmianie dokumentu, także cofnij/ponów).
// Nagłówek i klauzula zgody istnieją zawsze – nawet gdy ich fragment zniknął ze strony (np. wyczyszczone imię), karta
// zostaje otwarta. Zniknięcie punktu, kontaktu czy elementu listy nie zamyka karty całego wpisu, kontaktów czy listy.
export function targetExists(target: EditTarget, document: CvDocument): boolean {
  switch (target.kind) {
    case 'sectionTitle':
    case 'listSection':
      return document.sections.some((section) => section.id === target.sectionId)
    case 'experienceItem':
    case 'educationItem':
      return document.sections.some(
        (section) =>
          section.id === target.sectionId &&
          section.type === (target.kind === 'experienceItem' ? 'experience' : 'education') &&
          section.items.some((item) => item.id === target.itemId)
      )
    default:
      return true
  }
}
