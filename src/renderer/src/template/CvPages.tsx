import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { paginate, type PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { CvBlockView } from './CvBlockView'
import { fontFamilies, loadTemplateFonts } from './fonts'
import './template.css'

const PX_PER_MM = 96 / 25.4
const CONTENT_HEIGHT_PX = 275 * PX_PER_MM
const CONSENT_GAP_PX = 6 * PX_PER_MM

// Mierzy bloki w ukrytym kontenerze (po załadowaniu fontów) i dzieli je na strony.
function usePagination(
  blocks: CvBlock[],
  font: CvDocument['settings']['font'],
  consentText: string | null
) {
  const blockElements = useRef(new Map<string, HTMLDivElement>())
  const consentElement = useRef<HTMLParagraphElement>(null)
  const [layout, setLayout] = useState<PaginateResult | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    void loadTemplateFonts(font).then(() => {
      if (cancelled) return
      const height = (element: Element | null | undefined) => element?.getBoundingClientRect().height ?? 0
      setLayout(
        paginate({
          blocks: blocks.map((block) => ({
            id: block.id,
            height: height(blockElements.current.get(block.id)),
            keepWithNext: block.keepWithNext,
            breakBefore: block.breakBefore
          })),
          pageHeight: CONTENT_HEIGHT_PX,
          consent: consentText === null ? null : { height: height(consentElement.current), gap: CONSENT_GAP_PX }
        })
      )
    })
    return () => {
      cancelled = true
    }
  }, [blocks, font, consentText])

  const measureRef = (id: string) => (element: HTMLDivElement | null) => {
    if (element) blockElements.current.set(id, element)
    else blockElements.current.delete(id)
  }

  return { layout, measureRef, consentElement }
}

// Zgłasza gotowość, gdy strony są ułożone, a wszystkie obrazki (zdjęcie) wczytane.
function useReadySignal(
  layout: PaginateResult | null,
  pagesElement: RefObject<HTMLDivElement | null>,
  onReady?: () => void
) {
  useEffect(() => {
    if (!layout || !onReady || !pagesElement.current) return
    let cancelled = false
    const images = [...pagesElement.current.querySelectorAll('img')]
    void Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (!cancelled) onReady()
    })
    return () => {
      cancelled = true
    }
  }, [layout, onReady, pagesElement])
}

// Strony A4 z treścią CV. Ten sam komponent służy do podglądu i do eksportu PDF.
// `onReady` – wywoływane, gdy fonty są załadowane, podział policzony, a zdjęcie wczytane.
export function CvPages({ document, onReady }: { document: CvDocument; onReady?: () => void }) {
  const blocks = useMemo(() => generateBlocks(document), [document])
  const consentText = document.consent.enabled && document.consent.text.trim() ? document.consent.text : null
  const { layout, measureRef, consentElement } = usePagination(blocks, document.settings.font, consentText)
  const blocksById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks])
  const pagesElement = useRef<HTMLDivElement>(null)
  useReadySignal(layout, pagesElement, onReady)

  const style = {
    '--accent': document.settings.accentColor,
    fontFamily: `"${fontFamilies[document.settings.font]}", sans-serif`
  } as CSSProperties

  return (
    <div ref={pagesElement} className="cv" style={style}>
      <div className="cv-measure" aria-hidden>
        {blocks.map((block) => (
          <CvBlockView key={block.id} block={block} ref={measureRef(block.id)} />
        ))}
        {consentText !== null && (
          <p ref={consentElement} className="cv-consent">
            {consentText}
          </p>
        )}
      </div>

      {layout?.pages.map((ids, index) => (
        <section key={index} className="cv-page">
          <div className="cv-page-content">
            {/* Do czasu ponownego podziału układ może jeszcze wskazywać bloki właśnie usunięte z dokumentu. */}
            {ids.flatMap((id) => {
              const block = blocksById.get(id)
              return block ? [<CvBlockView key={id} block={block} />] : []
            })}
            {consentText !== null && index === layout.pages.length - 1 && (
              <p className="cv-consent">{consentText}</p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
