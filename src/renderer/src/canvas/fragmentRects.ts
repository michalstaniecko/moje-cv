import type { CvDocument } from '../domain/schema'
import { blockTarget, fragmentKey, fragmentTarget, headerPartTarget, headerParts, type EditTarget } from './editTargets'

// Prostokąt w px względem warstwy edycji (już w skali powiększenia stron).
export type Rect = { top: number; left: number; right: number; bottom: number }

// Część bloku rozpoznana po klasach kontraktu znaczników (`editMarkupContract`): części nagłówka, tytuł sekcji obok
// listy i elementy (`li`) wiersza listy razem.
export type BlockPart = (typeof headerParts)[number] | 'sectionTitle' | 'items'

// Blok odczytany ze strony: id bloku (`data-block-id`), numer strony, prostokąt jego treści (bez odstępu po bloku)
// i prostokąty części w kolejności DOM.
export type MeasuredBlock = {
  blockId: string
  page: number
  rect: Rect
  parts: { part: BlockPart; rect: Rect }[]
}

// Fragment strony: część CV edytowana jedną Edit card, na jednej stronie (wpis rozdzielony podziałem stron to dwa
// fragmenty o tym samym kluczu). `target` – cel bez pola, otwierany klawiaturą.
export type Fragment = { key: string; target: EditTarget; page: number; rect: Rect }

const isHeaderPart = (part: BlockPart): part is (typeof headerParts)[number] =>
  (headerParts as readonly string[]).includes(part)

export const unionRect = (a: Rect, b: Rect): Rect => ({
  top: Math.min(a.top, b.top),
  left: Math.min(a.left, b.left),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom)
})

// Kawałki jednego bloku: nagłówek dzielony po klasach kontraktu (bez nich – w całości imię i nazwisko), pierwszy wiersz
// listy z tytułem obok – tytuł sekcji i elementy osobno; pozostałe bloki w całości.
function blockPieces(block: MeasuredBlock, target: EditTarget): { target: EditTarget; rect: Rect }[] {
  const partRect = (name: BlockPart) => block.parts.find(({ part }) => part === name)?.rect
  if (block.blockId === 'header') {
    const pieces = block.parts.flatMap(({ part, rect }) =>
      isHeaderPart(part) ? [{ target: headerPartTarget(part), rect }] : []
    )
    return pieces.length > 0 ? pieces : [{ target, rect: block.rect }]
  }
  const title = partRect('sectionTitle')
  if (target.kind === 'listSection' && title) {
    return [
      { target: { kind: 'sectionTitle', sectionId: target.sectionId }, rect: title },
      { target, rect: partRect('items') ?? block.rect }
    ]
  }
  return [{ target: fragmentTarget(target), rect: block.rect }]
}

// Łączy bloki w fragmenty: na każdej stronie osobno suma prostokątów bloków jednej części CV (wpis + jego punkty,
// wszystkie wiersze sekcji listowej). Kolejność – dokumentu (bloki i ich części przychodzą w kolejności stron i DOM).
// Bloki spoza dokumentu (układ sprzed ponownego podziału stron) są pomijane.
export function fragmentRects(blocks: MeasuredBlock[], document: CvDocument): Fragment[] {
  const fragments = new Map<string, Fragment>()
  for (const block of blocks) {
    const target = blockTarget(block.blockId, document)
    if (!target) continue
    for (const piece of blockPieces(block, target)) {
      const key = fragmentKey(piece.target)
      const id = `${key}@${block.page}`
      const existing = fragments.get(id)
      fragments.set(
        id,
        existing
          ? { ...existing, rect: unionRect(existing.rect, piece.rect) }
          : { key, target: piece.target, page: block.page, rect: piece.rect }
      )
    }
  }
  return [...fragments.values()]
}

// Czy dwa zestawy fragmentów rysują to samo (bez przerysowania warstwy, gdy pomiar niczego nie zmienił).
export function sameFragments(a: Fragment[], b: Fragment[]): boolean {
  return (
    a.length === b.length &&
    a.every((fragment, index) => {
      const other = b[index]!
      return (
        fragment.key === other.key &&
        fragment.page === other.page &&
        fragment.rect.top === other.rect.top &&
        fragment.rect.left === other.rect.left &&
        fragment.rect.right === other.rect.right &&
        fragment.rect.bottom === other.rect.bottom
      )
    })
  )
}
