import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useDictionary } from '../i18n'
import { RowMenu, type RowMenuAction } from './RowMenu'

// Sterowanie kolejnością jednego wiersza, przekazywane do `children`:
// - `handle` – uchwyt do umieszczenia w wierszu: przeciągnięcie myszą zmienia kolejność, kliknięcie (albo Enter/spacja)
//   otwiera menu wiersza („Przenieś wyżej/niżej”, a w listach z `onRemove` także „Usuń”),
// - `moveBy(offset)` – przenosi wiersz o `offset` pozycji (−1 w górę, 1 w dół) jako osobny krok cofania i ogłasza nową
//   pozycję czytnikowi ekranu; na krańcu listy nic nie robi i zwraca `false`. Fokusu nie zmienia – o nim decyduje
//   wywołujący (menu wraca na uchwyt, pole tekstowe może zostać w sobie).
export type SortableRow = {
  handle: ReactNode
  moveBy: (offset: -1 | 1) => boolean
}

// Lista z ręczną kolejnością: przeciąganie za uchwyt myszą i menu wiersza pod uchwytem (także z klawiatury).
// `onMove(id, toIndex)` – element ma trafić na pozycję `toIndex`; `children` dostaje sterowanie wiersza (`SortableRow`).
// `onRemove` dodaje do menu wiersza „Usuń” (punkty i elementy list; całe wpisy usuwa się przyciskiem w ich polu) –
// wywołujący usuwa element z „Usunięto. Cofnij” i decyduje o fokusie.
export function SortableList<T extends { id: string }>({
  items,
  label,
  onMove,
  onRemove,
  children
}: {
  items: T[]
  // Nazwa elementu w etykiecie uchwytu i komunikatach, np. „section “Languages”” → „Actions for section “Languages””.
  label: (item: T, index: number) => string
  onMove: (id: string, toIndex: number) => void
  onRemove?: (item: T) => void
  children: (item: T, row: SortableRow, index: number) => ReactNode
}) {
  const { order } = useDictionary().editor
  // Tylko mysz: czujnik klawiatury dnd-kit zastępuje menu wiersza (Enter i spacja na uchwycie je otwierają).
  // Próg przesunięcia odróżnia kliknięcie (menu) od przeciągania.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  // Komunikaty dla czytnika ekranu w Interface language: element opisany tą samą etykietą co uchwyt (nie
  // identyfikatorem z dokumentu), pozycja liczona od 1 z liczby elementów listy. dnd-kit zgłasza `onDragOver`
  // także zaraz po podniesieniu (element nad samym sobą), co zagłuszyłoby „Podniesiono…”, więc pozycja jest
  // ogłaszana dopiero, gdy element nad którym jest przeciągany się zmieni.
  const announcedOver = useRef<UniqueIdentifier | null>(null)
  const accessibility = useMemo(() => {
    const indexOf = (id: UniqueIdentifier) => items.findIndex((item) => item.id === id)
    const name = (id: UniqueIdentifier) => {
      const index = indexOf(id)
      return index === -1 ? undefined : label(items[index]!, index)
    }
    const announcements: Announcements = {
      onDragStart: ({ active }) => {
        announcedOver.current = active.id
        const item = name(active.id)
        return item && order.pickedUp(item)
      },
      onDragOver: ({ active, over }) => {
        const item = name(active.id)
        if (!item || !over || over.id === announcedOver.current || indexOf(over.id) === -1) return undefined
        announcedOver.current = over.id
        return order.movedOver(item, indexOf(over.id) + 1, items.length)
      },
      onDragEnd: ({ active, over }) => {
        const item = name(active.id)
        if (!item) return undefined
        if (!over || indexOf(over.id) === -1) return order.cancelled(item)
        return order.dropped(item, indexOf(over.id) + 1, items.length)
      },
      onDragCancel: ({ active }) => {
        const item = name(active.id)
        return item && order.cancelled(item)
      }
    }
    return { announcements, screenReaderInstructions: { draggable: order.instructions } }
  }, [items, label, order])
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = items.findIndex((item) => item.id === over.id)
    if (toIndex !== -1) onMove(String(active.id), toIndex)
  }

  // Komunikat po przeniesieniu z menu (albo `moveBy`). Ten sam tekst drugi raz (np. dwa razy z rzędu na tę samą
  // pozycję w innej liście) też ma zostać przeczytany, więc region dostaje nowy węzeł przy każdym komunikacie.
  const [moved, setMoved] = useState<{ text: string; key: number } | null>(null)
  const moveBy = (index: number, offset: -1 | 1) => {
    const item = items[index]
    const toIndex = index + offset
    if (!item || toIndex < 0 || toIndex >= items.length) return false
    const text = order.moved(label(item, index), toIndex + 1, items.length)
    flushSync(() => {
      onMove(item.id, toIndex)
      setMoved((previous) => ({ text, key: (previous?.key ?? 0) + 1 }))
    })
    return true
  }

  // Uchwyty wierszy po identyfikatorze elementu – po przeniesieniu z menu fokus wraca na uchwyt w nowym miejscu
  // (przestawienie węzłów w DOM gubi fokus).
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const handleRef = useCallback(
    (id: string) => (element: HTMLButtonElement | null) => {
      if (element) handles.current.set(id, element)
      else handles.current.delete(id)
    },
    []
  )
  const focusHandle = (id: string) => handles.current.get(id)?.focus()

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => {
          const name = label(item, index)
          const moveAndRefocus = (offset: -1 | 1) => {
            if (moveBy(index, offset)) focusHandle(item.id)
          }
          const actions: RowMenuAction[] = [
            { label: order.moveUp, disabled: index === 0, run: () => moveAndRefocus(-1) },
            { label: order.moveDown, disabled: index === items.length - 1, run: () => moveAndRefocus(1) },
            ...(onRemove ? [{ label: order.remove, run: () => onRemove(item) }] : [])
          ]
          return (
            <SortableItem key={item.id} id={item.id}>
              {(dragHandle) =>
                children(
                  item,
                  {
                    handle: (
                      <RowMenu
                        label={order.actions(name)}
                        actions={actions}
                        handleRef={handleRef(item.id)}
                        handleProps={dragHandle}
                      />
                    ),
                    moveBy: (offset) => moveBy(index, offset)
                  },
                  index
                )
              }
            </SortableItem>
          )
        })}
      </SortableContext>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {moved && <span key={moved.key}>{moved.text}</span>}
      </div>
    </DndContext>
  )
}

// Atrybuty i obsługa zdarzeń dnd-kit dla uchwytu. Z atrybutów dnd-kit zostaje tylko opis (instrukcja przeciągania):
// uchwyt jest przyciskiem menu, nie „sortowalnym” przyciskiem przełączanym (`aria-roledescription`, `aria-pressed`).
export type DragHandleProps = {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  describedBy: string
  listeners: ReturnType<typeof useSortable>['listeners']
}

function SortableItem({ id, children }: { id: string; children: (dragHandle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.85 : undefined
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({ setActivatorNodeRef, describedBy: attributes['aria-describedby'], listeners })}
    </div>
  )
}
