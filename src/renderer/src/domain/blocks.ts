import { formatDateRange } from './dates'
import type { CvDocument, CvLanguage, EducationItem, ExperienceItem, Section } from './schema'
import type { BlockSpacingMm, TemplateGeometry } from './templateGeometry'

// Położenie bloku względem wpisów swojej sekcji (bez tytułu sekcji) – niezależne od podziału na strony.
// Szablon może z niego rysować dekoracje ciągnące się od pierwszego do ostatniego wpisu (np. oś czasu):
// first / last / only – początek pierwszego, ostatniego lub jedynego wpisu; middle – bloki pomiędzy nimi;
// afterLast – punkty ostatniego (lub jedynego) wpisu, już za końcem dekoracji.
export type SectionPosition = 'first' | 'middle' | 'last' | 'only' | 'afterLast'

type BlockContent =
  | {
      kind: 'header'
      fullName: string
      photoUrl: string | null
      contacts: { id: string; label: string; value: string }[]
      summary: string
    }
  | { kind: 'sectionTitle'; title: string }
  // Data + stanowisko + firma + pierwszy punkt wpisu.
  | {
      kind: 'experienceEntry'
      dates: string
      role: string
      companyLine: string
      firstBullet: string | null
      sectionPosition: SectionPosition
    }
  | { kind: 'experienceBullet'; text: string; sectionPosition: SectionPosition }
  // Poziom osobno od reszty linii (kierunek, uczelnia), żeby szablon mógł go wyróżnić.
  | { kind: 'educationEntry'; dates: string; level: string; details: string; sectionPosition: SectionPosition }
  // Wiersz sekcji listy: kolejne elementy (tyle, ile kolumn w układzie szablonu) i – w pierwszym wierszu
  // przy tytule obok listy – tytuł sekcji (w pozostałych wierszach pusty).
  | { kind: 'listRow'; title: string; items: { id: string; text: string }[] }

// Niepodzielny fragment dokumentu. Odstęp do następnego bloku (spaceAfterMm) jest częścią bloku
// (padding), żeby wysokości bloków sumowały się bez zapadania marginesów.
export type CvBlock = BlockContent & {
  id: string
  keepWithNext: boolean
  breakBefore: boolean
  spaceAfterMm: number
}

type DraftBlock = BlockContent & {
  id: string
  keepWithNext?: boolean
  breakBefore?: boolean
  // Odstępy z geometrii szablonu; odstęp między blokami to większy z nich, jak przy zapadaniu marginesów.
  marginTopMm?: number
  marginBottomMm?: number
}

// Pozycja w sekcji jest ustalana dopiero dla gotowej listy bloków wpisów (markSectionPositions).
const unplaced: SectionPosition = 'middle'

const noReveal: Reveal = new Set()

const isFilled = (text: string): boolean => text.trim() !== ''
const joinFilled = (parts: string[], separator: string): string => parts.filter(isFilled).join(separator)

// Części CV odsłonięte w Edit mode (docs/specs/wysiwyg-editing.md, W4, W10): mają blok mimo pustych pól, żeby było
// gdzie postawić kursor. Klucze to klucze fragmentów strony warstwy edycji (`fragmentKey` w canvas/editTargets.ts):
// `fullName` i `summary` (części nagłówka), `sectionTitle:<id sekcji>`, `item:<id wpisu>` (stanowisko albo wykształcenie –
// blok mimo pustych pól, a stanowisko ze wszystkimi punktami, także pustymi) i `list:<id sekcji>` (wiersze ze wszystkimi
// elementami listy, także pustymi). PDF, DOCX i Preview mode nigdy ich nie podają.
export type Reveal = ReadonlySet<string>

export type GenerateBlocksOptions = { reveal?: Reveal }

const headerParts = ['fullName', 'summary']

function headerBlocks(header: CvDocument['header'], spacing: BlockSpacingMm, reveal: Reveal): DraftBlock[] {
  const contacts = header.contacts.filter((contact) => isFilled(contact.value))
  const photoUrl = header.photo?.dataUrl ?? null
  const revealed = headerParts.some((part) => reveal.has(part))
  if (!isFilled(header.fullName) && contacts.length === 0 && !isFilled(header.summary) && !photoUrl && !revealed) return []
  return [
    {
      kind: 'header',
      id: 'header',
      fullName: header.fullName,
      photoUrl,
      contacts,
      summary: header.summary,
      marginBottomMm: spacing.afterHeader
    }
  ]
}

function titleBlocks(section: Section, spacing: BlockSpacingMm, reveal: Reveal): DraftBlock[] {
  if (!isFilled(section.title) && !reveal.has(`sectionTitle:${section.id}`)) return []
  return [
    {
      kind: 'sectionTitle',
      id: `${section.id}:title`,
      title: section.title,
      keepWithNext: true,
      marginTopMm: spacing.beforeSectionTitle,
      marginBottomMm: spacing.afterSectionTitle
    }
  ]
}

// Z czym budowane są bloki wpisów: odstępy z geometrii szablonu, CV language (stały tekst w datach) i części
// odsłonięte w Edit mode.
type EntryContext = { spacing: BlockSpacingMm; language: CvLanguage; reveal: Reveal }

function experienceItemBlocks(item: ExperienceItem, { spacing, language, reveal }: EntryContext): DraftBlock[] {
  const revealed = reveal.has(`item:${item.id}`)
  const dates = formatDateRange(item.start, item.end, language)
  const companyLine = joinFilled([item.company, item.location], ' – ')
  const bullets = revealed ? item.bullets : item.bullets.filter((bullet) => isFilled(bullet.text))
  if (!revealed && !isFilled(item.role) && !companyLine && !dates && bullets.length === 0) return []

  const [first, ...rest] = bullets
  const entry: DraftBlock = {
    kind: 'experienceEntry',
    id: item.id,
    dates,
    role: item.role,
    companyLine,
    firstBullet: first?.text ?? null,
    sectionPosition: unplaced,
    breakBefore: item.pageBreakBefore,
    marginBottomMm: first ? spacing.betweenBullets : spacing.afterExperienceEntryWithoutBullets
  }
  const blocks: DraftBlock[] = [
    entry,
    ...rest.map(
      (bullet): DraftBlock => ({
        kind: 'experienceBullet',
        id: `${item.id}:${bullet.id}`,
        text: bullet.text,
        sectionPosition: unplaced,
        marginBottomMm: spacing.betweenBullets
      })
    )
  ]
  blocks[blocks.length - 1]!.marginBottomMm! += spacing.afterExperienceItem
  return blocks
}

function educationItemBlocks(item: EducationItem, { spacing, language, reveal }: EntryContext): DraftBlock[] {
  const dates = formatDateRange(item.start, item.end, language)
  const level = isFilled(item.level) ? item.level : ''
  const details = joinFilled([item.field, item.institution], ', ')
  if (!dates && !level && !details && !reveal.has(`item:${item.id}`)) return []
  return [
    {
      kind: 'educationEntry',
      id: item.id,
      dates,
      level,
      details,
      sectionPosition: unplaced,
      breakBefore: item.pageBreakBefore,
      marginBottomMm: spacing.afterEducationItem
    }
  ]
}

const isEntryStart = (block: DraftBlock): boolean => block.kind === 'experienceEntry' || block.kind === 'educationEntry'

function markSectionPositions(entries: DraftBlock[]): DraftBlock[] {
  const starts = entries.filter(isEntryStart)
  const first = starts[0]
  const last = starts.at(-1)
  let afterLast = false
  for (const block of entries) {
    if (!('sectionPosition' in block)) continue
    if (afterLast) block.sectionPosition = 'afterLast'
    else if (block === first) block.sectionPosition = block === last ? 'only' : 'first'
    else if (block === last) block.sectionPosition = 'last'
    afterLast ||= block === last
  }
  return entries
}

// Geometria szablonu potrzebna do generowania bloków.
export type BlockGeometry = Pick<TemplateGeometry, 'blockSpacingMm' | 'listSectionLayout'>

function listSectionBlocks(section: Extract<Section, { type: 'list' }>, geometry: BlockGeometry, reveal: Reveal): DraftBlock[] {
  const { blockSpacingMm: spacing, listSectionLayout: layout } = geometry
  const shown = reveal.has(`list:${section.id}`) ? section.items : section.items.filter((item) => isFilled(item.text))
  const items = shown.map(({ id, text }) => ({ id, text }))
  if (items.length === 0) return []

  const rows: DraftBlock[] = []
  for (let index = 0; index < items.length; index += layout.columns) {
    const rowItems = items.slice(index, index + layout.columns)
    rows.push({
      kind: 'listRow',
      id: `${section.id}:${rowItems[0]!.id}`,
      title: layout.title === 'beside' && index === 0 ? section.title : '',
      items: rowItems,
      marginBottomMm: spacing.betweenListItems
    })
  }
  rows[rows.length - 1]!.marginBottomMm! += spacing.afterListSection
  return layout.title === 'above' ? [...titleBlocks(section, spacing, reveal), ...rows] : rows
}

function sectionBlocks(section: Section, geometry: BlockGeometry, language: CvLanguage, reveal: Reveal): DraftBlock[] {
  const spacing = geometry.blockSpacingMm
  const entry: EntryContext = { spacing, language, reveal }
  if (section.hidden) return []

  let blocks: DraftBlock[]
  switch (section.type) {
    case 'experience': {
      const items = markSectionPositions(section.items.flatMap((item) => experienceItemBlocks(item, entry)))
      blocks = items.length > 0 ? [...titleBlocks(section, spacing, reveal), ...items] : []
      break
    }
    case 'education': {
      const items = markSectionPositions(section.items.flatMap((item) => educationItemBlocks(item, entry)))
      if (items.length > 0) items[items.length - 1]!.marginBottomMm = spacing.afterEducationSection
      blocks = items.length > 0 ? [...titleBlocks(section, spacing, reveal), ...items] : []
      break
    }
    case 'list':
      blocks = listSectionBlocks(section, geometry, reveal)
      break
  }

  if (blocks[0] && section.pageBreakBefore) blocks[0].breakBefore = true
  return blocks
}

// Zamienia dokument na płaską listę bloków do podziału na strony. Puste pola, puste sekcje
// i sekcje ukryte są pomijane – poza częściami odsłoniętymi w Edit mode (`reveal`), które mają blok mimo pustych pól.
// Stały tekst (np. „present” w datach) jest w CV language dokumentu. Odstępy między blokami i układ sekcji listowych
// pochodzą z geometrii szablonu.
export function generateBlocks(document: CvDocument, geometry: BlockGeometry, { reveal = noReveal }: GenerateBlocksOptions = {}): CvBlock[] {
  const drafts = [
    ...headerBlocks(document.header, geometry.blockSpacingMm, reveal),
    ...document.sections.flatMap((section) => sectionBlocks(section, geometry, document.settings.language, reveal))
  ]
  return drafts.map(({ marginTopMm: _top, marginBottomMm, ...block }, index) => {
    const next = drafts[index + 1]
    return {
      ...block,
      keepWithNext: block.keepWithNext ?? false,
      breakBefore: block.breakBefore ?? false,
      spaceAfterMm: next ? Math.max(marginBottomMm ?? 0, next.marginTopMm ?? 0) : 0
    }
  })
}
