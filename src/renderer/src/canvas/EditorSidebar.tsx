import { useEffect, useRef } from 'react'
import type { Clause, ClauseContent, CvDocument, EditorSidebar as Sidebar } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { CvForm } from '../editor/CvForm'
import { PaneSeparator } from '../editor/PaneSeparator'
import type { RemoveWithUndo } from '../editor/removalUndo'
import type { EditorSidebarControl } from '../editor/useEditorSidebar'
import type { FormWidth } from '../editor/useFormWidth'
import { useDictionary } from '../i18n'
import { markInput } from '../preview/keystrokeTiming'
import { Outline } from './Outline'
import type { EditSession } from './useEditSession'

// Szerokość Outline i szyny w px (docs/specs/inline-editing-redesign.md, Q13); CV form ma szerokość z separatora.
export const OUTLINE_WIDTH = 240
export const RAIL_WIDTH = 44

export const sidebarWidth = (sidebar: Sidebar, formWidth: number) =>
  sidebar === 'outline' ? OUTLINE_WIDTH : sidebar === 'collapsed' ? RAIL_WIDTH : formWidth

// Pasek boczny edytora w Edit mode: Outline (domyślnie), CV form z separatorem albo szyna z ikonami. Na dole Outline
// i CV form przełącznik „Outline | Formularz” i „Zwiń”; szyna ma ikony obu widoków i „Rozwiń” (wraca do widoku,
// z którego ją zwinięto). Wybór jest preferencją aplikacji (`useEditorSidebar`). Po przełączeniu fokus zostaje na
// odpowiedniku klikniętego przycisku w nowym widoku. Element z `data-safe-focus` to miejsce dla fokusu, który nie ma
// dokąd wrócić (np. pole części CV, której już nie ma).
export function EditorSidebar({
  control,
  editor,
  document,
  session,
  formWidth,
  clauses,
  onSaveClause,
  onRemove
}: {
  control: EditorSidebarControl
  editor: CvEditor
  document: CvDocument
  session: EditSession
  formWidth: FormWidth
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
  onRemove: RemoveWithUndo
}) {
  const { sidebar } = control
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    const selector = pendingFocus.current
    pendingFocus.current = null
    if (selector) window.document.querySelector<HTMLElement>(`.editor-panes [data-sidebar-control="${selector}"]`)?.focus()
  }, [sidebar])

  // `focus` – przycisk (`data-sidebar-control`), na który przechodzi fokus w nowym widoku.
  const choose = (next: Sidebar, focus: string) => {
    if (next === sidebar) return
    pendingFocus.current = focus
    control.choose(next)
  }
  const expand = () => {
    pendingFocus.current = 'collapse'
    control.expand()
  }

  if (sidebar === 'collapsed') return <SidebarRail onChoose={choose} onExpand={expand} />

  const footer = <SidebarFooter sidebar={sidebar} onChoose={choose} />
  if (sidebar === 'outline') {
    return <Outline editor={editor} document={document} session={session} footer={footer} />
  }
  return (
    <>
      {/* Początek pomiaru odpowiedzi podglądu na klawisz (preview/keystrokeTiming.ts). */}
      <aside className="editor-form" data-entry-root onInput={(event) => markInput(event.timeStamp)}>
        <CvForm editor={editor} clauses={clauses} onSaveClause={onSaveClause} onRemove={onRemove} />
        {footer}
      </aside>
      <PaneSeparator formWidth={formWidth} />
    </>
  )
}

// Dół Outline i CV form: przełącznik widoku (dwa przyciski `aria-pressed`) i „Zwiń”.
function SidebarFooter({ sidebar, onChoose }: { sidebar: Sidebar; onChoose: (next: Sidebar, focus: string) => void }) {
  const t = useDictionary().editor.outline
  return (
    <div className="sidebar-footer">
      <div className="sidebar-switch">
        {(['outline', 'form'] as const).map((view) => (
          <button
            key={view}
            type="button"
            data-sidebar-control={view}
            // Przy CV form tu wraca fokus, który nie ma dokąd wrócić (w Outline – „Nagłówek”).
            data-safe-focus={(sidebar === 'form' && view === 'form') || undefined}
            aria-pressed={sidebar === view}
            onClick={() => onChoose(view, view)}
          >
            {view === 'outline' ? t.title : t.form}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="sidebar-icon-button"
        data-sidebar-control="collapse"
        aria-label={t.collapse}
        title={t.collapse}
        onClick={() => onChoose('collapsed', 'expand')}
      >
        <ChevronIcon direction="left" />
      </button>
    </div>
  )
}

// Zwinięty pasek boczny: ikony Outline i CV form (rozwijają do swojego widoku) oraz „Rozwiń” na dole. Dla czytnika
// ekranu to nazwany punkt orientacyjny „Pasek boczny” (rozwinięty Outline jest nawigacją „Konspekt”).
function SidebarRail({ onChoose, onExpand }: { onChoose: (next: Sidebar, focus: string) => void; onExpand: () => void }) {
  const t = useDictionary().editor.outline
  return (
    <aside className="editor-rail" aria-label={t.sidebar}>
      <button
        type="button"
        className="sidebar-icon-button"
        data-sidebar-control="rail-outline"
        data-safe-focus
        aria-label={t.title}
        title={t.title}
        onClick={() => onChoose('outline', 'outline')}
      >
        <OutlineIcon />
      </button>
      <button
        type="button"
        className="sidebar-icon-button"
        data-sidebar-control="rail-form"
        aria-label={t.form}
        title={t.form}
        onClick={() => onChoose('form', 'form')}
      >
        <FormIcon />
      </button>
      <button
        type="button"
        className="sidebar-icon-button editor-rail-expand"
        data-sidebar-control="expand"
        aria-label={t.expand}
        title={t.expand}
        onClick={onExpand}
      >
        <ChevronIcon direction="right" />
      </button>
    </aside>
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

function OutlineIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 4h1M6 4h7.5M2.5 8h1M6 8h7.5M2.5 12h1M6 12h7.5" />
    </svg>
  )
}

function FormIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg {...iconProps}>
      <path d={direction === 'left' ? 'M9.5 4 5.5 8l4 4' : 'M6.5 4l4 4-4 4'} strokeLinejoin="round" />
    </svg>
  )
}
