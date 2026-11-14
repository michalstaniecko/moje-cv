import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { EditLayer, type EditingContext } from '../canvas/EditLayer'
import { PageFieldsProvider } from '../canvas/PageField'
import type { EditorMode } from '../canvas/useEditSession'
import { usePageEditing } from '../canvas/usePageEditing'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import { useDictionary, useInterfaceLanguage } from '../i18n'
import { CvPages } from '../template/CvPages'
import { afterNextPaint, markInput, markPreviewPainted } from './keystrokeTiming'
import { pageCountLabel, RECOMMENDED_MAX_PAGES } from './pageCount'
import { fitScale, PREVIEW_MARGIN_PX, zoomIn, zoomOut } from './zoom'

// Podgląd stron CV z licznikiem stron i powiększeniem.
// Domyślnie strony dopasowane są do szerokości panelu; po użyciu +, − lub 100% obowiązuje wybrana skala,
// a „Dopasuj” wraca do dopasowania.
// `onLayout` dostaje każdy nowy podział stron (np. edytor sprawdza przed eksportem, czy są za długie bloki).
// Bloki wyższe niż strona są wyróżnione na kartkach w Edit mode; w Preview mode kartki są jak w PDF, a w pasku
// podglądu jest ostrzeżenie z „Pokaż” (`onShowOversized` – przejście do Edit mode).
// `editing` – w Edit mode tekst na stronach to Page fields (ADR-0010, canvas/usePageEditing.ts), a nad stronami leży
// warstwa edycji z uchwytami i Edit card (canvas/EditLayer.tsx); w Preview mode nie ma ani jednego, ani drugiego.
export function PreviewPane({
  document,
  onLayout: onLayoutChange,
  mode = 'edit',
  onShowOversized,
  editing
}: {
  document: CvDocument
  onLayout?: (layout: PaginateResult) => void
  mode?: EditorMode
  onShowOversized?: () => void
  editing?: EditingContext
}) {
  const panel = useRef<HTMLElement>(null)
  const panelWidth = usePanelWidth(panel)
  const [chosenScale, setChosenScale] = useState<number | null>(null)
  const scale = chosenScale ?? fitScale(panelWidth)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [oversizedCount, setOversizedCount] = useState(0)
  const [layout, setLayout] = useState<PaginateResult | null>(null)
  const onLayout = useCallback(
    (layout: PaginateResult) => {
      setLayout(layout)
      setPageCount(layout.pages.length)
      setOversizedCount(layout.oversizedIds.length)
      onLayoutChange?.(layout)
      afterNextPaint(markPreviewPainted)
    },
    [onLayoutChange]
  )
  const t = useDictionary().preview
  const language = useInterfaceLanguage()
  const oversizedMessage = mode === 'edit' ? t.oversized : undefined
  const pageEditing = usePageEditing({
    document,
    editor: editing?.editor,
    active: editing?.session.activeField,
    dates: editing?.session.datePopover,
    announcer: editing?.session.announcer,
    panel
  })
  const editable = mode === 'edit' && pageEditing !== null
  // Element stron zapamiętany: przerysowanie panelu (np. nowy podział stron dla warstwy edycji, zmiana pola z fokusem
  // bez odsłaniania) nie renderuje stron ponownie, dopóki nie zmieni się dokument albo odsłonięty fragment.
  // To samo drzewo w obu trybach: zmiana trybu nie montuje stron od nowa (przewinięcie i podział stron zostają).
  const pages = useMemo(
    () => (
      <PageFieldsProvider value={pageEditing?.fields ?? null}>
        <CvPages
          document={document}
          onLayout={onLayout}
          oversizedMessage={oversizedMessage}
          editing={editable ? pageEditing?.editing : undefined}
        />
      </PageFieldsProvider>
    ),
    [document, onLayout, oversizedMessage, editable, pageEditing?.fields, pageEditing?.editing]
  )

  return (
    <main ref={panel} className="preview" style={{ '--scale': scale, '--page-gap': `${PREVIEW_MARGIN_PX}px` } as CSSProperties}>
      <div className="preview-bar">
        {pageCount !== null && (
          <span className="preview-page-count" role="status">
            {pageCountLabel(pageCount, language)}
          </span>
        )}
        {pageCount !== null && pageCount > RECOMMENDED_MAX_PAGES && (
          <span className="preview-length-notice">
            <span aria-hidden="true">⚠</span> {t.lengthNotice(pageCountLabel(RECOMMENDED_MAX_PAGES, language))}
          </span>
        )}
        {mode === 'preview' && oversizedCount > 0 && (
          <span className="preview-length-notice preview-oversized-notice">
            <span aria-hidden="true">⚠</span> {t.oversizedInPreview}
            {onShowOversized && (
              <button type="button" onClick={onShowOversized}>
                {t.showInEditMode}
              </button>
            )}
          </span>
        )}
        {/* Klik w powiększenie nie zabiera fokusu z Page field: kursor zostaje w polu przy każdej skali. */}
        <div className="preview-zoom" onMouseDown={(event) => event.preventDefault()}>
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
      {/* W Edit mode strony to dla czytnika ekranu CV z polami tekstowymi (Page fields, W22); w Preview mode są ukryte –
          to kopia CV bez niczego do zrobienia. Pasek podglądu (licznik stron, ostrzeżenie o długości, powiększenie) jest
          dostępny w obu trybach, a w Edit mode także warstwa edycji obok stron. Pisanie na stronie mierzy
          `cv:keystroke-to-preview` jak pisanie w formularzu (W23). */}
      <div
        className="preview-pages"
        aria-hidden={editable ? undefined : true}
        onInput={editable ? (event) => markInput(event.timeStamp) : undefined}
      >
        {pages}
      </div>
      {mode === 'edit' && editing && (
        <EditLayer {...editing} document={document} panel={panel} layout={layout} scale={scale} />
      )}
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
