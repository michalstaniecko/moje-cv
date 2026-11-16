// PROTOTYP – wariant B: pasek formatowania (drugi rząd pod paskiem narzędzi) – WSZYSTKIE opcje globalne CV w jednym
// poziomym pasku, od lewej: wygląd (szablon, kolor, font, układ) | zawartość (zdjęcie, sekcje, klauzula) | język CV,
// a po prawej ⋯ z ustawieniami aplikacji. Każda opcja jest o jeden klik i od razu zmienia strony (editor.edit = krok
// cofania). Pasek jest w Edit mode i w Preview mode.
import { useState } from 'react'
import { cvFontFamilies, cvFontIds } from '../../../../shared/cvFonts'
import { interfaceLanguages } from '../../../../shared/i18n/languages'
import { clauseName, cvLanguageCodes, type Clause, type ClauseContent, type CvDocument } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { applyClause, setPhotoHidden, updateConsent, updateHeader, updateSettings } from '../../editor/documentEdits'
import { usePhotoPicker } from '../../editor/fields/PhotoField'
import { fontStack } from '../../template/fonts'
import { StubBadge } from '../StubBadge'
import { useStubOptions } from '../stubOptions'
import { PbHeading, PbPopover, PbSegmented, PbSwitch } from './PbPopover'
import { SectionsMenu } from './SectionsMenu'
import { Chevron, TemplateMenu } from './TemplateMenu'

const ACCENT_PRESETS = [
  { color: '#1f4e79', name: 'Granatowy' },
  { color: '#1f6fcf', name: 'Niebieski' },
  { color: '#0f766e', name: 'Morski' },
  { color: '#2f7d32', name: 'Zielony' },
  { color: '#9b2335', name: 'Bordowy' },
  { color: '#3f4752', name: 'Grafitowy' }
]

export function FormatBar({
  editor,
  document,
  clauses,
  saveClause,
  exportJson
}: {
  editor: CvEditor
  document: CvDocument
  clauses: Clause[]
  saveClause: (content: ClauseContent) => Promise<Clause | null>
  exportJson: () => void
}) {
  // Wybór i kadrowanie zdjęcia żyją poza popoverem: popover zamyka się przed otwarciem okna kadrowania.
  const photoPicker = usePhotoPicker(editor)
  return (
    <div className="pb-format-bar" role="toolbar" aria-label="Opcje CV">
      <div className="pb-bar-scroll">
        <div className="pb-group" aria-label="Wygląd">
          <TemplateMenu editor={editor} document={document} />
          <AccentSwatches editor={editor} document={document} />
          <FontMenu editor={editor} document={document} />
          <LayoutMenu />
        </div>
        <Separator />
        <div className="pb-group" aria-label="Zawartość">
          <PhotoChip editor={editor} document={document} picker={photoPicker} />
          <SectionsMenu editor={editor} document={document} onAddPhoto={() => void photoPicker.pick()} />
          <ConsentChip editor={editor} document={document} clauses={clauses} saveClause={saveClause} />
        </div>
        <Separator />
        <div className="pb-group" aria-label="Język">
          <LanguageMenu editor={editor} document={document} />
        </div>
      </div>
      <div className="pb-bar-end">
        <AppMenu exportJson={exportJson} />
      </div>
      {photoPicker.error && (
        <span className="pb-bar-error" role="alert">
          Nie udało się wczytać zdjęcia
        </span>
      )}
      {photoPicker.cropper}
    </div>
  )
}

function Separator() {
  return <span className="pb-separator" aria-hidden="true" />
}

// ---------- Kolor akcentu: kropki presetów + „+” (własny kolor, natywny próbnik) ----------
function AccentSwatches({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const current = document.settings.accentColor.toLowerCase()
  const isPreset = ACCENT_PRESETS.some((preset) => preset.color === current)
  const set = (accentColor: string) => editor.edit(updateSettings({ accentColor }), 'settings:accentColor')
  return (
    <div className="pb-swatches" role="radiogroup" aria-label="Kolor akcentu">
      {ACCENT_PRESETS.map((preset, index) => (
        <button
          key={preset.color}
          type="button"
          role="radio"
          aria-checked={current === preset.color}
          aria-label={preset.name}
          title={preset.name}
          className="pb-swatch"
          data-index={index}
          style={{ ['--pb-swatch' as string]: preset.color }}
          onClick={() => set(preset.color)}
        />
      ))}
      <label
        className="pb-swatch pb-swatch-custom"
        data-active={!isPreset || undefined}
        title="Własny kolor"
        style={!isPreset ? { ['--pb-swatch' as string]: current } : undefined}
      >
        <input type="color" aria-label="Własny kolor akcentu" value={current} onChange={(event) => set(event.target.value)} />
        {isPreset && <span aria-hidden="true">+</span>}
      </label>
    </div>
  )
}

// ---------- Font: nazwy we własnym kroju + rozmiar (atrapa) ----------
function FontMenu({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const { font } = document.settings
  const fontSize = useStubOptions((state) => state.fontSize)
  const setStub = useStubOptions((state) => state.set)
  return (
    <PbPopover
      width={260}
      title="Font CV"
      trigger={
        <>
          <span className="pb-trigger-text" style={{ fontFamily: fontStack(font) }}>
            {cvFontFamilies[font]}
          </span>
          <Chevron />
        </>
      }
    >
      {(close) => (
        <>
          <PbHeading>Font</PbHeading>
          <div role="radiogroup" aria-label="Font" className="pb-list">
            {cvFontIds.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={font === id}
                className="pb-list-item pb-font-item"
                style={{ fontFamily: fontStack(id) }}
                onClick={() => {
                  editor.edit(updateSettings({ font: id }))
                  close()
                }}
              >
                {cvFontFamilies[id]}
                <span className="pb-font-sample">Zażółć gęślą jaźń</span>
              </button>
            ))}
          </div>
          <PbHeading>
            Rozmiar tekstu <StubBadge />
          </PbHeading>
          <div className="pb-stepper">
            <button
              type="button"
              className="pb-icon-button"
              aria-label="Mniejszy tekst"
              disabled={fontSize === 'small'}
              onClick={() => setStub({ fontSize: fontSize === 'large' ? 'normal' : 'small' })}
            >
              A−
            </button>
            <span className="pb-stepper-value">{{ small: 'Mały', normal: 'Normalny', large: 'Duży' }[fontSize]}</span>
            <button
              type="button"
              className="pb-icon-button"
              aria-label="Większy tekst"
              disabled={fontSize === 'large'}
              onClick={() => setStub({ fontSize: fontSize === 'small' ? 'normal' : 'large' })}
            >
              A+
            </button>
          </div>
        </>
      )}
    </PbPopover>
  )
}

// ---------- Układ: same atrapy (gęstość, format daty, rozmiar strony) ----------
function LayoutMenu() {
  const stub = useStubOptions()
  return (
    <PbPopover
      width={300}
      title="Układ strony"
      trigger={
        <>
          <span className="pb-trigger-text">Układ</span>
          <Chevron />
        </>
      }
    >
      {() => (
        <>
          <PbHeading>
            Gęstość <StubBadge />
          </PbHeading>
          <PbSegmented
            label="Gęstość"
            value={stub.density}
            onChange={(density) => stub.set({ density })}
            options={[
              { value: 'compact', label: 'Zwarta' },
              { value: 'normal', label: 'Normalna' },
              { value: 'airy', label: 'Luźna' }
            ]}
          />
          <PbHeading>
            Format dat <StubBadge />
          </PbHeading>
          <PbSegmented
            label="Format dat"
            value={stub.dateFormat}
            onChange={(dateFormat) => stub.set({ dateFormat })}
            options={[
              { value: 'MM.YYYY', label: '03.2024' },
              { value: 'MMM YYYY', label: 'mar 2024' },
              { value: 'YYYY', label: '2024' }
            ]}
          />
          <PbHeading>
            Rozmiar strony <StubBadge />
          </PbHeading>
          <PbSegmented
            label="Rozmiar strony"
            value={stub.pageSize}
            onChange={(pageSize) => stub.set({ pageSize })}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'Letter', label: 'Letter' }
            ]}
          />
        </>
      )}
    </PbPopover>
  )
}

// ---------- Zdjęcie: chip = przełącznik „na CV” + menu (zmień, kadruj, usuń, kształt) ----------
function PhotoChip({
  editor,
  document,
  picker
}: {
  editor: CvEditor
  document: CvDocument
  picker: ReturnType<typeof usePhotoPicker>
}) {
  const { photo } = document.header
  const photoShape = useStubOptions((state) => state.photoShape)
  const setStub = useStubOptions((state) => state.set)
  if (!photo) {
    return (
      <button type="button" className="pb-trigger pb-chip-add" onClick={() => void picker.pick()} title="Dodaj zdjęcie">
        <span aria-hidden="true">+</span>
        <span className="pb-trigger-text">Zdjęcie</span>
      </button>
    )
  }
  return (
    <span className="pb-chip" data-off={photo.hidden || undefined}>
      <PbSwitch checked={!photo.hidden} label="Pokaż zdjęcie na CV" onChange={(checked) => editor.edit(setPhotoHidden(!checked))} />
      <PbPopover
        width={260}
        triggerClassName="pb-trigger pb-chip-trigger"
        title="Zdjęcie"
        trigger={
          <>
            <img className="pb-photo-thumb" src={photo.dataUrl} alt="" />
            <span className="pb-trigger-text">Zdjęcie</span>
            <Chevron />
          </>
        }
      >
        {(close) => (
          <>
            <div className="pb-list">
              <button
                type="button"
                className="pb-list-item"
                onClick={() => {
                  close()
                  void picker.pick()
                }}
              >
                Zmień zdjęcie…
              </button>
              <button
                type="button"
                className="pb-list-item"
                onClick={() => {
                  close()
                  void picker.crop(photo.dataUrl)
                }}
              >
                Kadruj…
              </button>
              <button
                type="button"
                className="pb-list-item"
                onClick={() => {
                  editor.edit(setPhotoHidden(!photo.hidden))
                }}
              >
                {photo.hidden ? 'Pokaż na CV' : 'Ukryj (zachowaj w CV)'}
              </button>
              <button
                type="button"
                className="pb-list-item pb-danger"
                onClick={() => {
                  close()
                  editor.edit(updateHeader({ photo: null }))
                }}
              >
                Usuń zdjęcie
              </button>
            </div>
            <PbHeading>
              Kształt <StubBadge />
            </PbHeading>
            <PbSegmented
              label="Kształt zdjęcia"
              value={photoShape}
              onChange={(value) => setStub({ photoShape: value })}
              options={[
                { value: 'template', label: 'Szablon' },
                { value: 'rectangle', label: '▭' },
                { value: 'rounded', label: '▢' },
                { value: 'circle', label: '◯' }
              ]}
            />
          </>
        )}
      </PbPopover>
    </span>
  )
}

// ---------- Klauzula zgody: chip = przełącznik + wybór klauzuli z biblioteki ----------
function ConsentChip({
  editor,
  document,
  clauses,
  saveClause
}: {
  editor: CvEditor
  document: CvDocument
  clauses: Clause[]
  saveClause: (content: ClauseContent) => Promise<Clause | null>
}) {
  const { consent } = document
  const [saving, setSaving] = useState(false)
  const saveCurrent = async () => {
    setSaving(true)
    try {
      const saved = await saveClause({ name: `Klauzula z CV „${document.name}”`, text: consent.text })
      if (saved) editor.edit(applyClause(saved))
    } finally {
      setSaving(false)
    }
  }
  return (
    <span className="pb-chip" data-off={!consent.enabled || undefined}>
      <PbSwitch
        checked={consent.enabled}
        label="Pokaż klauzulę zgody na CV"
        onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
      />
      <PbPopover
        width={340}
        triggerClassName="pb-trigger pb-chip-trigger"
        title="Klauzula zgody"
        trigger={
          <>
            <span className="pb-trigger-text">Klauzula</span>
            <Chevron />
          </>
        }
      >
        {() => (
          <>
            <label className="pb-switch-row">
              <span>Klauzula zgody na CV</span>
              <PbSwitch
                checked={consent.enabled}
                label="Pokaż klauzulę zgody na CV"
                onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
              />
            </label>
            <PbHeading>Z biblioteki</PbHeading>
            {clauses.length === 0 ? (
              <p className="pb-hint">Biblioteka klauzul jest pusta.</p>
            ) : (
              <div role="radiogroup" aria-label="Klauzula z biblioteki" className="pb-list pb-list-scroll">
                {clauses.map((clause) => (
                  <button
                    key={clause.id}
                    type="button"
                    role="radio"
                    aria-checked={consent.clauseId === clause.id && consent.text === clause.text}
                    className="pb-list-item pb-clause"
                    // Wybór klauzuli przy wyłączonej zgodzie od razu ją włącza – jeden krok cofania.
                    onClick={() => editor.edit((current) => updateConsent({ enabled: true })(applyClause(clause)(current)))}
                  >
                    <span className="pb-clause-name">{clauseName(clause, 'Bez nazwy')}</span>
                    <span className="pb-clause-text">{clause.text}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="pb-actions">
              <button type="button" disabled={saving || !consent.text.trim()} onClick={() => void saveCurrent()}>
                Zapisz bieżącą w bibliotece
              </button>
            </div>
            <p className="pb-hint">Tekst klauzuli edytujesz bezpośrednio na stronie.</p>
          </>
        )}
      </PbPopover>
    </span>
  )
}

// ---------- Język CV ----------
function LanguageMenu({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const { language } = document.settings
  return (
    <PbPopover
      width={240}
      title="Język CV (stałe napisy na dokumencie)"
      trigger={
        <>
          <span className="pb-trigger-label">Język CV</span>
          <span className="pb-trigger-text pb-lang-code">{language.toUpperCase()}</span>
          <Chevron />
        </>
      }
    >
      {(close) => (
        <>
          <PbHeading>Język CV</PbHeading>
          <p className="pb-hint pb-hint-top">Zmienia stałe napisy na CV (np. „Doświadczenie”), nie Twoją treść.</p>
          <div role="radiogroup" aria-label="Język CV" className="pb-list pb-list-scroll">
            {cvLanguageCodes.map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={language === code}
                className="pb-list-item"
                onClick={() => {
                  editor.edit(updateSettings({ language: code }))
                  close()
                }}
              >
                {interfaceLanguages[code].name}
                <span className="pb-list-meta">{code.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </PbPopover>
  )
}

// ---------- ⋯ Ustawienia aplikacji (nie tego CV) – atrapy ----------
function AppMenu({ exportJson }: { exportJson: () => void }) {
  const [interfaceLanguage, setInterfaceLanguage] = useState('pl')
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>('system')
  return (
    <PbPopover
      width={300}
      align="end"
      title="Ustawienia aplikacji"
      triggerClassName="pb-trigger pb-more"
      trigger={<span aria-label="Więcej">⋯</span>}
    >
      {() => (
        <>
          <div className="pb-popover-caption">Ustawienia aplikacji – dotyczą wszystkich CV</div>
          <PbHeading>
            Język interfejsu <StubBadge />
          </PbHeading>
          <select
            className="pb-select"
            value={interfaceLanguage}
            onChange={(event) => setInterfaceLanguage(event.target.value)}
            aria-label="Język interfejsu"
          >
            {Object.entries(interfaceLanguages).map(([code, { name }]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <PbHeading>
            Wygląd <StubBadge />
          </PbHeading>
          <PbSegmented
            label="Wygląd"
            value={appearance}
            onChange={setAppearance}
            options={[
              { value: 'system', label: 'Systemowy' },
              { value: 'light', label: 'Jasny' },
              { value: 'dark', label: 'Ciemny' }
            ]}
          />
          <div className="pb-list pb-list-divided">
            <button type="button" className="pb-list-item" disabled>
              Biblioteka klauzul… <StubBadge />
            </button>
            <button type="button" className="pb-list-item" onClick={exportJson}>
              Eksportuj CV jako JSON
            </button>
          </div>
        </>
      )}
    </PbPopover>
  )
}
