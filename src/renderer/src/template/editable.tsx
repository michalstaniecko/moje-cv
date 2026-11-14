import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { CvBlock, Reveal } from '../domain/blocks'
import type { ListSectionLayout } from '../domain/templateGeometry'

// Sloty edycji (ADR-0010, docs/specs/wysiwyg-editing.md, W2, W9): szablony rysują tekst pól CV przez `CvText`, a o tym,
// czy element pola w ogóle jest, decydują przez `useShown`. Bez kontekstu edycji (Preview mode, okno PDF, Template
// thumbnail) slot zwraca dokładnie dzisiejszy markup: ten sam napis jako ten sam węzeł tekstowy i te same warunki
// renderowania (pilnuje tego `goldenMarkup.test.tsx`). Z kontekstem – podawanym przez `CvPages` tylko w Edit mode –
// każde pole to osobny Page field w tym samym elemencie szablonu. Ten moduł nie zna edytora: Page field rysuje komponent
// z kontekstu (`PageEditing.Field`, canvas/PageField.tsx).

// Tekst bloku rysowany przez slot: `fullName` i `summary` nagłówka, `title` tytułu sekcji (także obok listy).
export type SlotName = 'fullName' | 'summary' | 'title'

// Pole CV rysowane przez slot w Edit mode. `key` – klucz pola (= klucz łączenia kroków cofania i `data-field-key`),
// `fragment` – klucz fragmentu strony, do którego pole należy (aktywny fragment pokazuje placeholdery pustych pól,
// zob. `Reveal`), `label` – nazwa pola dla czytnika ekranu, `placeholder` – tekst pustego pola, `spellcheck` –
// sprawdzanie pisowni (W24).
export type EditableField = {
  key: string
  fragment: string
  label: string
  placeholder: string
  spellcheck: boolean
}

// `measuring` – kopia w kontenerze pomiarowym: ten sam tekst i placeholder (identyczna geometria), bez edycji i fokusu.
export type PageFieldProps = { field: EditableField; text: string; measuring: boolean }

// Edycja stron w Edit mode – implementuje ją warstwa edycji (canvas/), szablony widzą tylko ten interfejs.
// - `fieldOf` – pole CV, którego tekst rysuje slot `slot` w bloku `block`; null – tekst nie jest (jeszcze) polem
//   i zostaje jak w dokumencie.
// - `reveal` – fragmenty, które mają blok i pokazują swoje puste pola mimo pustej treści (`generateBlocks`).
// - `Field` – komponent Page field (musi mieć stałą tożsamość, inaczej pole traci kursor przy każdym renderze).
// - `onPagesCommitted` – wołane przed malowaniem po każdym nowym podziale stron (np. przywrócenie kursora w polu
//   przeniesionym na inną stronę).
export type PageEditing = {
  fieldOf: (block: CvBlock, slot: SlotName) => EditableField | null
  reveal: Reveal
  Field: ComponentType<PageFieldProps>
  onPagesCommitted: () => void
}

type SlotContext = { editing: PageEditing; measuring: boolean; listSectionLayout: ListSectionLayout }

const EditingContext = createContext<SlotContext | null>(null)

// Udostępnia edycję slotom jednej kopii bloków (kontener pomiarowy albo strony) – tylko `CvPages` z `editing`.
export function EditingProvider({ value, children }: { value: SlotContext | null; children: ReactNode }) {
  return value ? <EditingContext.Provider value={value}>{children}</EditingContext.Provider> : children
}

// Pole slotu albo null. Tytuł w wierszu listy jest polem tylko w układzie z tytułem obok listy (w pierwszym wierszu).
function useField(block: CvBlock, slot: SlotName): { context: SlotContext; field: EditableField } | null {
  const context = useContext(EditingContext)
  if (!context) return null
  if (block.kind === 'listRow' && slot === 'title' && context.listSectionLayout.title !== 'beside') return null
  const field = context.editing.fieldOf(block, slot)
  return field ? { context, field } : null
}

// Czy szablon rysuje element pola: w dokumencie – gdy tekst jest niepusty (jak dotąd), w Edit mode także wtedy, gdy
// fragment pola jest odsłonięty (pusty Page field z placeholderem w aktywnym fragmencie).
export function useShown(block: CvBlock, slot: SlotName, text: string): boolean {
  const editable = useField(block, slot)
  return text.trim() !== '' || (editable !== null && editable.context.editing.reveal.has(editable.field.fragment))
}

// Tekst pola: w dokumencie sam napis, w Edit mode – Page field.
export function CvText({ block, slot, text }: { block: CvBlock; slot: SlotName; text: string }) {
  const editable = useField(block, slot)
  if (!editable) return text
  const { Field } = editable.context.editing
  return <Field field={editable.field} text={text} measuring={editable.context.measuring} />
}
