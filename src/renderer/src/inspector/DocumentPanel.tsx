import { useId } from 'react'
import { cvFontIds, cvFontFamilies } from '../../../shared/cvFonts'
import { interfaceLanguages } from '../../../shared/i18n/languages'
import { cvLanguageCodes, type CvDocument, type CvLanguage } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { updateSettings } from '../editor/documentEdits'
import { TemplatePicker } from '../editor/TemplatePicker'
import { useDictionary } from '../i18n'
import { fontStack } from '../template/fonts'
import { InspectorGroup } from './InspectorGroup'

// Gotowe kolory akcentu: stonowane barwy dobrze czytelne na bieli; pierwszy to domyślny akcent CV (domain/schema.ts).
export const accentPresets = [
  ['teal', '#1a6e72'],
  ['blue', '#1f5fa8'],
  ['graphite', '#2f3e4e'],
  ['violet', '#5b3a9a'],
  ['crimson', '#a3243b'],
  ['orange', '#b8571a'],
  ['green', '#2e6b34'],
  ['black', '#111111']
] as const

// Klucz łączenia kroków cofania własnego koloru – ten sam co w CV form: przeciąganie w wyborze koloru to jeden krok.
const ACCENT_MERGE_KEY = 'settings:accentColor'

// Panel „Dokument” Inspektora (bez zaznaczenia): CV design w zwijanych grupach Szablon, Styl i Język. Każda zmiana idzie
// przez edytor – od razu na stronach, w autozapisie i jako jeden krok cofania. Działa w Edit mode i w Preview mode.
export function DocumentPanel({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor
  const { settings } = document
  const change = (patch: Parameters<typeof updateSettings>[0], mergeKey?: string) => editor.edit(updateSettings(patch), mergeKey)

  return (
    <>
      <InspectorGroup id="template" title={t.inspector.groups.template} safeFocus>
        <TemplatePicker document={document} onChange={(template) => change({ template })} />
      </InspectorGroup>
      <InspectorGroup id="style" title={t.inspector.groups.style}>
        <AccentColor value={settings.accentColor} onChange={change} />
        <FontCards value={settings.font} onChange={(font) => change({ font })} />
      </InspectorGroup>
      <InspectorGroup id="language" title={t.inspector.groups.language}>
        <CvLanguageField value={settings.language} onChange={(language) => change({ language })} />
      </InspectorGroup>
    </>
  )
}

// Kolor akcentu: radio z gotowymi próbkami (klik albo strzałki – zwykły krok cofania) i własny kolor obok nich.
// Kolor spoza próbek nie zaznacza żadnej próbki; pole własnego koloru zawsze pokazuje bieżący kolor.
function AccentColor({
  value,
  onChange
}: {
  value: string
  onChange: (patch: { accentColor: string }, mergeKey?: string) => void
}) {
  const t = useDictionary().editor
  const name = useId()
  const label = useId()
  const current = value.toLowerCase()
  const custom = !accentPresets.some(([, color]) => color === current)

  return (
    <div className="inspector-field">
      <span id={label} className="inspector-label">
        {t.accentColor}
      </span>
      <div className="inspector-swatches">
        <div role="radiogroup" aria-labelledby={label} className="inspector-swatch-list">
          {accentPresets.map(([id, color]) => (
            <input
              key={id}
              type="radio"
              className="inspector-swatch"
              name={name}
              value={color}
              checked={current === color}
              aria-label={t.inspector.colors[id]}
              title={t.inspector.colors[id]}
              style={{ backgroundColor: color }}
              onChange={() => onChange({ accentColor: color })}
            />
          ))}
        </div>
        <input
          type="color"
          className="inspector-custom-color"
          data-checked={custom || undefined}
          value={current}
          aria-label={t.inspector.customColor}
          title={t.inspector.customColor}
          onChange={(event) => onChange({ accentColor: event.target.value }, ACCENT_MERGE_KEY)}
        />
      </div>
    </div>
  )
}

// Font jako karty pisane własnym krojem (próbka „Aa” i nazwa); zwykłe radio – wybór działa z klawiatury.
function FontCards({ value, onChange }: { value: CvDocument['settings']['font']; onChange: (font: CvDocument['settings']['font']) => void }) {
  const t = useDictionary().editor
  const name = useId()
  const label = useId()
  return (
    <div className="inspector-field">
      <span id={label} className="inspector-label">
        {t.font}
      </span>
      <div role="radiogroup" aria-labelledby={label} className="inspector-font-cards">
        {cvFontIds.map((font) => (
          <label key={font} className="inspector-font-card" style={{ fontFamily: fontStack(font) }}>
            <input type="radio" name={name} value={font} checked={value === font} onChange={() => onChange(font)} />
            <span className="inspector-font-sample" aria-hidden>
              Aa
            </span>
            <span className="inspector-font-name">{cvFontFamilies[font]}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// CV language z notką, że zmienia tylko stały tekst na dokumencie, a nie treść CV (GLOSSARY.md).
function CvLanguageField({ value, onChange }: { value: CvLanguage; onChange: (language: CvLanguage) => void }) {
  const t = useDictionary().editor
  const note = useId()
  return (
    <div className="inspector-field">
      <label className="inspector-field">
        <span className="inspector-label">{t.cvLanguage}</span>
        <select value={value} aria-describedby={note} onChange={(event) => onChange(event.target.value as CvLanguage)}>
          {cvLanguageCodes.map((language) => (
            <option key={language} value={language}>
              {interfaceLanguages[language].name}
            </option>
          ))}
        </select>
      </label>
      <p id={note} className="inspector-hint">
        {t.inspector.languageNote}
      </p>
    </div>
  )
}
