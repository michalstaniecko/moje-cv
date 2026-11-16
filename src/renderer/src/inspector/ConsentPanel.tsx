import { updateConsent } from '../editor/documentEdits'
import { useDictionary } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'

// Panel klauzuli zgody Inspektora – zaślepka (#139): na razie tylko „Pokaż na CV”. „Edytuj na stronie”, wybór klauzuli
// z biblioteki i „Zapisz jako nową klauzulę” dodaje #141.
export function ConsentPanel({ editor, document }: PanelProps) {
  const t = useDictionary().editor.inspector
  return (
    <InspectorSwitch
      label={t.showOnCv}
      part="consent"
      checked={document.consent.enabled}
      onChange={(shown) => editor.edit(updateConsent({ enabled: shown }))}
    />
  )
}
