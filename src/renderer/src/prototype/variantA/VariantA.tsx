// PROTOTYP – wariant A „Inspektor”: kontekstowy prawy panel (jak Figma, Keynote, Pages).
// Układ: pasek narzędzi | strony | po prawej Inspektor ~300 px. Bez lewego paska: konspekt (nawigacja, kolejność,
// widoczność) jest w Inspektorze, w „Dokument → Elementy CV”. W Preview mode Inspektor ma samą kartę „Dokument”.
import { useRef, type CSSProperties } from 'react'
import { useStore } from 'zustand'
import type { PrototypeShellProps } from '../shell'
import { UndoIcon } from './controls'
import { Inspector } from './Inspector'
import { useInspectorSelection } from './useInspectorSelection'
import './variantA.css'

// Przy oknie 960 px zostaje ~670 px na strony.
const INSPECTOR_WIDTH = 'clamp(284px, 24vw, 320px)'

export function VariantA(props: PrototypeShellProps) {
  const { editor, document, session } = props
  const inspector = useRef<HTMLElement>(null)
  const [selection, setSelection] = useInspectorSelection(session, document, inspector)
  const preview = session.mode === 'preview'
  const canUndo = useStore(editor.store.temporal, (state) => state.pastStates.length > 0)
  const canRedo = useStore(editor.store.temporal, (state) => state.futureStates.length > 0)

  const panesStyle = {
    gridTemplateColumns: `minmax(0, 1fr) ${INSPECTOR_WIDTH}`,
    '--sidebar-width': '0px'
  } as CSSProperties

  return (
    <div className="editor-screen pa-screen">
      <header className="toolbar editor-toolbar pa-toolbar">
        {props.backButton}
        {props.nameHeading}
        {props.modeToggle}
        {!preview && (
          <div className="pa-history" role="group" aria-label="Historia zmian">
            <button type="button" className="pa-icon-button" title="Cofnij (⌘Z)" aria-label="Cofnij" aria-keyshortcuts="Meta+Z" disabled={!canUndo} onClick={() => editor.undo()}>
              <UndoIcon />
            </button>
            <button type="button" className="pa-icon-button" title="Ponów (⇧⌘Z)" aria-label="Ponów" aria-keyshortcuts="Shift+Meta+Z" disabled={!canRedo} onClick={() => editor.redo()}>
              <UndoIcon redo />
            </button>
          </div>
        )}
        <span className="toolbar-status">{props.saveStatus}</span>
        {props.exportButtons}
      </header>
      {props.notices}
      <div ref={props.panesRef} className="editor-panes pa-panes" style={panesStyle}>
        {props.preview}
        <Inspector
          ref={inspector}
          editor={editor}
          document={document}
          session={session}
          clauses={props.clauses}
          saveClause={props.saveClause}
          selection={selection}
          onSelect={setSelection}
          preview={preview}
        />
        {props.removalMessage}
      </div>
    </div>
  )
}
