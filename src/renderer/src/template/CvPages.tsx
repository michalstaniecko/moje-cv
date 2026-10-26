import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { paginate, type PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { contentAreaMm, pageMetricsPx, type TemplateGeometry } from '../domain/templateGeometry'
import { CvBlockView } from './CvBlockView'
import { fontFamilies, loadTemplateFonts } from './fonts'
import './pages.css'
import type { TemplateDefinition } from './templateDefinition'
import { templates } from './templates'

// Mierzy bloki w ukrytym kontenerze (po załadowaniu fontów) i dzieli je na strony.
function usePagination(
  blocks: CvBlock[],
  font: CvDocument['settings']['font'],
  consentText: string | null,
  geometry: TemplateGeometry
) {
  const blockElements = useRef(new Map<string, HTMLDivElement>())
  const consentElement = useRef<HTMLParagraphElement>(null)
  const [layout, setLayout] = useState<PaginateResult | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    void loadTemplateFonts(font).then(() => {
      if (cancelled) return
      const metrics = pageMetricsPx(geometry)
      const height = (element: Element | null | undefined) => element?.getBoundingClientRect().height ?? 0
      setLayout(
        paginate({
          blocks: blocks.map((block) => ({
            id: block.id,
            height: height(blockElements.current.get(block.id)),
            keepWithNext: block.keepWithNext,
            breakBefore: block.breakBefore
          })),
          pageHeight: metrics.contentHeight,
          consent: consentText === null ? null : { height: height(consentElement.current), gap: metrics.consentGap }
        })
      )
    })
    return () => {
      cancelled = true
    }
  }, [blocks, font, consentText, geometry])

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

// Strony A4 z treścią CV w danym templacie. Ten sam komponent służy do podglądu i do eksportu PDF.
// `template` – domyślnie template zapisany w CV; podany jawnie zastępuje go (np. miniatura innego templatu).
// `onReady` – wywoływane, gdy fonty są załadowane, podział policzony, a zdjęcie wczytane.
// `onLayout` – wywoływane po każdym podziale stron; `oversizedMessage` wyróżnia bloki wyższe niż strona i podpisuje je
// tym komunikatem (tylko podgląd – okno wydruku nie zna języka interfejsu i niczego nie wyróżnia).
export function CvPages({
  document,
  template = templates[document.settings.template],
  onReady,
  onLayout,
  oversizedMessage
}: {
  document: CvDocument
  template?: TemplateDefinition
  onReady?: () => void
  onLayout?: (layout: PaginateResult) => void
  oversizedMessage?: string
}) {
  const { geometry } = template
  const blocks = useMemo(() => generateBlocks(document, geometry.blockSpacingMm), [document, geometry])
  const consentText = document.consent.enabled && document.consent.text.trim() ? document.consent.text : null
  const { layout, measureRef, consentElement } = usePagination(
    blocks,
    document.settings.font,
    consentText,
    geometry
  )
  const blocksById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks])
  const pagesElement = useRef<HTMLDivElement>(null)
  useReadySignal(layout, pagesElement, onReady)
  useEffect(() => {
    if (layout) onLayout?.(layout)
  }, [layout, onLayout])
  const markOversized = oversizedMessage !== undefined
  const oversizedIds = useMemo(() => new Set(markOversized ? layout?.oversizedIds : []), [layout, markOversized])

  const contentArea = contentAreaMm(geometry)
  const margins = geometry.pageMarginsMm
  const style = {
    '--accent': document.settings.accentColor,
    '--cv-margin-top': `${margins.top}mm`,
    '--cv-margin-right': `${margins.right}mm`,
    '--cv-margin-bottom': `${margins.bottom}mm`,
    '--cv-margin-left': `${margins.left}mm`,
    '--cv-content-width': `${contentArea.width}mm`,
    '--cv-content-height': `${contentArea.height}mm`,
    fontFamily: `"${fontFamilies[document.settings.font]}", sans-serif`
  } as CSSProperties

  return (
    <div ref={pagesElement} className={`cv ${template.className}`} style={style}>
      <div className="cv-measure" aria-hidden>
        {blocks.map((block) => (
          <CvBlockView key={block.id} block={block} views={template.blockViews} ref={measureRef(block.id)} />
        ))}
        {consentText !== null && (
          <p ref={consentElement} className="cv-consent">
            {consentText}
          </p>
        )}
      </div>

      {/* Ramka i warstwa stron pozwalają podglądowi skalować same strony, bez wpływu na pomiar bloków. */}
      <div className="cv-pages-frame" style={{ '--pages': layout?.pages.length ?? 0 } as CSSProperties}>
        <div className="cv-pages">
          {layout?.pages.map((ids, index) => (
            <section key={index} className="cv-page">
              <div className="cv-page-content">
                {/* Do czasu ponownego podziału układ może jeszcze wskazywać bloki właśnie usunięte z dokumentu. */}
                {ids.flatMap((id) => {
                  const block = blocksById.get(id)
                  return block ? [
                        <CvBlockView
                          key={id}
                          block={block}
                          views={template.blockViews}
                          oversized={oversizedIds.has(id)}
                        />
                      ] : []
                })}
                {ids.some((id) => oversizedIds.has(id)) && (
                  <p className="cv-oversized-message" role="status">
                    {oversizedMessage}
                  </p>
                )}
                {consentText !== null && index === layout.pages.length - 1 && (
                  <p className="cv-consent">{consentText}</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
