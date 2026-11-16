// PROTOTYP – wariant A „Inspektor”: skoki z Inspektora na strony i dodawanie elementów sekcji (bez konspektu po lewej).
import { addSectionElement } from '../../canvas/AddControls'
import { sectionShown } from '../../canvas/addOnPage'
import { fragmentKey, type EditTarget } from '../../canvas/editTargets'
import type { EditSession } from '../../canvas/useEditSession'
import type { CvDocument, Section } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { addEducationItem, addExperienceItem, addListItem, updateSection } from '../../editor/documentEdits'

// Przewija strony do fragmentu (klucz `fragmentKey` z canvas/editTargets.ts); brak fragmentu – nic.
export function scrollToFragment(key: string) {
  window.document.querySelector(`.cv-pages [data-fragment="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// Kursor w części CV na stronie (jak Outline.tsx): strony przewinięte do jej fragmentu, a pusta część odsłonięta.
// Części, której nie ma na stronach (ukryta, wyłączona), `focusPart` nie rusza – fokus zostaje w Inspektorze.
export function focusOnPage(session: EditSession, target: EditTarget) {
  scrollToFragment(fragmentKey(target))
  session.focusPart(target)
}

// Sekcja bez treści na stronach (gdyby była pokazana): bez elementów albo z samymi pustymi.
export const isEmptySection = (section: Section, document: CvDocument) => !sectionShown({ ...section, hidden: false }, document)

export const itemTarget = (section: Section, itemId: string): EditTarget =>
  section.type === 'list'
    ? { kind: 'listSection', sectionId: section.id, itemId }
    : { kind: section.type === 'experience' ? 'experienceItem' : 'educationItem', sectionId: section.id, itemId }

// „+ Dodaj …” w panelu sekcji: nowy element z kursorem w nim na stronie. Pusta sekcja dostaje swój istniejący pusty
// element zamiast kolejnego (jak pasek „Add to CV”). Ukryta sekcja jest najpierw pokazywana – razem z dodaniem to
// jeden krok cofania.
export function addToSection(editor: CvEditor, session: EditSession, section: Section) {
  const document = editor.store.getState().document
  const empty = isEmptySection(section, document)
  let target: EditTarget | null
  if (!section.hidden) {
    target = addSectionElement(editor, section, { reuseEmpty: empty })
  } else {
    const reused = empty ? section.items[0] : undefined
    const add =
      section.type === 'experience' ? addExperienceItem(section.id) : section.type === 'education' ? addEducationItem(section.id) : addListItem(section.id)
    const show = updateSection(section.id, { hidden: false })
    editor.edit((current) => (reused ? show(current) : add(show(current))))
    const item = reused ?? editor.store.getState().document.sections.find((candidate) => candidate.id === section.id)?.items.at(-1)
    target = item ? itemTarget(section, item.id) : null
  }
  if (target) session.focusPart(target)
}

// Tytuł elementu sekcji na liście w Inspektorze (tylko do odczytu).
export function itemTitle(section: Section, index: number): { title: string; detail?: string } {
  if (section.type === 'experience') {
    const item = section.items[index]!
    return { title: item.role.trim() || item.company.trim(), detail: item.role.trim() ? item.company.trim() : undefined }
  }
  if (section.type === 'education') {
    const item = section.items[index]!
    const degree = [item.level, item.field].map((part) => part.trim()).filter(Boolean).join(', ')
    return { title: item.institution.trim() || degree, detail: item.institution.trim() ? degree : undefined }
  }
  return { title: section.items[index]!.text.trim() }
}
