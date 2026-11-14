import { createContext, Fragment, useContext, type ComponentType, type ReactNode } from 'react'
import type { CvBlock, Reveal } from '../domain/blocks'
import type { ListSectionLayout } from '../domain/templateGeometry'

// Sloty edycji (ADR-0010, docs/specs/wysiwyg-editing.md, W2, W9): szablony rysują tekst pól CV przez `CvText`, a o tym,
// czy element pola w ogóle jest, decydują przez `useShown`. Bez kontekstu edycji (Preview mode, okno PDF, Template
// thumbnail) slot zwraca dokładnie dzisiejszy markup: ten sam napis jako ten sam węzeł tekstowy i te same warunki
// renderowania (pilnuje tego `goldenMarkup.test.tsx`). Z kontekstem – podawanym przez `CvPages` tylko w Edit mode –
// każde pole to osobny Page field w tym samym elemencie szablonu. Ten moduł nie zna edytora: Page field rysuje komponent
// z kontekstu (`PageEditing.Field`, canvas/PageField.tsx).

// Tekst bloku rysowany przez slot: `fullName` i `summary` nagłówka, `title` tytułu sekcji (także obok listy), pola
// stanowiska (`role`, `company`, `location`) i jego punkt (`bullet` – pierwszy punkt w bloku wpisu albo punkt bloku
// punktu), pola wykształcenia (`level`, `field`, `institution`) i element wiersza listy (`item`, z id elementu).
export type SlotName =
  | 'fullName'
  | 'summary'
  | 'title'
  | 'role'
  | 'company'
  | 'location'
  | 'bullet'
  | 'level'
  | 'field'
  | 'institution'
  | 'item'

// Pole CV rysowane przez slot w Edit mode. `key` – klucz pola (= klucz łączenia kroków cofania i `data-field-key`),
// `fragment` – klucz fragmentu strony, do którego pole należy (aktywny fragment pokazuje placeholdery pustych pól,
// zob. `Reveal`), `label` – nazwa pola dla czytnika ekranu, `placeholder` – tekst pustego pola, `spellcheck` –
// sprawdzanie pisowni (W24), `value` – wartość pola w dokumencie (sloty złożone rysują pola, które blok łączy w jeden
// napis, np. `companyLine`).
export type EditableField = {
  key: string
  fragment: string
  label: string
  placeholder: string
  spellcheck: boolean
  value: string
}

// `measuring` – kopia w kontenerze pomiarowym: ten sam tekst i placeholder (identyczna geometria), bez edycji i fokusu.
export type PageFieldProps = { field: EditableField; text: string; measuring: boolean }

// Edycja stron w Edit mode – implementuje ją warstwa edycji (canvas/), szablony widzą tylko ten interfejs.
// - `fieldOf` – pole CV, którego tekst rysuje slot `slot` w bloku `block` (`part` – id elementu wiersza listy); null –
//   tekst nie jest (jeszcze) polem i zostaje jak w dokumencie.
// - `reveal` – fragmenty, które mają blok i pokazują swoje puste pola mimo pustej treści (`generateBlocks`).
// - `Field` – komponent Page field (musi mieć stałą tożsamość, inaczej pole traci kursor przy każdym renderze).
// - `onPagesCommitted` – wołane przed malowaniem po każdym nowym podziale stron (np. przywrócenie kursora w polu
//   przeniesionym na inną stronę).
export type PageEditing = {
  fieldOf: (block: CvBlock, slot: SlotName, part?: string) => EditableField | null
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

type Editable = { context: SlotContext; field: EditableField }

const isFilled = (text: string) => text.trim() !== ''

// Pole slotu albo null. Tytuł w wierszu listy jest polem tylko w układzie z tytułem obok listy (w pierwszym wierszu).
function useField(block: CvBlock, slot: SlotName, part?: string): Editable | null {
  const context = useContext(EditingContext)
  if (!context) return null
  if (block.kind === 'listRow' && slot === 'title' && context.listSectionLayout.title !== 'beside') return null
  const field = context.editing.fieldOf(block, slot, part)
  return field ? { context, field } : null
}

// Czy pole jest na stronie w Edit mode: niepuste albo (z placeholderem) w odsłoniętym fragmencie.
const shownField = ({ context, field }: Editable) => isFilled(field.value) || context.editing.reveal.has(field.fragment)

// Czy szablon rysuje element pola: w dokumencie – gdy tekst jest niepusty (jak dotąd), w Edit mode także wtedy, gdy
// fragment pola jest odsłonięty (pusty Page field z placeholderem w aktywnym fragmencie).
export function useShown(block: CvBlock, slot: SlotName, text: string): boolean {
  const editable = useField(block, slot)
  return isFilled(text) || (editable !== null && editable.context.editing.reveal.has(editable.field.fragment))
}

function PageFieldOf({ editable }: { editable: Editable }) {
  const { Field } = editable.context.editing
  return <Field field={editable.field} text={editable.field.value} measuring={editable.context.measuring} />
}

// Tekst pola: w dokumencie sam napis, w Edit mode – Page field. Puste pole poza odsłoniętym fragmentem zostaje samym
// napisem (np. stanowisko w wierszu z datami w Modern): placeholder pokazuje tylko aktywny fragment.
export function CvText({ block, slot, text, part }: { block: CvBlock; slot: SlotName; text: string; part?: string }) {
  const editable = useField(block, slot, part)
  if (!editable || !shownField(editable)) return text
  return <PageFieldOf editable={editable} />
}

// Pola złączone w jeden napis bloku: w Edit mode każde osobno, a separator między dwoma polami na stronie – w dokumencie
// tylko między niepustymi polami (jak `joinFilled` w domain/blocks.ts), w odsłoniętym fragmencie między wszystkimi.
function Joined({ fields, separator }: { fields: Editable[]; separator: string }) {
  return fields.filter(shownField).map((editable, index) => (
    <Fragment key={editable.field.key}>
      {index > 0 && separator}
      <PageFieldOf editable={editable} />
    </Fragment>
  ))
}

type ExperienceEntryBlock = Extract<CvBlock, { kind: 'experienceEntry' }>
type EducationEntryBlock = Extract<CvBlock, { kind: 'educationEntry' }>

// „Firma – miejscowość” stanowiska: w dokumencie `companyLine`, w Edit mode dwa pola z separatorem.
export function CompanyLine({ block }: { block: ExperienceEntryBlock }) {
  const company = useField(block, 'company')
  const location = useField(block, 'location')
  if (!company || !location) return block.companyLine
  return <Joined fields={[company, location]} separator=" – " />
}

// „Poziom, kierunek, uczelnia” wspólnego markupu (Classic): w dokumencie jeden napis, w Edit mode trzy pola.
export function EducationLine({ block }: { block: EducationEntryBlock }) {
  const level = useField(block, 'level')
  const field = useField(block, 'field')
  const institution = useField(block, 'institution')
  if (!level || !field || !institution) return [block.level, block.details].filter((part) => part !== '').join(', ')
  return <Joined fields={[level, field, institution]} separator=", " />
}

// „Kierunek, uczelnia” obok wyróżnionego poziomu (Modern, Bold): w dokumencie `details`, w Edit mode dwa pola. Czy
// szablon rysuje szczegóły (i przecinek po poziomie) – `useShown(block, 'field', block.details)`.
export function EducationDetails({ block }: { block: EducationEntryBlock }) {
  const field = useField(block, 'field')
  const institution = useField(block, 'institution')
  if (!field || !institution) return block.details
  return <Joined fields={[field, institution]} separator=", " />
}
