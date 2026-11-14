import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { onAccentColor } from '../domain/accentColor'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { consentText } from '../domain/consent'
import { paginate, type PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { contentAreaMm, pageMetricsPx, type TemplateGeometry } from '../domain/templateGeometry'
import { CvBlockView } from './CvBlockView'
import { ConsentText, EditingProvider, type PageEditing } from './editable'
import { fontStack, loadTemplateFonts } from './fonts'
import './pages.css'
import type { TemplateDefinition } from './templateDefinition'
import { templates } from './templates'

// Mierzy bloki w ukrytym kontenerze (po załadowaniu fontów) i dzieli je na strony.
function usePagination(
  blocks: CvBlock[],
  font: CvDocument['settings']['font'],
  consent: string | null,
  geometry: TemplateGeometry
) {
  const blockElements = useRef(new Map<string, HTMLDivElement>())
  const consentElement = useRef<HTMLParagraphElement>(null)
  // Podział stron razem z blokami, z których go policzono (do czasu ponownego podziału bloki mogą być już nowsze).
  const [state, setState] = useState<{ layout: PaginateResult; blocks: CvBlock[] } | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    void loadTemplateFonts(font).then(() => {
      if (cancelled) return
      const metrics = pageMetricsPx(geometry)
      const height = (element: Element | null | undefined) => element?.getBoundingClientRect().height ?? 0
      const layout = paginate({
          blocks: blocks.map((block) => ({
            id: block.id,
            height: height(blockElements.current.get(block.id)),
            keepWithNext: block.keepWithNext,
            breakBefore: block.breakBefore
          })),
          pageHeight: metrics.contentHeight,
          consent: consent === null ? null : { height: height(consentElement.current), gap: metrics.consentGap }
        })
      setState({ layout, blocks })
    })
    return () => {
      cancelled = true
    }
  }, [blocks, font, consent, geometry])

  const measureRef = (id: string) => (element: HTMLDivElement | null) => {
    if (element) blockElements.current.set(id, element)
    else blockElements.current.delete(id)
  }

  return { layout: state?.layout ?? null, layoutBlocks: state?.blocks ?? null, measureRef, consentElement }
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

// Strony A4 z treścią CV w danym szablonie. Ten sam komponent służy do podglądu i do eksportu PDF.
// `template` – domyślnie szablon zapisany w CV; podany jawnie zastępuje go (np. miniatura innego szablonu).
// `firstPageOnly` – renderuje tylko pierwszą stronę (miniatura); podział stron i liczba stron w stopce są liczone
// jak dla całego dokumentu.
// `onReady` – wywoływane, gdy fonty są załadowane, podział policzony, a zdjęcie wczytane.
// `onLayout` – wywoływane po każdym podziale stron; `oversizedMessage` wyróżnia bloki wyższe niż strona i podpisuje je
// tym komunikatem (tylko podgląd – okno wydruku nie zna języka interfejsu i niczego nie wyróżnia).
// `editing` – tylko Edit mode (ADR-0010): sloty szablonu i tekst klauzuli zgody rysują tekst pól jako Page fields
// (editable.tsx), fragmenty z `editing.reveal` mają bloki (a odsłonięta klauzula – miejsce) mimo pustych pól, a stopki
// stron są ukryte przed czytnikiem ekranu (strony są wtedy dla niego CV z polami tekstowymi). Bez `editing` – dokument
// jak dotąd (podgląd w Preview mode, PDF, miniatury).
export function CvPages({
  document,
  template = templates[document.settings.template],
  firstPageOnly = false,
  onReady,
  onLayout,
  oversizedMessage,
  editing
}: {
  document: CvDocument
  template?: TemplateDefinition
  firstPageOnly?: boolean
  onReady?: () => void
  onLayout?: (layout: PaginateResult) => void
  oversizedMessage?: string
  editing?: PageEditing
}) {
  const { geometry, blockViews: views, PageFooter } = template
  const reveal = editing?.reveal
  const blocks = useMemo(() => generateBlocks(document, geometry, { reveal }), [document, geometry, reveal])
  // Klauzula odsłonięta w Edit mode (aktywna, pusta) jest na stronie mimo pustego tekstu – jest gdzie postawić kursor.
  const consent = consentText(document) ?? (reveal?.has('consent') && document.consent.enabled ? document.consent.text : null)
  const { layout, layoutBlocks, measureRef, consentElement } = usePagination(blocks, document.settings.font, consent, geometry)
  const blocksById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks])
  const pagesElement = useRef<HTMLDivElement>(null)
  useReadySignal(layout, pagesElement, onReady)
  useEffect(() => {
    if (layout) onLayout?.(layout)
  }, [layout, onLayout])
  // Po każdym renderze z podziałem stron policzonym z bieżących bloków, przed malowaniem: blok przeniesiony na inną
  // stronę jest nowym węzłem, więc edycja przywraca w nim kursor (W8).
  useLayoutEffect(() => {
    if (editing && layoutBlocks === blocks) editing.onPagesCommitted()
  })
  const listSectionLayout = geometry.listSectionLayout
  const measuring = useMemo(() => (editing ? { editing, measuring: true, listSectionLayout } : null), [editing, listSectionLayout])
  const onPages = useMemo(() => (editing ? { editing, measuring: false, listSectionLayout } : null), [editing, listSectionLayout])
  const markOversized = oversizedMessage !== undefined
  const pageCount = layout?.pages.length ?? 0
  const pages = firstPageOnly ? layout?.pages.slice(0, 1) : layout?.pages
  const oversizedIds = useMemo(() => new Set(markOversized ? layout?.oversizedIds : []), [layout, markOversized])

  const contentArea = contentAreaMm(geometry)
  const margins = geometry.pageMarginsMm
  const style = {
    '--accent': document.settings.accentColor,
    '--on-accent': onAccentColor(document.settings.accentColor),
    '--cv-margin-top': `${margins.top}mm`,
    '--cv-margin-right': `${margins.right}mm`,
    '--cv-margin-bottom': `${margins.bottom}mm`,
    '--cv-margin-left': `${margins.left}mm`,
    '--cv-content-width': `${contentArea.width}mm`,
    '--cv-content-height': `${contentArea.height}mm`,
    fontFamily: fontStack(document.settings.font)
  } as CSSProperties

  // `lang` z CV language: m.in. `text-transform: uppercase` w szablonach zależy od języka (po turecku „i” → „İ”).
  return (
    <div
      ref={pagesElement}
      className={editing ? `cv ${template.className} cv-editing` : `cv ${template.className}`}
      style={style}
      lang={document.settings.language}
    >
      <div className="cv-measure" aria-hidden>
        <EditingProvider value={measuring}>
          {blocks.map((block) => (
            <CvBlockView key={block.id} block={block} views={views} ref={measureRef(block.id)} />
          ))}
          {consent !== null && (
            <p ref={consentElement} className="cv-consent">
              <ConsentText text={consent} />
            </p>
          )}
        </EditingProvider>
      </div>

      {/* Ramka i warstwa stron pozwalają podglądowi skalować same strony, bez wpływu na pomiar bloków. */}
      <div className="cv-pages-frame" style={{ '--pages': pages?.length ?? 0 } as CSSProperties}>
        <div className="cv-pages">
          <EditingProvider value={onPages}>
            {pages?.map((ids, index) => (
              <section key={index} className="cv-page">
                <div className="cv-page-content">
                  {/* Do czasu ponownego podziału układ może jeszcze wskazywać bloki właśnie usunięte z dokumentu. */}
                  {ids.flatMap((id) => {
                    const block = blocksById.get(id)
                    return block ? [<CvBlockView key={id} block={block} views={views} oversized={oversizedIds.has(id)} />] : []
                  })}
                  {ids.some((id) => oversizedIds.has(id)) && (
                    <p className="cv-oversized-message">
                      {oversizedMessage}
                    </p>
                  )}
                  {consent !== null && index === pageCount - 1 && (
                    <p className="cv-consent">
                      <ConsentText text={consent} />
                    </p>
                  )}
                </div>
                {PageFooter && editing ? (
                  // `display: contents` – bez własnego pudełka, więc stopka leży na stronie jak w dokumencie.
                  <div className="cv-page-footer-frame" aria-hidden>
                    <PageFooter fullName={document.header.fullName} pageNumber={index + 1} pageCount={pageCount} />
                  </div>
                ) : (
                  PageFooter && <PageFooter fullName={document.header.fullName} pageNumber={index + 1} pageCount={pageCount} />
                )}
              </section>
            ))}
          </EditingProvider>
        </div>
      </div>
    </div>
  )
}
