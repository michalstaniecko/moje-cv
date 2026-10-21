import { useEffect, useState, type FormEvent } from 'react'
import { clauseName, type AppSettings, type ClauseContent } from './domain/schema'

// Tryb ekranu: lista, edycja klauzuli (nowej albo istniejącej) albo potwierdzenie usunięcia.
type Mode = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'confirm-delete'; id: string } | null

// Biblioteka klauzul zgody: dodawanie, edycja, usuwanie i wybór klauzuli domyślnej dla nowych CV.
export function ClauseLibrary({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings, () => setError('Nie udało się wczytać biblioteki klauzul.'))
  }, [])

  // Wykonuje operację, pokazuje nowy stan biblioteki i zamyka formularz; błąd pokazuje jako komunikat.
  const runAndShow = async (action: () => Promise<AppSettings>, failure: string) => {
    setError(null)
    try {
      setSettings(await action())
      setMode(null)
    } catch {
      setError(failure)
    }
  }

  const add = (content: ClauseContent) =>
    runAndShow(async () => {
      await window.api.settings.addClause(content)
      return window.api.settings.get()
    }, 'Nie udało się dodać klauzuli.')

  return (
    <>
      <header className="toolbar">
        <button type="button" onClick={onBack}>
          ← Moje CV
        </button>
        <h1 className="toolbar-title">Klauzule zgody</h1>
        <button type="button" onClick={() => setMode({ kind: 'add' })} disabled={settings === null}>
          Dodaj klauzulę
        </button>
      </header>
      <main className="library">
        {error && (
          <p className="library-error" role="alert">
            {error}
          </p>
        )}
        <p className="library-hint">
          Klauzula domyślna trafia do każdego nowego CV. Zmiany w bibliotece nie zmieniają klauzul w istniejących CV.
        </p>
        {mode?.kind === 'add' && (
          <ClauseForm clause={{ name: '', text: '' }} onSubmit={add} onCancel={() => setMode(null)} />
        )}
        {settings?.clauses.length === 0 && mode?.kind !== 'add' && (
          <p className="library-empty">Biblioteka jest pusta. Kliknij „Dodaj klauzulę”.</p>
        )}
        <ul className="library-list" aria-label="Lista klauzul">
          {settings?.clauses.map((clause) => {
            const isDefault = clause.id === settings.defaultClauseId
            const rowMode = mode && 'id' in mode && mode.id === clause.id ? mode.kind : null
            return (
              <li key={clause.id} className="library-item">
                {rowMode === 'edit' ? (
                  <ClauseForm
                    clause={clause}
                    onSubmit={(content) =>
                      runAndShow(() => window.api.settings.updateClause(clause.id, content), 'Nie udało się zapisać klauzuli.')
                    }
                    onCancel={() => setMode(null)}
                  />
                ) : rowMode === 'confirm-delete' ? (
                  <div className="library-item-form" role="alertdialog" aria-label="Potwierdź usunięcie">
                    <span>Usunąć klauzulę „{clauseName(clause)}”? CV, które jej używają, zachowają swoją kopię treści.</span>
                    <div className="library-item-actions">
                      <button
                        type="button"
                        className="danger"
                        onClick={() => runAndShow(() => window.api.settings.deleteClause(clause.id), 'Nie udało się usunąć klauzuli.')}
                      >
                        Usuń
                      </button>
                      <button type="button" onClick={() => setMode(null)} autoFocus>
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="clause-item">
                    <div className="library-item-info">
                      <span className="library-item-name">
                        {clauseName(clause)}
                        {isDefault && <span className="clause-default"> (domyślna)</span>}
                      </span>
                      <span className="clause-text">{clause.text}</span>
                    </div>
                    <div className="library-item-actions">
                      <button type="button" onClick={() => setMode({ kind: 'edit', id: clause.id })}>
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAndShow(
                            () => window.api.settings.setDefaultClause(isDefault ? null : clause.id),
                            'Nie udało się zmienić klauzuli domyślnej.'
                          )
                        }
                      >
                        {isDefault ? 'Usuń oznaczenie domyślnej' : 'Ustaw jako domyślną'}
                      </button>
                      <button type="button" onClick={() => setMode({ kind: 'confirm-delete', id: clause.id })}>
                        Usuń
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </>
  )
}

// Formularz nazwy i treści klauzuli – wspólny dla nowej i edytowanej. Nazwa jest wymagana, żeby dało się ją wybrać w CV.
function ClauseForm({
  clause,
  onSubmit,
  onCancel
}: {
  clause: ClauseContent
  onSubmit: (content: ClauseContent) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(clause.name)
  const [text, setText] = useState(clause.text)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onSubmit({ name: name.trim(), text })
  }

  return (
    <form className="form clause-form" onSubmit={submit} aria-label="Klauzula">
      <label className="form-field">
        <span>Nazwa</span>
        <input value={name} autoFocus placeholder="np. Talent Partners" onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="form-field">
        <span>Treść</span>
        <textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
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
