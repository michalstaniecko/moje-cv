import type { CvDocument } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { updateHeader } from '../documentEdits'

// Imię i nazwisko – w CV form i w Edit card (te same klucze łączenia kroków cofania).
export function FullNameField({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const t = useDictionary().editor
  return (
    <label className="form-field">
      <span>{t.fullName}</span>
      <input
        value={header.fullName}
        onChange={(event) => editor.edit(updateHeader({ fullName: event.target.value }), 'header:fullName')}
      />
    </label>
  )
}
