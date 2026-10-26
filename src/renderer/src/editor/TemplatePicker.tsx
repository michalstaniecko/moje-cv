import { memo, useDeferredValue, useId } from 'react'
import type { CvDocument, CvTemplateId } from '../domain/schema'
import { useDictionary } from '../i18n'
import { CvPages } from '../template/CvPages'
import { templateIds, templates } from '../template/templates'

// Wybór templatu CV: każda opcja to żywa miniatura pierwszej strony bieżącego CV w danym templacie
// (z kolorem i fontem CV) podpisana nazwą templatu. Opcje to zwykłe radio – wybór działa z klawiatury.
// Radio jest nazwane samą nazwą templatu (aria-labelledby), a nie całą etykietą razem z tekstem miniatury.
export function TemplatePicker({
  document,
  onChange
}: {
  document: CvDocument
  onChange: (template: CvTemplateId) => void
}) {
  const t = useDictionary().editor
  const name = useId()
  // Miniatury renderują się z odroczoną wersją CV: pisanie w polach i główny podgląd mają pierwszeństwo,
  // a miniatury doganiają je, gdy React ma wolną chwilę (render miniatur można przerwać kolejną zmianą).
  const thumbnailDocument = useDeferredValue(document)

  return (
    <div role="radiogroup" aria-label={t.template} className="template-picker">
      {templateIds.map((id) => (
        <label key={id} className="template-option">
          <input
            type="radio"
            name={name}
            value={id}
            checked={document.settings.template === id}
            onChange={() => onChange(id)}
            aria-labelledby={`${name}-${id}`}
          />
          <TemplateThumbnail document={thumbnailDocument} template={id} />
          <span id={`${name}-${id}`} className="template-option-name">{t.templateNames[id]}</span>
        </label>
      ))}
    </div>
  )
}

// Pomniejszona pierwsza strona CV w danym templacie. `memo` – miniatura renderuje się tylko, gdy zmieni się
// (odroczony) dokument, a nie przy każdym renderze formularza.
const TemplateThumbnail = memo(function TemplateThumbnail({
  document,
  template
}: {
  document: CvDocument
  template: CvTemplateId
}) {
  return (
    <div className="template-thumbnail" aria-hidden>
      <CvPages document={document} template={templates[template]} firstPageOnly />
    </div>
  )
})
