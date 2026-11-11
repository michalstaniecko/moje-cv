import { useRef } from 'react'
import { useDictionary } from '../i18n'
import { DEFAULT_FORM_WIDTH, displayedFormWidth, formWidthAfterKey, formWidthBounds } from './formWidth'
import type { FormWidth } from './useFormWidth'

// Pionowy separator między formularzem a podglądem: przeciąganie myszą, strzałki ←/→ (ze Shiftem większy krok),
// Home/End – minimum/maksimum, podwójne kliknięcie – szerokość domyślna.
// Przeciąganie tylko zmienia szerokość (`preview`), zapis (`commit`) następuje po puszczeniu separatora.
export function PaneSeparator({ formWidth }: { formWidth: FormWidth }) {
  const { width, panesWidth, preview, commit } = formWidth
  const t = useDictionary().editor
  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null)
  const { min, max } = formWidthBounds(panesWidth)

  return (
    <div
      className="pane-separator"
      role="separator"
      aria-orientation="vertical"
      aria-label={t.resizePanes}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { startX: event.clientX, startWidth: width, width }
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const next = displayedFormWidth(drag.current.startWidth + event.clientX - drag.current.startX, panesWidth)
        if (next === drag.current.width) return
        drag.current.width = next
        preview(next)
      }}
      onPointerUp={() => {
        if (!drag.current) return
        const { startWidth, width: dragged } = drag.current
        drag.current = null
        if (dragged !== startWidth) commit(dragged)
      }}
      onPointerCancel={() => {
        if (drag.current) commit(drag.current.width)
        drag.current = null
      }}
      onDoubleClick={() => commit(DEFAULT_FORM_WIDTH)}
      onKeyDown={(event) => {
        const next = formWidthAfterKey(event, width, panesWidth)
        if (next === null) return
        event.preventDefault()
        commit(next)
      }}
    />
  )
}
