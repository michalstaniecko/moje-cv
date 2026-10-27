import { formatDateRange } from './dates'
import type { CvDocument, EducationItem, ExperienceItem, Section } from './schema'
import type { BlockSpacingMm, TemplateGeometry } from './templateGeometry'

// Położenie bloku wpisu wśród bloków wpisów swojej sekcji (bez tytułu sekcji) – niezależne od podziału na strony.
// Szablon może z niego rysować dekoracje ciągnące się przez całą sekcję (np. oś czasu).
export type SectionPosition = { first: boolean; last: boolean }

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
const unplaced = (): SectionPosition => ({ first: false, last: false })

const isFilled = (text: string): boolean => text.trim() !== ''
const joinFilled = (parts: string[], separator: string): string => parts.filter(isFilled).join(separator)

function headerBlocks(header: CvDocument['header'], spacing: BlockSpacingMm): DraftBlock[] {
  const contacts = header.contacts.filter((contact) => isFilled(contact.value))
  const photoUrl = header.photo?.dataUrl ?? null
  if (!isFilled(header.fullName) && contacts.length === 0 && !isFilled(header.summary) && !photoUrl) return []
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

function titleBlocks(section: Section, spacing: BlockSpacingMm): DraftBlock[] {
  if (!isFilled(section.title)) return []
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

function experienceItemBlocks(item: ExperienceItem, spacing: BlockSpacingMm): DraftBlock[] {
  const dates = formatDateRange(item.start, item.end)
  const companyLine = joinFilled([item.company, item.location], ' – ')
  const bullets = item.bullets.filter((bullet) => isFilled(bullet.text))
  if (!isFilled(item.role) && !companyLine && !dates && bullets.length === 0) return []

  const [first, ...rest] = bullets
  const entry: DraftBlock = {
    kind: 'experienceEntry',
    id: item.id,
    dates,
    role: item.role,
    companyLine,
    firstBullet: first?.text ?? null,
    sectionPosition: unplaced(),
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
        sectionPosition: unplaced(),
        marginBottomMm: spacing.betweenBullets
      })
    )
  ]
  blocks[blocks.length - 1]!.marginBottomMm! += spacing.afterExperienceItem
  return blocks
}

function educationItemBlocks(item: EducationItem, spacing: BlockSpacingMm): DraftBlock[] {
  const dates = formatDateRange(item.start, item.end)
  const level = isFilled(item.level) ? item.level : ''
  const details = joinFilled([item.field, item.institution], ', ')
  if (!dates && !level && !details) return []
  return [
    {
      kind: 'educationEntry',
      id: item.id,
      dates,
      level,
      details,
      sectionPosition: unplaced(),
      breakBefore: item.pageBreakBefore,
      marginBottomMm: spacing.afterEducationItem
    }
  ]
}

function markSectionPositions(entries: DraftBlock[]): DraftBlock[] {
  entries.forEach((block, index) => {
    if ('sectionPosition' in block) block.sectionPosition = { first: index === 0, last: index === entries.length - 1 }
  })
  return entries
}

// Geometria szablonu potrzebna do generowania bloków.
export type BlockGeometry = Pick<TemplateGeometry, 'blockSpacingMm' | 'listSectionLayout'>

function listSectionBlocks(section: Extract<Section, { type: 'list' }>, geometry: BlockGeometry): DraftBlock[] {
  const { blockSpacingMm: spacing, listSectionLayout: layout } = geometry
  const items = section.items.filter((item) => isFilled(item.text)).map(({ id, text }) => ({ id, text }))
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
  return layout.title === 'above' ? [...titleBlocks(section, spacing), ...rows] : rows
}

function sectionBlocks(section: Section, geometry: BlockGeometry): DraftBlock[] {
  const spacing = geometry.blockSpacingMm
  if (section.hidden) return []

  let blocks: DraftBlock[]
  switch (section.type) {
    case 'experience': {
      const items = markSectionPositions(section.items.flatMap((item) => experienceItemBlocks(item, spacing)))
      blocks = items.length > 0 ? [...titleBlocks(section, spacing), ...items] : []
      break
    }
    case 'education': {
      const items = markSectionPositions(section.items.flatMap((item) => educationItemBlocks(item, spacing)))
      if (items.length > 0) items[items.length - 1]!.marginBottomMm = spacing.afterEducationSection
      blocks = items.length > 0 ? [...titleBlocks(section, spacing), ...items] : []
      break
    }
    case 'list':
      blocks = listSectionBlocks(section, geometry)
      break
  }

  if (blocks[0] && section.pageBreakBefore) blocks[0].breakBefore = true
  return blocks
}

// Zamienia dokument na płaską listę bloków do podziału na strony. Puste pola, puste sekcje
// i sekcje ukryte są pomijane. Odstępy między blokami i układ sekcji listowych pochodzą z geometrii szablonu.
export function generateBlocks(document: CvDocument, geometry: BlockGeometry): CvBlock[] {
  const drafts = [
    ...headerBlocks(document.header, geometry.blockSpacingMm),
    ...document.sections.flatMap((section) => sectionBlocks(section, geometry))
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
