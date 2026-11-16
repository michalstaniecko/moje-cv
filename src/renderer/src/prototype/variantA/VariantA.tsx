// PROTOTYP – wariant A „Inspektor”: kontekstowy prawy panel (jak Figma, Keynote, Pages).
// Układ: wąski pasek narzędzi | po lewej konspekt (tylko nawigacja i kolejność) | strony | po prawej Inspektor ~300 px.
// W Preview mode konspekt znika, a Inspektor zostaje z samą kartą „Dokument”.
import { useRef, type CSSProperties } from 'react'
import { useStore } from 'zustand'
import type { PrototypeShellProps } from '../shell'
import { Inspector } from './Inspector'
import { NavOutline } from './NavOutline'
import { useInspectorSelection } from './useInspectorSelection'
import './variantA.css'

// Szerokości kolumn: przy oknie 960 px zostaje ~490 px na strony (konspekt 168 px, Inspektor ~300 px).
const OUTLINE_WIDTH = 'clamp(168px, 15vw, 220px)'
const INSPECTOR_WIDTH = 'clamp(284px, 24vw, 320px)'

export function VariantA(props: PrototypeShellProps) {
  const { editor, document, session } = props
  const inspector = useRef<HTMLElement>(null)
  const [selection, setSelection] = useInspectorSelection(session, document, inspector)
  const preview = session.mode === 'preview'
  const canUndo = useStore(editor.store.temporal, (state) => state.pastStates.length > 0)
  const canRedo = useStore(editor.store.temporal, (state) => state.futureStates.length > 0)

  const panesStyle = {
    gridTemplateColumns: preview ? `minmax(0, 1fr) ${INSPECTOR_WIDTH}` : `${OUTLINE_WIDTH} minmax(0, 1fr) ${INSPECTOR_WIDTH}`,
    '--sidebar-width': preview ? '0px' : OUTLINE_WIDTH
  } as CSSProperties

  return (
    <div className="editor-screen pa-screen">
      <header className="toolbar editor-toolbar pa-toolbar">
        {props.backButton}
        {props.nameHeading}
        {props.modeToggle}
        <div className="pa-history" role="group" aria-label="Historia zmian">
          <button type="button" className="pa-icon-button" title="Cofnij (⌘Z)" aria-label="Cofnij" disabled={!canUndo} onClick={() => editor.undo()}>
            ↶
          </button>
          <button type="button" className="pa-icon-button" title="Ponów (⇧⌘Z)" aria-label="Ponów" disabled={!canRedo} onClick={() => editor.redo()}>
            ↷
          </button>
        </div>
        <span className="toolbar-status">{props.saveStatus}</span>
        {props.exportButtons}
      </header>
      {props.notices}
      <div ref={props.panesRef} className="editor-panes pa-panes" style={panesStyle}>
        {!preview && (
          <NavOutline editor={editor} document={document} session={session} selection={selection} onSelect={setSelection} />
        )}
        {props.preview}
        <Inspector
          ref={inspector}
          editor={editor}
          document={document}
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
