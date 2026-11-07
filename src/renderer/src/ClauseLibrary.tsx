import { useEffect, useState, type FormEvent } from 'react'
import type { Dictionary } from '../../shared/i18n/en'
import { clauseName, type AppSettings, type ClauseContent } from './domain/schema'
import { useDictionary } from './i18n'

// Tryb ekranu: lista, edycja klauzuli (nowej albo istniejącej) albo potwierdzenie usunięcia.
type Mode = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'confirm-delete'; id: string } | null

type Failure = keyof Dictionary['clauses']['errors']

// Przycisk, na który wraca fokus po zamknięciu formularza: „Dodaj klauzulę” albo „Edytuj” danej klauzuli.
// Szukany po `data-action` (i `data-clause-id`) dopiero po odświeżeniu listy, bo zmiana nazwy przesuwa klauzulę.
type FocusTarget = { action: 'add' } | { action: 'edit'; id: string }

// Biblioteka klauzul zgody: dodawanie, edycja, usuwanie i wybór klauzuli domyślnej dla nowych CV.
export function ClauseLibrary({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  // Błąd jako klucz, żeby zmiana języka tłumaczyła także widoczny już komunikat.
  const [error, setError] = useState<Failure | null>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const { common, clauses: t } = useDictionary()

  useEffect(() => {
    window.api.settings.get().then(setSettings, () => setError('load'))
  }, [])

  useEffect(() => {
    if (!focusTarget) return
    const selector =
      focusTarget.action === 'add'
        ? '[data-action="add-clause"]'
        : `[data-clause-id="${CSS.escape(focusTarget.id)}"][data-action="edit"]`
    document.querySelector<HTMLElement>(selector)?.focus()
    setFocusTarget(null)
  }, [focusTarget, settings, mode])

  // Zamyka formularz (Anuluj, Escape, zapis) i oddaje fokus przyciskowi, który go otworzył.
  const closeForm = () => {
    if (mode?.kind === 'add') setFocusTarget({ action: 'add' })
    else if (mode?.kind === 'edit') setFocusTarget({ action: 'edit', id: mode.id })
    setMode(null)
  }

  // Wykonuje operację, pokazuje nowy stan biblioteki i zamyka formularz; błąd pokazuje jako komunikat.
  const runAndShow = async (action: () => Promise<AppSettings>, failure: Failure) => {
    setError(null)
    try {
      setSettings(await action())
      closeForm()
    } catch {
      setError(failure)
    }
  }

  const add = (content: ClauseContent) =>
    runAndShow(async () => {
      await window.api.settings.addClause(content)
      return window.api.settings.get()
    }, 'add')

  return (
    <>
      <header className="toolbar">
        <button type="button" onClick={onBack}>
          {common.back}
        </button>
        <h1 className="toolbar-title">{t.title}</h1>
        <button type="button" data-action="add-clause" onClick={() => setMode({ kind: 'add' })} disabled={settings === null}>
          {t.add}
        </button>
      </header>
      <main className="library">
        {error && (
          <p className="library-error" role="alert">
            {t.errors[error]}
          </p>
        )}
        <p className="library-hint">{t.hint}</p>
        {mode?.kind === 'add' && (
          <ClauseForm clause={{ name: '', text: '' }} onSubmit={add} onCancel={closeForm} />
        )}
        {settings?.clauses.length === 0 && mode?.kind !== 'add' && (
          <p className="library-empty">{t.empty}</p>
        )}
        <ul className="library-list" aria-label={t.list}>
          {settings?.clauses.map((clause) => {
            const isDefault = clause.id === settings.defaultClauseId
            const rowMode = mode && 'id' in mode && mode.id === clause.id ? mode.kind : null
            const name = clauseName(clause, t.untitled)
            return (
              <li key={clause.id} className="library-item">
                {rowMode === 'edit' ? (
                  <ClauseForm
                    clause={clause}
                    onSubmit={(content) =>
                      runAndShow(() => window.api.settings.updateClause(clause.id, content), 'save')
                    }
                    onCancel={closeForm}
                  />
                ) : rowMode === 'confirm-delete' ? (
                  <div className="library-item-form" role="alertdialog" aria-label={common.confirmDelete}>
                    <span>{t.confirmDelete(name)}</span>
                    <div className="library-item-actions">
                      <button
                        type="button"
                        className="danger"
                        onClick={() => runAndShow(() => window.api.settings.deleteClause(clause.id), 'delete')}
                      >
                        {common.delete}
                      </button>
                      <button type="button" onClick={() => setMode(null)} autoFocus>
                        {common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="clause-item">
                    <div className="library-item-info">
                      <span className="library-item-name">
                        {name}
                        {isDefault && <span className="clause-default"> {t.isDefault}</span>}
                      </span>
                      <span className="clause-text">{clause.text}</span>
                    </div>
                    <div className="library-item-actions">
                      <button
                        type="button"
                        data-clause-id={clause.id}
                        data-action="edit"
                        onClick={() => setMode({ kind: 'edit', id: clause.id })}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAndShow(() => window.api.settings.setDefaultClause(isDefault ? null : clause.id), 'setDefault')
                        }
                      >
                        {isDefault ? t.unsetDefault : t.setDefault}
                      </button>
                      <button type="button" onClick={() => setMode({ kind: 'confirm-delete', id: clause.id })}>
                        {common.delete}
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
// Escape w dowolnym polu działa jak „Anuluj”, tak jak w formularzach inline biblioteki CV.
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
  const { common, clauses: t } = useDictionary()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onSubmit({ name: name.trim(), text })
  }

  return (
    <form
      className="form clause-form"
      onSubmit={submit}
      aria-label={t.form}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        onCancel()
      }}
    >
      <label className="form-field">
        <span>{t.name}</span>
        <input value={name} autoFocus placeholder={t.namePlaceholder} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="form-field">
        <span>{t.text}</span>
        <textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="library-item-actions">
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          {common.save}
        </button>
        <button type="button" onClick={onCancel}>
          {common.cancel}
        </button>
      </div>
    </form>
  )
}
