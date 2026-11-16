import { useEffect, useRef } from 'react'
import { clauseName, type Clause, type ClauseContent, type CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { applyClause, updateConsent } from '../editor/documentEdits'
import { SaveAsNewClause } from '../editor/fields/ConsentFields'
import { useDictionary } from '../i18n'
import { FIELD_POPOVER_CONTROLS, FieldPopover, focusAfter } from './FieldPopover'
import { pageFieldElement, useActiveFragment, type ActiveFieldStore } from './useActiveField'

// Biblioteka klauzul zgody (jak w CV form): wybór, przywrócenie i zapis tekstu z CV jako nowej klauzuli.
export type ClauseLibrary = { clauses: Clause[]; onSaveClause: (content: ClauseContent) => Promise<Clause> }

const CONSENT_KEY = 'consent:text'
const consentField = () => pageFieldElement(window.document, CONSENT_KEY)

// Pasek klauzuli zgody (docs/specs/wysiwyg-editing.md, W15): Field popover w formie paska narzędzi (`role="toolbar"`)
// nad klauzulą na stronie, dopóki jej tekst (Page field `consent:text`) albo sam pasek ma fokus. „Clause from the
// library” (wybór klauzuli – kopia jej treści w CV), „Restore from library” (gdy tekst różni się od klauzuli
// z biblioteki), „Save as new clause” (pyta tylko o nazwę) i „Hide clause” (klauzula wyłączona, zostaje w CV). Tab
// z tekstu klauzuli wchodzi do paska, Shift+Tab z jego pierwszej kontrolki i Escape wracają do tekstu, Tab z ostatniej –
// dalej za klauzulą. Fokus w pasku nie dezaktywuje pola (`data-field-popover`), więc klauzula zostaje aktywnym
// fragmentem.
export function ConsentToolbar({
  editor,
  document,
  active,
  library,
  onFocusLost
}: {
  editor: CvEditor
  document: CvDocument
  active: ActiveFieldStore
  library: ClauseLibrary
  onFocusLost: () => void
}) {
  const fragment = useActiveFragment(active)
  if (fragment !== 'consent' || !document.consent.enabled) return null
  return <Toolbar editor={editor} consent={document.consent} active={active} library={library} onFocusLost={onFocusLost} />
}

function Toolbar({
  editor,
  consent,
  active,
  library,
  onFocusLost
}: {
  editor: CvEditor
  consent: CvDocument['consent']
  active: ActiveFieldStore
  library: ClauseLibrary
  onFocusLost: () => void
}) {
  const t = useDictionary().editor.consent
  const toolbar = useRef<HTMLDivElement>(null)
  const { clauses, onSaveClause } = library
  const libraryClause = clauses.find((clause) => clause.id === consent.clauseId) ?? null
  const modified = libraryClause !== null && libraryClause.text !== consent.text

  // Tab z tekstu klauzuli – do pierwszej kontrolki paska (pasek stoi „za” klauzulą).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.target !== consentField()) return
      const first = toolbar.current?.querySelector<HTMLElement>(FIELD_POPOVER_CONTROLS)
      if (!first) return
      event.preventDefault()
      first.focus()
    }
    window.document.addEventListener('keydown', onKeyDown, true)
    return () => window.document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const backToText = () => consentField()?.focus({ preventScroll: true })
  // Klik obok paska (nie w klauzulę): klauzula przestaje być aktywna, jeśli fokus nie trafił w inne pole.
  const close = (returnFocus: boolean) => {
    if (returnFocus) backToText()
    else setTimeout(() => active.blurred({ key: CONSENT_KEY, fragment: 'consent' }))
  }
  const tabOut = (backward: boolean) => {
    const text = consentField()
    if (backward) backToText()
    else if (text) focusAfter(text)
  }
  const hide = () => {
    editor.edit(updateConsent({ enabled: false }))
    active.leave()
    onFocusLost()
  }

  return (
    <FieldPopover
      anchor={consentField}
      label={t.title}
      role="toolbar"
      className="field-popover--toolbar"
      above
      focusOnShow={false}
      onClose={close}
      onTabOut={tabOut}
    >
      <div ref={toolbar} className="consent-toolbar">
        <ClauseSelect editor={editor} consent={consent} clauses={clauses} aria-label={t.fromLibrary} />
        {modified && (
          <button
            type="button"
            title={t.modified}
            onClick={() => {
              // Przycisk znika razem z różnicą – kursor wraca do tekstu klauzuli.
              editor.edit(applyClause(libraryClause))
              backToText()
            }}
          >
            {t.restore}
          </button>
        )}
        <SaveAsNewClause
          text={consent.text}
          onSave={async (name) => {
            editor.edit(applyClause(await onSaveClause({ name, text: consent.text })))
            backToText()
          }}
        />
        <button type="button" onClick={hide}>
          {t.hide}
        </button>
      </div>
    </FieldPopover>
  )
}

// Wybór klauzuli z biblioteki (w pasku klauzuli i w panelu klauzuli zgody Inspektora): CV dostaje kopię treści
// wybranej klauzuli – jeden krok cofania. Pusta biblioteka – wybór nieaktywny; klauzula usunięta z biblioteki – napis
// zamiast nazwy. Nazwa z `aria-label` albo z etykiety wokół.
export function ClauseSelect({
  editor,
  consent,
  clauses,
  'aria-label': label
}: {
  editor: CvEditor
  consent: CvDocument['consent']
  clauses: Clause[]
  'aria-label'?: string
}) {
  const dictionary = useDictionary()
  const t = dictionary.editor.consent
  const libraryClause = clauses.find((clause) => clause.id === consent.clauseId) ?? null
  return (
    <select
      aria-label={label}
      value={libraryClause?.id ?? ''}
      disabled={clauses.length === 0}
      onChange={(event) => {
        const clause = clauses.find((candidate) => candidate.id === event.target.value)
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
  )
}
