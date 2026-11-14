import type { CvDocument } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { updateHeader } from '../documentEdits'

// Podsumowanie pod nagłówkiem w CV form (ten sam klucz łączenia kroków cofania co Page field na stronie).
export function SummaryField({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const t = useDictionary().editor
  return (
    <label className="form-field">
      <span>{t.summary}</span>
      <textarea
        rows={4}
        value={header.summary}
        onChange={(event) => editor.edit(updateHeader({ summary: event.target.value }), 'header:summary')}
      />
    </label>
  )
}
