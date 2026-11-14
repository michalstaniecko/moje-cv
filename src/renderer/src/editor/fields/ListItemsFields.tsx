import type { TextItem } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { CvEditor } from '../cvEditor'
import { addListItem, moveItem, removeListItem, splitListItem, updateListItem } from '../documentEdits'
import { handleListFieldKeyDown } from '../listFieldKeys'
import { useRemove } from '../removalUndo'
import { SortableList } from '../SortableList'

// Elementy sekcji listowej (umiejętności, języki): kolejność, usuwanie z menu wiersza, Enter dzieli, Backspace łączy,
// „Dodaj element” – w CV form i w Edit card sekcji (`data-edit-focus` = id elementu). Te same klucze łączenia kroków
// cofania w obu miejscach.
export function ListItemsFields({ editor, sectionId, items }: { editor: CvEditor; sectionId: string; items: TextItem[] }) {
  const t = useDictionary().editor
  const remove = useRemove()
  return (
    <div className="form-bullets">
      <SortableList
        items={items}
        label={(_item, index) => t.order.listItem(index + 1)}
        handleLabel={(_item, index) => t.order.handle.listItem(index + 1)}
        onMove={(id, toIndex) => editor.edit(moveItem(sectionId, id, toIndex))}
        onRemove={(item) => remove(removeListItem(sectionId, item.id), { entryId: item.id, listId: sectionId })}
      >
        {(item, row, index) => (
          <div className="form-row" data-entry-id={item.id}>
            {row.handle}
            <input
              aria-label={t.listItem(index + 1)}
              data-edit-focus={item.id}
              value={item.text}
              onChange={(event) =>
                editor.edit(updateListItem(sectionId, item.id, event.target.value), `list:${item.id}:text`)
              }
              onKeyDown={(event) =>
                handleListFieldKeyDown(event, {
                  multiline: false,
                  previousId: items[index - 1]?.id,
                  split: (at) => editor.edit(splitListItem(sectionId, item.id, at)),
                  remove: () => editor.edit(removeListItem(sectionId, item.id)),
                  moveBy: row.moveBy
                })
              }
            />
          </div>
        )}
      </SortableList>
      <button type="button" data-add-for={sectionId} onClick={() => editor.edit(addListItem(sectionId))}>
        {t.addListItem}
      </button>
    </div>
  )
}
