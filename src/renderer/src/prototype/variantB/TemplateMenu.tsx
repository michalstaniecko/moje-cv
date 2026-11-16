// PROTOTYP – wariant B: [Szablon ▾] – duże miniatury pierwszej strony BIEŻĄCEGO CV w każdym szablonie (nie Sample CV,
// jak w TemplatePicker), więc widać od razu, jak własna treść wygląda w innym układzie. Renderuje się tylko przy
// otwartym popoverze (PbPopover).
import { memo } from 'react'
import { cvTemplateIds, type CvDocument, type CvTemplateId } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { updateSettings } from '../../editor/documentEdits'
import { CvPages } from '../../template/CvPages'
import { templates } from '../../template/templates'
import { PbHeading, PbPopover } from './PbPopover'

export const templateNamesPl: Record<CvTemplateId, string> = {
  classic: 'Klasyczny',
  modern: 'Nowoczesny',
  bold: 'Wyrazisty'
}

export function TemplateMenu({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const current = document.settings.template
  return (
    <PbPopover
      width={720}
      title="Szablon CV"
      trigger={
        <>
          <span className="pb-template-glyph" aria-hidden="true" />
          <span className="pb-trigger-text">{templateNamesPl[current]}</span>
          <Chevron />
        </>
      }
    >
      {() => (
        <>
          <PbHeading>Szablon – podgląd Twojego CV</PbHeading>
          <div className="pb-templates" role="radiogroup" aria-label="Szablon">
            {cvTemplateIds.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={current === id}
                className="pb-template"
                onClick={() => editor.edit(updateSettings({ template: id }))}
              >
                <Thumbnail document={document} template={id} />
                <span className="pb-template-name">{templateNamesPl[id]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </PbPopover>
  )
}

const Thumbnail = memo(function Thumbnail({ document, template }: { document: CvDocument; template: CvTemplateId }) {
  return (
    <div className="pb-thumb" aria-hidden="true" inert>
      <CvPages document={document} template={templates[template]} firstPageOnly />
    </div>
  )
})

export function Chevron() {
  return (
    <svg className="pb-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
