import type { Dictionary } from '../../../shared/i18n/en'
import type { CvBlock } from '../domain/blocks'
import type { CvDocument } from '../domain/schema'
import { updateHeader, updateSection, type Change } from '../editor/documentEdits'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { EditableField, SlotName } from '../template/editable'
import { blockTarget, fragmentKey, type EditTarget } from './editTargets'

// Mapa Page fields (docs/specs/wysiwyg-editing.md, W4, W9, W19): które pole CV rysuje slot szablonu, jak się nazywa,
// co pokazuje puste i jak jego nowa wartość zmienia dokument. Czyste funkcje – bez DOM.
// Klucz pola = klucz łączenia kroków cofania pola CV form (te same kroki cofania na stronie i w formularzu)
// = `data-field-key` na stronie. Kawałek S1: imię i nazwisko, podsumowanie, tytuły sekcji.

// Części CV edytowane już na stronie, a nie w Edit card (ich fragmenty nie mają przycisku karty).
export const pageFieldKinds: ReadonlySet<EditTarget['kind']> = new Set(['fullName', 'summary', 'sectionTitle'])

const fullNameKey = 'header:fullName'
const summaryKey = 'header:summary'
const titleKey = (sectionId: string) => `section:${sectionId}:title`

const isFilled = (text: string) => text.trim() !== ''

// Klucz Page field części CV edytowanej na stronie (fokus z Outline, „Add to CV”, menu) albo null.
export function pageFieldKey(target: EditTarget): string | null {
  switch (target.kind) {
    case 'fullName':
      return fullNameKey
    case 'summary':
      return summaryKey
    case 'sectionTitle':
      return titleKey(target.sectionId)
    default:
      return null
  }
}

// Część CV pola o kluczu `key` (odwrotność `pageFieldKey`) albo null.
export function pageFieldTarget(key: string): EditTarget | null {
  if (key === fullNameKey) return { kind: 'fullName' }
  if (key === summaryKey) return { kind: 'summary' }
  const title = /^section:(.+):title$/.exec(key)
  return title ? { kind: 'sectionTitle', sectionId: title[1]! } : null
}

function field(target: EditTarget, document: CvDocument, t: Dictionary['editor']): EditableField | null {
  const key = pageFieldKey(target)
  if (key === null) return null
  const base = { key, fragment: fragmentKey(target) }
  switch (target.kind) {
    case 'fullName':
      return { ...base, label: t.fullName, placeholder: t.fullName, spellcheck: false }
    case 'summary':
      return { ...base, label: t.summary, placeholder: t.summary, spellcheck: true }
    case 'sectionTitle': {
      const section = document.sections.find((candidate) => candidate.id === target.sectionId)
      if (!section) return null
      return { ...base, label: t.sectionTitle(sectionName(section, t)), placeholder: t.sectionTypes[section.type], spellcheck: true }
    }
    default:
      return null
  }
}

// Pole CV, którego tekst rysuje slot `slot` bloku `block` (id bloku rozwiązane w bieżącym dokumencie, jak w
// editTargets.ts). Tytuł w wierszu listy – tylko w pierwszym wierszu sekcji (tam szablon z tytułem obok listy go rysuje).
export function pageFieldOf(block: CvBlock, slot: SlotName, document: CvDocument, t: Dictionary['editor']): EditableField | null {
  if (block.kind === 'header') {
    if (slot === 'fullName') return field({ kind: 'fullName' }, document, t)
    if (slot === 'summary') return field({ kind: 'summary' }, document, t)
    return null
  }
  if (slot !== 'title' || (block.kind !== 'sectionTitle' && block.kind !== 'listRow')) return null
  const target = blockTarget(block.id, document)
  if (!target || (target.kind !== 'sectionTitle' && target.kind !== 'listSection')) return null
  if (block.kind === 'listRow') {
    const section = document.sections.find((candidate) => candidate.id === target.sectionId)
    const first = section?.type === 'list' ? section.items.find((item) => isFilled(item.text)) : undefined
    if (!first || block.id !== `${target.sectionId}:${first.id}`) return null
  }
  return field({ kind: 'sectionTitle', sectionId: target.sectionId }, document, t)
}

// Zmiana dokumentu po nowej wartości pola `key` (nieznane pole – bez zmian).
export function fieldChange(key: string, value: string): Change<CvDocument> {
  const target = pageFieldTarget(key)
  switch (target?.kind) {
    case 'fullName':
      return updateHeader({ fullName: value })
    case 'summary':
      return updateHeader({ summary: value })
    case 'sectionTitle':
      return updateSection(target.sectionId, { title: value })
    default:
      return (document) => document
  }
}

// Czy fragment strony ma puste pole – tylko wtedy aktywny fragment trzeba odsłonić (W10, W23: odsłonięcie zmienia
// bloki i podział stron, więc wejście w wypełniony fragment nie kosztuje ponownego podziału).
export function fragmentHasEmptyField(fragment: string, document: CvDocument): boolean {
  if (fragment === 'fullName') return !isFilled(document.header.fullName)
  if (fragment === 'summary') return !isFilled(document.header.summary)
  const title = /^sectionTitle:(.+)$/.exec(fragment)
  if (!title) return false
  const section = document.sections.find((candidate) => candidate.id === title[1])
  return section !== undefined && !isFilled(section.title)
}
