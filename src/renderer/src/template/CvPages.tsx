import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { onAccentColor } from '../domain/accentColor'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { consentText } from '../domain/consent'
import { paginate, type PaginateResult } from '../domain/paginate'
import { blocksToMeasureForPreview } from '../domain/previewSplit'
import type { CvDocument } from '../domain/schema'
import { contentAreaMm, pageMetricsPx, type TemplateGeometry } from '../domain/templateGeometry'
import { CvBlockView } from './CvBlockView'
import { ConsentText, EditingProvider, type PageEditing } from './editable'
import { fontStack, loadTemplateFonts } from './fonts'
import './pages.css'
import type { TemplateDefinition } from './templateDefinition'
import { templates } from './templates'

// Podział stron Preview mode przy odsłoniętym fragmencie w Edit mode (W10): bloki i klauzula bez odsłonięcia oraz te z
// bloków, które trzeba zmierzyć osobno (domain/previewSplit.ts) – reszta ma wysokości z pomiaru bloków Edit mode.
type PreviewSplit = { blocks: CvBlock[]; toMeasure: CvBlock[]; consent: string | null }

// Mierzy bloki w ukrytym kontenerze (po załadowaniu fontów) i dzieli je na strony; z `preview` – także jak w Preview mode.
function usePagination(
  blocks: CvBlock[],
  font: CvDocument['settings']['font'],
  consent: string | null,
  geometry: TemplateGeometry,
  preview: PreviewSplit | null
) {
  const blockElements = useRef(new Map<string, HTMLDivElement>())
  const previewElements = useRef(new Map<string, HTMLDivElement>())
  const consentElement = useRef<HTMLParagraphElement>(null)
  // Podział stron (i ten jak w Preview mode) razem z blokami, z których go policzono (do czasu ponownego podziału bloki
  // mogą być już nowsze).
  const [state, setState] = useState<{ layout: PaginateResult; previewLayout: PaginateResult; blocks: CvBlock[] } | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    void loadTemplateFonts(font).then(() => {
      if (cancelled) return
      const metrics = pageMetricsPx(geometry)
      const height = (element: Element | null | undefined) => element?.getBoundingClientRect().height ?? 0
      const split = (blocks: CvBlock[], heightOf: (id: string) => number, consent: string | null) =>
        paginate({
          blocks: blocks.map((block) => ({
            id: block.id,
            height: heightOf(block.id),
            keepWithNext: block.keepWithNext,
            breakBefore: block.breakBefore
          })),
          pageHeight: metrics.contentHeight,
          consent: consent === null ? null : { height: height(consentElement.current), gap: metrics.consentGap }
        })
      const editHeight = (id: string) => height(blockElements.current.get(id))
      const layout = split(blocks, editHeight, consent)
      // Klauzula jak w Preview mode jest tą z Edit mode (odsłonięta pusta klauzula w Preview mode znika – `null`).
      const measured = new Set(preview?.toMeasure.map((block) => block.id))
      const previewLayout = preview
        ? split(preview.blocks, (id) => (measured.has(id) ? height(previewElements.current.get(id)) : editHeight(id)), preview.consent)
        : layout
      setState({ layout, previewLayout, blocks })
    })
    return () => {
      cancelled = true
    }
  }, [blocks, font, consent, geometry, preview])

  const refInto = (elements: Map<string, HTMLDivElement>, id: string) => (element: HTMLDivElement | null) => {
    if (element) elements.set(id, element)
    else elements.delete(id)
  }
  const measureRef = (id: string) => refInto(blockElements.current, id)
  const previewMeasureRef = (id: string) => refInto(previewElements.current, id)

  return {
    layout: state?.layout ?? null,
    previewLayout: state?.previewLayout ?? null,
    layoutBlocks: state?.blocks ?? null,
    measureRef,
    previewMeasureRef,
    consentElement
  }
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
// `onLayout` – wywoływane po każdym podziale stron, z podziałem stron jak w Preview mode (`previewLayout`: w Edit mode z
// odsłoniętym fragmentem liczony osobno, bez odsłonięcia – W10; poza tym ten sam); `oversizedMessage` wyróżnia bloki wyższe niż strona i podpisuje je
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
  onLayout?: (layout: PaginateResult, previewLayout: PaginateResult) => void
  oversizedMessage?: string
  editing?: PageEditing
}) {
  const { geometry, blockViews: views, PageFooter } = template
  const reveal = editing?.reveal
  const blocks = useMemo(() => generateBlocks(document, geometry, { reveal }), [document, geometry, reveal])
  // Klauzula odsłonięta w Edit mode (aktywna, pusta) jest na stronie mimo pustego tekstu – jest gdzie postawić kursor.
  const consent = consentText(document) ?? (reveal?.has('consent') && document.consent.enabled ? document.consent.text : null)
  // Z odsłoniętym fragmentem – także bloki bez odsłonięcia, do podziału stron jak w Preview mode (W10).
  const preview = useMemo((): PreviewSplit | null => {
    if (!reveal || reveal.size === 0) return null
    const previewBlocks = generateBlocks(document, geometry)
    return { blocks: previewBlocks, toMeasure: blocksToMeasureForPreview(previewBlocks, blocks, reveal), consent: consentText(document) }
  }, [document, geometry, reveal, blocks])
  const { layout, previewLayout, layoutBlocks, measureRef, previewMeasureRef, consentElement } = usePagination(
    blocks,
    document.settings.font,
    consent,
    geometry,
    preview
  )
  const blocksById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks])
  const pagesElement = useRef<HTMLDivElement>(null)
  useReadySignal(layout, pagesElement, onReady)
  useEffect(() => {
    if (layout) onLayout?.(layout, previewLayout ?? layout)
  }, [layout, previewLayout, onLayout])
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
      {preview && preview.toMeasure.length > 0 && (
        // Bloki Preview mode, których wysokości nie daje pomiar Edit mode – bez Page fields i placeholderów.
        <div className="cv-measure" aria-hidden>
          {preview.toMeasure.map((block) => (
            <CvBlockView key={block.id} block={block} views={views} ref={previewMeasureRef(block.id)} />
          ))}
        </div>
      )}

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
