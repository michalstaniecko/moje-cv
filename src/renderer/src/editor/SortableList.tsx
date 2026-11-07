import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useRef, type ReactNode } from 'react'
import { useDictionary } from '../i18n'

// Lista z ręczną kolejnością: przeciąganie za uchwyt (mysz lub klawiatura) i strzałki góra/dół.
// `onMove(id, toIndex)` – element ma trafić na pozycję `toIndex`. `children` dostaje gotowe
// elementy sterujące kolejnością (uchwyt + strzałki) do umieszczenia w wierszu elementu.
export function SortableList<T extends { id: string }>({
  items,
  label,
  onMove,
  children
}: {
  items: T[]
  // Nazwa elementu w etykietach przycisków, np. „section “Languages”” → „Move section “Languages” up”.
  label: (item: T, index: number) => string
  onMove: (id: string, toIndex: number) => void
  children: (item: T, orderControls: ReactNode, index: number) => ReactNode
}) {
  const { order } = useDictionary().editor
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  // Komunikaty dla czytnika ekranu w Interface language: element opisany tą samą etykietą co w przyciskach strzałek
  // (nie identyfikatorem z dokumentu), pozycja liczona od 1 z liczby elementów listy. dnd-kit zgłasza `onDragOver`
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id}>
            {(handle) =>
              children(
                item,
                <span className="order-controls">
                  {handle(label(item, index))}
                  <button
                    type="button"
                    aria-label={order.moveUp(label(item, index))}
                    disabled={index === 0}
                    onClick={() => onMove(item.id, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={order.moveDown(label(item, index))}
                    disabled={index === items.length - 1}
                    onClick={() => onMove(item.id, index + 1)}
                  >
                    ↓
                  </button>
                </span>,
                index
              )
            }
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: (handle: (label: string) => ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { order } = useDictionary().editor
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.85 : undefined
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children((label) => (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={order.drag(label)}
        >
          ⠿
        </button>
      ))}
    </div>
  )
}
