import { formatDateRange } from './dates'
import type { CvDocument, EducationItem, ExperienceItem, Section } from './schema'

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
  // Marginesy z briefu; odstęp między blokami to większy z nich, jak przy zapadaniu marginesów.
  marginTopMm?: number
  marginBottomMm?: number
}

const isFilled = (text: string): boolean => text.trim() !== ''
const joinFilled = (parts: string[], separator: string): string => parts.filter(isFilled).join(separator)

const ENTRY_GAP_MM = 5
const BULLET_GAP_MM = 0.6
const COMPANY_GAP_MM = 2

function headerBlocks(header: CvDocument['header']): DraftBlock[] {
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
      marginBottomMm: 6
    }
  ]
}

function titleBlocks(section: Section): DraftBlock[] {
  if (!isFilled(section.title)) return []
  return [
    {
      kind: 'sectionTitle',
      id: `${section.id}:title`,
      title: section.title,
      keepWithNext: true,
      marginTopMm: 6,
      marginBottomMm: 3
    }
  ]
}

function experienceItemBlocks(item: ExperienceItem): DraftBlock[] {
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
    marginBottomMm: first ? BULLET_GAP_MM : COMPANY_GAP_MM
  }
  const blocks: DraftBlock[] = [
    entry,
    ...rest.map(
      (bullet): DraftBlock => ({
        kind: 'experienceBullet',
        id: `${item.id}:${bullet.id}`,
        text: bullet.text,
        marginBottomMm: BULLET_GAP_MM
      })
    )
  ]
  blocks[blocks.length - 1]!.marginBottomMm! += ENTRY_GAP_MM
  return blocks
}

function educationItemBlocks(item: EducationItem): DraftBlock[] {
  const dates = formatDateRange(item.start, item.end)
  const text = joinFilled([item.level, item.field, item.institution], ', ')
  if (!dates && !text) return []
  return [
    { kind: 'educationEntry', id: item.id, dates, text, breakBefore: item.pageBreakBefore, marginBottomMm: 2 }
  ]
}

function sectionBlocks(section: Section): DraftBlock[] {
  if (section.hidden) return []

  let blocks: DraftBlock[]
  switch (section.type) {
    case 'experience': {
      const items = section.items.flatMap(experienceItemBlocks)
      blocks = items.length > 0 ? [...titleBlocks(section), ...items] : []
      break
    }
    case 'education': {
      const items = section.items.flatMap(educationItemBlocks)
      if (items.length > 0) items[items.length - 1]!.marginBottomMm = 6
      blocks = items.length > 0 ? [...titleBlocks(section), ...items] : []
      break
    }
    case 'list': {
      const [first, ...rest] = section.items.filter((item) => isFilled(item.text))
      if (!first) return []
      blocks = [
        { kind: 'listFirst', id: `${section.id}:${first.id}`, title: section.title, text: first.text },
        ...rest.map((item): DraftBlock => ({ kind: 'listItem', id: `${section.id}:${item.id}`, text: item.text }))
      ]
      for (const block of blocks) block.marginBottomMm = BULLET_GAP_MM
      blocks[blocks.length - 1]!.marginBottomMm! += 4
      break
    }
  }

  if (blocks[0] && section.pageBreakBefore) blocks[0].breakBefore = true
  return blocks
}

// Zamienia dokument na płaską listę bloków do podziału na strony. Puste pola, puste sekcje
// i sekcje ukryte są pomijane.
export function generateBlocks(document: CvDocument): CvBlock[] {
  const drafts = [...headerBlocks(document.header), ...document.sections.flatMap(sectionBlocks)]
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
