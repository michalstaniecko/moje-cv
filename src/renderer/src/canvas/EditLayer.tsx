import { Fragment as Group, memo, useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { useAddControls, type AddedAnchor } from './AddControls'
import { BlockHandle, useBlockMenu } from './BlockMenu'
import { cardLabel, EditCard, hasCard, type CardAnchor, type ClauseLibrary } from './EditCard'
import {
  blockTarget,
  editMarkupContract,
  fragmentKey,
  fragmentTarget,
  hitTarget,
  sectionOf,
  type ContractHit,
  type ContractPart,
  type EditTarget
} from './editTargets'
import type { Fragment } from './fragmentRects'
import { pageFieldKinds } from './pageFields'
import { activateJoined } from './PageField'
import { offsetOf, writeSelection, type ActiveFieldStore } from './useActiveField'
import { useFragmentRects } from './useFragmentRects'
import type { EditSession } from './useEditSession'

// Poniżej tej skali stron uchwyty i pigułki „+” warstwy (T5, T6) chowają się – zasłaniałyby treść; zostaje klik we
// fragment (docs/specs/inline-editing-redesign.md, Q26).
export const CONTROLS_MIN_SCALE = 0.5

// Warstwa edycji (ADR-0009): leży w przewijanym panelu stron obok `.preview-pages`, poza korzeniem `.cv`, więc nie
// zmienia ani piksela stron. Każdy fragment strony z Edit card to przezroczysty przycisk „Edit: <co>” nad nim
// (kolejność dokumentu, obrys przy najechaniu i fokusie), który otwiera kartę: klik – z fokusem na klikniętym polu
// (kontrakt znaczników), Enter/spacja – na pierwszym polu. Istnieje tylko w Edit mode.
// Tytuły sekcji i wpisy mają przed przyciskiem fragmentu uchwyt menu w marginesie kartki (BlockMenu.tsx); przy skali
// poniżej CONTROLS_MIN_SCALE uchwytów nie ma. Dodawanie (AddControls.tsx): pigułki „+” pod sekcjami (też tylko od
// CONTROLS_MIN_SCALE), pasek „Add to CV” pod ostatnią stroną i podpowiedź w pustym CV – wszystko poza treścią kartek.
// Kartę zamyka Escape (fokus wraca na fragment), klik w tło strony lub poza stronę (poza kartą, fragmentami i paskiem
// podglądu), przejście do Preview mode i wyjście z edytora. `onFocusLost` – fokus nie ma dokąd wrócić (fragment zniknął).
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
  const t = useDictionary().editor
  const { card: open, openCard, closeCard } = session

  const fragmentButtons = useCallback(
    (key?: string) =>
      [...(layer.current?.querySelectorAll<HTMLButtonElement>('.edit-fragment') ?? [])].filter(
        (button) => key === undefined || button.dataset['fragment'] === key
      ),
    []
  )
  const blockMenu = useBlockMenu({ editor, document, fragments, layout, layer, session, added, onFocusLost })
  const compact = scale < CONTROLS_MIN_SCALE
  const addOnPage = useAddControls({ editor, document, session, fragments, pages, layer, added, compact })
  // Element, przy którym stoi karta: przycisk fragmentu, a dla nowego, jeszcze pustego elementu – przycisk, którym go
  // dodano (uchwyt menu, pigułka „+”, pasek „Add to CV”, podpowiedź w pustym CV).
  const anchorElement = (key: string | undefined): HTMLElement | undefined =>
    key === undefined ? undefined : (fragmentButtons(key)[0] ?? added.anchor(key) ?? undefined)
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
    const fragment = fragmentButtons(open.anchor)[0]
    const previous = lastAnchor.current
    lastAnchor.current = { key: open.anchor, onPage: fragment !== undefined }
    if (fragment && previous?.key === open.anchor && !previous.onPage) fragment.scrollIntoView({ block: 'nearest' })
  })

  // Bieżący dokument dla obsługi kliknięcia – bez niego w zależnościach przyciski nie przerysowują się przy każdym klawiszu.
  const latestDocument = useRef(document)
  useEffect(() => {
    latestDocument.current = document
  })
  const onOpen = useCallback(
    (fragment: Fragment, event: MouseEvent<HTMLButtonElement>) => {
      // Klik myszą: pole pod kursorem; klawiatura (Enter/spacja dają `detail` 0) – pierwsze pole karty.
      const hit =
        event.detail > 0 && panel.current ? targetAt(event.clientX, event.clientY, panel.current, latestDocument.current) : null
      openCard(hit && fragmentKey(hit) === fragment.key ? hit : fragment.target, fragment.key)
    },
    [openCard, panel]
  )

  // Tab z (ostatniego) przycisku fragmentu otwartej karty wchodzi do karty – karta jest „za” swoim fragmentem.
  const onFragmentKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Tab' || event.shiftKey || !card.current || anchorKey === undefined) return
      if (event.currentTarget !== fragmentButtons(anchorKey).at(-1)) return
      const first = card.current.querySelector<HTMLElement>('button, input, select, textarea')
      if (!first) return
      event.preventDefault()
      first.focus()
    },
    [anchorKey, fragmentButtons]
  )

  const onTabOut = (direction: 'forward' | 'backward') => {
    if (anchorKey === undefined) return false
    // Przyciski fragmentów, uchwyty i przyciski dodawania – kolejne miejsce w kolejności Tab warstwy.
    const all = [...(layer.current?.querySelectorAll<HTMLButtonElement>(layerControls) ?? [])]
    const own = fragmentButtons(anchorKey)
    // Karta bez fragmentu na stronie (np. ukryta sekcja otwarta z Outline) – Shift+Tab wraca na jej kotwicę.
    const next = direction === 'backward' ? (own[0] ?? anchorElement(anchorKey)) : all[all.indexOf(own.at(-1)!) + 1]
    if (!next || (direction === 'forward' && own.length === 0)) return false
    next.focus()
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
      if (target?.closest(`.edit-card, ${layerControls}, .edit-handle, .preview-bar, .removal-message, .outline`)) return
      const anchor = anchorElement(open.anchor)
      closeCard()
      requestAnimationFrame(() => {
        if (window.document.activeElement === window.document.body) anchor?.focus({ preventScroll: true })
      })
    }
    window.document.addEventListener('pointerdown', onPointerDown)
    return () => window.document.removeEventListener('pointerdown', onPointerDown)
  }, [open, closeCard, fragmentButtons])

  useHandlesOfPageFields(panel, layer)
  usePointerOnPages(panel, latestDocument, openCard, session.activeField)
  useSectionHoverOnPages(panel, latestDocument, addOnPage.hoverOnPage)

  return (
    <div ref={layer} className="edit-layer" data-compact={compact || undefined} {...addOnPage.layerEvents}>
      {addOnPage.hint}
      {fragments.map((fragment) => {
        const handle = compact ? undefined : blockMenu.handles.find((candidate) => candidate.fragment === fragment)
        return (
          <Group key={`${fragment.key}@${fragment.page}`}>
            {handle && <BlockHandle fragment={fragment} menu={handle.menu} />}
            {hasCard(fragment.target) && (
              <FragmentButton
                fragment={fragment}
                label={t.canvas.edit(cardLabel(fragment.target, document, t))}
                expanded={anchorKey === fragment.key}
                keysOnly={pageFieldKinds.has(fragment.target.kind)}
                onOpen={onOpen}
                onKeyDown={onFragmentKeyDown}
              />
            )}
            {addOnPage.pillAfter(fragment)}
          </Group>
        )
      })}
      {addOnPage.bar}
      {blockMenu.liveRegion}
      {open && (
        <EditCard
          // Inny fragment = nowa karta (nowe pola, fokus); inne pole tego samego fragmentu – ta sama karta.
          key={open.anchor}
          ref={card}
          target={open.target}
          editor={editor}
          document={document}
          library={library}
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

// `keysOnly` – fragment z Page fields, który ma jeszcze kartę (wpis – jego daty, do S3): przycisk tylko dla klawiatury,
// mysz trafia w pola pod nim.
type FragmentButtonProps = {
  fragment: Fragment
  label: string
  expanded: boolean
  keysOnly: boolean
  onOpen: (fragment: Fragment, event: MouseEvent<HTMLButtonElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// Przycisk fragmentu – przerysowany tylko, gdy zmienił się jego prostokąt, nazwa albo stan karty.
const FragmentButton = memo(
  function FragmentButton({ fragment, label, expanded, keysOnly, onOpen, onKeyDown }: FragmentButtonProps) {
    const { rect } = fragment
    return (
      <button
        type="button"
        className={keysOnly ? 'edit-fragment edit-fragment--keys' : 'edit-fragment'}
        data-fragment={fragment.key}
        data-section={sectionOf(fragment.target) ?? undefined}
        data-page={fragment.page}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        style={{ top: rect.top, left: rect.left, width: rect.right - rect.left, height: rect.bottom - rect.top }}
        onClick={(event) => onOpen(fragment, event)}
        onKeyDown={onKeyDown}
      >
        {/* Nazwa z (ukrytej) treści, nie z `aria-label`: wyszukiwanie po etykiecie (np. „Full name”, `getByLabel` w e2e)
            wskazuje wtedy tylko pole formularza, a nie także przycisk „Edit: Full name”. */}
        <span className="visually-hidden">{label}</span>
      </button>
    )
  },
  (previous, next) =>
    previous.label === next.label &&
    previous.expanded === next.expanded &&
    previous.keysOnly === next.keysOnly &&
    previous.onOpen === next.onOpen &&
    previous.onKeyDown === next.onKeyDown &&
    previous.fragment.key === next.fragment.key &&
    previous.fragment.page === next.fragment.page &&
    previous.fragment.rect.top === next.fragment.rect.top &&
    previous.fragment.rect.left === next.fragment.rect.left &&
    previous.fragment.rect.right === next.fragment.rect.right &&
    previous.fragment.rect.bottom === next.fragment.rect.bottom
)

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

// Klik myszą na stronie poza Page field (docs/specs/wysiwyg-editing.md, W9): w datę wpisu – karta wpisu z fokusem na
// dacie początku (do S3, żetony dat); w separator, kropkę osi czasu albo puste miejsce bloku – kursor w najbliższym
// polu tego bloku, w miejscu najbliższym kliknięciu. Tło strony poza blokami – nic (zamyka kartę, jak dotąd).
function usePointerOnPages(
  panel: RefObject<HTMLElement | null>,
  latestDocument: RefObject<CvDocument>,
  openCard: (target: EditTarget, anchor: string) => void,
  active: ActiveFieldStore
) {
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
      const entry = date ? blockTarget(block.dataset['blockId']!, latestDocument.current) : null
      if (entry?.kind === 'experienceItem' || entry?.kind === 'educationItem') {
        event.preventDefault()
        openCard({ kind: entry.kind, sectionId: entry.sectionId, itemId: entry.itemId, field: 'start' }, fragmentKey(entry))
        return
      }
      const nearest = nearestField(block, event.clientX, event.clientY)
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
  }, [panel, latestDocument, openCard, active])
}

// Page field (albo linia złączona z kilku pól) bloku najbliższe punktowi okna i miejsce kursora w nim (znak pod punktem
// przesuniętym na linię pola).
function nearestField(block: HTMLElement, x: number, y: number): { field: HTMLElement; caret: number } | null {
  let best: { field: HTMLElement; rect: DOMRect; distance: number } | null = null
  for (const field of block.querySelectorAll<HTMLElement>('[data-field-key], [data-joined]')) {
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

// Przyciski warstwy w kolejności Tab (poza uchwytami menu): fragmenty, pigułki „+”, pasek „Add to CV” i podpowiedź
// w pustym CV.
const layerControls = '.edit-fragment, .edit-handle .row-handle, .edit-pill, .add-to-cv button, .edit-start-hint'

const contractParts = Object.entries(editMarkupContract) as [ContractPart, string][]

// Część CV pod punktem okna: element strony pod przyciskiem fragmentu, jego blok (`data-block-id`) i najbliższa klasa
// kontraktu znaczników nad nim. Kontakt rozpoznajemy po rodzicu `.cv-contact` (jego dzieci bywają `li`).
function targetAt(x: number, y: number, panel: HTMLElement, document: CvDocument): EditTarget | null {
  const element = window.document.elementsFromPoint(x, y).find((candidate) => candidate.closest('.cv-pages') && panel.contains(candidate))
  const block = element?.closest<HTMLElement>('[data-block-id]')
  if (!element || !block) return null
  return hitTarget(block.dataset['blockId']!, contractHit(element, block), document)
}

function contractHit(element: Element, block: Element): ContractHit {
  const childIndex = (container: Element) => [...container.children].findIndex((child) => child.contains(element))
  const contacts = element.closest(editMarkupContract.contact)
  if (contacts && block.contains(contacts)) return { part: 'contact', index: childIndex(contacts) }
  for (let current: Element | null = element; current && current !== block.parentElement; current = current.parentElement) {
    const part = contractParts.find(([, selector]) => current!.matches(selector))?.[0]
    if (part) return { part, index: part === 'item' && current.parentElement ? childIndex(current.parentElement) : 0 }
  }
  return { part: null, index: 0 }
}
