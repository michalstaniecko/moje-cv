import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import { CvPages } from '../template/CvPages'
import { pageCountLabel, RECOMMENDED_MAX_PAGES } from './pageCount'
import { fitScale, PREVIEW_MARGIN_PX, zoomIn, zoomOut } from './zoom'

// Podgląd stron CV z licznikiem stron i powiększeniem. Domyślnie strony dopasowane są do szerokości panelu;
// po użyciu +, − lub 100% obowiązuje wybrana skala, a „Dopasuj” wraca do dopasowania.
export function PreviewPane({ document }: { document: CvDocument }) {
  const panel = useRef<HTMLElement>(null)
  const panelWidth = usePanelWidth(panel)
  const [chosenScale, setChosenScale] = useState<number | null>(null)
  const scale = chosenScale ?? fitScale(panelWidth)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const onLayout = useCallback((layout: PaginateResult) => setPageCount(layout.pages.length), [])
  const t = useDictionary().preview
  const language = useInterfaceLanguage()

  return (
    <main ref={panel} className="preview" style={{ '--scale': scale, '--page-gap': `${PREVIEW_MARGIN_PX}px` } as CSSProperties}>
      <div className="preview-bar">
        {pageCount !== null && (
          <span className="preview-page-count" role="status">
            {pageCountLabel(pageCount, language)}
          </span>
        )}
        {pageCount !== null && pageCount > RECOMMENDED_MAX_PAGES && (
          <span className="preview-length-notice">{t.lengthNotice(pageCountLabel(RECOMMENDED_MAX_PAGES, language))}</span>
        )}
        <div className="preview-zoom">
          <button type="button" aria-label={t.zoomOut} onClick={() => setChosenScale(zoomOut(scale))}>
            −
          </button>
          <span className="preview-zoom-value">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label={t.zoomIn} onClick={() => setChosenScale(zoomIn(scale))}>
            +
          </button>
          <button type="button" onClick={() => setChosenScale(1)}>
            100%
          </button>
          <button type="button" onClick={() => setChosenScale(null)} disabled={chosenScale === null}>
            {t.fit}
          </button>
        </div>
      </div>
      <CvPages document={document} onLayout={onLayout} oversizedMessage={t.oversized} />
    </main>
  )
}

// Szerokość panelu (bez paska przewijania), aktualizowana przy zmianie rozmiaru okna.
function usePanelWidth(panel: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [panel])
  return width
}
