import { Fragment as Group, memo, useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { useDictionary } from '../i18n'
import { BlockHandle, useBlockMenu } from './BlockMenu'
import { cardLabel, EditCard, hasCard, type CardAnchor, type ClauseLibrary } from './EditCard'
import {
  editMarkupContract,
  fragmentKey,
  fragmentTarget,
  hitTarget,
  type ContractHit,
  type ContractPart,
  type EditTarget
} from './editTargets'
import type { Fragment } from './fragmentRects'
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
// poniżej CONTROLS_MIN_SCALE uchwytów nie ma.
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
  library
}: EditingContext & {
  document: CvDocument
  panel: RefObject<HTMLElement | null>
  layout: PaginateResult | null
  scale: number
}) {
  const layer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const fragments = useFragmentRects({ layer, panel, document, layout, scale })
  const t = useDictionary().editor
  const { card: open, openCard, closeCard } = session

  const fragmentButtons = useCallback(
    (key?: string) =>
      [...(layer.current?.querySelectorAll<HTMLButtonElement>('.edit-fragment') ?? [])].filter(
        (button) => key === undefined || button.dataset['fragment'] === key
      ),
    []
  )
  const blockMenu = useBlockMenu({ editor, document, fragments, layout, layer, session, onFocusLost })
  const compact = scale < CONTROLS_MIN_SCALE
  // Element, przy którym stoi karta: przycisk fragmentu, a dla nowego, jeszcze pustego elementu – uchwyt, z którego go
  // dodano.
  const anchorElement = (key: string | undefined): HTMLElement | undefined =>
    key === undefined ? undefined : (fragmentButtons(key)[0] ?? blockMenu.addedAnchor(key) ?? undefined)
  const anchorKey = open?.anchor
  const focusAnchor = () => {
    const element = anchorElement(anchorKey)
    if (element) element.focus()
    else onFocusLost()
  }

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
    // Przyciski fragmentów i uchwyty – kolejne miejsce w kolejności Tab warstwy.
    const all = [...(layer.current?.querySelectorAll<HTMLButtonElement>('.edit-fragment, .edit-handle .row-handle') ?? [])]
    const own = fragmentButtons(anchorKey)
    const next = direction === 'backward' ? own[0] : all[all.indexOf(own.at(-1)!) + 1]
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
  // i jego menu też nie: przeniesienie fragmentu z otwartą kartą zostawia kartę przy nim, a „Dodaj …” ją zastępuje.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.edit-card, .edit-fragment, .edit-handle, .preview-bar, .removal-message')) return
      const anchor = anchorElement(open.anchor)
      closeCard()
      requestAnimationFrame(() => {
        if (window.document.activeElement === window.document.body) anchor?.focus({ preventScroll: true })
      })
    }
    window.document.addEventListener('pointerdown', onPointerDown)
    return () => window.document.removeEventListener('pointerdown', onPointerDown)
  }, [open, closeCard, fragmentButtons])

  return (
    <div ref={layer} className="edit-layer" data-compact={compact || undefined}>
      {fragments
        .filter((fragment) => hasCard(fragment.target))
        .map((fragment) => {
          const handle = compact ? undefined : blockMenu.handles.find((candidate) => candidate.fragment === fragment)
          return (
            <Group key={`${fragment.key}@${fragment.page}`}>
              {handle && <BlockHandle fragment={fragment} menu={handle.menu} />}
              <FragmentButton
                fragment={fragment}
                label={t.canvas.edit(cardLabel(fragment.target, document, t))}
                expanded={anchorKey === fragment.key}
                onOpen={onOpen}
                onKeyDown={onFragmentKeyDown}
              />
            </Group>
          )
        })}
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
// dla fokusu, usuwanie z „Usunięto. Cofnij” i bibliotekę klauzul.
export type EditingContext = {
  editor: CvEditor
  session: EditSession
  onFocusLost: () => void
  onRemove: RemoveWithUndo
  library: ClauseLibrary
}

type FragmentButtonProps = {
  fragment: Fragment
  label: string
  expanded: boolean
  onOpen: (fragment: Fragment, event: MouseEvent<HTMLButtonElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// Przycisk fragmentu – przerysowany tylko, gdy zmienił się jego prostokąt, nazwa albo stan karty.
const FragmentButton = memo(
  function FragmentButton({ fragment, label, expanded, onOpen, onKeyDown }: FragmentButtonProps) {
    const { rect } = fragment
    return (
      <button
        type="button"
        className="edit-fragment"
        data-fragment={fragment.key}
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
    previous.onOpen === next.onOpen &&
    previous.onKeyDown === next.onKeyDown &&
    previous.fragment.key === next.fragment.key &&
    previous.fragment.page === next.fragment.page &&
    previous.fragment.rect.top === next.fragment.rect.top &&
    previous.fragment.rect.left === next.fragment.rect.left &&
    previous.fragment.rect.right === next.fragment.rect.right &&
    previous.fragment.rect.bottom === next.fragment.rect.bottom
)

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
