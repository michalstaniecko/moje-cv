import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type Ref } from 'react'
import type { Dictionary } from '../../../shared/i18n/en'
import type { CvDocument, EducationItem, ExperienceItem } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { EducationItemFields } from '../editor/fields/EducationItemFields'
import { educationName, entryName } from '../editor/fields/entryNames'
import { ExperienceItemFields } from '../editor/fields/ExperienceItemFields'
import { FullNameField } from '../editor/fields/FullNameField'
import { ListItemsFields } from '../editor/fields/ListItemsFields'
import { PhotoField } from '../editor/fields/PhotoField'
import { SectionTitleField, sectionName } from '../editor/fields/SectionTitleField'
import { SummaryField } from '../editor/fields/SummaryField'
import { RemoveProvider, type RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { markInput } from '../preview/keystrokeTiming'
import { anchoredPosition, type Box } from './anchoredPosition'
import type { EditTarget } from './editTargets'

// Edit card (wycofywana, docs/specs/wysiwyg-editing.md, W20): po S5 nic jej już nie otwiera – tekst CV to Page fields,
// wartości nietekstowe mają Field popovers, a dodawanie odsłania nowe części na stronie. Kod do usunięcia w S6.

const findSection = (document: CvDocument, sectionId: string) =>
  document.sections.find((candidate) => candidate.id === sectionId)

const findExperience = (document: CvDocument, sectionId: string, itemId: string): ExperienceItem | undefined => {
  const section = findSection(document, sectionId)
  return section?.type === 'experience' ? section.items.find((item) => item.id === itemId) : undefined
}

const findEducation = (document: CvDocument, sectionId: string, itemId: string): EducationItem | undefined => {
  const section = findSection(document, sectionId)
  return section?.type === 'education' ? section.items.find((item) => item.id === itemId) : undefined
}

// Nazwa części CV – nazwa karty (`aria-label`).
export function cardLabel(target: EditTarget, document: CvDocument, t: Dictionary['editor']): string {
  switch (target.kind) {
    case 'fullName':
      return t.fullName
    case 'photo':
      return t.photo.legend
    case 'contacts':
      return t.contact
    case 'summary':
      return t.summary
    case 'sectionTitle': {
      const section = findSection(document, target.sectionId)
      return t.sectionTitle(section ? sectionName(section, t) : '')
    }
    case 'experienceItem':
      return t.card.position(entryName(findExperience(document, target.sectionId, target.itemId)?.role ?? '', t.newPosition))
    case 'educationItem': {
      const item = findEducation(document, target.sectionId, target.itemId)
      return t.card.education(item ? educationName(item, t) : t.newEducation)
    }
    case 'listSection': {
      const section = findSection(document, target.sectionId)
      return t.card.list(section ? sectionName(section, t) : '')
    }
    case 'consent':
      return t.consent.title
    default:
      return ''
  }
}

// Pola karty – te same komponenty co w CV form (te same klucze łączenia kroków cofania). Część CV, której już nie ma
// (chwilę przed zamknięciem karty po cofnięciu albo usunięciu), nie ma pól.
function CardFields({ target, editor, document }: { target: EditTarget; editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor
  switch (target.kind) {
    case 'fullName':
      return <FullNameField editor={editor} header={document.header} />
    case 'photo':
      return (
        <>
          <CardHeading>{t.photo.legend}</CardHeading>
          <PhotoField editor={editor} photo={document.header.photo} inCard />
        </>
      )
    case 'summary':
      return <SummaryField editor={editor} header={document.header} />
    case 'sectionTitle': {
      const section = findSection(document, target.sectionId)
      return section ? <SectionTitleField editor={editor} section={section} labelled /> : null
    }
    case 'experienceItem': {
      const item = findExperience(document, target.sectionId, target.itemId)
      return item ? <ExperienceItemFields editor={editor} sectionId={target.sectionId} item={item} /> : null
    }
    case 'educationItem': {
      const item = findEducation(document, target.sectionId, target.itemId)
      return item ? <EducationItemFields editor={editor} sectionId={target.sectionId} item={item} /> : null
    }
    case 'listSection': {
      const section = findSection(document, target.sectionId)
      if (section?.type !== 'list') return null
      return (
        <>
          <CardHeading>{sectionName(section, t)}</CardHeading>
          <ListItemsFields editor={editor} sectionId={section.id} items={section.items} />
        </>
      )
    }
    default:
      return null
  }
}

// Nagłówek karty bez etykiety pola na górze (zdjęcie, kontakty, lista, klauzula): mówi, co się edytuje, i robi miejsce na „×”. Dla
// czytnika ekranu to samo mówi już nazwa karty.
function CardHeading({ children }: { children: string }) {
  return (
    <p className="edit-card-heading" aria-hidden="true">
      {children}
    </p>
  )
}

// Pole, na które trafia fokus po otwarciu karty: element z `data-edit-focus` równym polu, punktowi, elementowi listy
// albo kontaktowi z celu; bez dopasowania – pierwsze pole karty.
function focusKey(target: EditTarget): string | undefined {
  switch (target.kind) {
    case 'experienceItem':
      return target.bulletId ?? target.field
    case 'educationItem':
      return target.field
    case 'listSection':
      return target.itemId
    default:
      return undefined
  }
}

// Pierwsze pole karty, a w karcie bez pól tekstowych (zdjęcie) – jej pierwszy przycisk poza „×”.
const firstField = (card: HTMLElement) =>
  card.querySelector<HTMLElement>('input, textarea, select') ?? card.querySelector<HTMLElement>('.form button')

const tabbable = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !(element as HTMLButtonElement).disabled
  )

// Gdzie stoi fragment, przy którym otwarto kartę: prostokąt kotwicy w oknie i – dla położenia obok kartki – prawa
// krawędź kartki oraz prawa krawędź panelu stron. `null` – fragmentu nie ma na stronie (karta zostaje, gdzie była).
export type CardAnchor = { anchor: Box; beside: { edge: number; limit: number } } | null

// Edit card: niemodalny `role="dialog"` w warstwie górnej (`popover`, jak RowMenu), zawsze w skali 1:1, z polami jednej
// części CV i tylko przyciskiem „×” – zmiany są natychmiastowe (autozapis), bez „Zapisz”.
// - Pozycja liczona po każdym przerysowaniu warstwy (nowy podział stron, zmiana skali), przewinięciu i zmianie rozmiaru
//   okna – od aktualnego położenia fragmentu (`locate`).
// - Escape zamyka kartę (warstwa przenosi fokus na fragment). Karta nie więzi fokusu: Tab z ostatniego pola idzie do
//   kolejnego fragmentu, Shift+Tab z pierwszego – na fragment karty (`onTabOut`).
// - `markInput` w `onInput` (jak formularz), żeby `cv:keystroke-to-preview` mierzył też pisanie w karcie.
// - Usunięcia w karcie (wpis, punkt, element listy, kontakt, zdjęcie) idą przez `onRemove` – „Usunięto. Cofnij” jak w CV form.
// - `data-entry-root`: Enter/Backspace w punktach i „Cofnij” szukają pól najpierw w karcie (ta sama lista jest w CV form).
export function EditCard({
  ref,
  target,
  editor,
  document,
  locate,
  onClose,
  onTabOut,
  onRemove
}: {
  ref?: Ref<HTMLDivElement>
  target: EditTarget
  editor: CvEditor
  document: CvDocument
  locate: () => CardAnchor
  onClose: () => void
  onTabOut: (direction: 'forward' | 'backward') => boolean
  onRemove: RemoveWithUndo
}) {
  const t = useDictionary().editor
  const card = useRef<HTMLDivElement | null>(null)
  const label = cardLabel(target, document, t)

  // Pozycja po każdym renderze (warstwa renderuje kartę od nowa przy każdym nowym pomiarze fragmentów).
  const locateRef = useRef(locate)
  useLayoutEffect(() => {
    locateRef.current = locate
  })
  const place = () => {
    const element = card.current
    const anchor = locateRef.current()
    if (!element || !anchor) return
    // Pełna wysokość karty (w granicach okna z arkusza), także gdy poprzednia pozycja ją obniżyła (`maxHeight`).
    const borders = element.offsetHeight - element.clientHeight
    const height = Math.min(element.scrollHeight + borders, window.innerHeight - 8)
    const { top, left, maxHeight } = anchoredPosition({
      ...anchor,
      panel: { width: element.offsetWidth, height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gap: 8,
      contain: true
    })
    element.style.top = `${top}px`
    element.style.left = `${left}px`
    // Niższa karta pod albo nad wysokim fragmentem (przewija się w środku), żeby go nie zasłaniała.
    element.style.maxHeight = maxHeight === undefined ? '' : `${maxHeight}px`
  }

  // Najpierw pokazanie (ukryty popover nie ma wymiarów), potem pozycja. `place` czyta wszystko przez refy, więc
  // nasłuch rejestrujemy raz.
  useLayoutEffect(() => {
    card.current?.showPopover()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [])
  useLayoutEffect(place)

  // Fokus na polu celu – przy otwarciu i przy każdym kliknięciu innego pola tego samego fragmentu.
  const targetSignature = JSON.stringify(target)
  useEffect(() => {
    if (!card.current) return
    const key = focusKey(target)
    const field =
      (key !== undefined
        ? [...card.current.querySelectorAll<HTMLElement>('[data-edit-focus]')].find((element) => element.dataset['editFocus'] === key)
        : undefined) ?? firstField(card.current)
    if (!field) return
    field.focus({ preventScroll: true })
    // Kursor na końcu tekstu: kliknięcie tekstu na stronie zwykle znaczy „dopisz” albo „popraw końcówkę”.
    if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && field.type === 'text')) {
      field.setSelectionRange(field.value.length, field.value.length)
    }
    revealInCard(card.current, field)
  }, [targetSignature])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Okno modalne otwarte z karty (kadrowanie zdjęcia) samo obsługuje Escape i Tab – karta zostaje otwarta pod nim.
    if ((event.target as Element).closest('dialog')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !card.current) return
    const elements = tabbable(card.current)
    const edge = event.shiftKey ? elements[0] : elements.at(-1)
    if (event.target === edge && onTabOut(event.shiftKey ? 'backward' : 'forward')) event.preventDefault()
  }

  return (
    <div
      ref={(element) => {
        card.current = element
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      popover="manual"
      className="edit-card"
      data-entry-root
      role="dialog"
      aria-label={label}
      onKeyDown={onKeyDown}
      onInput={(event) => markInput(event.timeStamp)}
    >
      <button type="button" className="edit-card-close" aria-label={t.card.close} title={t.card.close} onClick={onClose}>
        ×
      </button>
      <div className="form">
        <RemoveProvider value={onRemove}>
          <CardFields target={target} editor={editor} document={document} />
        </RemoveProvider>
      </div>
    </div>
  )
}

// Pole celu w widocznej części karty (długi wpis z wieloma punktami przewija się w karcie). Bez `scrollIntoView`, bo
// przewinąłby też panel stron pod kartą.
function revealInCard(card: HTMLElement, field: HTMLElement) {
  const box = card.getBoundingClientRect()
  const target = field.getBoundingClientRect()
  const margin = 12
  if (target.bottom > box.bottom - margin) card.scrollTop += target.bottom - box.bottom + margin
  else if (target.top < box.top + margin) card.scrollTop -= box.top + margin - target.top
}
