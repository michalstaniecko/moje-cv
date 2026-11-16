// PROTOTYP – wariant C „Tryb Projekt”: pisanie i projektowanie to dwie osobne czynności. Przełącznik
// Treść | Projekt | Podgląd; w „Projekt” strony są tylko do odczytu (Preview mode), a obok szeroka kolumna z kartami
// wszystkich opcji wyglądu CV. Ustawienia całej aplikacji – pod ⚙ w pasku narzędzi.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type Ref } from 'react'
import { sidebarWidth } from '../../canvas/EditorSidebar'
import { useEditorSidebar } from '../../editor/useEditorSidebar'
import { useFormWidth } from '../../editor/useFormWidth'
import type { PrototypeShellProps } from '../shell'
import { AppSettingsPopover } from './AppSettingsPopover'
import { DesignColumn } from './DesignColumn'
import './variantC.css'

type Stage = 'content' | 'design' | 'preview'

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'content', label: 'Treść', hint: 'Pisz i poprawiaj tekst bezpośrednio na stronach' },
  { id: 'design', label: 'Projekt', hint: 'Szablon, kolory, czcionka, elementy CV i układ' },
  { id: 'preview', label: 'Podgląd', hint: 'Strony dokładnie tak, jak w PDF' }
]

// Szerokość kolumny Projekt: 360–420 px, przy oknie 960 px zostaje ~600 px na strony.
const DESIGN_WIDTH = 'clamp(360px, 34vw, 420px)'

export function VariantC(props: PrototypeShellProps) {
  const { session } = props
  const [designOpen, setDesignOpen] = useState(false)
  // Przejście do Edit mode z zewnątrz (skrót podglądu, „Pokaż” za długich bloków) zamyka etap Projekt.
  useEffect(() => {
    if (session.mode === 'edit') setDesignOpen(false)
  }, [session.mode])
  const stage: Stage = session.mode === 'edit' ? 'content' : designOpen ? 'design' : 'preview'
  const choose = (next: Stage) => {
    setDesignOpen(next === 'design')
    session.setMode(next === 'content' ? 'edit' : 'preview')
  }

  // Szerokość obecnego paska bocznego (Outline / CV form / szyna) w etapie Treść – jak w CvScreen.
  const panes = useRef<HTMLDivElement | null>(null)
  const sidebar = useEditorSidebar()
  const formWidth = useFormWidth(panes)
  const { panesRef } = props
  const setPanes = useCallback(
    (element: HTMLDivElement | null) => {
      panes.current = element
      assignRef(panesRef, element)
    },
    [panesRef]
  )

  const contentWidth = `${sidebarWidth(sidebar.sidebar, formWidth.width)}px`
  const left = stage === 'content' ? contentWidth : stage === 'design' ? DESIGN_WIDTH : '0px'
  const panesStyle = {
    gridTemplateColumns: stage === 'preview' ? 'minmax(0, 1fr)' : `${left} minmax(0, 1fr)`,
    '--sidebar-width': left,
    '--form-width': `${formWidth.width}px`
  } as CSSProperties

  return (
    <div className="editor-screen pc-screen" data-stage={stage}>
      <header className="toolbar editor-toolbar pc-toolbar">
        {props.backButton}
        {props.nameHeading}
        <StageToggle stage={stage} onChange={choose} />
        <span className="toolbar-status" role="status">
          {props.saveStatus}
        </span>
        {props.exportButtons}
        <AppSettingsPopover clauses={props.clauses} />
      </header>
      {props.notices}
      {/* Strony (`preview`) zawsze na drugiej pozycji – nie są montowane od nowa przy zmianie etapu. */}
      <div ref={setPanes} className="editor-panes" style={panesStyle}>
        {stage === 'content' ? (
          props.currentSidebar
        ) : stage === 'design' ? (
          <DesignColumn {...props} onDone={() => choose('content')} />
        ) : null}
        {props.preview}
        {props.removalMessage}
      </div>
    </div>
  )
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T }).current = value
}

// Trzy segmenty: radio wyglądające jak natywny NSSegmentedControl (strzałki przełączają etapy).
function StageToggle({ stage, onChange }: { stage: Stage; onChange: (stage: Stage) => void }) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label="Etap pracy nad CV" className="pc-segmented pc-stage-toggle">
      {STAGES.map((item) => (
        <label key={item.id} className="pc-segment" title={item.hint}>
          <input type="radio" name={name} checked={stage === item.id} onChange={() => onChange(item.id)} />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  )
}
