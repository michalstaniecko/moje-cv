import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type Ref } from 'react'
import type { Dictionary } from '../../../shared/i18n/en'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { FullNameField } from '../editor/fields/FullNameField'
import { SectionTitleField, sectionName } from '../editor/fields/SectionTitleField'
import { SummaryField } from '../editor/fields/SummaryField'
import { useDictionary } from '../i18n'
import { markInput } from '../preview/keystrokeTiming'
import { anchoredPosition, type Box } from './anchoredPosition'
import type { EditTarget } from './editTargets'

// Części CV, które mają już swoją Edit card. Warstwa edycji pokazuje przyciski tylko ich fragmentów; karty wpisów,
// list i klauzuli (T3) oraz zdjęcia i kontaktów (T4) dopisują się tutaj i w `CardFields`.
const cardKinds: ReadonlySet<EditTarget['kind']> = new Set(['fullName', 'summary', 'sectionTitle'])
export const hasCard = (target: EditTarget) => cardKinds.has(target.kind)

// Nazwa części CV: w przycisku fragmentu („Edit: <nazwa>”) i jako nazwa karty (`aria-label`).
export function cardLabel(target: EditTarget, document: CvDocument, t: Dictionary['editor']): string {
  switch (target.kind) {
    case 'fullName':
      return t.fullName
    case 'summary':
      return t.summary
    case 'sectionTitle': {
      const section = document.sections.find((candidate) => candidate.id === target.sectionId)
      return t.sectionTitle(section ? sectionName(section, t) : '')
    }
    default:
      return ''
  }
}

// Pola karty – te same komponenty co w CV form (te same klucze łączenia kroków cofania).
function CardFields({ target, editor, document }: { target: EditTarget; editor: CvEditor; document: CvDocument }) {
  switch (target.kind) {
    case 'fullName':
      return <FullNameField editor={editor} header={document.header} />
    case 'summary':
      return <SummaryField editor={editor} header={document.header} />
    case 'sectionTitle': {
      const section = document.sections.find((candidate) => candidate.id === target.sectionId)
      return section ? <SectionTitleField editor={editor} section={section} labelled /> : null
    }
    default:
      return null
  }
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
    case 'contacts':
      return target.contactId
    default:
      return undefined
  }
}

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
export function EditCard({
  ref,
  target,
  editor,
  document,
  locate,
  onClose,
  onTabOut
}: {
  ref?: Ref<HTMLDivElement>
  target: EditTarget
  editor: CvEditor
  document: CvDocument
  locate: () => CardAnchor
  onClose: () => void
  onTabOut: (direction: 'forward' | 'backward') => boolean
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
    const { top, left } = anchoredPosition({
      ...anchor,
      panel: { width: element.offsetWidth, height: element.offsetHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gap: 8
    })
    element.style.top = `${top}px`
    element.style.left = `${left}px`
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
        : undefined) ?? card.current.querySelector<HTMLElement>('input, textarea, select')
    field?.focus({ preventScroll: true })
    // Kursor na końcu tekstu: kliknięcie tekstu na stronie zwykle znaczy „dopisz” albo „popraw końcówkę”.
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.setSelectionRange(field.value.length, field.value.length)
    }
  }, [targetSignature])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
      role="dialog"
      aria-label={label}
      onKeyDown={onKeyDown}
      onInput={(event) => markInput(event.timeStamp)}
    >
      <button type="button" className="edit-card-close" aria-label={t.card.close} title={t.card.close} onClick={onClose}>
        ×
      </button>
      <div className="form">
        <CardFields target={target} editor={editor} document={document} />
      </div>
    </div>
  )
}
