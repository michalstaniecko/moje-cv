import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CvListEntry } from '../../shared/api'
import type { Dictionary } from '../../shared/i18n/en'
import type { InterfaceLanguage } from '../../shared/i18n/languages'
import { cvDisplayName, type CvDocument } from './domain/schema'
import { useDictionary, useInterfaceLanguage } from './i18n'

type OkEntry = Extract<CvListEntry, { status: 'ok' }>
type DamagedEntry = Extract<CvListEntry, { status: 'damaged' }>

// Tryb pojedynczego wiersza: zwykły, zmiana nazwy albo potwierdzenie usunięcia.
type RowMode = { id: string; kind: 'rename' | 'confirm-delete' } | null

// Komunikat tłumaczony przy wyświetlaniu, więc zmiana języka obejmuje także widoczny już komunikat.
type Message = (dictionary: Dictionary) => string
type Failure = keyof Dictionary['library']['errors']
const failureMessage =
  (failure: Failure): Message =>
  ({ library }) =>
    library.errors[failure]

// Ekran startowy: lista CV z akcjami Nowe / Importuj / Otwórz / Duplikuj / Eksportuj / Zmień nazwę / Usuń i wejście do biblioteki klauzul.
export function Library({
  onOpen,
  onOpenClauses
}: {
  onOpen: (document: CvDocument) => void
  onOpenClauses: () => void
}) {
  const [entries, setEntries] = useState<CvListEntry[] | null>(null)
  const [rowMode, setRowMode] = useState<RowMode>(null)
  const [error, setError] = useState<Message | null>(null)
  const [notice, setNotice] = useState<Message | null>(null)
  const showError = (message: Message) => setError(() => message)
  const showNotice = (message: Message) => setNotice(() => message)
  const dictionary = useDictionary()
  const { appName, common, library: t } = dictionary
  const language = useInterfaceLanguage()

  const refresh = useCallback(async () => setEntries(await window.api.cv.list()), [])

  useEffect(() => {
    refresh().catch(() => showError(failureMessage('load')))
  }, [refresh])

  // Wykonuje operację, odświeża listę i zamyka edycję wiersza; błąd pokazuje jako komunikat.
  const runAndRefresh = async (action: () => Promise<unknown>, failure: Failure) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      setRowMode(null)
      await refresh()
    } catch {
      showError(failureMessage(failure))
    }
  }

  const open = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      onOpen(await window.api.cv.get(id))
    } catch {
      showError(failureMessage('open'))
      await refresh()
    }
  }

  const importFile = async () => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.importFile()
      if (result.status === 'invalid') {
        const { reason } = result
        showError(({ library }) => `${library.errors.import} ${library.importErrors[reason]}`)
      }
      if (result.status !== 'imported') return
      const { name } = result.document
      showNotice(({ library }) => library.imported(cvDisplayName(name, library.untitled)))
      await refresh()
    } catch {
      showError(failureMessage('import'))
    }
  }

  const exportFile = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.exportFile(id)
      if (result.status === 'saved') {
        const fileName = baseName(result.filePath)
        showNotice(({ library }) => library.savedFile(fileName))
      }
    } catch {
      showError(failureMessage('export'))
      await refresh()
    }
  }

  return (
    <>
      <header className="toolbar">
        <h1 className="toolbar-title">{appName}</h1>
        <button type="button" onClick={onOpenClauses}>
          {t.clauses}
        </button>
        <button type="button" onClick={importFile}>
          {t.importFile}
        </button>
        <button type="button" onClick={() => runAndRefresh(() => window.api.cv.create(), 'create')}>
          {t.newCv}
        </button>
      </header>
      <main className="library">
        {error && (
          <p className="library-error" role="alert">
            {error(dictionary)}
          </p>
        )}
        {notice && (
          <p className="library-notice" role="status">
            {notice(dictionary)}
          </p>
        )}
        {entries?.length === 0 && <p className="library-empty">{t.empty}</p>}
        <ul className="library-list" aria-label={t.list}>
          {entries?.map((entry) => {
            const mode = rowMode?.id === entry.id ? rowMode.kind : null
            const askDelete = () => setRowMode({ id: entry.id, kind: 'confirm-delete' })
            return (
              <li key={entry.id} className="library-item">
                {mode === 'confirm-delete' ? (
                  <ConfirmDelete
                    label={
                      entry.status === 'ok' ? t.confirmDelete(cvDisplayName(entry.name, t.untitled)) : t.confirmDeleteDamaged(`${entry.id}.json`)
                    }
                    onDelete={() => runAndRefresh(() => window.api.cv.delete(entry.id), 'delete')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : entry.status === 'damaged' ? (
                  <DamagedRow entry={entry} onDelete={askDelete} />
                ) : mode === 'rename' ? (
                  <RenameForm
                    entry={entry}
                    onSubmit={(name) => runAndRefresh(() => window.api.cv.rename(entry.id, name), 'rename')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : (
                  <>
                    <div className="library-item-info">
                      <span className="library-item-name">{cvDisplayName(entry.name, t.untitled)}</span>
                      <span className="library-item-date">{t.modified(formatDateTime(entry.updatedAt, language))}</span>
                    </div>
                    <div className="library-item-actions">
                      <button type="button" onClick={() => open(entry.id)}>
                        {t.open}
                      </button>
                      <button type="button" onClick={() => runAndRefresh(() => window.api.cv.duplicate(entry.id), 'duplicate')}>
                        {t.duplicate}
                      </button>
                      <button type="button" onClick={() => exportFile(entry.id)}>
                        {t.exportFile}
                      </button>
                      <button type="button" onClick={() => setRowMode({ id: entry.id, kind: 'rename' })}>
                        {t.rename}
                      </button>
                      <button type="button" onClick={askDelete}>
                        {common.delete}
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </>
  )
}

function RenameForm({ entry, onSubmit, onCancel }: { entry: OkEntry; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(entry.name)
  const { common, library } = useDictionary()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onSubmit(name.trim())
  }

  return (
    <form className="library-item-form" onSubmit={submit}>
      <input
        aria-label={library.name}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      />
      <div className="library-item-actions">
        <button type="submit" disabled={!name.trim()}>
          {common.save}
        </button>
        <button type="button" onClick={onCancel}>
          {common.cancel}
        </button>
      </div>
    </form>
  )
}

function ConfirmDelete({ label, onDelete, onCancel }: { label: string; onDelete: () => void; onCancel: () => void }) {
  const { common } = useDictionary()
  return (
    <div className="library-item-form" role="alertdialog" aria-label={common.confirmDelete}>
      <span>{label}</span>
      <div className="library-item-actions">
        <button type="button" className="danger" onClick={onDelete}>
          {common.delete}
        </button>
        <button type="button" onClick={onCancel} autoFocus>
          {common.cancel}
        </button>
      </div>
    </div>
  )
}

function DamagedRow({ entry, onDelete }: { entry: DamagedEntry; onDelete: () => void }) {
  const { common, library } = useDictionary()
  return (
    <>
      <div className="library-item-info">
        <span className="library-item-name">{entry.id}.json</span>
        <span className="library-item-damaged">{library.damaged}</span>
      </div>
      <div className="library-item-actions">
        <button type="button" onClick={onDelete}>
          {common.delete}
        </button>
      </div>
    </>
  )
}

const formatDateTime = (iso: string, language: InterfaceLanguage) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? filePath
