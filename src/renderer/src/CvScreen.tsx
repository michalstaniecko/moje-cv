import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { MenuCommand } from '../../shared/api'
import { cvDisplayName, type Clause, type ClauseContent, type CvDocument } from './domain/schema'
import { createCvEditor, type CvEditor } from './editor/cvEditor'
import { CvForm } from './editor/CvForm'
import { useDictionary } from './i18n'
import { useMenuCommands } from './menuCommands'
import { PreviewPane } from './preview/PreviewPane'

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'saved'; filePath: string }
  | { status: 'failed' }

// Wynik eksportu otwartego CV do pliku .json z menu Plik.
type JsonExportState = { status: 'idle' } | { status: 'saved'; fileName: string } | { status: 'failed' }

// Otwarte CV: formularz edycji (lewo), podgląd stron (prawo) i eksport do PDF.
// `onBack` dostaje komendę menu Plik (Nowe CV, Dodaj przykładowe CV, Importuj…), gdy edytor wychodzi, żeby wykonała
// ją biblioteka CV.
export function CvScreen({
  document: initial,
  onBack
}: {
  document: CvDocument
  onBack: (command?: MenuCommand) => void
}) {
  const [editor] = useState(() => createCvEditor(initial, window.api.cv.update))
  const document = useStore(editor.store, (state) => state.document)
  const saveStatus = useStore(editor.store, (state) => state.saveStatus)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [jsonExport, setJsonExport] = useState<JsonExportState>({ status: 'idle' })
  const [clauses, saveClause] = useClauseLibrary()
  const { appName, common, editor: t, library } = useDictionary()
  useEditorLifecycle(editor)

  const exportPdf = async () => {
    setJsonExport({ status: 'idle' })
    setExportState({ status: 'exporting' })
    try {
      const result = await window.api.pdf.export(document)
      setExportState(result.status === 'saved' ? result : { status: 'idle' })
    } catch {
      setExportState({ status: 'failed' })
    }
  }

  // Przy nieudanym zapisie zostajemy w edytorze – komunikat o błędzie jest widoczny, a zmiany nie przepadają.
  const back = async (command?: MenuCommand) => {
    await editor.flush()
    if (editor.store.getState().saveStatus !== 'failed') onBack(command)
  }

  // Eksport do .json z menu Plik: najpierw zapis oczekującej zmiany, żeby plik miał to, co właśnie wpisano.
  const exportJson = async () => {
    setExportState({ status: 'idle' })
    setJsonExport({ status: 'idle' })
    try {
      await editor.flush()
      const result = await window.api.cv.exportFile(document.id)
      if (result.status === 'saved') setJsonExport({ status: 'saved', fileName: baseName(result.filePath) })
    } catch {
      setJsonExport({ status: 'failed' })
    }
  }

  // Menu Plik: eksport tymi samymi funkcjami co przycisk (trwający eksport do PDF – komenda pominięta, jak wyłączony
  // przycisk); tworzenie i import tą samą drogą co „← Wróć”, a wykonuje je biblioteka CV.
  useMenuCommands((command) => {
    if (command === 'export-pdf') {
      if (exportState.status !== 'exporting') void exportPdf()
    } else if (command === 'export-json') void exportJson()
    else void back(command)
  })

  return (
    <div className="editor-screen">
      <header className="toolbar">
        <button type="button" onClick={() => back()}>
          {common.back(appName)}
        </button>
        <h1 className="toolbar-title">{cvDisplayName(document.name, library.untitled)}</h1>
        <span
          className={saveStatus === 'failed' ? 'toolbar-status toolbar-status--error' : 'toolbar-status'}
          role="status"
        >
          {t.saveStatus[saveStatus]}
        </span>
        <button type="button" className="button-primary" onClick={exportPdf} disabled={exportState.status === 'exporting'}>
          {exportState.status === 'exporting' ? t.exporting : t.exportPdf}
        </button>
        {exportState.status === 'saved' && (
          <p className="toolbar-notice" role="status">
            {t.savedPdf(baseName(exportState.filePath))}
            <button type="button" onClick={() => window.api.pdf.open(exportState.filePath)}>
              {t.openPdf}
            </button>
            <button type="button" onClick={() => window.api.pdf.showInFolder(exportState.filePath)}>
              {t.showInFolder}
            </button>
          </p>
        )}
        {exportState.status === 'failed' && (
          <p className="toolbar-notice toolbar-notice--error" role="alert">
            {t.exportFailed}
          </p>
        )}
        {jsonExport.status === 'saved' && (
          <p className="toolbar-notice" role="status">
            {library.savedFile(jsonExport.fileName)}
          </p>
        )}
        {jsonExport.status === 'failed' && (
          <p className="toolbar-notice toolbar-notice--error" role="alert">
            {library.errors.export}
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

// Cmd+Z / Cmd+Shift+Z (Ctrl na innych systemach) i Edycja → Cofnij / Ponów w menu cofają i ponawiają zmiany
// w dokumencie – także w polu tekstowym, zamiast wbudowanego cofania pola. Skrót obsłużony tutaj (preventDefault)
// nie uruchamia już pozycji menu. Oczekująca zmiana jest zapisywana przy zamknięciu okna i wyjściu z edytora.
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
    const unsubscribe = window.api.editor.onHistoryCommand((command) =>
      command === 'undo' ? editor.undo() : editor.redo()
    )
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onUnload)
      unsubscribe()
      void editor.flush()
    }
  }, [editor])
}

const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? filePath
