// PROTOTYP – wariant A (do wypełnienia).
import type { PrototypeShellProps } from '../shell'

export function VariantA(props: PrototypeShellProps) {
  return (
    <div className="editor-screen">
      <header className="toolbar editor-toolbar">
        {props.backButton}
        {props.nameHeading}
        {props.modeToggle}
        <span className="toolbar-status">Wariant A – w budowie</span>
        {props.exportButtons}
      </header>
      {props.notices}
      <div ref={props.panesRef} className="editor-panes" style={{ gridTemplateColumns: 'minmax(0, 1fr)', ['--sidebar-width' as string]: '0px' }}>
        {props.preview}
        {props.removalMessage}
      </div>
    </div>
  )
}
