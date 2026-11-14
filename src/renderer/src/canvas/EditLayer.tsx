import { Fragment as Group, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { isEndBeforeStart } from '../domain/dates'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { useAddControls, type AddedAnchor } from './AddControls'
import { BlockHandle, useBlockMenu } from './BlockMenu'
import { ContactLabelSuggestions } from './ContactLabelSuggestions'
import { DatePopover, openDatesAt, type DatePopoverStore } from './DatePopover'
import { ConsentToolbar, type ClauseLibrary } from './ConsentToolbar'
import { EditCard, type CardAnchor } from './EditCard'
import { blockTarget, fragmentTarget, sectionOf } from './editTargets'
import type { Fragment, Rect } from './fragmentRects'
import { dateWarningId } from './pageFields'
import { activateJoined } from './PageField'
import { usePhotoEditing } from './PhotoPopover'
import { offsetOf, writeSelection, type ActiveFieldStore } from './useActiveField'
import { useFragmentRects } from './useFragmentRects'
import type { EditSession } from './useEditSession'

// Poniżej tej skali stron uchwyty i pigułki „+” warstwy (T5, T6) chowają się – zasłaniałyby treść; zostaje klik we
// fragment (docs/specs/inline-editing-redesign.md, Q26).
export const CONTROLS_MIN_SCALE = 0.5

// Warstwa edycji (ADR-0009, ADR-0010): leży w przewijanym panelu stron obok `.preview-pages`, poza korzeniem `.cv`, więc
// nie zmienia ani piksela stron. Tekst CV edytuje się na stronach (Page fields), więc żadna część strony nie otwiera już
// Edit card; w warstwie są to, co nie jest tekstem: przycisk zdjęcia (Field popover zdjęcia, PhotoPopover.tsx), Field
// popovers dat, podpowiedzi etykiet kontaktu i pasek klauzuli zgody, ⚠ odwróconych dat. Istnieje tylko w Edit mode.
// Tytuły sekcji i wpisy mają uchwyt menu w marginesie kartki (BlockMenu.tsx); przy skali
// poniżej CONTROLS_MIN_SCALE uchwytów nie ma. Dodawanie (AddControls.tsx): pigułki „+” pod sekcjami (też tylko od
// CONTROLS_MIN_SCALE), pasek „Add to CV” pod ostatnią stroną i podpowiedź w pustym CV – wszystko poza treścią kartek.
// Kartę (już tylko nowego, pustego wpisu i sekcji, której nie ma na stronach – do S5) zamyka Escape (fokus wraca na jej
// kotwicę), klik w tło strony lub poza stronę (poza kartą, kontrolkami warstwy i paskiem podglądu), przejście do Preview
// mode i wyjście z edytora. `onFocusLost` – fokus nie ma dokąd wrócić (fragment zniknął).
export function EditLayer({
  document,
  editor,
  session,
  panel,
  layout,
  scale,
  onFocusLost,
  onRemove,
  library,
  added
}: EditingContext & {
  document: CvDocument
  panel: RefObject<HTMLElement | null>
  layout: PaginateResult | null
  scale: number
}) {
  const layer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const { fragments, pages } = useFragmentRects({ layer, panel, document, layout, scale })
  const { card: open, openCard, closeCard } = session

  const blockMenu = useBlockMenu({ editor, document, fragments, layout, layer, session, added, onFocusLost, onRemove })
  const compact = scale < CONTROLS_MIN_SCALE
  const addOnPage = useAddControls({ editor, document, session, fragments, pages, layer, added, compact })
  // Element, przy którym stoi karta: pierwsze pole tekstu fragmentu na stronie (nie żeton daty; nowy wpis, do S5), a dla
  // nowego, jeszcze pustego elementu – przycisk, którym go dodano (uchwyt menu, pigułka „+”, pasek „Add to CV”,
  // podpowiedź w pustym CV, wiersz Outline). Najpierw Page field (fokus w nim nie rozwija wpisu), dopiero potem linia
  // złączona.
  const onPage = (key: string): HTMLElement | undefined => {
    const selector = `.cv-pages [data-fragment="${CSS.escape(key)}"]`
    return (
      panel.current?.querySelector<HTMLElement>(`${selector}[contenteditable]`) ??
      panel.current?.querySelector<HTMLElement>(`${selector}:not(.cv-page-date, .cv-page-dates)`) ??
      undefined
    )
  }
  const anchorElement = (key: string | undefined): HTMLElement | undefined =>
    key === undefined ? undefined : (onPage(key) ?? added.anchor(key) ?? undefined)
  const anchorKey = open?.anchor
  const focusAnchor = () => {
    const element = anchorElement(anchorKey)
    if (element) element.focus()
    else onFocusLost()
  }

  // Karta nowego elementu przeskakuje z przycisku, którym go dodano (albo wiersza Outline), do jego pierwszego fragmentu
  // na stronie: gdy ten fragment jest poza widokiem (np. na kolejnej stronie), strony przewijają się do niego, żeby
  // karta nie stała przy krawędzi okna z dala od tego, co edytuje.
  const lastAnchor = useRef<{ key: string; onPage: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!open) {
      lastAnchor.current = null
      return
    }
    const fragment = onPage(open.anchor)
    const previous = lastAnchor.current
    lastAnchor.current = { key: open.anchor, onPage: fragment !== undefined }
    if (fragment && previous?.key === open.anchor && !previous.onPage) fragment.scrollIntoView({ block: 'nearest' })
  })

  // Bieżący dokument dla obsługi kliknięcia – bez niego w zależnościach przyciski nie przerysowują się przy każdym klawiszu.
  const latestDocument = useRef(document)
  useEffect(() => {
    latestDocument.current = document
  })

  // Shift+Tab z pierwszego pola karty wraca na jej kotwicę; Tab z ostatniego – zwykła kolejność Tab.
  const onTabOut = (direction: 'forward' | 'backward') => {
    const anchor = direction === 'backward' ? anchorElement(anchorKey) : undefined
    if (!anchor) return false
    anchor.focus()
    return true
  }

  // Usunięcie w karcie: „Cofnij” wraca do pola przywróconego punktu lub elementu w karcie, a po usunięciu całego wpisu
  // (karta zamknęła się razem z nim) – otwiera kartę przywróconego wpisu z fokusem na jej pierwszym polu.
  const removeInCard: RemoveWithUndo = (change, focus) => {
    if (!open) return
    const reopen = { target: fragmentTarget(open.target), anchor: open.anchor }
    const wholeEntry =
      (open.target.kind === 'experienceItem' || open.target.kind === 'educationItem') && focus.entryId === open.target.itemId
    onRemove(change, {
      ...focus,
      root: () => card.current,
      restore: wholeEntry ? () => openCard(reopen.target, reopen.anchor) : undefined
    })
  }

  const locate = (): CardAnchor => {
    const element = anchorElement(anchorKey)
    if (!element || !panel.current) return null
    const anchor = element.getBoundingClientRect()
    const pageNumber = element.closest<HTMLElement>('[data-page]')?.dataset['page']
    const page = panel.current.querySelectorAll('.cv-pages > .cv-page')[Number(pageNumber)]
    const panelBox = panel.current.getBoundingClientRect()
    return {
      anchor,
      beside: { edge: page?.getBoundingClientRect().right ?? anchor.right, limit: panelBox.left + panel.current.clientWidth - 8 }
    }
  }

  // Klik w tło strony albo poza stronę zamyka kartę. Gdy fokus nie trafił w nic (tło nie przyjmuje fokusu), wraca na
  // fragment karty, żeby nie zginął. „Usunięto. Cofnij” nie zamyka karty – „Cofnij” wraca do pola w karcie. Uchwyt
  // i jego menu też nie: przeniesienie fragmentu z otwartą kartą zostawia kartę przy nim, a „Dodaj …” ją zastępuje –
  // tak jak pigułki „+”, pasek „Add to CV”, podpowiedź w pustym CV i Outline (jego wiersze otwierają inną kartę).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(`.edit-card, ${layerControls}, .edit-handle, .preview-bar, .removal-message, .outline, [data-field-popover]`)) return
      const anchor = anchorElement(open.anchor)
      closeCard()
      requestAnimationFrame(() => {
        if (window.document.activeElement === window.document.body) anchor?.focus({ preventScroll: true })
      })
    }
    window.document.addEventListener('pointerdown', onPointerDown)
    return () => window.document.removeEventListener('pointerdown', onPointerDown)
  }, [open, closeCard])

  const photo = usePhotoEditing({ editor, photo: document.header.photo, onRemove, onFocusLost })

  useHandlesOfPageFields(panel, layer)
  usePointerOnPages(panel, session.activeField, session.datePopover)
  useSectionHoverOnPages(panel, latestDocument, addOnPage.hoverOnPage)

  return (
    <div ref={layer} className="edit-layer" data-compact={compact || undefined} {...addOnPage.layerEvents}>
      {addOnPage.hint}
      {fragments.map((fragment) => {
        const handle = compact ? undefined : blockMenu.handles.find((candidate) => candidate.fragment === fragment)
        return (
          <Group key={`${fragment.key}@${fragment.page}`}>
            {handle && <BlockHandle fragment={fragment} menu={handle.menu} />}
            {fragment.target.kind === 'photo' && photo.button(fragment)}
            {addOnPage.pillAfter(fragment)}
          </Group>
        )
      })}
      {addOnPage.bar}
      {blockMenu.liveRegion}
      <DateWarnings document={document} panel={panel} layer={layer} fragments={fragments} hidden={compact} />
      {photo.popover}
      <DatePopover editor={editor} document={document} dates={session.datePopover} active={session.activeField} />
      <ContactLabelSuggestions editor={editor} document={document} active={session.activeField} />
      <ConsentToolbar editor={editor} document={document} active={session.activeField} library={library} onFocusLost={onFocusLost} />
      {open && (
        <EditCard
          // Inny fragment = nowa karta (nowe pola, fokus); inne pole tego samego fragmentu – ta sama karta.
          key={open.anchor}
          ref={card}
          target={open.target}
          editor={editor}
          document={document}
          locate={locate}
          onClose={() => {
            closeCard()
            focusAnchor()
          }}
          onTabOut={onTabOut}
          onRemove={removeInCard}
        />
      )}
    </div>
  )
}

// Co edytor daje warstwie edycji (przez PreviewPane): dokument do zmian, sesję (tryb, otwarta karta), bezpieczne miejsce
// dla fokusu, usuwanie z „Usunięto. Cofnij”, bibliotekę klauzul i kotwicę kart otwartych poza fragmentem strony
// (`added` – wspólna z Outline: karta ukrytej lub pustej sekcji stoi przy wierszu Outline).
export type EditingContext = {
  editor: CvEditor
  session: EditSession
  onFocusLost: () => void
  onRemove: RemoveWithUndo
  library: ClauseLibrary
  added: AddedAnchor
}

// Uchwyt menu fragmentu edytowanego na stronie (Page fields – bez przycisku fragmentu, nad którym CSS pokazuje uchwyt)
// pokazuje się, gdy kursor myszy jest nad polem fragmentu (`data-hovered`) albo pole ma fokus (`data-focused`).
function useHandlesOfPageFields(panel: RefObject<HTMLElement | null>, layer: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const fragmentOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('.cv-pages [data-fragment]')?.dataset['fragment'] : undefined
    const mark = (target: EventTarget | null, attribute: string, on: boolean) => {
      const key = fragmentOf(target)
      if (key === undefined) return
      layer.current?.querySelectorAll(`.edit-handle[data-fragment="${CSS.escape(key)}"]`).forEach((handle) => {
        if (on) handle.setAttribute(attribute, '')
        else handle.removeAttribute(attribute)
      })
    }
    const listeners: [string, (event: Event) => void][] = [
      ['pointerover', (event) => mark(event.target, 'data-hovered', true)],
      ['pointerout', (event) => mark(event.target, 'data-hovered', false)],
      ['focusin', (event) => mark(event.target, 'data-focused', true)],
      ['focusout', (event) => mark(event.target, 'data-focused', false)]
    ]
    for (const [type, listener] of listeners) element.addEventListener(type, listener)
    return () => {
      for (const [type, listener] of listeners) element.removeEventListener(type, listener)
    }
  }, [panel, layer])
}

// Kursor nad treścią sekcji na stronie pokazuje jej pigułkę „+” (AddControls.tsx) – tak jak dotąd najechanie na
// przycisk fragmentu, którego wpisy edytowane na stronie pod myszą już nie mają.
function useSectionHoverOnPages(
  panel: RefObject<HTMLElement | null>,
  latestDocument: RefObject<CvDocument>,
  hoverOnPage: (sectionId: string | null) => void
) {
  const hover = useRef(hoverOnPage)
  useEffect(() => {
    hover.current = hoverOnPage
  })
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const sectionAt = (target: EventTarget | null) => {
      const block = target instanceof Element ? target.closest<HTMLElement>('.cv-pages [data-block-id]') : null
      const part = block ? blockTarget(block.dataset['blockId']!, latestDocument.current) : null
      return part ? sectionOf(part) : null
    }
    const onOver = (event: PointerEvent) => {
      const section = sectionAt(event.target)
      if (section !== null) hover.current(section)
    }
    const onOut = (event: PointerEvent) => {
      if (sectionAt(event.target) !== null && sectionAt(event.relatedTarget) === null) hover.current(null)
    }
    element.addEventListener('pointerover', onOver)
    element.addEventListener('pointerout', onOut)
    return () => {
      element.removeEventListener('pointerover', onOver)
      element.removeEventListener('pointerout', onOut)
    }
  }, [panel, latestDocument])
}

// Klik myszą na stronie poza Page field (docs/specs/wysiwyg-editing.md, W9, W12): w datę wpisu obok żetonu (np. kropka
// osi czasu w Classic, tło żetonu w Bold) – Field popover najbliższej daty; w separator, kropkę osi czasu albo puste
// miejsce bloku – kursor w najbliższym polu tego bloku, w miejscu najbliższym kliknięciu. Tło strony poza blokami – nic
// (zamyka kartę, jak dotąd).
function usePointerOnPages(panel: RefObject<HTMLElement | null>, active: ActiveFieldStore, dates: DatePopoverStore) {
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      const target = event.target
      if (!target.closest('.cv-pages') || target.closest('[data-field-key], [data-joined]')) return
      const block = target.closest<HTMLElement>('[data-block-id]')
      if (!block) return
      const date = target.closest('.cv-date')
      const token = date ? nearestField(date, dateTokens, event.clientX, event.clientY) : null
      if (token) {
        event.preventDefault()
        if (token.field.dataset['joined'] !== undefined) {
          openDatesAt(token.field, token.caret, active, dates)
          return
        }
        token.field.focus({ preventScroll: true })
        dates.open(token.field.dataset['fieldKey']!)
        return
      }
      const nearest = nearestField(block, textFields, event.clientX, event.clientY)
      if (!nearest) return
      event.preventDefault()
      if (nearest.field.dataset['joined'] !== undefined) {
        activateJoined(nearest.field, nearest.caret, active)
        return
      }
      nearest.field.focus({ preventScroll: true })
      writeSelection(nearest.field, { start: nearest.caret, end: nearest.caret })
    }
    element.addEventListener('mousedown', onMouseDown)
    return () => element.removeEventListener('mousedown', onMouseDown)
  }, [panel, active, dates])
}

// Pola tekstu (Page fields i linie złączone) i daty na stronie (żetony dat i napis dat poza rozwiniętym wpisem).
const textFields = '[data-field-key][contenteditable], .cv-page-joined'
const dateTokens = '.cv-page-date[data-field-key], .cv-page-dates'

// Page field (albo linia złączona z kilku pól) bloku najbliższe punktowi okna i miejsce kursora w nim (znak pod punktem
// przesuniętym na linię pola).
function nearestField(block: Element, selector: string, x: number, y: number): { field: HTMLElement; caret: number } | null {
  let best: { field: HTMLElement; rect: DOMRect; distance: number } | null = null
  for (const field of block.querySelectorAll<HTMLElement>(selector)) {
    for (const rect of field.getClientRects()) {
      if (rect.height === 0) continue
      const dx = Math.max(rect.left - x, 0, x - rect.right)
      const dy = Math.max(rect.top - y, 0, y - rect.bottom)
      const distance = Math.hypot(dx, dy)
      if (!best || distance < best.distance) best = { field, rect, distance }
    }
  }
  if (!best) return null
  const { field, rect } = best
  const length = (field.textContent ?? '').length
  const point = window.document.caretPositionFromPoint(
    Math.min(Math.max(x, rect.left + 1), rect.right - 1),
    Math.min(Math.max(y, rect.top + 1), rect.bottom - 1)
  )
  const caret = point && field.contains(point.offsetNode) ? offsetOf(field, point.offsetNode, point.offset) : x < rect.left ? 0 : length
  return { field, caret }
}

// Kontrolki warstwy (klik w nie nie zamyka karty): zdjęcie, uchwyty menu, pigułki „+”, pasek „Add to CV” i podpowiedź
// w pustym CV.
const layerControls = '.edit-photo, .edit-handle .row-handle, .edit-pill, .add-to-cv button, .edit-start-hint'

// Ostrzeżenie o odwróconych datach wpisu (W12): znaczek ⚠ w warstwie edycji przy dacie na stronie (poza treścią kartki,
// tylko w Edit mode) i opis dla czytnika ekranu, który żetony dat wpisu wskazują przez `aria-describedby`
// (`dateWarningId`). Znaczek stoi po tej stronie napisu dat, po której w bloku jest wolne miejsce: po prawej, gdy daty
// kończą blok (Modern, Bold), inaczej po lewej (Classic: kolumna dat wyrównana do prawej). Położenie liczone po każdym
// nowym pomiarze fragmentów (podział stron, skala); poniżej CONTROLS_MIN_SCALE – bez znaczka (`hidden`), opis zostaje.
function DateWarnings({
  document,
  panel,
  layer,
  fragments,
  hidden
}: {
  document: CvDocument
  panel: RefObject<HTMLElement | null>
  layer: RefObject<HTMLElement | null>
  fragments: Fragment[]
  hidden: boolean
}) {
  const t = useDictionary().editor
  const reversed = document.sections.flatMap((section) =>
    section.type === 'list' ? [] : section.items.filter((item) => isEndBeforeStart(item.start, item.end)).map((item) => item.id)
  )
  const [marks, setMarks] = useState<{ id: string; top: number; left: number }[]>([])
  const signature = reversed.join(' ')
  useLayoutEffect(() => {
    const origin = layer.current?.getBoundingClientRect()
    if (!origin || !panel.current) return
    const next = reversed.flatMap((id) =>
      [...panel.current!.querySelectorAll<HTMLElement>(`.cv-pages [data-block-id="${CSS.escape(id)}"]`)].flatMap((block) => {
        const date = block.querySelector('.cv-date')
        if (!date) return []
        const range = window.document.createRange()
        range.selectNodeContents(date)
        const text: Rect = range.getBoundingClientRect()
        const box = block.getBoundingClientRect()
        if (text.right - text.left === 0) return []
        const middle = (text.top + text.bottom) / 2 - origin.top
        const right = text.right >= box.right - 2
        return [{ id, top: middle - WARNING_SIZE / 2, left: right ? text.right - origin.left + 4 : text.left - origin.left - WARNING_SIZE - 4 }]
      })
    )
    setMarks((current) =>
      current.length === next.length && current.every((mark, index) => sameMark(mark, next[index]!)) ? current : next
    )
  }, [fragments, signature, layer, panel])
  return (
    <>
      {!hidden &&
        marks.map((mark, index) => (
          <span key={`${mark.id}:${index}`} className="edit-date-warning" style={{ top: mark.top, left: mark.left }} aria-hidden="true">
            ⚠
          </span>
        ))}
      {reversed.map((id) => (
        <span key={id} id={dateWarningId(id)} className="visually-hidden">
          {t.endBeforeStart}
        </span>
      ))}
    </>
  )
}

const WARNING_SIZE = 16

const sameMark = (a: { id: string; top: number; left: number }, b: { id: string; top: number; left: number }) =>
  a.id === b.id && a.top === b.top && a.left === b.left
