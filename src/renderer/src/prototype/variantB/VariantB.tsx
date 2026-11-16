// PROTOTYP – wariant B „Pasek formatowania”: bez lewego paska bocznego – strony na całą szerokość, a wszystkie opcje
// globalne w drugim, zwartym rzędzie pod paskiem narzędzi (jak w Canva / Google Docs / Pages). Rząd 1: wstecz, nazwa
// CV, tryb, status zapisu, eksport. Rząd 2: FormatBar. Oba tryby (Edit / Preview) mają ten sam pasek.
import type { PrototypeShellProps } from '../shell'
import { FormatBar } from './FormatBar'
import './variantB.css'

export function VariantB(props: PrototypeShellProps) {
  return (
    <div className="editor-screen pb-screen">
      <header className="toolbar editor-toolbar pb-toolbar">
        {props.backButton}
        {props.nameHeading}
        {props.modeToggle}
        {/* Przy nieudanym zapisie status jest pusty – błąd ogłasza pasek komunikatu (notices). */}
        <span className="toolbar-status" role="status">
          {props.saveStatus}
        </span>
        {props.exportButtons}
      </header>
      <FormatBar
        editor={props.editor}
        document={props.document}
        clauses={props.clauses}
        saveClause={props.saveClause}
        exportJson={props.exportJson}
      />
      {props.notices}
      <div
        ref={props.panesRef}
        className="editor-panes pb-panes"
        style={{ gridTemplateColumns: 'minmax(0, 1fr)', ['--sidebar-width' as string]: '0px' }}
      >
        {props.preview}
        {props.removalMessage}
      </div>
    </div>
  )
}
