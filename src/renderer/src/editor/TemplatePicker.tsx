import { memo, useId, useMemo } from 'react'
import { templateThumbnailCv } from '../domain/sampleCv'
import { cvTemplateIds, type CvDocument, type CvTemplateId } from '../domain/schema'
import { useDictionary } from '../i18n'
import { CvPages } from '../template/CvPages'
import { templates } from '../template/templates'

// Wybór szablonu CV: każda opcja to Template thumbnail – pierwsza strona Sample CV w CV language bieżącego CV,
// w danym szablonie, z kolorem i fontem CV – podpisana nazwą szablonu. Treść bieżącego CV nie trafia do miniatur,
// więc przy pustym CV też widać różnice między szablonami. Opcje to zwykłe radio – wybór działa z klawiatury.
// Radio jest nazwane samą nazwą szablonu (aria-labelledby), a nie całą etykietą razem z tekstem miniatury.
export function TemplatePicker({
  document,
  onChange
}: {
  document: CvDocument
  onChange: (template: CvTemplateId) => void
}) {
  const t = useDictionary().editor
  const name = useId()
  // Dokument miniatur zależy tylko od koloru, fontu i CV language – pisanie w polach go nie zmienia,
  // więc zapamiętane miniatury renderują się ponownie tylko przy zmianie CV design.
  const { accentColor, font, language } = document.settings
  const thumbnailDocument = useMemo(
    () => templateThumbnailCv({ accentColor, font, language }),
    [accentColor, font, language]
  )

  return (
    <div role="radiogroup" aria-label={t.template} className="template-picker">
      {cvTemplateIds.map((id) => (
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

// Pomniejszona pierwsza strona dokumentu miniatury w danym szablonie. `memo` – miniatura renderuje się tylko,
// gdy zmieni się dokument miniatury, a nie przy każdym renderze formularza.
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
