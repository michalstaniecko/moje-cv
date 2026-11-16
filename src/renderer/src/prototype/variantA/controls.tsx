// PROTOTYP – wariant A „Inspektor”: małe kontrolki panelu (przełącznik, segmenty, grupa, miniatury szablonów,
// próbki koloru, karty fontów). Wszystkie z klasami `pa-` (variantA.css).
import { memo, useId, useMemo, type ReactNode } from 'react'
import { cvFontFamilies, cvFontIds, type CvFontId } from '../../../../shared/cvFonts'
import { templateThumbnailCv } from '../../domain/sampleCv'
import { cvTemplateIds, type CvDocument, type CvTemplateId } from '../../domain/schema'
import { CvPages } from '../../template/CvPages'
import { templates } from '../../template/templates'
import { StubBadge } from '../StubBadge'

// Jeden przełącznik dla wszystkich „pokaż / ukryj” w Inspektorze (zdjęcie, sekcje, klauzula, nowa strona).
export function Switch({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className="pa-switch" title={label}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="pa-switch-track" aria-hidden="true" />
    </label>
  )
}

// Wiersz „etykieta … kontrolka”.
export function Row({ label, stub, children, hint }: { label: ReactNode; stub?: boolean; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="pa-row">
      <div className="pa-row-main">
        <span className="pa-row-label">
          {label}
          {stub && <StubBadge />}
        </span>
        <span className="pa-row-control">{children}</span>
      </div>
      {hint && <p className="pa-hint">{hint}</p>}
    </div>
  )
}

// Zwijana grupa opcji Inspektora (nagłówek z trójkątem, jak w Keynote).
export function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="pa-group" open={defaultOpen}>
      <summary className="pa-group-title">{title}</summary>
      <div className="pa-group-body">{children}</div>
    </details>
  )
}

// Segmenty (wybór jednej z kilku wartości).
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  const name = useId()
  return (
    <div className="pa-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="pa-segment" data-checked={option.value === value || undefined}>
          <input type="radio" name={name} checked={option.value === value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  )
}

const TEMPLATE_NAMES: Record<CvTemplateId, string> = { classic: 'Klasyczny', modern: 'Nowoczesny', bold: 'Wyrazisty' }

// Miniatury szablonów – to samo podejście co editor/TemplatePicker.tsx (Sample CV w kolorze, foncie i języku CV).
export function TemplateGrid({ document, onChange }: { document: CvDocument; onChange: (template: CvTemplateId) => void }) {
  const name = useId()
  const { accentColor, font, language } = document.settings
  const thumbnailDocument = useMemo(() => templateThumbnailCv({ accentColor, font, language }), [accentColor, font, language])
  return (
    <div className="pa-templates" role="radiogroup" aria-label="Szablon">
      {cvTemplateIds.map((id) => (
        <label key={id} className="pa-template" data-checked={document.settings.template === id || undefined}>
          <input type="radio" name={name} checked={document.settings.template === id} onChange={() => onChange(id)} />
          <Thumbnail document={thumbnailDocument} template={id} />
          <span className="pa-template-name">{TEMPLATE_NAMES[id]}</span>
        </label>
      ))}
    </div>
  )
}

const Thumbnail = memo(function Thumbnail({ document, template }: { document: CvDocument; template: CvTemplateId }) {
  return (
    <div className="pa-thumbnail" aria-hidden>
      <CvPages document={document} template={templates[template]} firstPageOnly />
    </div>
  )
})

export const ACCENT_PRESETS = [
  { value: '#1a6e72', name: 'Morski (domyślny)' },
  { value: '#1f5fa8', name: 'Niebieski' },
  { value: '#2f3e4e', name: 'Grafitowy' },
  { value: '#5b3a9a', name: 'Fioletowy' },
  { value: '#a3243b', name: 'Bordowy' },
  { value: '#b8571a', name: 'Miedziany' },
  { value: '#2e6b34', name: 'Leśny' },
  { value: '#111111', name: 'Czarny' }
] as const

// Próbki koloru akcentu + własny kolor (natywny próbnik w ostatnim kółku).
export function Swatches({
  value,
  onPreset,
  onCustom
}: {
  value: string
  onPreset: (color: string) => void
  onCustom: (color: string) => void
}) {
  const current = value.toLowerCase()
  const isPreset = ACCENT_PRESETS.some((preset) => preset.value === current)
  return (
    <div className="pa-swatches" role="radiogroup" aria-label="Kolor akcentu">
      {ACCENT_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          role="radio"
          aria-checked={preset.value === current}
          className="pa-swatch"
          title={preset.name}
          aria-label={preset.name}
          style={{ background: preset.value }}
          onClick={() => onPreset(preset.value)}
        />
      ))}
      <label
        className="pa-swatch pa-swatch--custom"
        title="Własny kolor"
        data-checked={!isPreset || undefined}
        style={!isPreset ? { background: value } : undefined}
      >
        <input type="color" aria-label="Własny kolor" value={value} onChange={(event) => onCustom(event.target.value)} />
      </label>
    </div>
  )
}

// Karty fontów – każda napisana swoim krojem.
export function FontCards({ value, onChange }: { value: CvFontId; onChange: (font: CvFontId) => void }) {
  const name = useId()
  return (
    <div className="pa-fonts" role="radiogroup" aria-label="Font">
      {cvFontIds.map((id) => (
        <label key={id} className="pa-font" data-checked={id === value || undefined} style={{ fontFamily: `'${cvFontFamilies[id]}', system-ui` }}>
          <input type="radio" name={name} checked={id === value} onChange={() => onChange(id)} />
          <span className="pa-font-sample" aria-hidden="true">Aa</span>
          <span className="pa-font-name">{cvFontFamilies[id]}</span>
        </label>
      ))}
    </div>
  )
}
