import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { CONSENT_BLOCK_ID, editMarkupContract, headerParts } from './editTargets'
import { fragmentRects, sameFragments, unionRect, type Fragment, type MeasuredBlock, type Rect } from './fragmentRects'

const headerSelector = headerParts.map((part) => editMarkupContract[part]).join(', ')

// Prostokąty fragmentów stron w px względem warstwy edycji (`layer`), odczytane z bloków na stronach
// (`.cv-pages [data-block-id]` w `panel`, nigdy z kontenera pomiarowego `.cv-measure`).
// Odczyt w `requestAnimationFrame` po każdym nowym podziale stron (`layout`), zmianie skali i zmianie rozmiaru panelu
// stron (strony są wyśrodkowane, więc szerokość panelu je przesuwa). Hook działa tylko, gdy warstwa istnieje (Edit mode).
// Przewijanie nie zmienia prostokątów: warstwa przewija się razem ze stronami.
// `pages` – prostokąty stron (`.cv-pages > .cv-page`) w tych samych współrzędnych, dla kontrolek warstwy poza
// fragmentami (pasek „Add to CV” pod ostatnią stroną, podpowiedź w pustym CV).
export function useFragmentRects({
  layer,
  panel,
  document,
  layout,
  scale
}: {
  layer: RefObject<HTMLElement | null>
  panel: RefObject<HTMLElement | null>
  document: CvDocument
  layout: PaginateResult | null
  scale: number
}): { fragments: Fragment[]; pages: Rect[] } {
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [pages, setPages] = useState<Rect[]>([])
  // Dokument, z którego powstał ostatni podział stron – do niego pasują id bloków na stronach.
  const latestDocument = useRef(document)
  useEffect(() => {
    latestDocument.current = document
  })

  const measure = useCallback(() => {
    if (!layer.current || !panel.current) return
    const { blocks, pages: nextPages } = readBlocks(layer.current, panel.current)
    const next = fragmentRects(blocks, latestDocument.current)
    setFragments((current) => (sameFragments(current, next) ? current : next))
    setPages((current) => (sameRects(current, nextPages) ? current : nextPages))
  }, [layer, panel])

  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [measure, layout, scale])

  useEffect(() => {
    const element = panel.current
    if (!element) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [measure, panel])

  return { fragments, pages }
}

const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length &&
  a.every(
    (rect, index) =>
      rect.top === b[index]!.top && rect.left === b[index]!.left && rect.right === b[index]!.right && rect.bottom === b[index]!.bottom
  )

function readBlocks(layer: HTMLElement, panel: HTMLElement): { blocks: MeasuredBlock[]; pages: Rect[] } {
  const origin = layer.getBoundingClientRect()
  const relative = (rect: DOMRect): Rect => ({
    top: rect.top - origin.top,
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    bottom: rect.bottom - origin.top
  })
  const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0
  const union = (elements: Iterable<Element>): Rect | null => {
    const rects = [...elements].map((element) => element.getBoundingClientRect()).filter(visible)
    return rects.length > 0 ? rects.map(relative).reduce(unionRect) : null
  }

  const blocks: MeasuredBlock[] = []
  const pages: Rect[] = []
  panel.querySelectorAll('.cv-pages > .cv-page').forEach((page, index) => {
    pages.push(relative(page.getBoundingClientRect()))
    page.querySelectorAll<HTMLElement>('[data-block-id]').forEach((element) => {
      // Treść bloku bez odstępu po nim (padding opakowania).
      const rect = union(element.children)
      if (!rect) return
      const parts: MeasuredBlock['parts'] = []
      if (element.dataset['block'] === 'header') {
        element.querySelectorAll(headerSelector).forEach((part) => {
          const name = headerParts.find((candidate) => part.matches(editMarkupContract[candidate]))
          const partRect = union([part])
          if (name && partRect) parts.push({ part: name, rect: partRect })
        })
      } else if (element.dataset['block'] === 'listRow') {
        const title = union(element.querySelectorAll(editMarkupContract.sectionTitle))
        const items = union(element.querySelectorAll(editMarkupContract.item))
        if (title) parts.push({ part: 'sectionTitle', rect: title })
        if (items) parts.push({ part: 'items', rect: items })
      }
      blocks.push({ blockId: element.dataset['blockId']!, page: index, rect, parts })
    })
    // Klauzula zgody na dole ostatniej strony – poza blokami, ale z własną Edit card.
    const consent = union(page.querySelectorAll(editMarkupContract.consent))
    if (consent) blocks.push({ blockId: CONSENT_BLOCK_ID, page: index, rect: consent, parts: [] })
  })
  return { blocks, pages }
}
