import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

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
  // Nazwa elementu w etykietach przycisków, np. „sekcję „Języki”” → „Przesuń sekcję „Języki” w górę”.
  label: (item: T, index: number) => string
  onMove: (id: string, toIndex: number) => void
  children: (item: T, orderControls: ReactNode, index: number) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = items.findIndex((item) => item.id === over.id)
    if (toIndex !== -1) onMove(String(active.id), toIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                    aria-label={`Przesuń ${label(item, index)} w górę`}
                    disabled={index === 0}
                    onClick={() => onMove(item.id, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Przesuń ${label(item, index)} w dół`}
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
          aria-label={`Przeciągnij ${label}, aby zmienić kolejność`}
        >
          ⠿
        </button>
      ))}
    </div>
  )
}
