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
// punktu), pola wykształcenia (`level`, `field`, `institution`), element wiersza listy (`item`, z id elementu) i daty
// wpisu (`start`, `end` – żetony dat, `DateRange`).
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
  | 'start'
  | 'end'

// Pole CV rysowane przez slot w Edit mode. `key` – klucz pola (= klucz łączenia kroków cofania i `data-field-key`),
// `fragment` – klucz fragmentu strony, do którego pole należy (aktywny fragment pokazuje placeholdery pustych pól,
// zob. `Reveal`), `label` – nazwa pola dla czytnika ekranu, `placeholder` – tekst pustego pola, `spellcheck` –
// sprawdzanie pisowni (W24), `value` – wartość pola w dokumencie (sloty złożone rysują pola, które blok łączy w jeden
// napis, np. `companyLine`; data – napis daty w CV language, np. „03.2021”), `describedBy` – id opisu pola dla czytnika
// ekranu (np. ostrzeżenia o kolejności dat).
export type EditableField = {
  key: string
  fragment: string
  label: string
  placeholder: string
  spellcheck: boolean
  value: string
  describedBy?: string
}

// `measuring` – kopia w kontenerze pomiarowym: ten sam tekst i placeholder (identyczna geometria), bez edycji i fokusu.
export type PageFieldProps = { field: EditableField; text: string; measuring: boolean }

// Linia złączona z kilku pól (np. „firma – miejscowość”) poza rozwiniętym fragmentem: `text` – napis dokumentu
// (dokładnie ten sam węzeł tekstowy co w PDF), `fields` – pola na nim, w kolejności, rozdzielone `separator`.
export type JoinedFieldsProps = { fields: EditableField[]; separator: string; text: string; measuring: boolean }

// Edycja stron w Edit mode – implementuje ją warstwa edycji (canvas/), szablony widzą tylko ten interfejs.
// - `fieldOf` – pole CV, którego tekst rysuje slot `slot` w bloku `block` (`part` – id elementu wiersza listy); null –
//   tekst nie jest (jeszcze) polem i zostaje jak w dokumencie.
// - `reveal` – fragmenty, które mają blok i pokazują swoje puste pola mimo pustej treści (`generateBlocks`).
// - `expanded` – fragmenty, w których linie złączone z kilku pól są rysowane jako osobne Page fields (aktywny fragment;
//   odsłonięte są rozwinięte zawsze). W pozostałych taka linia to jeden napis jak w dokumencie (`Joined`): granica
//   elementów w środku linii przesuwa dalszy tekst o ułamek piksela (pozycja każdego elementu jest zaokrąglana do 1/64
//   px), a strony w spoczynku muszą być piksel w piksel jak w PDF.
// - `Field` – komponent Page field (musi mieć stałą tożsamość, inaczej pole traci kursor przy każdym renderze);
//   `Joined` – komponent linii złączonej poza rozwiniętym fragmentem (klik i fokus rozwijają fragment); `DateToken` –
//   żeton daty (przycisk otwierający Field popover daty; napis daty albo placeholder); `JoinedDates` – daty wpisu poza
//   rozwiniętym fragmentem (jeden napis jak w dokumencie; klik rozwija wpis i otwiera popover klikniętej daty).
// - `onPagesCommitted` – wołane przed malowaniem po każdym nowym podziale stron (np. przywrócenie kursora w polu
//   przeniesionym na inną stronę).
export type PageEditing = {
  fieldOf: (block: CvBlock, slot: SlotName, part?: string) => EditableField | null
  reveal: Reveal
  expanded: ReadonlySet<string>
  Field: ComponentType<PageFieldProps>
  Joined: ComponentType<JoinedFieldsProps>
  DateToken: ComponentType<PageFieldProps>
  JoinedDates: ComponentType<JoinedFieldsProps>
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

// Pola złączone w jeden napis bloku (`text` – napis dokumentu). W rozwiniętym fragmencie każde pole osobno, a separator
// między dwoma polami na stronie – między niepustymi polami (jak `joinFilled` w domain/blocks.ts), w odsłoniętym
// fragmencie między wszystkimi. Poza nim – jeden napis (`PageEditing.Joined`).
function Joined({ fields, separator, text }: { fields: Editable[]; separator: string; text: string }) {
  const shown = fields.filter(shownField)
  const { context } = fields[0]!
  if (!context.editing.expanded.has(fields[0]!.field.fragment)) {
    if (text === '') return text
    const { Joined: JoinedText } = context.editing
    return <JoinedText fields={shown.map(({ field }) => field)} separator={separator} text={text} measuring={context.measuring} />
  }
  return shown.map((editable, index) => (
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
  return <Joined fields={[company, location]} separator=" – " text={block.companyLine} />
}

// „Poziom, kierunek, uczelnia” wspólnego markupu (Classic): w dokumencie jeden napis, w Edit mode trzy pola.
export function EducationLine({ block }: { block: EducationEntryBlock }) {
  const level = useField(block, 'level')
  const field = useField(block, 'field')
  const institution = useField(block, 'institution')
  const text = [block.level, block.details].filter((part) => part !== '').join(', ')
  if (!level || !field || !institution) return text
  return <Joined fields={[level, field, institution]} separator=", " text={text} />
}

// „Kierunek, uczelnia” obok wyróżnionego poziomu (Modern, Bold): w dokumencie `details`, w Edit mode dwa pola. Czy
// szablon rysuje szczegóły (i przecinek po poziomie) – `useShown(block, 'field', block.details)`.
export function EducationDetails({ block }: { block: EducationEntryBlock }) {
  const field = useField(block, 'field')
  const institution = useField(block, 'institution')
  if (!field || !institution) return block.details
  return <Joined fields={[field, institution]} separator=", " text={block.details} />
}

// Daty wpisu („od – do”) w `.cv-date`: w dokumencie `dates`, w Edit mode w rozwiniętym fragmencie dwa żetony dat
// z separatorem „ – ” (jak `formatDateRange`: między dwiema niepustymi datami, w odsłoniętym fragmencie – zawsze), poza
// nim – jeden napis jak w dokumencie (`PageEditing.JoinedDates`): granica elementów w środku napisu przesuwa dalsze
// znaki o ułamek piksela, jak w liniach złączonych. Czy szablon rysuje element dat, gdy są puste (Bold) –
// `useShown(block, 'start', block.dates)`.
export function DateRange({ block }: { block: ExperienceEntryBlock | EducationEntryBlock }) {
  const start = useField(block, 'start')
  const end = useField(block, 'end')
  if (!start || !end) return block.dates
  const shown = [start, end].filter(shownField)
  const { context } = start
  if (!context.editing.expanded.has(start.field.fragment)) {
    if (block.dates === '') return block.dates
    const { JoinedDates } = context.editing
    return <JoinedDates fields={shown.map(({ field }) => field)} separator=" – " text={block.dates} measuring={context.measuring} />
  }
  return shown.map((editable, index) => {
    const { DateToken } = editable.context.editing
    return (
      <Fragment key={editable.field.key}>
        {index > 0 && ' – '}
        <DateToken field={editable.field} text={editable.field.value} measuring={editable.context.measuring} />
      </Fragment>
    )
  })
}
