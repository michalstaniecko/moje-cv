import { useEffect, useRef } from 'react'
import type { Clause, ClauseContent } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { CvForm } from '../editor/CvForm'
import { PaneSeparator } from '../editor/PaneSeparator'
import type { RemoveWithUndo } from '../editor/removalUndo'
import type { EditorSidebarControl, SidebarView } from '../editor/useEditorSidebar'
import type { FormWidth } from '../editor/useFormWidth'
import { useDictionary } from '../i18n'
import { markInput } from '../preview/keystrokeTiming'

// Szerokość szyny w px (docs/specs/inline-editing-redesign.md, Q13); CV form ma szerokość z separatora.
export const RAIL_WIDTH = 44

export const sidebarWidth = (sidebar: SidebarView, formWidth: number) => (sidebar === 'collapsed' ? RAIL_WIDTH : formWidth)

// Pasek boczny edytora w Edit mode – do czasu #135 tylko CV form jako widok zapasowy (Outline zastąpiła lista „CV
// elements” w Inspektorze, ADR-0012): domyślnie zwinięty do szyny z przyciskiem „Formularz”, rozwinięty – CV form
// z separatorem i „Zwiń” na dole. Wybór jest preferencją aplikacji (`useEditorSidebar`). Po przełączeniu fokus
// przechodzi na przycisk, który wraca do poprzedniego widoku.
export function EditorSidebar({
  control,
  editor,
  formWidth,
  clauses,
  onSaveClause,
  onRemove
}: {
  control: EditorSidebarControl
  editor: CvEditor
  formWidth: FormWidth
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
  onRemove: RemoveWithUndo
}) {
  const { sidebar } = control
  const t = useDictionary().editor.sidebar
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    const selector = pendingFocus.current
    pendingFocus.current = null
    if (selector) window.document.querySelector<HTMLElement>(`.editor-panes [data-sidebar-control="${selector}"]`)?.focus()
  }, [sidebar])

  // `focus` – przycisk (`data-sidebar-control`), na który przechodzi fokus w nowym widoku.
  const choose = (next: SidebarView, focus: string) => {
    if (next === sidebar) return
    pendingFocus.current = focus
    control.choose(next)
  }

  if (sidebar === 'collapsed') {
    // Zwinięty pasek boczny: ikona CV form. Dla czytnika ekranu to nazwany punkt orientacyjny „Pasek boczny”.
    return (
      <aside className="editor-rail" aria-label={t.label}>
        <button
          type="button"
          className="sidebar-icon-button"
          data-sidebar-control="form"
          aria-label={t.form}
          title={t.form}
          onClick={() => choose('form', 'collapse')}
        >
          <FormIcon />
        </button>
      </aside>
    )
  }
  return (
    <>
      {/* Początek pomiaru odpowiedzi podglądu na klawisz (preview/keystrokeTiming.ts). */}
      <aside className="editor-form" data-entry-root onInput={(event) => markInput(event.timeStamp)}>
        <CvForm editor={editor} clauses={clauses} onSaveClause={onSaveClause} onRemove={onRemove} />
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-icon-button"
            data-sidebar-control="collapse"
            aria-label={t.collapse}
            title={t.collapse}
            onClick={() => choose('collapsed', 'form')}
          >
            <ChevronIcon />
          </button>
        </div>
      </aside>
      <PaneSeparator formWidth={formWidth} />
    </>
  )
}

const iconProps = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  'aria-hidden': true,
  focusable: false
} as const

function FormIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9.5 4 5.5 8l4 4" strokeLinejoin="round" />
    </svg>
  )
}
