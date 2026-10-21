import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CvListEntry } from '../../shared/api'
import type { CvDocument } from './domain/schema'

type OkEntry = Extract<CvListEntry, { status: 'ok' }>
type DamagedEntry = Extract<CvListEntry, { status: 'damaged' }>

// Tryb pojedynczego wiersza: zwykły, zmiana nazwy albo potwierdzenie usunięcia.
type RowMode = { id: string; kind: 'rename' | 'confirm-delete' } | null

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
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => setEntries(await window.api.cv.list()), [])

  useEffect(() => {
    refresh().catch(() => setError('Nie udało się wczytać listy CV.'))
  }, [refresh])

  // Wykonuje operację, odświeża listę i zamyka edycję wiersza; błąd pokazuje jako komunikat.
  const runAndRefresh = async (action: () => Promise<unknown>, failure: string) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      setRowMode(null)
      await refresh()
    } catch {
      setError(failure)
    }
  }

  const open = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      onOpen(await window.api.cv.get(id))
    } catch {
      setError('Nie udało się otworzyć CV.')
      await refresh()
    }
  }

  const importFile = async () => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.importFile()
      if (result.status === 'invalid') setError(`Nie udało się zaimportować CV. ${result.message}`)
      if (result.status !== 'imported') return
      setNotice(`Zaimportowano „${result.document.name}”.`)
      await refresh()
    } catch {
      setError('Nie udało się zaimportować CV.')
    }
  }

  const exportFile = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.exportFile(id)
      if (result.status === 'saved') setNotice(`Zapisano plik: ${baseName(result.filePath)}`)
    } catch {
      setError('Nie udało się wyeksportować CV.')
      await refresh()
    }
  }

  return (
    <>
      <header className="toolbar">
        <h1 className="toolbar-title">Moje CV</h1>
        <button type="button" onClick={onOpenClauses}>
          Klauzule zgody
        </button>
        <button type="button" onClick={importFile}>
          Importuj z pliku
        </button>
        <button type="button" onClick={() => runAndRefresh(() => window.api.cv.create(), 'Nie udało się utworzyć CV.')}>
          Nowe CV
        </button>
      </header>
      <main className="library">
        {error && (
          <p className="library-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="library-notice" role="status">
            {notice}
          </p>
        )}
        {entries?.length === 0 && <p className="library-empty">Nie masz jeszcze żadnego CV. Kliknij „Nowe CV”.</p>}
        <ul className="library-list" aria-label="Lista CV">
          {entries?.map((entry) => {
            const mode = rowMode?.id === entry.id ? rowMode.kind : null
            const askDelete = () => setRowMode({ id: entry.id, kind: 'confirm-delete' })
            return (
              <li key={entry.id} className="library-item">
                {mode === 'confirm-delete' ? (
                  <ConfirmDelete
                    label={
                      entry.status === 'ok'
                        ? `Usunąć „${entry.name}”? Tej operacji nie można cofnąć.`
                        : `Usunąć uszkodzony plik „${entry.id}.json”? Tej operacji nie można cofnąć.`
                    }
                    onDelete={() => runAndRefresh(() => window.api.cv.delete(entry.id), 'Nie udało się usunąć CV.')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : entry.status === 'damaged' ? (
                  <DamagedRow entry={entry} onDelete={askDelete} />
                ) : mode === 'rename' ? (
                  <RenameForm
                    entry={entry}
                    onSubmit={(name) => runAndRefresh(() => window.api.cv.rename(entry.id, name), 'Nie udało się zmienić nazwy.')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : (
                  <>
                    <div className="library-item-info">
                      <span className="library-item-name">{entry.name}</span>
                      <span className="library-item-date">Zmieniono {formatDateTime(entry.updatedAt)}</span>
                    </div>
                    <div className="library-item-actions">
                      <button type="button" onClick={() => open(entry.id)}>
                        Otwórz
                      </button>
                      <button
                        type="button"
                        onClick={() => runAndRefresh(() => window.api.cv.duplicate(entry.id), 'Nie udało się zduplikować CV.')}
                      >
                        Duplikuj
                      </button>
                      <button type="button" onClick={() => exportFile(entry.id)}>
                        Eksportuj do pliku
                      </button>
                      <button type="button" onClick={() => setRowMode({ id: entry.id, kind: 'rename' })}>
                        Zmień nazwę
                      </button>
                      <button type="button" onClick={askDelete}>
                        Usuń
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
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onSubmit(name.trim())
  }

  return (
    <form className="library-item-form" onSubmit={submit}>
      <input
        aria-label="Nazwa CV"
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      />
      <div className="library-item-actions">
        <button type="submit" disabled={!name.trim()}>
          Zapisz
        </button>
        <button type="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </form>
  )
}

function ConfirmDelete({ label, onDelete, onCancel }: { label: string; onDelete: () => void; onCancel: () => void }) {
  return (
    <div className="library-item-form" role="alertdialog" aria-label="Potwierdź usunięcie">
      <span>{label}</span>
      <div className="library-item-actions">
        <button type="button" className="danger" onClick={onDelete}>
          Usuń
        </button>
        <button type="button" onClick={onCancel} autoFocus>
          Anuluj
        </button>
      </div>
    </div>
  )
}

function DamagedRow({ entry, onDelete }: { entry: DamagedEntry; onDelete: () => void }) {
  return (
    <>
      <div className="library-item-info">
        <span className="library-item-name">{entry.id}.json</span>
        <span className="library-item-damaged">Plik uszkodzony – nie można go otworzyć</span>
      </div>
      <div className="library-item-actions">
        <button type="button" onClick={onDelete}>
          Usuń
        </button>
      </div>
    </>
  )
}

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))
const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1)
