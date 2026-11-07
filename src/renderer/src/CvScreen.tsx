import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { MenuCommand } from '../../shared/api'
import type { PaginateResult } from './domain/paginate'
import { cvDisplayName, type Clause, type ClauseContent, type CvDocument } from './domain/schema'
import { createCvEditor, type CvEditor } from './editor/cvEditor'
import { CvForm } from './editor/CvForm'
import { updateName } from './editor/documentEdits'
import { RemovalMessage, useRemovalUndo } from './editor/removalUndo'
import { useDictionary } from './i18n'
import { useMenuCommands } from './menuCommands'
import { markInput } from './preview/keystrokeTiming'
import { PreviewPane } from './preview/PreviewPane'

// `confirming` – CV ma bloki wyższe niż strona i eksport czeka na „Eksportuj mimo to”; `timed-out` – strona wydruku
// nie zgłosiła gotowości w czasie (osobny komunikat od innych błędów).
type ExportState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'exporting' }
  | { status: 'saved'; filePath: string }
  | { status: 'failed' }
  | { status: 'timed-out' }

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
  const { common, editor: t, library } = useDictionary()
  const removal = useRemovalUndo(editor)
  // Wyjście z edytora po nieudanym zapisie czeka na decyzję: komenda menu Plik, z którą wychodzimy (albo samo wyjście).
  const [leaving, setLeaving] = useState<{ command?: MenuCommand } | null>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const exportButton = useRef<HTMLButtonElement>(null)
  // Liczba bloków wyższych niż strona z ostatniego podziału stron podglądu (liczonego po każdej zmianie dokumentu).
  const oversizedCount = useRef(0)
  const onLayout = useCallback((layout: PaginateResult) => {
    oversizedCount.current = layout.oversizedIds.length
  }, [])
  useEditorLifecycle(editor)

  // Ponowiony albo kolejny zapis kończy pytanie o wyjście; przy następnym błędzie pasek wraca do zwykłego komunikatu.
  useEffect(() => {
    if (saveStatus !== 'failed') setLeaving(null)
  }, [saveStatus])

  // Każdy wyzwalacz eksportu (przycisk, menu Plik) przechodzi tędy: przy blokach wyższych niż strona najpierw pytanie,
  // czy eksportować uciętą treść. Nowy eksport zastępuje poprzednie powiadomienie.
  const exportPdf = async ({ confirmed = false } = {}) => {
    setJsonExport({ status: 'idle' })
    if (!confirmed && oversizedCount.current > 0) {
      setExportState({ status: 'confirming' })
      return
    }
    setExportState({ status: 'exporting' })
    try {
      const result = await window.api.pdf.export(document)
      setExportState(result.status === 'canceled' ? { status: 'idle' } : result)
    } catch {
      setExportState({ status: 'failed' })
    }
  }

  const cancelExport = () => {
    setExportState({ status: 'idle' })
    exportButton.current?.focus()
  }

  // Przy nieudanym zapisie wyjście wymaga potwierdzenia („Wyjdź mimo to”), żeby zmiany nie przepadły przez przypadek,
  // a użytkownik nie utknął w edytorze przy trwałym błędzie.
  const back = async (command?: MenuCommand) => {
    await editor.flush()
    if (editor.store.getState().saveStatus !== 'failed') onBack(command)
    else setLeaving({ command })
  }

  const stay = () => {
    setLeaving(null)
    backButton.current?.focus()
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
      if (exportState.status !== 'exporting' && exportState.status !== 'confirming') void exportPdf()
    } else if (command === 'export-json') void exportJson()
    else void back(command)
  })

  return (
    <div className="editor-screen">
      <header className="toolbar">
        <button type="button" ref={backButton} onClick={() => back()}>
          {common.back}
        </button>
        <CvNameHeading name={document.name} onRename={(name) => editor.edit(updateName(name))} />
        {/* Przy nieudanym zapisie status jest pusty – błąd ogłasza pasek komunikatu pod paskiem narzędzi. */}
        <span className="toolbar-status" role="status">
          {saveStatus === 'failed' ? '' : t.saveStatus[saveStatus]}
        </span>
        <button
          type="button"
          ref={exportButton}
          className="button-primary"
          onClick={() => void exportPdf()}
          disabled={exportState.status === 'exporting'}
        >
          {exportState.status === 'exporting' ? t.exporting : t.exportPdf}
        </button>
      </header>
      {saveStatus === 'failed' && (
        <SaveFailedAlert
          leaving={leaving !== null}
          onRetry={() => void editor.flush()}
          onLeave={() => onBack(leaving?.command)}
          onStay={stay}
        />
      )}
      {exportState.status === 'exporting' && (
        <div className="export-notice" role="status">
          <progress aria-label={t.preparingPdf} />
          <span>{t.preparingPdf}</span>
        </div>
      )}
      {exportState.status === 'saved' && (
        <ExportNotice onDismiss={() => setExportState({ status: 'idle' })}>
          <span>{t.savedPdf(baseName(exportState.filePath))}</span>
          <button type="button" onClick={() => window.api.pdf.open(exportState.filePath)}>
            {t.openPdf}
          </button>
          <button type="button" onClick={() => window.api.pdf.showInFolder(exportState.filePath)}>
            {t.showInFolder}
          </button>
        </ExportNotice>
      )}
      {(exportState.status === 'failed' || exportState.status === 'timed-out') && (
        <ExportNotice error onDismiss={() => setExportState({ status: 'idle' })}>
          <span>{exportState.status === 'failed' ? t.exportFailed : t.exportTimedOut}</span>
        </ExportNotice>
      )}
      {jsonExport.status === 'saved' && (
        <ExportNotice onDismiss={() => setJsonExport({ status: 'idle' })}>
          <span>{library.savedFile(jsonExport.fileName)}</span>
        </ExportNotice>
      )}
      {jsonExport.status === 'failed' && (
        <ExportNotice error onDismiss={() => setJsonExport({ status: 'idle' })}>
          <span>{library.errors.export}</span>
        </ExportNotice>
      )}
      {exportState.status === 'confirming' && (
        <ExportCutOffDialog onExport={() => void exportPdf({ confirmed: true })} onCancel={cancelExport} />
      )}
      <div className="editor-panes">
        {/* Początek pomiaru odpowiedzi podglądu na klawisz (preview/keystrokeTiming.ts). */}
        <aside className="editor-form" onInput={(event) => markInput(event.timeStamp)}>
          <CvForm editor={editor} clauses={clauses} onSaveClause={saveClause} onRemove={removal.remove} />
          <RemovalMessage removal={removal.removal} onUndo={removal.undo} onExpire={removal.dismiss} />
        </aside>
        <PreviewPane document={document} onLayout={onLayout} />
      </div>
    </div>
  )
}

// Nazwa CV w nagłówku edytora: przycisk z nazwą, który zamienia się w pole z zaznaczonym tekstem. Enter i kliknięcie obok
// zatwierdzają (zmiana dokumentu: autozapis i jeden krok cofania), Escape anuluje; fokus wraca na przycisk z nazwą.
// Pusta nazwa niczego nie zmienia (`updateName`).
function CvNameHeading({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { editor: t, library } = useDictionary()
  const [draft, setDraft] = useState<string | null>(null)
  const nameButton = useRef<HTMLButtonElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const focusButtonAfterEditing = useRef(false)
  const editing = draft !== null
  const displayName = cvDisplayName(name, library.untitled)

  useEffect(() => {
    if (editing) nameField.current?.select()
    else if (focusButtonAfterEditing.current) {
      focusButtonAfterEditing.current = false
      nameButton.current?.focus()
    }
  }, [editing])

  // Enter/Escape kończą edycję, zanim pole zniknie – późniejsze `blur` nie zatwierdza już drugi raz.
  const finish = (commit: boolean, focusButton: boolean) => {
    if (draft === null) return
    if (commit) onRename(draft)
    focusButtonAfterEditing.current = focusButton
    setDraft(null)
  }

  return (
    <h1 className="toolbar-title">
      {editing ? (
        <input
          ref={nameField}
          className="toolbar-title-field"
          aria-label={library.name}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Bez preventDefault Enter „kliknąłby” przycisk z nazwą, który dostaje fokus, i otworzył pole ponownie.
            if (event.key === 'Enter') {
              event.preventDefault()
              finish(true, true)
            } else if (event.key === 'Escape') finish(false, true)
          }}
          onBlur={() => finish(true, false)}
        />
      ) : (
        <button
          type="button"
          ref={nameButton}
          className="toolbar-title-button"
          aria-label={t.renameCv(displayName)}
          onClick={() => setDraft(name)}
        >
          {displayName}
        </button>
      )}
    </h1>
  )
}

// Pasek pod paskiem narzędzi przy nieudanym autozapisie: komunikat z „Spróbuj ponownie”, a po próbie wyjścia z edytora
// pytanie „Wyjść mimo to?”. Fokus przechodzi wtedy na „Zostań w edytorze”, a Escape działa jak ten przycisk.
function SaveFailedAlert({
  leaving,
  onRetry,
  onLeave,
  onStay
}: {
  leaving: boolean
  onRetry: () => void
  onLeave: () => void
  onStay: () => void
}) {
  const { editor: t } = useDictionary()
  const stayButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (leaving) stayButton.current?.focus()
  }, [leaving])

  return (
    <div
      className="editor-alert"
      role="alert"
      onKeyDown={(event) => {
        if (leaving && event.key === 'Escape') onStay()
      }}
    >
      {leaving ? (
        <>
          <span>{t.leaveUnsaved}</span>
          <button type="button" onClick={onLeave}>
            {t.leaveAnyway}
          </button>
          <button type="button" ref={stayButton} onClick={onStay}>
            {t.stayInEditor}
          </button>
        </>
      ) : (
        <>
          <span>{t.saveFailed}</span>
          <button type="button" onClick={onRetry}>
            {t.retrySave}
          </button>
        </>
      )}
    </div>
  )
}

// Powiadomienie o wyniku eksportu w pasku pod paskiem narzędzi (nie rozpycha paska narzędzi), z przyciskiem zamknięcia.
// Sukces ogłasza `status`, błąd `alert`.
function ExportNotice({ error = false, onDismiss, children }: { error?: boolean; onDismiss: () => void; children: ReactNode }) {
  const { editor: t } = useDictionary()
  return (
    <div className={error ? 'export-notice export-notice--error' : 'export-notice'} role={error ? 'alert' : 'status'}>
      {children}
      <button type="button" className="export-notice-dismiss" aria-label={t.dismissNotice} onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}

// Pytanie przed eksportem CV z blokami wyższymi niż strona (w PDF zostałyby ucięte). Natywny <dialog> otwarty modalnie
// jak okno „Więcej” Sponsor bara: Escape i kliknięcie w tło działają jak „Anuluj”, na którym jest fokus.
function ExportCutOffDialog({ onExport, onCancel }: { onExport: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const { common, editor: t } = useDictionary()

  useEffect(() => {
    dialog.current?.showModal()
    cancelButton.current?.focus()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="export-dialog"
      aria-labelledby="export-cut-off-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="export-dialog-content">
        <h2 id="export-cut-off-title" className="form-section-title">
          {t.exportCutOff}
        </h2>
        <p className="export-dialog-paragraph">{t.exportCutOffHint}</p>
        <div className="form-row form-row--spread">
          <button type="button" className="button-primary" onClick={onExport}>
            {t.exportAnyway}
          </button>
          <button type="button" ref={cancelButton} onClick={onCancel}>
            {common.cancel}
          </button>
        </div>
      </div>
    </dialog>
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
// nie uruchamia już pozycji menu. Oczekująca zmiana jest zapisywana przy wyjściu z edytora, przeładowaniu okna
// (`beforeunload`) i na prośbę procesu głównego przed zamknięciem okna lub zakończeniem aplikacji.
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
    // Zamknięcie okna i zakończenie aplikacji czekają na ten zapis (także zmiany zakolejkowane za trwającym zapisem).
    const unsubscribeFlush = window.api.editor.onFlushRequest(async () => {
      await editor.flush()
      return editor.store.getState().saveStatus !== 'failed'
    })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onUnload)
      unsubscribe()
      unsubscribeFlush()
      void editor.flush()
    }
  }, [editor])
}

const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? filePath
