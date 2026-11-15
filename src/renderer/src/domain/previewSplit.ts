import type { CvBlock, Reveal } from './blocks'

// Podział stron Preview mode przy odsłoniętym fragmencie w Edit mode (docs/specs/wysiwyg-editing.md, W10; ADR-0010):
// licznik stron, ostrzeżenia paska podglądu i sprawdzenie przed eksportem zawsze liczą strony jak w Preview mode. Bloki
// Preview mode mają wysokości z pomiaru stron Edit mode, gdy są tam takie same; mierzone osobno (bez Page fields i
// placeholderów) są tylko bloki zwrócone przez `blocksToMeasureForPreview`.

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  )
}

const headerFragments = ['fullName', 'summary', 'contacts']

// Czy blok należy do odsłoniętego fragmentu – wtedy w Edit mode może mieć placeholdery pustych pól mimo tej samej treści.
// Id bloków niosą źródło (domain/blocks.ts): `header`, `<sekcja>:title`, `<wpis>`, `<wpis>:<punkt>`,
// `<sekcja>:<pierwszy element wiersza>`; tytuł obok listy jest w pierwszym wierszu sekcji (`firstRow`).
function inRevealedFragment(block: CvBlock, reveal: Reveal, firstRow: boolean): boolean {
  const owner = block.id.split(':')[0]!
  switch (block.kind) {
    case 'header':
      return headerFragments.some((part) => reveal.has(part))
    case 'sectionTitle':
      return reveal.has(`sectionTitle:${owner}`)
    case 'experienceEntry':
    case 'educationEntry':
    case 'experienceBullet':
      return reveal.has(`item:${owner}`)
    case 'listRow':
      return reveal.has(`list:${owner}`) || (firstRow && reveal.has(`sectionTitle:${owner}`))
  }
}

// Bloki Preview mode (`previewBlocks`, bez odsłonięcia), których wysokości nie można wziąć z pomiaru bloków Edit mode
// (`editBlocks`, z odsłoniętymi `reveal`): bez bloku o tym samym id i tej samej treści albo z odsłoniętego fragmentu.
export function blocksToMeasureForPreview(previewBlocks: CvBlock[], editBlocks: CvBlock[], reveal: Reveal): CvBlock[] {
  if (reveal.size === 0) return []
  const editById = new Map(editBlocks.map((block) => [block.id, block]))
  const listsSeen = new Set<string>()
  return previewBlocks.filter((block) => {
    const owner = block.id.split(':')[0]!
    const firstRow = block.kind === 'listRow' && !listsSeen.has(owner)
    if (block.kind === 'listRow') listsSeen.add(owner)
    return inRevealedFragment(block, reveal, firstRow) || !sameValue(block, editById.get(block.id))
  })
}
