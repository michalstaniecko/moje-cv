import { formatDateRange } from './dates'
import type { CvDocument, EducationItem, ExperienceItem, Section } from './schema'
import type { BlockSpacingMm } from './templateGeometry'

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
  | { kind: 'experienceEntry'; dates: string; role: string; companyLine: string; firstBullet: string | null }
  | { kind: 'experienceBullet'; text: string }
  | { kind: 'educationEntry'; dates: string; text: string }
  // Tytuł sekcji listy + pierwszy element (układ dwukolumnowy).
  | { kind: 'listFirst'; title: string; text: string }
  | { kind: 'listItem'; text: string }

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
  // Odstępy z geometrii templatu; odstęp między blokami to większy z nich, jak przy zapadaniu marginesów.
  marginTopMm?: number
  marginBottomMm?: number
}

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
        marginBottomMm: spacing.betweenBullets
      })
    )
  ]
  blocks[blocks.length - 1]!.marginBottomMm! += spacing.afterExperienceItem
  return blocks
}

function educationItemBlocks(item: EducationItem, spacing: BlockSpacingMm): DraftBlock[] {
  const dates = formatDateRange(item.start, item.end)
  const text = joinFilled([item.level, item.field, item.institution], ', ')
  if (!dates && !text) return []
  return [
    {
      kind: 'educationEntry',
      id: item.id,
      dates,
      text,
      breakBefore: item.pageBreakBefore,
      marginBottomMm: spacing.afterEducationItem
    }
  ]
}

function sectionBlocks(section: Section, spacing: BlockSpacingMm): DraftBlock[] {
  if (section.hidden) return []

  let blocks: DraftBlock[]
  switch (section.type) {
    case 'experience': {
      const items = section.items.flatMap((item) => experienceItemBlocks(item, spacing))
      blocks = items.length > 0 ? [...titleBlocks(section, spacing), ...items] : []
      break
    }
    case 'education': {
      const items = section.items.flatMap((item) => educationItemBlocks(item, spacing))
      if (items.length > 0) items[items.length - 1]!.marginBottomMm = spacing.afterEducationSection
      blocks = items.length > 0 ? [...titleBlocks(section, spacing), ...items] : []
      break
    }
    case 'list': {
      const [first, ...rest] = section.items.filter((item) => isFilled(item.text))
      if (!first) return []
      blocks = [
        { kind: 'listFirst', id: `${section.id}:${first.id}`, title: section.title, text: first.text },
        ...rest.map((item): DraftBlock => ({ kind: 'listItem', id: `${section.id}:${item.id}`, text: item.text }))
      ]
      for (const block of blocks) block.marginBottomMm = spacing.betweenListItems
      blocks[blocks.length - 1]!.marginBottomMm! += spacing.afterListSection
      break
    }
  }

  if (blocks[0] && section.pageBreakBefore) blocks[0].breakBefore = true
  return blocks
}

// Zamienia dokument na płaską listę bloków do podziału na strony. Puste pola, puste sekcje
// i sekcje ukryte są pomijane. Odstępy między blokami pochodzą z geometrii templatu.
export function generateBlocks(document: CvDocument, spacing: BlockSpacingMm): CvBlock[] {
  const drafts = [
    ...headerBlocks(document.header, spacing),
    ...document.sections.flatMap((section) => sectionBlocks(section, spacing))
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
