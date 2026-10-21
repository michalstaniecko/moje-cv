export type PaginationBlock = {
  id: string
  height: number
  keepWithNext: boolean
  breakBefore: boolean
}

export type PaginateInput = {
  blocks: PaginationBlock[]
  pageHeight: number
  consent: { height: number; gap: number } | null
}

export type PaginateResult = {
  pages: string[][]
  consentOnOwnPage: boolean
  oversizedIds: string[]
}

// Łańcuch bloków keepWithNext razem z blokiem, który go kończy – przenoszony na nową stronę w całości.
function groupIntoChains(blocks: PaginationBlock[]): PaginationBlock[][] {
  const chains: PaginationBlock[][] = []
  let current: PaginationBlock[] = []
  for (const block of blocks) {
    current.push(block)
    if (!block.keepWithNext) {
      chains.push(current)
      current = []
    }
  }
  if (current.length > 0) chains.push(current)
  return chains
}

const sumHeights = (blocks: PaginationBlock[]): number =>
  blocks.reduce((sum, block) => sum + block.height, 0)

// Łańcuch wyższy niż strona dzielony jest na najdłuższe mieszczące się na stronie fragmenty.
function splitToFit(chain: PaginationBlock[], pageHeight: number): PaginationBlock[][] {
  const parts: PaginationBlock[][] = []
  let rest = chain
  while (rest.length > 0) {
    let size = rest.length
    while (size > 1 && sumHeights(rest.slice(0, size)) > pageHeight) size--
    parts.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  return parts
}

export function paginate({ blocks, pageHeight, consent }: PaginateInput): PaginateResult {
  const pages: string[][] = [[]]
  const oversizedIds: string[] = []
  let usedHeight = 0

  for (const chain of groupIntoChains(blocks).flatMap((chain) => splitToFit(chain, pageHeight))) {
    const chainHeight = sumHeights(chain)
    // breakBefore w środku łańcucha przenosi cały łańcuch, żeby tytuł nie został sam na dole strony.
    const startNewPage = chain.some((block) => block.breakBefore) || usedHeight + chainHeight > pageHeight
    if (startNewPage && pages[pages.length - 1]!.length > 0) {
      pages.push([])
      usedHeight = 0
    }
    pages[pages.length - 1]!.push(...chain.map((block) => block.id))
    usedHeight += chainHeight

    if (chainHeight > pageHeight) {
      oversizedIds.push(chain[0]!.id)
      usedHeight = pageHeight
    }
  }

  const consentOnOwnPage = consent !== null && pageHeight - usedHeight < consent.height + consent.gap
  if (consentOnOwnPage) pages.push([])

  return { pages, consentOnOwnPage, oversizedIds }
}
