import { ClauseSelect } from '../canvas/ConsentToolbar'
import { applyClause, updateConsent } from '../editor/documentEdits'
import { SaveAsNewClause } from '../editor/fields/ConsentFields'
import { useDictionary } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'
import { focusOnPage } from './openOnPage'

// Panel klauzuli zgody Inspektora (#141) – te same akcje co pasek klauzuli na stronie (canvas/ConsentToolbar.tsx), bez
// edycji tekstu (ten jest na stronie):
// - „Show consent clause on CV” – klauzula włączona albo wyłączona (wyłączona zostaje w CV);
// - „Edit on the page” – kursor w tekście klauzuli na stronie; wyłączonej klauzuli nie ma na stronach, więc nieaktywny;
// - wybór klauzuli z biblioteki (kopia jej treści w CV) – jeden krok cofania;
// - „Save as new clause” – bieżący tekst jako nowa klauzula w bibliotece, od razu wybrana w CV.
export function ConsentPanel({ editor, document, session, library }: PanelProps) {
  const t = useDictionary().editor
  const { consent } = document
  const { clauses, onSaveClause } = library
  return (
    <>
      <div className="inspector-field">
        <InspectorSwitch
          label={t.inspector.elements.showConsent}
          part="consent"
          checked={consent.enabled}
          onChange={(shown) => editor.edit(updateConsent({ enabled: shown }))}
        />
        <button
          type="button"
          className="inspector-action"
          disabled={!consent.enabled}
          onClick={() => focusOnPage(session, { kind: 'consent' })}
        >
          {t.inspector.consent.editOnPage}
          <span aria-hidden="true"> ›</span>
        </button>
      </div>
      <label className="inspector-field">
        <span className="inspector-label">{t.consent.fromLibrary}</span>
        <ClauseSelect editor={editor} consent={consent} clauses={clauses} />
      </label>
      <div className="inspector-field inspector-save-clause">
        <SaveAsNewClause
          text={consent.text}
          onSave={async (name) => editor.edit(applyClause(await onSaveClause({ name, text: consent.text })))}
        />
      </div>
    </>
  )
}
