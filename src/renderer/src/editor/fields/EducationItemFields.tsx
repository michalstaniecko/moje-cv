import { useId, type ReactNode } from 'react'
import { isEndBeforeStart } from '../../domain/dates'
import type { EducationItem } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { removeEducationItem, updateEducationItem } from '../documentEdits'
import { MonthField } from '../MonthField'
import { useRemove } from '../removalUndo'
import { Checkbox } from './Checkbox'
import { DateOrderWarning } from './DateOrderWarning'
import { educationName } from './entryNames'

// Wykształcenie: poziom, kierunek, uczelnia, daty, nowa strona przed wpisem i „Usuń wykształcenie” (tekstowym
// przyciskiem). W CV form – grupa z legendą i uchwytem wiersza (`handle`). Te same klucze łączenia kroków cofania co
// Page fields wpisu na stronie.
export function EducationItemFields({
  editor,
  sectionId,
  item,
  handle
}: {
  editor: CvEditor
  sectionId: string
  item: EducationItem
  handle: ReactNode
}) {
  const t = useDictionary().editor
  const remove = useRemove()
  const warningId = useId()
  const reversedDates = isEndBeforeStart(item.start, item.end)
  const patchItem = (patch: Partial<Omit<EducationItem, 'id'>>, field?: string) =>
    editor.edit(updateEducationItem(sectionId, item.id, patch), field ? `education:${item.id}:${field}` : undefined)
  const textField = (label: string, field: 'level' | 'field' | 'institution', placeholder: string) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        placeholder={placeholder}
        value={item[field]}
        onChange={(event) => patchItem({ [field]: event.target.value }, field)}
      />
    </label>
  )

  const fields = (
    <>
      {textField(t.level, 'level', t.levelPlaceholder)}
      {textField(t.field, 'field', t.fieldPlaceholder)}
      {textField(t.institution, 'institution', t.institutionPlaceholder)}
      <div className="form-row">
        <MonthField
          label={t.startOptional}
          value={item.start}
          onChange={(start) => patchItem({ start }, 'start')}
        />
        <MonthField
          label={t.graduation}
          value={item.end}
          describedBy={reversedDates ? warningId : undefined}
          onChange={(end) => patchItem({ end }, 'end')}
        />
      </div>
      {reversedDates && <DateOrderWarning id={warningId} />}
      <div className="form-row form-row--spread">
        <Checkbox
          label={t.pageBreakBeforeEntry}
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button
          type="button"
          className="danger"
          onClick={() => remove(removeEducationItem(sectionId, item.id), { entryId: item.id, listId: sectionId })}
        >
          {t.removeEducation}
        </button>
      </div>
    </>
  )

  return (
    <fieldset className="form-group" data-entry-id={item.id}>
      <legend>
        {handle}
        {educationName(item, t)}
      </legend>
      {fields}
    </fieldset>
  )
}
