import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { Clause, ClauseContent, CvDocument } from './domain/schema'
import { createCvEditor, type CvEditor, type SaveStatus } from './editor/cvEditor'
import { CvForm } from './editor/CvForm'
import { PreviewPane } from './preview/PreviewPane'

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'saved'; filePath: string }
  | { status: 'failed' }

const saveStatusText: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Zapisywanie…',
  saved: 'Zmiany zapisane',
  failed: 'Nie udało się zapisać zmian'
}

// Otwarte CV: formularz edycji (lewo), podgląd stron (prawo) i eksport do PDF.
export function CvScreen({ document: initial, onBack }: { document: CvDocument; onBack: () => void }) {
  const [editor] = useState(() => createCvEditor(initial, window.api.cv.update))
  const document = useStore(editor.store, (state) => state.document)
  const saveStatus = useStore(editor.store, (state) => state.saveStatus)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [clauses, saveClause] = useClauseLibrary()
  useEditorLifecycle(editor)

  const exportPdf = async () => {
    setExportState({ status: 'exporting' })
    try {
      const result = await window.api.pdf.export(document)
      setExportState(result.status === 'saved' ? result : { status: 'idle' })
    } catch {
      setExportState({ status: 'failed' })
    }
  }

  // Przy nieudanym zapisie zostajemy w edytorze – komunikat o błędzie jest widoczny, a zmiany nie przepadają.
  const back = async () => {
    await editor.flush()
    if (editor.store.getState().saveStatus !== 'failed') onBack()
  }

  return (
    <div className="editor-screen">
      <header className="toolbar">
        <button type="button" onClick={back}>
          ← Moje CV
        </button>
        <h1 className="toolbar-title">{document.name}</h1>
        <span
          className={saveStatus === 'failed' ? 'toolbar-status toolbar-status--error' : 'toolbar-status'}
          role="status"
        >
          {saveStatusText[saveStatus]}
        </span>
        <button type="button" onClick={exportPdf} disabled={exportState.status === 'exporting'}>
          {exportState.status === 'exporting' ? 'Eksportowanie…' : 'Eksportuj do PDF'}
        </button>
        {exportState.status === 'saved' && (
          <p className="toolbar-notice" role="status">
            Zapisano PDF: {baseName(exportState.filePath)}
            <button type="button" onClick={() => window.api.pdf.open(exportState.filePath)}>
              Otwórz
            </button>
            <button type="button" onClick={() => window.api.pdf.showInFolder(exportState.filePath)}>
              Pokaż w Finderze
            </button>
          </p>
        )}
        {exportState.status === 'failed' && (
          <p className="toolbar-notice toolbar-notice--error" role="alert">
            Nie udało się zapisać PDF. Spróbuj ponownie.
          </p>
        )}
      </header>
      <div className="editor-panes">
        <aside className="editor-form">
          <CvForm editor={editor} clauses={clauses} onSaveClause={saveClause} />
        </aside>
        <PreviewPane document={document} />
      </div>
    </div>
  )
}

// Klauzule z biblioteki do wyboru w CV i dodawanie nowej („Zapisz jako nową klauzulę”).
// Bez dostępu do biblioteki (np. uszkodzony plik ustawień) lista jest pusta, a klauzulę w CV nadal można edytować.
function useClauseLibrary() {
  const [clauses, setClauses] = useState<Clause[]>([])

  useEffect(() => {
    window.api.settings.get().then(
      (settings) => setClauses(settings.clauses),
      () => setClauses([])
    )
  }, [])

  const saveClause = async (content: ClauseContent) => {
    const clause = await window.api.settings.addClause(content)
    setClauses((current) => [...current, clause])
    return clause
  }

  return [clauses, saveClause] as const
}

// Cmd+Z / Cmd+Shift+Z (Ctrl na innych systemach) cofa i ponawia zmiany w dokumencie – także w polu tekstowym,
// zamiast wbudowanego cofania pola. Oczekująca zmiana jest zapisywana przy zamknięciu okna i wyjściu z edytora.
function useEditorLifecycle(editor: CvEditor) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = navigator.platform.startsWith('Mac') ? event.metaKey : event.ctrlKey
      if (!modifier || event.altKey || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) editor.redo()
      else editor.undo()
    }
    const onUnload = () => void editor.flush()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onUnload)
      void editor.flush()
    }
  }, [editor])
}

const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1)
