import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import type { Clause, ClauseContent, CvDocument, Section } from '../domain/schema'
import { useDictionary } from '../i18n'
import type { CvEditor } from './cvEditor'
import {
  addEducationItem,
  addExperienceItem,
  moveItem,
  moveSection,
  updateSection
} from './documentEdits'
import { Checkbox } from './fields/Checkbox'
import { ConsentFields } from './fields/ConsentFields'
import { ContactsFields } from './fields/ContactsFields'
import { CvDesignFields } from './fields/CvDesignFields'
import { EducationItemFields } from './fields/EducationItemFields'
import { educationName, entryName } from './fields/entryNames'
import { ExperienceItemFields } from './fields/ExperienceItemFields'
import { FullNameField } from './fields/FullNameField'
import { ListItemsFields } from './fields/ListItemsFields'
import { PhotoField } from './fields/PhotoField'
import { SectionTitleField, sectionName } from './fields/SectionTitleField'
import { SummaryField } from './fields/SummaryField'
import { RemoveProvider, type RemoveWithUndo } from './removalUndo'
import { SortableList } from './SortableList'

// Formularz edycji CV: nagłówek, sekcje w kolejności z CV i klauzula zgody. Każda zmiana trafia do edytora (historia + autozapis).
// `clauses` – biblioteka klauzul; `onSaveClause` dodaje do niej nową klauzulę; `onRemove` wykonuje usunięcia z formularza
// (z komunikatem „Usunięto. Cofnij”).
export function CvForm({
  editor,
  clauses,
  onSaveClause,
  onRemove
}: {
  editor: CvEditor
  clauses: Clause[]
  onSaveClause: (content: ClauseContent) => Promise<Clause>
  onRemove: RemoveWithUndo
}) {
  const document = useStore(editor.store, (state) => state.document)
  const t = useDictionary().editor

  return (
    <RemoveProvider value={onRemove}>
      <div className="form">
        <CvDesignFields editor={editor} document={document} />
        <HeaderFields editor={editor} header={document.header} />
        <SortableList
          items={document.sections}
          label={(section) => t.order.section(sectionName(section, t))}
          handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
          onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
        >
          {(section, row) => <SectionFields editor={editor} section={section} handle={row.handle} />}
        </SortableList>
        <ConsentFields editor={editor} consent={document.consent} clauses={clauses} onSaveClause={onSaveClause} />
      </div>
    </RemoveProvider>
  )
}

function HeaderFields({ editor, header }: { editor: CvEditor; header: CvDocument['header'] }) {
  const t = useDictionary().editor

  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.header}</h2>
      <FullNameField editor={editor} header={header} />
      <PhotoField editor={editor} photo={header.photo} />
      <ContactsFields editor={editor} contacts={header.contacts} />
      <SummaryField editor={editor} header={header} />
    </section>
  )
}

// Sekcja w formularzu: tytuł, kolejność, ukrycie i nowa strona, a pod nimi wpisy zależne od typu sekcji.
// Ukryta sekcja zostaje w formularzu, ale znika z podglądu i PDF.
function SectionFields({ editor, section, handle }: { editor: CvEditor; section: Section; handle: ReactNode }) {
  const t = useDictionary().editor
  const name = sectionName(section, t)

  return (
    <section className={section.hidden ? 'form-section form-section--hidden' : 'form-section'} aria-label={name}>
      <div className="form-section-header">
        {handle}
        <SectionTitleField editor={editor} section={section} />
      </div>
      <div className="form-row">
        <Checkbox
          label={t.hideSection}
          checked={section.hidden}
          onChange={(hidden) => editor.edit(updateSection(section.id, { hidden }))}
        />
        <Checkbox
          label={t.pageBreakBeforeSection}
          checked={section.pageBreakBefore}
          onChange={(pageBreakBefore) => editor.edit(updateSection(section.id, { pageBreakBefore }))}
        />
      </div>
      <SectionItems editor={editor} section={section} />
    </section>
  )
}

function SectionItems({ editor, section }: { editor: CvEditor; section: Section }) {
  const onMove = (id: string, toIndex: number) => editor.edit(moveItem(section.id, id, toIndex))
  const t = useDictionary().editor

  switch (section.type) {
    case 'experience':
      return (
        <>
          <SortableList
            items={section.items}
            label={(item) => t.order.position(entryName(item.role, t.newPosition))}
            handleLabel={(item) => t.order.handle.position(entryName(item.role, t.newPosition))}
            onMove={onMove}
          >
            {(item, row) => (
              <ExperienceItemFields editor={editor} sectionId={section.id} item={item} handle={row.handle} />
            )}
          </SortableList>
          <button type="button" data-add-for={section.id} onClick={() => editor.edit(addExperienceItem(section.id))}>
            {t.addPosition}
          </button>
        </>
      )
    case 'education':
      return (
        <>
          <SortableList
            items={section.items}
            label={(item) => t.order.education(educationName(item, t))}
            handleLabel={(item) => t.order.handle.education(educationName(item, t))}
            onMove={onMove}
          >
            {(item, row) => (
              <EducationItemFields editor={editor} sectionId={section.id} item={item} handle={row.handle} />
            )}
          </SortableList>
          <button type="button" data-add-for={section.id} onClick={() => editor.edit(addEducationItem(section.id))}>
            {t.addEducation}
          </button>
        </>
      )
    case 'list':
      return <ListItemsFields editor={editor} sectionId={section.id} items={section.items} />
  }
}
