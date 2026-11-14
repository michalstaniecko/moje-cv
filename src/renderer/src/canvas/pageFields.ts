import type { Dictionary } from '../../../shared/i18n/en'
import { generateBlocks, type CvBlock, type Reveal } from '../domain/blocks'
import { formatYearMonth, isEndBeforeStart } from '../domain/dates'
import type { CvDocument, EducationItem, ExperienceItem, Section, TextItem, YearMonth } from '../domain/schema'
import {
  insertContactAfter,
  mergeBulletIntoPrevious,
  mergeListItemIntoPrevious,
  moveBullet,
  moveItem,
  pasteIntoBullet,
  pasteIntoListItem,
  removeBullet,
  removeContact,
  removeListItem,
  splitBullet,
  splitListItem,
  textPaste,
  textSplit,
  updateBullet,
  updateConsent,
  updateContact,
  updateEducationItem,
  updateExperienceItem,
  updateHeader,
  updateListItem,
  updateSection,
  type Change
} from '../editor/documentEdits'
import { educationName, entryName } from '../editor/fields/entryNames'
import { dictionaryFor } from '../../../shared/i18n/languages'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { MoveOffset } from '../editor/moveShortcut'
import type { EditableField, SlotName } from '../template/editable'
import { templates } from '../template/templates'
import { moveAmongShown } from './blockMoves'
import { blockTarget, type EditTarget } from './editTargets'
import type { TextSelection } from './pageFieldInput'

// Mapa Page fields (docs/specs/wysiwyg-editing.md, W4, W9, W11, W19): które pole CV rysuje slot szablonu, jak się
// nazywa, co pokazuje puste, jak jego nowa wartość zmienia dokument i co z nim robią Enter, Backspace, Delete, wklejenie
// wielu linii i ⌥⇧↑/↓. Czyste funkcje – bez DOM.
// Klucz pola = klucz łączenia kroków cofania pola CV form (te same kroki cofania na stronie i w formularzu)
// = `data-field-key` na stronie: `header:fullName`, `header:summary`, `section:<sekcja>:title`,
// `experience:<wpis>:role|company|location`, `experience:<wpis>:bullet:<punkt>`, `education:<wpis>:level|field|institution`,
// `list:<element>:text`, `contact:<kontakt>:label|value`, `consent:text`; żetony dat (W12):
// `experience|education:<wpis>:start|end`. Fragment pola (aktywny fragment, `reveal`) – klucz fragmentu warstwy edycji
// (`fragmentKey`): `fullName`, `summary`, `contacts` (wszystkie kontakty), `sectionTitle:<sekcja>`, `item:<wpis>` (wpis
// z punktami), `list:<sekcja>`, `consent`.

type ExperienceText = 'role' | 'company' | 'location'
type EducationText = 'level' | 'field' | 'institution'
type ContactText = 'label' | 'value'
export type DateField = 'start' | 'end'
type Contact = CvDocument['header']['contacts'][number]

// Pole CV wskazane kluczem, rozwiązane w dokumencie (z sekcją, w której leży).
type FieldRef =
  | { kind: 'fullName' }
  | { kind: 'summary' }
  | { kind: 'contact'; contact: Contact; index: number; field: ContactText }
  | { kind: 'consent' }
  | { kind: 'title'; section: Section }
  | { kind: 'experience'; sectionId: string; item: ExperienceItem; field: ExperienceText }
  | { kind: 'bullet'; sectionId: string; item: ExperienceItem; index: number }
  | { kind: 'education'; sectionId: string; item: EducationItem; field: EducationText }
  | { kind: 'listItem'; section: Extract<Section, { type: 'list' }>; index: number }
  | { kind: 'date'; sectionId: string; entry: Entry; field: DateField }

// Wpis z datami – stanowisko albo wykształcenie.
type Entry = { type: 'experience'; item: ExperienceItem } | { type: 'education'; item: EducationItem }

const fullNameKey = 'header:fullName'
const consentKey = 'consent:text'
const summaryKey = 'header:summary'
const contactKey = (contactId: string, field: ContactText) => `contact:${contactId}:${field}`
const titleKey = (sectionId: string) => `section:${sectionId}:title`
const experienceKey = (itemId: string, field: ExperienceText) => `experience:${itemId}:${field}`
const bulletKey = (itemId: string, bulletId: string) => `experience:${itemId}:bullet:${bulletId}`
const educationKey = (itemId: string, field: EducationText) => `education:${itemId}:${field}`
const listItemKey = (itemId: string) => `list:${itemId}:text`
const dateKey = (entry: Entry['type'], itemId: string, field: DateField) => `${entry}:${itemId}:${field}`

const isFilled = (text: string) => text.trim() !== ''

function keyOf(ref: FieldRef): string {
  switch (ref.kind) {
    case 'fullName':
      return fullNameKey
    case 'summary':
      return summaryKey
    case 'contact':
      return contactKey(ref.contact.id, ref.field)
    case 'consent':
      return consentKey
    case 'title':
      return titleKey(ref.section.id)
    case 'experience':
      return experienceKey(ref.item.id, ref.field)
    case 'bullet':
      return bulletKey(ref.item.id, ref.item.bullets[ref.index]!.id)
    case 'education':
      return educationKey(ref.item.id, ref.field)
    case 'listItem':
      return listItemKey(ref.section.items[ref.index]!.id)
    case 'date':
      return dateKey(ref.entry.type, ref.entry.item.id, ref.field)
  }
}

function fragmentOf(ref: FieldRef): string {
  switch (ref.kind) {
    case 'fullName':
    case 'summary':
    case 'consent':
      return ref.kind
    case 'contact':
      return 'contacts'
    case 'title':
      return `sectionTitle:${ref.section.id}`
    case 'listItem':
      return `list:${ref.section.id}`
    case 'date':
      return `item:${ref.entry.item.id}`
    default:
      return `item:${ref.item.id}`
  }
}

function valueOf(ref: FieldRef, document: CvDocument): string {
  switch (ref.kind) {
    case 'fullName':
      return document.header.fullName
    case 'summary':
      return document.header.summary
    case 'contact':
      return ref.contact[ref.field]
    case 'consent':
      return document.consent.text
    case 'title':
      return ref.section.title
    case 'experience':
      return ref.item[ref.field]
    case 'bullet':
      return ref.item.bullets[ref.index]!.text
    case 'education':
      return ref.item[ref.field]
    case 'listItem':
      return ref.section.items[ref.index]!.text
    case 'date':
      return dateText(ref.entry.item[ref.field], document)
  }
}

// Napis daty na stronie: „MM.RRRR”, „present” w CV language (jak `formatDateRange`), pusta data – pusty napis.
const dateText = (date: YearMonth | 'present' | null, document: CvDocument) =>
  date === null ? '' : date === 'present' ? dictionaryFor(document.settings.language).cvText.present : formatYearMonth(date)

function findEntry(document: CvDocument, itemId: string) {
  for (const section of document.sections) {
    if (section.type === 'experience') {
      const item = section.items.find((candidate) => candidate.id === itemId)
      if (item) return { sectionId: section.id, type: 'experience' as const, item }
    } else if (section.type === 'education') {
      const item = section.items.find((candidate) => candidate.id === itemId)
      if (item) return { sectionId: section.id, type: 'education' as const, item }
    }
  }
  return null
}

function findContact(document: CvDocument, contactId: string, field: ContactText): FieldRef | null {
  const index = document.header.contacts.findIndex((contact) => contact.id === contactId)
  return index === -1 ? null : { kind: 'contact', contact: document.header.contacts[index]!, index, field }
}

function findListItem(document: CvDocument, itemId: string): FieldRef | null {
  for (const section of document.sections) {
    if (section.type !== 'list') continue
    const index = section.items.findIndex((item) => item.id === itemId)
    if (index !== -1) return { kind: 'listItem', section, index }
  }
  return null
}

// Pole o kluczu `key` w dokumencie (null – nieznany klucz albo pola już nie ma, np. po cofnięciu podziału).
function refOf(key: string, document: CvDocument): FieldRef | null {
  if (key === fullNameKey) return { kind: 'fullName' }
  if (key === summaryKey) return { kind: 'summary' }
  if (key === consentKey) return { kind: 'consent' }
  const contact = /^contact:(.+):(label|value)$/.exec(key)
  if (contact) return findContact(document, contact[1]!, contact[2] as ContactText)
  const title = /^section:(.+):title$/.exec(key)
  if (title) {
    const section = document.sections.find((candidate) => candidate.id === title[1])
    return section ? { kind: 'title', section } : null
  }
  const list = /^list:(.+):text$/.exec(key)
  if (list) return findListItem(document, list[1]!)
  const bullet = /^experience:(.+?):bullet:(.+)$/.exec(key)
  if (bullet) {
    const entry = findEntry(document, bullet[1]!)
    if (entry?.type !== 'experience') return null
    const index = entry.item.bullets.findIndex((candidate) => candidate.id === bullet[2])
    return index === -1 ? null : { kind: 'bullet', sectionId: entry.sectionId, item: entry.item, index }
  }
  const experience = /^experience:(.+):(role|company|location)$/.exec(key)
  if (experience) {
    const entry = findEntry(document, experience[1]!)
    return entry?.type === 'experience'
      ? { kind: 'experience', sectionId: entry.sectionId, item: entry.item, field: experience[2] as ExperienceText }
      : null
  }
  const education = /^education:(.+):(level|field|institution)$/.exec(key)
  if (education) {
    const entry = findEntry(document, education[1]!)
    return entry?.type === 'education'
      ? { kind: 'education', sectionId: entry.sectionId, item: entry.item, field: education[2] as EducationText }
      : null
  }
  const date = /^(experience|education):(.+):(start|end)$/.exec(key)
  if (date) {
    const entry = findEntry(document, date[2]!)
    return entry && entry.type === date[1] ? { kind: 'date', sectionId: entry.sectionId, entry, field: date[3] as DateField } : null
  }
  return null
}

// Klucz Page field (albo żetonu daty) części CV edytowanej na stronie (fokus z Outline, „Add to CV”, menu) albo null –
// część bez pola (zdjęcie). Wpis bez wskazanego pola (np. nowy wpis) – jego pierwsze pole tekstu: stanowisko albo poziom
// wykształcenia (pusty wpis jest odsłaniany z placeholderami). Sekcja listowa bez wskazanego
// elementu – jej pierwszy element; kontakt – jego pierwsze puste pole, a wypełniony – wartość; bez wskazanego kontaktu –
// pierwszy (gdy podano dokument).
export function pageFieldKey(target: EditTarget, document?: CvDocument): string | null {
  switch (target.kind) {
    case 'fullName':
      return fullNameKey
    case 'summary':
      return summaryKey
    case 'contacts': {
      const contacts = document?.header.contacts ?? []
      const contact = target.contactId === undefined ? contacts[0] : contacts.find((candidate) => candidate.id === target.contactId)
      if (!contact) return null
      return contactKey(contact.id, isFilled(contact.label) ? 'value' : 'label')
    }
    case 'consent':
      return consentKey
    case 'sectionTitle':
      return titleKey(target.sectionId)
    case 'experienceItem':
      if (target.bulletId) return bulletKey(target.itemId, target.bulletId)
      if (target.field === 'start' || target.field === 'end') return dateKey('experience', target.itemId, target.field)
      return experienceKey(target.itemId, target.field ?? 'role')
    case 'educationItem':
      if (target.field === 'start' || target.field === 'end') return dateKey('education', target.itemId, target.field)
      return educationKey(target.itemId, target.field ?? 'level')
    case 'listSection': {
      if (target.itemId) return listItemKey(target.itemId)
      const section = document?.sections.find((candidate) => candidate.id === target.sectionId)
      const first = section?.type === 'list' ? section.items[0] : undefined
      return first ? listItemKey(first.id) : null
    }
    default:
      return null
  }
}

// Część CV pola o kluczu `key` (odwrotność `pageFieldKey`) albo null.
export function pageFieldTarget(key: string, document: CvDocument): EditTarget | null {
  const ref = refOf(key, document)
  switch (ref?.kind) {
    case 'fullName':
      return { kind: 'fullName' }
    case 'summary':
      return { kind: 'summary' }
    case 'contact':
      return { kind: 'contacts', contactId: ref.contact.id }
    case 'consent':
      return { kind: 'consent' }
    case 'title':
      return { kind: 'sectionTitle', sectionId: ref.section.id }
    case 'experience':
      return { kind: 'experienceItem', sectionId: ref.sectionId, itemId: ref.item.id, field: ref.field }
    case 'bullet':
      return { kind: 'experienceItem', sectionId: ref.sectionId, itemId: ref.item.id, bulletId: ref.item.bullets[ref.index]!.id }
    case 'education':
      return { kind: 'educationItem', sectionId: ref.sectionId, itemId: ref.item.id, field: ref.field }
    case 'listItem':
      return { kind: 'listSection', sectionId: ref.section.id, itemId: ref.section.items[ref.index]!.id }
    case 'date':
      return { kind: ref.entry.type === 'experience' ? 'experienceItem' : 'educationItem', sectionId: ref.sectionId, itemId: ref.entry.item.id, field: ref.field }
    default:
      return null
  }
}

// Nazwa pola dla czytnika ekranu i placeholder pustego pola. Pola wpisów i list: „<pole> – <część CV>” (np. „Company –
// Position “Buyer””), bo każde stanowisko ma swoją firmę; placeholder – sama nazwa pola.
function describe(ref: FieldRef, t: Dictionary['editor']): Pick<EditableField, 'label' | 'placeholder' | 'spellcheck'> {
  const inPart = (name: string, part: string) => ({ label: `${name} – ${part}`, placeholder: name, spellcheck: true })
  switch (ref.kind) {
    case 'fullName':
      return { label: t.fullName, placeholder: t.fullName, spellcheck: false }
    case 'summary':
      return { label: t.summary, placeholder: t.summary, spellcheck: true }
    case 'contact':
      return ref.field === 'label'
        ? { label: t.contactLabel(ref.index + 1), placeholder: t.contactLabelPlaceholder, spellcheck: false }
        : { label: t.contactValue(ref.index + 1), placeholder: t.contactValuePlaceholder, spellcheck: false }
    case 'consent':
      return { label: t.consent.title, placeholder: t.consent.title, spellcheck: true }
    case 'title':
      return { label: t.sectionTitle(sectionName(ref.section, t)), placeholder: t.sectionTypes[ref.section.type], spellcheck: true }
    case 'experience':
      return inPart(t[ref.field], t.part.position(entryName(ref.item.role, t.newPosition)))
    case 'bullet':
      return inPart(t.bullet(ref.index + 1), t.part.position(entryName(ref.item.role, t.newPosition)))
    case 'education':
      return inPart(t[ref.field], t.part.education(educationName(ref.item, t)))
    case 'listItem':
      return inPart(t.listItem(ref.index + 1), t.part.list(sectionName(ref.section, t)))
    case 'date': {
      const { entry, field } = ref
      const name = dateName(dateKey(entry.type, entry.item.id, field), t)!
      const part = entry.type === 'experience' ? t.part.position(entryName(entry.item.role, t.newPosition)) : t.part.education(educationName(entry.item, t))
      return { label: `${name} – ${part}`, placeholder: field === 'start' ? t.from : t.to, spellcheck: false }
    }
  }
}

// Pole (albo żeton daty) o kluczu `key` w dokumencie – np. nazwa żetonu dla jego Field popover; null – nie ma go.
export const pageFieldByKey = (key: string, document: CvDocument, t: Dictionary['editor']): EditableField | null =>
  field(refOf(key, document), document, t)

// Krótka nazwa daty wpisu (etykieta pola w Field popover daty, jak w CV form) albo null – to nie żeton daty.
export function dateName(key: string, t: Dictionary['editor']): string | null {
  const date = /^(experience|education):.+:(start|end)$/.exec(key)
  if (!date) return null
  if (date[1] === 'experience') return date[2] === 'start' ? t.from : t.to
  return date[2] === 'start' ? t.startOptional : t.graduation
}

// Czy żeton `key` to koniec stanowiska (ma „Obecnie tu pracuję”).
export const isPositionEnd = (key: string) => /^experience:.+:end$/.test(key)

// Daty wpisu żetonu `key` (null – to nie żeton daty albo wpisu już nie ma).
export function entryDates(key: string, document: CvDocument): { start: YearMonth | null; end: YearMonth | 'present' | null } | null {
  const ref = refOf(key, document)
  return ref?.kind === 'date' ? { start: ref.entry.item.start, end: ref.entry.item.end } : null
}

// Id opisu odwróconych dat wpisu (ostrzeżenie w warstwie edycji, W12) – `aria-describedby` jego żetonów.
export const dateWarningId = (itemId: string) => `date-warning-${itemId}`

function field(ref: FieldRef | null, document: CvDocument, t: Dictionary['editor']): EditableField | null {
  if (!ref) return null
  const described = ref.kind === 'date' && isEndBeforeStart(ref.entry.item.start, ref.entry.item.end) ? { describedBy: dateWarningId(ref.entry.item.id) } : {}
  return { key: keyOf(ref), fragment: fragmentOf(ref), value: valueOf(ref, document), ...describe(ref, t), ...described }
}

// Pole tekstu klauzuli zgody (rysuje ją `CvPages` pod blokami ostatniej strony) albo null – klauzula wyłączona.
export const consentFieldOf = (document: CvDocument, t: Dictionary['editor']): EditableField | null =>
  document.consent.enabled ? field({ kind: 'consent' }, document, t) : null

// Elementy, które pokazuje fragment: w odsłoniętym wszystkie, w pozostałych – niepuste (jak domain/blocks.ts).
const shownItems = <T extends { text: string }>(items: T[], revealed: boolean) => (revealed ? items : items.filter((item) => isFilled(item.text)))

const experienceSlots: Partial<Record<SlotName, ExperienceText>> = { role: 'role', company: 'company', location: 'location' }
const educationSlots: Partial<Record<SlotName, EducationText>> = { level: 'level', field: 'field', institution: 'institution' }

const noReveal: Reveal = new Set()

// Pole CV, którego tekst rysuje slot `slot` bloku `block` (id bloku rozwiązane w bieżącym dokumencie, jak w
// editTargets.ts), `part` – id elementu wiersza listy. Tytuł w wierszu listy – tylko w pierwszym wierszu sekcji (tam
// szablon z tytułem obok listy go rysuje); punkt w bloku wpisu – pierwszy punkt na stronie (`reveal` – odsłonięte
// fragmenty, w nich na stronie są też puste punkty i elementy).
export function pageFieldOf(
  block: CvBlock,
  slot: SlotName,
  document: CvDocument,
  t: Dictionary['editor'],
  reveal: Reveal = noReveal,
  part?: string
): EditableField | null {
  if (block.kind === 'header') {
    if (slot === 'fullName') return field({ kind: 'fullName' }, document, t)
    if (slot === 'summary') return field({ kind: 'summary' }, document, t)
    const contactField = slot === 'contactLabel' ? 'label' : slot === 'contactValue' ? 'value' : null
    if (contactField && part !== undefined && block.contacts.some((contact) => contact.id === part)) {
      return field(findContact(document, part, contactField), document, t)
    }
    return null
  }
  const target = blockTarget(block.id, document)
  if (!target) return null
  if (slot === 'title') {
    if (block.kind !== 'sectionTitle' && block.kind !== 'listRow') return null
    if (target.kind !== 'sectionTitle' && target.kind !== 'listSection') return null
    const section = document.sections.find((candidate) => candidate.id === target.sectionId)
    if (!section) return null
    if (block.kind === 'listRow') {
      const first = section.type === 'list' ? shownItems(section.items, reveal.has(`list:${section.id}`))[0] : undefined
      if (!first || block.id !== `${section.id}:${first.id}`) return null
    }
    return field({ kind: 'title', section }, document, t)
  }
  if (slot === 'item') {
    if (block.kind !== 'listRow' || part === undefined || !block.items.some((item) => item.id === part)) return null
    return field(findListItem(document, part), document, t)
  }
  if (target.kind !== 'experienceItem' && target.kind !== 'educationItem') return null
  const entry = findEntry(document, target.itemId)
  if (!entry) return null
  if (slot === 'start' || slot === 'end') {
    if (block.kind !== 'experienceEntry' && block.kind !== 'educationEntry') return null
    return field({ kind: 'date', sectionId: entry.sectionId, entry, field: slot }, document, t)
  }
  if (entry.type === 'experience') {
    if (slot === 'bullet') {
      const { bullets } = entry.item
      const bulletId =
        block.kind === 'experienceBullet' && target.kind === 'experienceItem'
          ? target.bulletId
          : block.kind === 'experienceEntry'
            ? shownItems(bullets, reveal.has(`item:${entry.item.id}`))[0]?.id
            : undefined
      const index = bullets.findIndex((bullet) => bullet.id === bulletId)
      return index === -1 ? null : field({ kind: 'bullet', sectionId: entry.sectionId, item: entry.item, index }, document, t)
    }
    const name = experienceSlots[slot]
    return name && block.kind === 'experienceEntry'
      ? field({ kind: 'experience', sectionId: entry.sectionId, item: entry.item, field: name }, document, t)
      : null
  }
  const name = educationSlots[slot]
  return name && block.kind === 'educationEntry'
    ? field({ kind: 'education', sectionId: entry.sectionId, item: entry.item, field: name }, document, t)
    : null
}

// Zmiana dokumentu po nowej dacie żetonu `key` (data początku – miesiąc albo nic; koniec stanowiska także „present”).
// Inne pole – bez zmian.
export function dateChange(key: string, value: YearMonth | 'present' | null): Change<CvDocument> {
  return (document) => {
    const ref = refOf(key, document)
    if (ref?.kind !== 'date' || (value === 'present' && (ref.field !== 'end' || ref.entry.type !== 'experience'))) return document
    if (ref.entry.type === 'experience') {
      return updateExperienceItem(ref.sectionId, ref.entry.item.id, (item) => ({ ...item, [ref.field]: value }))(document)
    }
    return updateEducationItem(ref.sectionId, ref.entry.item.id, { [ref.field]: value })(document)
  }
}

// Zmiana dokumentu po nowej wartości pola `key` (nieznane pole – bez zmian).
export function fieldChange(key: string, value: string): Change<CvDocument> {
  return (document) => {
    const ref = refOf(key, document)
    switch (ref?.kind) {
      case 'fullName':
        return updateHeader({ fullName: value })(document)
      case 'summary':
        return updateHeader({ summary: value })(document)
      case 'contact':
        return updateContact(ref.contact.id, { [ref.field]: value })(document)
      case 'consent':
        return updateConsent({ text: value })(document)
      case 'title':
        return updateSection(ref.section.id, { title: value })(document)
      case 'experience':
        return updateExperienceItem(ref.sectionId, ref.item.id, (item) => ({ ...item, [ref.field]: value }))(document)
      case 'bullet':
        return updateBullet(ref.sectionId, ref.item.id, ref.item.bullets[ref.index]!.id, value)(document)
      case 'education':
        return updateEducationItem(ref.sectionId, ref.item.id, { [ref.field]: value })(document)
      case 'listItem':
        return updateListItem(ref.section.id, ref.section.items[ref.index]!.id, value)(document)
      default:
        return document
    }
  }
}

// Czy fragment strony ma puste pole – tylko wtedy aktywny fragment trzeba odsłonić (W10, W23: odsłonięcie zmienia
// bloki i podział stron, więc wejście w wypełniony fragment nie kosztuje ponownego podziału). Pusta data wpisu też jest
// pustym polem (żeton z placeholderem).
export function fragmentHasEmptyField(fragment: string, document: CvDocument): boolean {
  if (fragment === 'fullName') return !isFilled(document.header.fullName)
  if (fragment === 'summary') return !isFilled(document.header.summary)
  if (fragment === 'consent') return document.consent.enabled && !isFilled(document.consent.text)
  if (fragment === 'contacts') return document.header.contacts.some((contact) => !isFilled(contact.label) || !isFilled(contact.value))
  const separator = fragment.indexOf(':')
  const [kind, id] = [fragment.slice(0, separator), fragment.slice(separator + 1)]
  if (kind === 'sectionTitle') {
    const section = document.sections.find((candidate) => candidate.id === id)
    return section !== undefined && !isFilled(section.title)
  }
  if (kind === 'item') {
    const entry = findEntry(document, id)
    if (!entry) return false
    if (entry.item.start === null || entry.item.end === null) return true
    if (entry.type === 'education') return [entry.item.level, entry.item.field, entry.item.institution].some((text) => !isFilled(text))
    const { role, company, location, bullets } = entry.item
    return [role, company, location, ...bullets.map((bullet) => bullet.text)].some((text) => !isFilled(text))
  }
  if (kind === 'list') {
    const section = document.sections.find((candidate) => candidate.id === id)
    return section?.type === 'list' && section.items.some((item) => !isFilled(item.text))
  }
  return false
}

// Czy fragment ma linie złączone z kilku pól („firma – miejscowość”, „poziom, kierunek, uczelnia”, w Classic „etykieta:
// wartość” kontaktu) – wpis i kontakty. Takie linie są osobnymi polami tylko w aktywnym fragmencie
// (template/editable.tsx, `PageEditing.expanded`).
export const fragmentHasJoinedFields = (fragment: string) => fragment.startsWith('item:') || fragment === 'contacts'

// ---------- Struktura z klawiatury (W6, W11) ----------

// Gdzie stawiamy kursor po zmianie struktury: pole i przesunięcie znaków w nim.
export type FieldFocus = { key: string; caret: number }
// Zmiana struktury (osobny krok cofania, bez klucza łączenia) i kursor po niej.
export type FieldEdit = { change: Change<CvDocument>; focus: FieldFocus }

// Punkt stanowiska albo element listy – pola, które Enter dzieli, a Backspace/Delete łączą.
type ListRef = Extract<FieldRef, { kind: 'bullet' | 'listItem' }>

function listRef(key: string, document: CvDocument): ListRef | null {
  const ref = refOf(key, document)
  return ref?.kind === 'bullet' || ref?.kind === 'listItem' ? ref : null
}

const listItems = (ref: ListRef): TextItem[] => (ref.kind === 'bullet' ? ref.item.bullets : ref.section.items)
const listKey = (ref: ListRef, itemId: string) => (ref.kind === 'bullet' ? bulletKey(ref.item.id, itemId) : listItemKey(itemId))
const mergeIntoPrevious = (ref: ListRef, itemId: string) =>
  ref.kind === 'bullet' ? mergeBulletIntoPrevious(ref.sectionId, ref.item.id, itemId) : mergeListItemIntoPrevious(ref.section.id, itemId)

// Czy pole to punkt albo element listy (Enter dzieli, wklejenie wielu linii tworzy kolejne elementy).
export const isListField = (key: string) => /^experience:.+?:bullet:.+$/.test(key) || /^list:.+:text$/.test(key)

// Czy Enter w polu zmienia strukturę (`splitField`): punkt, element listy, wartość kontaktu.
export const splitsOnEnter = (key: string) => isListField(key) || /^contact:.+:value$/.test(key)

// Enter: podział w miejscu kursora (zaznaczenie znika), kursor na początku nowego elementu; w pustym – nic. W wartości
// kontaktu – nowy, pusty kontakt za bieżącym, kursor w jego etykiecie (W11); w pustej wartości – nic.
export function splitField(key: string, document: CvDocument, selection: TextSelection, newItemId?: string): FieldEdit | null {
  const contact = refOf(key, document)
  if (contact?.kind === 'contact') {
    if (contact.field !== 'value' || !isFilled(contact.contact.value)) return null
    const id = newItemId ?? crypto.randomUUID()
    return { change: insertContactAfter(contact.contact.id, id), focus: { key: contactKey(id, 'label'), caret: 0 } }
  }
  const ref = listRef(key, document)
  if (!ref) return null
  const current = listItems(ref)[ref.index]!
  if (!isFilled(current.text)) return null
  const at = textSplit(Math.min(selection.start, selection.end), Math.max(selection.start, selection.end), newItemId)
  const change = ref.kind === 'bullet' ? splitBullet(ref.sectionId, ref.item.id, current.id, at) : splitListItem(ref.section.id, current.id, at)
  return { change, focus: { key: listKey(ref, at.newItemId), caret: 0 } }
}

// Backspace na początku: pusty element znika (kursor na końcu poprzedniego), niepusty dołącza do poprzedniego (kursor
// w miejscu złączenia); pierwszy – nic. Kontakt: pusty (etykieta i wartość) znika, kursor na końcu wartości poprzedniego.
export function mergeBackward(key: string, document: CvDocument): FieldEdit | null {
  const contact = refOf(key, document)
  if (contact?.kind === 'contact') {
    const previous = document.header.contacts[contact.index - 1]
    if (!previous || isFilled(contact.contact.label) || isFilled(contact.contact.value)) return null
    return { change: removeContact(contact.contact.id), focus: { key: contactKey(previous.id, 'value'), caret: previous.value.length } }
  }
  const ref = listRef(key, document)
  if (!ref || ref.index === 0) return null
  const items = listItems(ref)
  const [previous, current] = [items[ref.index - 1]!, items[ref.index]!]
  const focus = { key: listKey(ref, previous.id), caret: previous.text.length }
  if (isFilled(current.text)) return { change: mergeIntoPrevious(ref, current.id), focus }
  const change = ref.kind === 'bullet' ? removeBullet(ref.sectionId, ref.item.id, current.id) : removeListItem(ref.section.id, current.id)
  return { change, focus }
}

// Delete na końcu: następny element dołącza do bieżącego (kursor zostaje w miejscu złączenia); ostatni – nic.
export function mergeForward(key: string, document: CvDocument): FieldEdit | null {
  const ref = listRef(key, document)
  if (!ref) return null
  const items = listItems(ref)
  const next = items[ref.index + 1]
  if (!next) return null
  return { change: mergeIntoPrevious(ref, next.id), focus: { key, caret: items[ref.index]!.text.length } }
}

// Wklejenie wielu linii (`lines`, co najmniej dwie) w punkt albo element listy: kolejne elementy, kursor na końcu
// ostatniej wklejonej linii (W6). Inne pola albo jedna linia – null.
export function pasteLines(
  key: string,
  document: CvDocument,
  selection: TextSelection,
  lines: string[],
  newItemIds?: string[]
): FieldEdit | null {
  const ref = listRef(key, document)
  if (!ref || lines.length < 2) return null
  const paste = textPaste(Math.min(selection.start, selection.end), Math.max(selection.start, selection.end), lines, newItemIds)
  const id = listItems(ref)[ref.index]!.id
  const change = ref.kind === 'bullet' ? pasteIntoBullet(ref.sectionId, ref.item.id, id, paste) : pasteIntoListItem(ref.section.id, id, paste)
  return { change, focus: { key: listKey(ref, paste.newItemIds.at(-1)!), caret: lines.at(-1)!.length } }
}

// ⌥⇧↑/↓ w polu: punkt i element listy – o jedną pozycję w swojej liście; pole albo żeton daty wpisu – cały wpis wśród wpisów sekcji na
// stronach (jak „Przenieś wyżej/niżej” w menu uchwytu). Na krańcu albo w innym polu – null. Kursor zostaje w polu.
export function moveField(key: string, document: CvDocument, offset: MoveOffset): Change<CvDocument> | null {
  const ref = refOf(key, document)
  if (ref?.kind === 'bullet' || ref?.kind === 'listItem') {
    const to = ref.index + offset
    if (to < 0 || to >= listItems(ref).length) return null
    const id = listItems(ref)[ref.index]!.id
    return ref.kind === 'bullet' ? moveBullet(ref.sectionId, ref.item.id, id, to) : moveItem(ref.section.id, id, to)
  }
  if (ref?.kind !== 'experience' && ref?.kind !== 'education' && ref?.kind !== 'date') return null
  const itemId = ref.kind === 'date' ? ref.entry.item.id : ref.item.id
  const section = document.sections.find((candidate) => candidate.id === ref.sectionId)!
  const onPages = new Set(generateBlocks(document, templates[document.settings.template].geometry).map((block) => block.id))
  onPages.add(itemId)
  const plan = moveAmongShown(section.items.map((item) => item.id), onPages, itemId, offset)
  return plan ? moveItem(section.id, itemId, plan.toIndex) : null
}
