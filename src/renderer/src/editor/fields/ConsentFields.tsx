import { useState, type FormEvent } from 'react'
import { clauseName, type Clause, type ClauseContent, type CvDocument } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { applyClause, updateConsent } from '../documentEdits'
import { Checkbox } from './Checkbox'

// Klauzula zgody tego CV: włączenie, wybór z biblioteki i edycja lokalnej kopii treści.
// Edycja w CV nie zmienia biblioteki; poprawioną treść można zapisać jako nową klauzulę albo przywrócić wersję z biblioteki.
// W CV form – sekcja z nagłówkiem; w Edit card (`inCard`) – same pola, bo nazwą jest nazwa karty.
export function ConsentFields({
  editor,
  consent,
  clauses,
  onSaveClause,
  inCard = false
}: {
  editor: CvEditor
  consent: CvDocument['consent']
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
  inCard?: boolean
}) {
  const dictionary = useDictionary()
  const t = dictionary.editor.consent
  const libraryClause = clauses.find((clause) => clause.id === consent.clauseId) ?? null
  const modified = libraryClause !== null && libraryClause.text !== consent.text

  const fields = (
    <>
      <Checkbox
        label={t.show}
        checked={consent.enabled}
        onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
      />
      {consent.enabled && (
        <>
          <label className="form-field">
            <span>{t.fromLibrary}</span>
            <select
              value={libraryClause?.id ?? ''}
              onChange={(event) => {
                const clause = clauses.find((clause) => clause.id === event.target.value)
                if (clause) editor.edit(applyClause(clause))
              }}
            >
              <option value="" disabled>
                {consent.clauseId !== null ? t.deleted : clauses.length ? t.choose : t.emptyLibrary}
              </option>
              {clauses.map((clause) => (
                <option key={clause.id} value={clause.id}>
                  {clauseName(clause, dictionary.clauses.untitled)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t.text}</span>
            <textarea
              rows={5}
              data-edit-focus="text"
              value={consent.text}
              onChange={(event) => editor.edit(updateConsent({ text: event.target.value }), 'consent:text')}
            />
          </label>
          <div className="consent-actions">
            {modified && (
              <>
                <span className="consent-modified">{t.modified}</span>
                <button type="button" onClick={() => editor.edit(applyClause(libraryClause))}>
                  {t.restore}
                </button>
              </>
            )}
            <SaveAsNewClause
              text={consent.text}
              onSave={async (name) => editor.edit(applyClause(await onSaveClause({ name, text: consent.text })))}
            />
          </div>
        </>
      )}
    </>
  )

  if (inCard) return fields
  return (
    <section className="form-section" aria-label={t.title}>
      <h2 className="form-section-title">{t.title}</h2>
      {fields}
    </section>
  )
}

// „Zapisz jako nową klauzulę”: pyta o nazwę w miejscu przycisku, żeby nie przerywać edycji CV oknem dialogowym.
// Escape w polu nazwy anuluje tylko nazwę (nie zamyka Edit card, w której stoi pole).
function SaveAsNewClause({ text, onSave }: { text: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { common, editor } = useDictionary()
  const t = editor.consent
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name?.trim()) return
    try {
      await onSave(name.trim())
      setName(null)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  if (name === null) {
    return (
      <button type="button" disabled={!text.trim()} onClick={() => setName('')}>
        {t.saveAsNew}
      </button>
    )
  }
  return (
    <form className="form-row" onSubmit={submit}>
      <input
        aria-label={t.newName}
        placeholder={t.newNamePlaceholder}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          setName(null)
        }}
      />
      <button type="submit" className="button-primary" disabled={!name.trim()}>
        {common.save}
      </button>
      <button type="button" onClick={() => setName(null)}>
        {common.cancel}
      </button>
      {failed && (
        <span className="toolbar-status--error" role="alert">
          {t.saveFailed}
        </span>
      )}
    </form>
  )
}
