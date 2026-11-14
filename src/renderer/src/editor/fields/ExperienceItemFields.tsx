import { useId, useRef, type ReactNode } from 'react'
import { isEndBeforeStart } from '../../domain/dates'
import type { ExperienceItem } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import {
  addBullet,
  moveBullet,
  removeBullet,
  removeExperienceItem,
  splitBullet,
  updateBullet,
  updateExperienceItem
} from '../documentEdits'
import { handleListFieldKeyDown } from '../listFieldKeys'
import { MonthField } from '../MonthField'
import { useRemove } from '../removalUndo'
import { SortableList } from '../SortableList'
import { Checkbox } from './Checkbox'
import { DateOrderWarning } from './DateOrderWarning'
import { entryName } from './entryNames'

// Stanowisko: nazwa, firma, miejscowość, daty z „Obecnie tu pracuję”, punkty (kolejność, Enter dzieli, Backspace łączy),
// nowa strona przed wpisem i „Usuń stanowisko” (tekstowym przyciskiem, nie z menu wiersza).
// W CV form – grupa z legendą i uchwytem wiersza (`handle`). Te same klucze łączenia kroków cofania co Page fields
// wpisu na stronie.
export function ExperienceItemFields({
  editor,
  sectionId,
  item,
  handle
}: {
  editor: CvEditor
  sectionId: string
  item: ExperienceItem
  handle: ReactNode
}) {
  const t = useDictionary().editor
  const remove = useRemove()
  const warningId = useId()
  const reversedDates = isEndBeforeStart(item.start, item.end)
  const mergeKey = (field: string) => `experience:${item.id}:${field}`
  const patchItem = (patch: Partial<ExperienceItem>, field?: string) =>
    editor.edit(
      updateExperienceItem(sectionId, item.id, (current) => ({ ...current, ...patch })),
      field ? mergeKey(field) : undefined
    )
  const textField = (label: string, field: 'role' | 'company' | 'location') => (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={item[field]}
        onChange={(event) => patchItem({ [field]: event.target.value }, field)}
      />
    </label>
  )
  // Data końca sprzed zaznaczenia „obecnie” – wraca po odznaczeniu.
  const endBeforePresent = useRef<ExperienceItem['end']>(null)
  const togglePresent = (present: boolean) => {
    if (present) endBeforePresent.current = item.end
    editor.edit(
      updateExperienceItem(sectionId, item.id, (current) => ({
        ...current,
        end: present ? 'present' : endBeforePresent.current
      }))
    )
  }

  const fields = (
    <>
      {textField(t.role, 'role')}
      <div className="form-row">
        {textField(t.company, 'company')}
        {textField(t.location, 'location')}
      </div>
      <div className="form-row">
        <MonthField label={t.from} value={item.start} onChange={(start) => patchItem({ start }, 'start')} />
        <MonthField
          label={t.to}
          value={item.end === 'present' ? null : item.end}
          disabled={item.end === 'present'}
          describedBy={reversedDates ? warningId : undefined}
          onChange={(end) => patchItem({ end }, 'end')}
        />
        <Checkbox label={t.currentlyWorkHere} checked={item.end === 'present'} onChange={togglePresent} />
      </div>
      {reversedDates && <DateOrderWarning id={warningId} />}

      <div className="form-bullets">
        <span>{t.bullets}</span>
        <SortableList
          items={item.bullets}
          label={(_bullet, index) => t.order.bullet(index + 1)}
          handleLabel={(_bullet, index) => t.order.handle.bullet(index + 1)}
          onMove={(bulletId, toIndex) => editor.edit(moveBullet(sectionId, item.id, bulletId, toIndex))}
          onRemove={(bullet) =>
            remove(removeBullet(sectionId, item.id, bullet.id), { entryId: bullet.id, listId: `bullets:${item.id}` })
          }
        >
          {(bullet, row, index) => (
            <div className="form-row" data-entry-id={bullet.id}>
              {row.handle}
              <textarea
                rows={2}
                aria-label={t.bullet(index + 1)}
                value={bullet.text}
                onChange={(event) =>
                  editor.edit(
                    updateBullet(sectionId, item.id, bullet.id, event.target.value),
                    mergeKey(`bullet:${bullet.id}`)
                  )
                }
                onKeyDown={(event) =>
                  handleListFieldKeyDown(event, {
                    multiline: true,
                    previousId: item.bullets[index - 1]?.id,
                    split: (at) => editor.edit(splitBullet(sectionId, item.id, bullet.id, at)),
                    remove: () => editor.edit(removeBullet(sectionId, item.id, bullet.id)),
                    moveBy: row.moveBy
                  })
                }
              />
            </div>
          )}
        </SortableList>
        <button type="button" data-add-for={`bullets:${item.id}`} onClick={() => editor.edit(addBullet(sectionId, item.id))}>
          {t.addBullet}
        </button>
      </div>

      <div className="form-row form-row--spread">
        <Checkbox
          label={t.pageBreakBeforeEntry}
          checked={item.pageBreakBefore}
          onChange={(pageBreakBefore) => patchItem({ pageBreakBefore })}
        />
        <button
          type="button"
          className="danger"
          onClick={() => remove(removeExperienceItem(sectionId, item.id), { entryId: item.id, listId: sectionId })}
        >
          {t.removePosition}
        </button>
      </div>
    </>
  )

  return (
    <fieldset className="form-group" data-entry-id={item.id}>
      <legend>
        {handle}
        {entryName(item.role, t.newPosition)}
      </legend>
      {fields}
    </fieldset>
  )
}
