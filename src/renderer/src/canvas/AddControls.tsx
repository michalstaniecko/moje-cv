import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type RefObject } from 'react'
import type { CvDocument, Section } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { addContact, addEducationItem, addExperienceItem, addListItem, updateConsent } from '../editor/documentEdits'
import { sectionName } from '../editor/fields/SectionTitleField'
import { useDictionary } from '../i18n'
import { addToCvItems, isEmptyCv, sectionPills, type AddToCvItem, type SectionPill } from './addOnPage'
import type { EditTarget } from './editTargets'
import type { Fragment, Rect } from './fragmentRects'
import type { EditSession } from './useEditSession'

// Przerwa między ostatnią stroną a paskiem „Add to CV” i między fragmentem a pigułką „+” (px).
const BAR_GAP = 16
const PILL_GAP = 2
// Jak długo pigułka zostaje po zjechaniu kursorem z sekcji – przejście przez odstęp między wpisami jej nie chowa.
const PILL_LINGER_MS = 300

// Element sekcji do dodania na stronach (pigułka „+”, pasek „Add to CV”, menu tytułu sekcji): nowy wpis albo element
// listy na końcu sekcji. `reuseEmpty` – sekcja bez treści na stronach (pasek): jej istniejący, jeszcze pusty element
// zamiast kolejnego pustego. Zwraca nowy (albo odsłaniany) element – cel `session.focusPart`.
export function addSectionElement(editor: CvEditor, section: Section, { reuseEmpty = false } = {}): EditTarget | null {
  const reused = reuseEmpty ? section.items[0] : undefined
  if (!reused) {
    editor.edit(
      section.type === 'experience'
        ? addExperienceItem(section.id)
        : section.type === 'education'
          ? addEducationItem(section.id)
          : addListItem(section.id)
    )
  }
  const item = reused ?? editor.store.getState().document.sections.find((candidate) => candidate.id === section.id)?.items.at(-1)
  if (!item) return null
  return section.type === 'list'
    ? { kind: 'listSection', sectionId: section.id, itemId: item.id }
    : { kind: section.type === 'experience' ? 'experienceItem' : 'educationItem', sectionId: section.id, itemId: item.id }
}

// Dodawanie na stronach w Edit mode (docs/specs/inline-editing-redesign.md, Q8, Q10) – wszystko w warstwie edycji,
// nic na kartkach (podział stron jak w Preview mode i PDF):
// - pigułki „+ Position / Education / Item” pod ostatnim fragmentem sekcji, widoczne przy najechaniu na sekcję albo
//   fokusie na uchwycie w niej; poza kolejnością Tab (W22); przy skali poniżej 50% ich nie ma;
// - pasek „Add to CV:” pod ostatnią stroną z przyciskami tylko dla tego, czego na stronach nie ma (`addToCvItems`);
// - w zupełnie pustym CV podpowiedź „Start with your full name” na środku pierwszej strony.
// Każdy przycisk dodaje (albo odsłania istniejący pusty) element i stawia kursor w jego pierwszym polu na stronie –
// pusty element jest odsłonięty z placeholderami (docs/specs/wysiwyg-editing.md, W10, W21); „Photo” od razu otwiera
// wybór pliku (`addPhoto`).
export function useAddControls({
  editor,
  document,
  session,
  fragments,
  pages,
  layer,
  compact,
  addPhoto
}: {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  fragments: Fragment[]
  pages: Rect[]
  layer: RefObject<HTMLElement | null>
  compact: boolean
  addPhoto: (from: () => HTMLElement | null) => void
}) {
  const t = useDictionary().editor
  const find = (selector: string) => () => layer.current?.querySelector<HTMLElement>(selector) ?? null
  const openAdded = (target: EditTarget | null) => {
    if (target) session.focusPart(target)
  }
  const sectionById = (sectionId: string) => document.sections.find((section) => section.id === sectionId)

  // Sekcja pod kursorem albo z fokusem – jej pigułka jest widoczna.
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const linger = useRef(0)
  useEffect(() => () => window.clearTimeout(linger.current), [])
  const sectionAt = (element: EventTarget | null) =>
    element instanceof Element ? (element.closest<HTMLElement>('[data-section]')?.dataset['section'] ?? null) : null
  const layerEvents = {
    onPointerOver: (event: PointerEvent) => {
      window.clearTimeout(linger.current)
      setHovered(sectionAt(event.target))
    },
    onPointerOut: (event: PointerEvent) => {
      if (sectionAt(event.relatedTarget) !== null) return
      window.clearTimeout(linger.current)
      linger.current = window.setTimeout(() => setHovered(null), PILL_LINGER_MS)
    },
    onFocus: (event: FocusEvent) => setFocused(sectionAt(event.target)),
    onBlur: (event: FocusEvent) => {
      if (sectionAt(event.relatedTarget) === null) setFocused(null)
    }
  }
  // Kursor nad treścią sekcji na stronie (Page fields wpisów nie mają przycisku fragmentu pod myszą): `null` – poza
  // sekcjami, pigułka gaśnie po chwili (przejście ze strony na pigułkę jej nie chowa).
  const hoverOnPage = (sectionId: string | null) => {
    window.clearTimeout(linger.current)
    if (sectionId !== null) setHovered(sectionId)
    else linger.current = window.setTimeout(() => setHovered(null), PILL_LINGER_MS)
  }

  const pills = new Map<Fragment, SectionPill>()
  if (!compact) for (const pill of sectionPills(fragments)) pills.set(pill.after, pill)

  const pillLabel = { experience: t.canvas.add.position, education: t.canvas.add.education, list: t.canvas.add.item }
  const pillAfter = (fragment: Fragment) => {
    const pill = pills.get(fragment)
    const section = pill && sectionById(pill.sectionId)
    if (!pill || !section) return null
    return (
      <button
        type="button"
        className="edit-pill"
        data-section={section.id}
        data-page={fragment.page}
        data-active={hovered === section.id || focused === section.id || undefined}
        style={{ top: pill.top + PILL_GAP, left: pill.left }}
        // Klik nie zabiera fokusu polu na stronie przed kliknięciem: utrata fokusu chowa placeholdery odsłoniętego wpisu
        // (docs/specs/wysiwyg-editing.md, W10), strony przesuwają się, a z nimi pigułka spod kursora – klik by nie
        // trafił. Fokus przenosi dopiero dodanie (kursor w nowym polu).
        onMouseDown={(event) => event.preventDefault()}
        // Poza kolejnością Tab (docs/specs/wysiwyg-editing.md, W22): z klawiatury „Dodaj …” w menu uchwytu tytułu sekcji
        // (Shift+F10 w tytule) albo Enter w ostatnim punkcie / elemencie.
        tabIndex={-1}
        onClick={() => openAdded(addSectionElement(editor, section))}
      >
        + {pillLabel[section.type]}
      </button>
    )
  }

  const itemLabel = (item: AddToCvItem): string => {
    switch (item.kind) {
      case 'fullName':
        return t.fullName
      case 'photo':
        return t.photo.legend
      case 'contacts':
        return t.contact
      case 'summary':
        return t.summary
      case 'section': {
        const section = sectionById(item.sectionId)
        return section ? sectionName(section, t) : ''
      }
      case 'consent':
        return t.consent.title
    }
  }

  const addItem = (item: AddToCvItem) => {
    const from = find(`.add-to-cv [data-add="${CSS.escape(item.key)}"]`)
    switch (item.kind) {
      case 'fullName':
      case 'summary':
        return openAdded({ kind: item.kind })
      case 'photo':
        // Od razu wybór pliku i kadrowanie (PhotoPopover.tsx) – zdjęcie nie ma pola na stronie.
        return addPhoto(from)
      case 'contacts':
        return openAdded(addContactElement(editor))
      case 'section': {
        const section = sectionById(item.sectionId)
        return section ? openAdded(addSectionElement(editor, section, { reuseEmpty: true })) : undefined
      }
      case 'consent':
        if (!document.consent.enabled) editor.edit(updateConsent({ enabled: true }))
        return openAdded({ kind: 'consent' })
    }
  }

  const lastPage = pages.at(-1)
  const items = addToCvItems(document)
  const bar = lastPage && items.length > 0 && (
    <div
      className="add-to-cv"
      role="group"
      aria-labelledby="add-to-cv-label"
      data-page={pages.length - 1}
      style={{ top: lastPage.bottom + BAR_GAP, left: lastPage.left, width: lastPage.right - lastPage.left }}
    >
      <span id="add-to-cv-label" className="add-to-cv-label">
        {t.canvas.addToCv}
      </span>
      {items.map((item) => (
        <button key={item.key} type="button" data-add={item.key} onClick={() => addItem(item)}>
          {itemLabel(item)}
        </button>
      ))}
    </div>
  )

  const firstPage = pages[0]
  const hint = firstPage && isEmptyCv(document) && (
    <button
      type="button"
      className="edit-start-hint button-primary"
      data-page={0}
      style={{ top: (firstPage.top + firstPage.bottom) / 2, left: (firstPage.left + firstPage.right) / 2 }}
      onClick={() => openAdded({ kind: 'fullName' })}
    >
      {t.canvas.startHint}
    </button>
  )

  return { layerEvents, hoverOnPage, pillAfter, bar, hint }
}

// Kontakt do dodania (pasek „Add to CV”, „+ Add contact” w panelu nagłówka Inspektora): kontakt bez wartości (np.
// etykiety nowego CV) zamiast kolejnego pustego, a bez niego – nowy na końcu. Zwraca kontakt – cel `session.focusPart`.
export function addContactElement(editor: CvEditor): EditTarget {
  let contact = editor.store.getState().document.header.contacts.find((candidate) => candidate.value.trim() === '')
  if (!contact) {
    editor.edit(addContact())
    contact = editor.store.getState().document.header.contacts.at(-1)
  }
  return { kind: 'contacts', contactId: contact?.id }
}
