import type { Dictionary } from '../../../shared/i18n/en'
import { generateBlocks, type CvBlock, type Reveal } from '../domain/blocks'
import type { CvDocument, EducationItem, ExperienceItem, Section, TextItem } from '../domain/schema'
import {
  mergeBulletIntoPrevious,
  mergeListItemIntoPrevious,
  moveBullet,
  moveItem,
  pasteIntoBullet,
  pasteIntoListItem,
  removeBullet,
  removeListItem,
  splitBullet,
  splitListItem,
  textPaste,
  textSplit,
  updateBullet,
  updateEducationItem,
  updateExperienceItem,
  updateHeader,
  updateListItem,
  updateSection,
  type Change
} from '../editor/documentEdits'
import { educationName, entryName } from '../editor/fields/entryNames'
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
// `list:<element>:text`. Fragment pola (aktywny fragment, `reveal`) – klucz fragmentu warstwy edycji (`fragmentKey`):
// `fullName`, `summary`, `sectionTitle:<sekcja>`, `item:<wpis>` (wpis z punktami), `list:<sekcja>`.

// Części CV edytowane na stronie (ich fragmenty nie mają przycisku karty pod myszą). Wpisy mają jeszcze przycisk karty
// z klawiatury – dla dat, które do S3 zmienia się w karcie (klik w datę na stronie też ją otwiera).
export const pageFieldKinds: ReadonlySet<EditTarget['kind']> = new Set([
  'fullName',
  'summary',
  'sectionTitle',
  'experienceItem',
  'educationItem',
  'listSection'
])

type ExperienceText = 'role' | 'company' | 'location'
type EducationText = 'level' | 'field' | 'institution'

// Pole CV wskazane kluczem, rozwiązane w dokumencie (z sekcją, w której leży).
type FieldRef =
  | { kind: 'fullName' }
  | { kind: 'summary' }
  | { kind: 'title'; section: Section }
  | { kind: 'experience'; sectionId: string; item: ExperienceItem; field: ExperienceText }
  | { kind: 'bullet'; sectionId: string; item: ExperienceItem; index: number }
  | { kind: 'education'; sectionId: string; item: EducationItem; field: EducationText }
  | { kind: 'listItem'; section: Extract<Section, { type: 'list' }>; index: number }

const fullNameKey = 'header:fullName'
const summaryKey = 'header:summary'
const titleKey = (sectionId: string) => `section:${sectionId}:title`
const experienceKey = (itemId: string, field: ExperienceText) => `experience:${itemId}:${field}`
const bulletKey = (itemId: string, bulletId: string) => `experience:${itemId}:bullet:${bulletId}`
const educationKey = (itemId: string, field: EducationText) => `education:${itemId}:${field}`
const listItemKey = (itemId: string) => `list:${itemId}:text`

const isFilled = (text: string) => text.trim() !== ''

function keyOf(ref: FieldRef): string {
  switch (ref.kind) {
    case 'fullName':
      return fullNameKey
    case 'summary':
      return summaryKey
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
  }
}

function fragmentOf(ref: FieldRef): string {
  switch (ref.kind) {
    case 'fullName':
    case 'summary':
      return ref.kind
    case 'title':
      return `sectionTitle:${ref.section.id}`
    case 'listItem':
      return `list:${ref.section.id}`
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
  }
}

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
  return null
}

// Klucz Page field części CV edytowanej na stronie (fokus z Outline, „Add to CV”, menu) albo null – część bez pola
// albo z kartą (wpis bez wskazanego pola tekstowego: karta jego dat do S3). Sekcja listowa bez wskazanego elementu –
// jej pierwszy element (gdy podano dokument).
export function pageFieldKey(target: EditTarget, document?: CvDocument): string | null {
  switch (target.kind) {
    case 'fullName':
      return fullNameKey
    case 'summary':
      return summaryKey
    case 'sectionTitle':
      return titleKey(target.sectionId)
    case 'experienceItem':
      if (target.bulletId) return bulletKey(target.itemId, target.bulletId)
      return target.field === 'role' || target.field === 'company' || target.field === 'location'
        ? experienceKey(target.itemId, target.field)
        : null
    case 'educationItem':
      return target.field === 'level' || target.field === 'field' || target.field === 'institution'
        ? educationKey(target.itemId, target.field)
        : null
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
    case 'title':
      return { label: t.sectionTitle(sectionName(ref.section, t)), placeholder: t.sectionTypes[ref.section.type], spellcheck: true }
    case 'experience':
      return inPart(t[ref.field], t.card.position(entryName(ref.item.role, t.newPosition)))
    case 'bullet':
      return inPart(t.bullet(ref.index + 1), t.card.position(entryName(ref.item.role, t.newPosition)))
    case 'education':
      return inPart(t[ref.field], t.card.education(educationName(ref.item, t)))
    case 'listItem':
      return inPart(t.listItem(ref.index + 1), t.card.list(sectionName(ref.section, t)))
  }
}

function field(ref: FieldRef | null, document: CvDocument, t: Dictionary['editor']): EditableField | null {
  if (!ref) return null
  return { key: keyOf(ref), fragment: fragmentOf(ref), value: valueOf(ref, document), ...describe(ref, t) }
}

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

// Zmiana dokumentu po nowej wartości pola `key` (nieznane pole – bez zmian).
export function fieldChange(key: string, value: string): Change<CvDocument> {
  return (document) => {
    const ref = refOf(key, document)
    switch (ref?.kind) {
      case 'fullName':
        return updateHeader({ fullName: value })(document)
      case 'summary':
        return updateHeader({ summary: value })(document)
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
// bloki i podział stron, więc wejście w wypełniony fragment nie kosztuje ponownego podziału). Daty nie są tu polami
// (do S3 zmienia je karta wpisu).
export function fragmentHasEmptyField(fragment: string, document: CvDocument): boolean {
  if (fragment === 'fullName') return !isFilled(document.header.fullName)
  if (fragment === 'summary') return !isFilled(document.header.summary)
  const separator = fragment.indexOf(':')
  const [kind, id] = [fragment.slice(0, separator), fragment.slice(separator + 1)]
  if (kind === 'sectionTitle') {
    const section = document.sections.find((candidate) => candidate.id === id)
    return section !== undefined && !isFilled(section.title)
  }
  if (kind === 'item') {
    const entry = findEntry(document, id)
    if (!entry) return false
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

// Enter: podział w miejscu kursora (zaznaczenie znika), kursor na początku nowego elementu; w pustym – nic.
export function splitField(key: string, document: CvDocument, selection: TextSelection, newItemId?: string): FieldEdit | null {
  const ref = listRef(key, document)
  if (!ref) return null
  const current = listItems(ref)[ref.index]!
  if (!isFilled(current.text)) return null
  const at = textSplit(Math.min(selection.start, selection.end), Math.max(selection.start, selection.end), newItemId)
  const change = ref.kind === 'bullet' ? splitBullet(ref.sectionId, ref.item.id, current.id, at) : splitListItem(ref.section.id, current.id, at)
  return { change, focus: { key: listKey(ref, at.newItemId), caret: 0 } }
}

// Backspace na początku: pusty element znika (kursor na końcu poprzedniego), niepusty dołącza do poprzedniego (kursor
// w miejscu złączenia); pierwszy – nic.
export function mergeBackward(key: string, document: CvDocument): FieldEdit | null {
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

// ⌥⇧↑/↓ w polu: punkt i element listy – o jedną pozycję w swojej liście; pole wpisu – cały wpis wśród wpisów sekcji na
// stronach (jak „Przenieś wyżej/niżej” w menu uchwytu). Na krańcu albo w innym polu – null. Kursor zostaje w polu.
export function moveField(key: string, document: CvDocument, offset: MoveOffset): Change<CvDocument> | null {
  const ref = refOf(key, document)
  if (ref?.kind === 'bullet' || ref?.kind === 'listItem') {
    const to = ref.index + offset
    if (to < 0 || to >= listItems(ref).length) return null
    const id = listItems(ref)[ref.index]!.id
    return ref.kind === 'bullet' ? moveBullet(ref.sectionId, ref.item.id, id, to) : moveItem(ref.section.id, id, to)
  }
  if (ref?.kind !== 'experience' && ref?.kind !== 'education') return null
  const section = document.sections.find((candidate) => candidate.id === ref.sectionId)!
  const onPages = new Set(generateBlocks(document, templates[document.settings.template].geometry).map((block) => block.id))
  onPages.add(ref.item.id)
  const plan = moveAmongShown(section.items.map((item) => item.id), onPages, ref.item.id, offset)
  return plan ? moveItem(section.id, ref.item.id, plan.toIndex) : null
}
