// PROTOTYP – wariant C: kolumna etapu „Projekt”. Duże, wizualne karty: Szablon, Kolory, Typografia, Elementy CV,
// Zdjęcie, Układ i format, Język CV. Opcje prawdziwe idą przez `editor.edit` (strony zmieniają się na żywo, Cofnij
// działa); opcje bez pola w schemacie CV (stubOptions.ts) są oznaczone <StubBadge />.
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cvFontFamilies, cvFontIds, type CvFontId } from '../../../../shared/cvFonts'
import { interfaceLanguages } from '../../../../shared/i18n/languages'
import { cvLanguageCodes, cvTemplateIds, type CvDocument, type CvLanguage, type CvTemplateId, type Section } from '../../domain/schema'
import { applyClause, moveSection, setPhotoHidden, updateConsent, updateHeader, updateSection, updateSettings } from '../../editor/documentEdits'
import { usePhotoPicker } from '../../editor/fields/PhotoField'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { SortableList } from '../../editor/SortableList'
import { useDictionary } from '../../i18n'
import { CvPages } from '../../template/CvPages'
import { fontStack } from '../../template/fonts'
import { templates } from '../../template/templates'
import type { PrototypeShellProps } from '../shell'
import { StubBadge } from '../StubBadge'
import { useStubOptions, type StubOptions } from '../stubOptions'

const PAGE_WIDTH_PX = (210 / 25.4) * 96

const TEMPLATE_NAMES: Record<CvTemplateId, { name: string; note: string }> = {
  classic: { name: 'Klasyczny', note: 'Spokojny, jedna kolumna' },
  modern: { name: 'Nowoczesny', note: 'Boczna kolumna z kontaktem' },
  bold: { name: 'Wyrazisty', note: 'Mocny nagłówek w kolorze' }
}

const PALETTES: { name: string; colors: { hex: string; name: string }[] }[] = [
  {
    name: 'Stonowane',
    colors: [
      { hex: '#1a6e72', name: 'Morski' },
      { hex: '#1f3a5f', name: 'Granat' },
      { hex: '#44546a', name: 'Łupek' },
      { hex: '#2f2f2f', name: 'Grafit' },
      { hex: '#4a5d3a', name: 'Oliwka' },
      { hex: '#6b4f3a', name: 'Orzech' }
    ]
  },
  {
    name: 'Wyraziste',
    colors: [
      { hex: '#0b57d0', name: 'Kobalt' },
      { hex: '#b3261e', name: 'Karmin' },
      { hex: '#c25e00', name: 'Miedź' },
      { hex: '#2e7d32', name: 'Szmaragd' },
      { hex: '#6a1b9a', name: 'Śliwka' },
      { hex: '#ad1457', name: 'Malina' }
    ]
  }
]

const SECTIONS_NAV: { id: string; label: string }[] = [
  { id: 'template', label: 'Szablon' },
  { id: 'colors', label: 'Kolory' },
  { id: 'type', label: 'Typografia' },
  { id: 'elements', label: 'Elementy' },
  { id: 'photo', label: 'Zdjęcie' },
  { id: 'layout', label: 'Układ' },
  { id: 'language', label: 'Język' }
]

type Props = PrototypeShellProps & { onDone: () => void }
type PhotoPicker = ReturnType<typeof usePhotoPicker>
type CardProps = Props & { photoPicker: PhotoPicker }

export function DesignColumn(props: Props) {
  const scroller = useRef<HTMLElement>(null)
  // Jeden wybór zdjęcia dla całej kolumny (wiersz „Zdjęcie” w Elementach CV i karta Zdjęcie).
  const photoPicker = usePhotoPicker(props.editor)
  const cardProps = { ...props, photoPicker }
  const jump = (id: string) =>
    scroller.current?.querySelector(`[data-pc-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <aside className="pc-design" aria-label="Projekt CV" ref={scroller}>
      <div className="pc-design-head">
        <div className="pc-design-title-row">
          <div>
            <h2 className="pc-design-title">Projekt CV</h2>
            <p className="pc-muted">Wygląd tego CV. Zmiany widać od razu na stronach, ⌘Z cofa.</p>
          </div>
          <button type="button" className="button-primary pc-done" onClick={props.onDone}>
            Gotowe → wróć do treści
          </button>
        </div>
        <nav className="pc-chips" aria-label="Skocz do grupy">
          {SECTIONS_NAV.map((item) => (
            <button key={item.id} type="button" className="pc-chip" onClick={() => jump(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="pc-design-body">
        <TemplateCard {...cardProps} />
        <ColorsCard {...cardProps} />
        <TypographyCard {...cardProps} />
        <ElementsCard {...cardProps} />
        <PhotoCard {...cardProps} />
        <LayoutCard />
        <LanguageCard {...cardProps} />
      </div>
      {photoPicker.cropper}
    </aside>
  )
}

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="pc-card" data-pc-card={id} aria-labelledby={`pc-card-${id}`}>
      <header className="pc-card-head">
        <h3 id={`pc-card-${id}`} className="pc-card-title">
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  )
}

// ---------- 1. Szablon: miniatury PRAWDZIWEGO CV w każdym szablonie ----------
function TemplateCard({ editor, document }: CardProps) {
  const [columns, setColumns] = useState<1 | 3>(3)
  const gallery = useRef<HTMLDivElement>(null)
  const width = useWidth(gallery)
  const gap = 10
  // Kolumna galerii minus obramowanie i wcięcie etykiety (2 × 8 px).
  const scale = width > 0 ? ((width - gap * (columns - 1)) / columns - 16) / PAGE_WIDTH_PX : 0.12
  const current = document.settings.template

  return (
    <Card
      id="template"
      title="Szablon"
      aside={
        <div role="radiogroup" aria-label="Widok galerii" className="pc-segmented pc-segmented--small">
          {([3, 1] as const).map((value) => (
            <label key={value} className="pc-segment" title={value === 3 ? 'Siatka' : 'Duże'}>
              <input type="radio" name="pc-gallery" checked={columns === value} onChange={() => setColumns(value)} />
              <span aria-hidden="true">{value === 3 ? '▦' : '▭'}</span>
            </label>
          ))}
        </div>
      }
    >
      <div
        ref={gallery}
        role="radiogroup"
        aria-label="Szablon"
        className="pc-templates"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, ['--thumbnail-scale' as string]: scale }}
      >
        {cvTemplateIds.map((id) => (
          <label key={id} className="pc-template">
            <input
              type="radio"
              name="pc-template"
              checked={current === id}
              onChange={() => editor.edit(updateSettings({ template: id }))}
            />
            <LiveThumbnail document={document} template={id} />
            <span className="pc-template-name">{TEMPLATE_NAMES[id].name}</span>
            {columns === 1 && <span className="pc-muted pc-template-note">{TEMPLATE_NAMES[id].note}</span>}
          </label>
        ))}
      </div>
    </Card>
  )
}

const LiveThumbnail = memo(function LiveThumbnail({ document, template }: { document: CvDocument; template: CvTemplateId }) {
  const thumbnailDocument = useMemo(
    () => ({ ...document, settings: { ...document.settings, template } }),
    [document, template]
  )
  return (
    <div className="template-thumbnail pc-thumbnail" aria-hidden>
      <CvPages document={thumbnailDocument} template={templates[template]} firstPageOnly />
    </div>
  )
})

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// ---------- 2. Kolory ----------
function ColorsCard({ editor, document }: CardProps) {
  const accent = document.settings.accentColor.toLowerCase()
  const inPalette = PALETTES.some((palette) => palette.colors.some((color) => color.hex === accent))
  return (
    <Card id="colors" title="Kolory">
      {PALETTES.map((palette) => (
        <div key={palette.name} className="pc-palette">
          <span className="pc-field-label">{palette.name}</span>
          <div role="radiogroup" aria-label={palette.name} className="pc-swatches">
            {palette.colors.map((color) => (
              <label key={color.hex} className="pc-swatch" title={color.name} style={{ ['--swatch' as string]: color.hex }}>
                <input
                  type="radio"
                  name="pc-accent"
                  aria-label={color.name}
                  checked={accent === color.hex}
                  onChange={() => editor.edit(updateSettings({ accentColor: color.hex }))}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="pc-custom-color">
        <label className="pc-swatch pc-swatch--custom" data-active={!inPalette || undefined} style={{ ['--swatch' as string]: accent }}>
          <input
            type="color"
            aria-label="Własny kolor"
            value={accent}
            onChange={(event) => editor.edit(updateSettings({ accentColor: event.target.value }), 'settings:accentColor')}
          />
        </label>
        <div>
          <div>Własny kolor</div>
          <div className="pc-muted pc-mono">{accent.toUpperCase()}</div>
        </div>
      </div>
    </Card>
  )
}

// ---------- 3. Typografia ----------
const FONT_SIZES: { value: StubOptions['fontSize']; label: string }[] = [
  { value: 'small', label: 'Mała' },
  { value: 'normal', label: 'Normalna' },
  { value: 'large', label: 'Duża' }
]

function TypographyCard({ editor, document }: CardProps) {
  const fontSize = useStubOptions((state) => state.fontSize)
  const setStub = useStubOptions((state) => state.set)
  const sample = document.header.fullName.trim() || 'Twoje imię i nazwisko'
  const sizeIndex = FONT_SIZES.findIndex((size) => size.value === fontSize)
  return (
    <Card id="type" title="Typografia">
      <div role="radiogroup" aria-label="Czcionka" className="pc-fonts">
        {cvFontIds.map((font: CvFontId) => (
          <label key={font} className="pc-font" style={{ fontFamily: fontStack(font) }}>
            <input
              type="radio"
              name="pc-font"
              checked={document.settings.font === font}
              onChange={() => editor.edit(updateSettings({ font }))}
            />
            <span className="pc-font-aa" aria-hidden="true">
              Aa
            </span>
            <span className="pc-font-text">
              <span className="pc-font-sample">{sample}</span>
              <span className="pc-font-name">{cvFontFamilies[font]}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="pc-field">
        <span className="pc-field-label">
          Wielkość tekstu <StubBadge />
          <span className="pc-field-value">{FONT_SIZES[sizeIndex]?.label}</span>
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={sizeIndex}
          onChange={(event) => setStub({ fontSize: FONT_SIZES[Number(event.target.value)]?.value ?? 'normal' })}
        />
        <span className="pc-range-ends pc-muted" aria-hidden="true">
          <span style={{ fontSize: 11 }}>A</span>
          <span style={{ fontSize: 16 }}>A</span>
        </span>
      </label>
    </Card>
  )
}

// ---------- 4. Elementy CV: jedna jednolita lista (zdjęcie, sekcje, klauzula) ----------
function ElementsCard({ editor, document, clauses, photoPicker }: CardProps) {
  const t = useDictionary().editor
  const { photo } = document.header
  const { consent } = document
  return (
    <Card id="elements" title="Elementy CV">
      <p className="pc-muted pc-card-hint">Zaznacz, co ma być na CV. Kolejność sekcji zmienisz, przeciągając za uchwyt.</p>
      <ul className="pc-checklist">
        <li className="pc-check-row">
          <span className="pc-row-lead" aria-hidden="true">
            {photo ? <img src={photo.dataUrl} alt="" className="pc-mini-photo" /> : <span className="pc-mini-photo pc-mini-photo--empty" />}
          </span>
          <label className="pc-check">
            <input
              type="checkbox"
              disabled={!photo}
              checked={!!photo && !photo.hidden}
              onChange={(event) => editor.edit(setPhotoHidden(!event.target.checked))}
            />
            <span className="pc-check-name">Zdjęcie</span>
          </label>
          {!photo && (
            <button type="button" className="pc-small" onClick={() => void photoPicker.pick()}>
              Dodaj…
            </button>
          )}
        </li>
      </ul>
      <SortableList
        items={document.sections}
        label={(section) => t.order.section(sectionName(section, t))}
        handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
        onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
        moreActions={(section: Section, focusHandle) => [
          {
            label: 'Nowa strona przed tą sekcją',
            checked: section.pageBreakBefore,
            run: () => {
              editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
              focusHandle()
            }
          }
        ]}
      >
        {(section, row, index) => (
          <div className="pc-check-row" data-hidden={section.hidden || undefined}>
            <span className="pc-row-lead">{row.handle}</span>
            <label className="pc-check">
              <input
                type="checkbox"
                checked={!section.hidden}
                onChange={(event) => editor.edit(updateSection(section.id, { hidden: !event.target.checked }))}
              />
              <span className="pc-check-name">{sectionName(section, t)}</span>
              {section.pageBreakBefore && (
                <span className="pc-pill" title="Sekcja zaczyna się na nowej stronie">
                  ↧ nowa strona
                </span>
              )}
            </label>
            <span className="pc-row-arrows">
              <button
                type="button"
                className="pc-icon"
                aria-label={`Przenieś wyżej: ${sectionName(section, t)}`}
                disabled={index === 0}
                onClick={() => row.moveBy(-1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="pc-icon"
                aria-label={`Przenieś niżej: ${sectionName(section, t)}`}
                disabled={index === document.sections.length - 1}
                onClick={() => row.moveBy(1)}
              >
                ↓
              </button>
            </span>
          </div>
        )}
      </SortableList>
      <ul className="pc-checklist">
        <li className="pc-check-row pc-check-row--consent">
          <span className="pc-row-lead" aria-hidden="true">
            §
          </span>
          <label className="pc-check">
            <input
              type="checkbox"
              checked={consent.enabled}
              onChange={(event) => editor.edit(updateConsent({ enabled: event.target.checked }))}
            />
            <span className="pc-check-name">Klauzula zgody</span>
          </label>
        </li>
        {consent.enabled && (
          <li className="pc-consent-pick">
            <select
              aria-label="Klauzula z biblioteki"
              value={consent.clauseId && clauses.some((clause) => clause.id === consent.clauseId) ? consent.clauseId : ''}
              onChange={(event) => {
                const clause = clauses.find((candidate) => candidate.id === event.target.value)
                if (clause) editor.edit(applyClause(clause))
              }}
            >
              <option value="" disabled>
                {clauses.length ? 'Własny tekst (wybierz z biblioteki…)' : 'Biblioteka klauzul jest pusta'}
              </option>
              {clauses.map((clause) => (
                <option key={clause.id} value={clause.id}>
                  {clause.name.trim() || 'Bez nazwy'}
                </option>
              ))}
            </select>
            <span className="pc-muted pc-consent-hint">Tekst klauzuli edytujesz na stronie w trybie Treść.</span>
          </li>
        )}
      </ul>
    </Card>
  )
}

// ---------- 5. Zdjęcie ----------
const SHAPES: { value: StubOptions['photoShape']; label: string }[] = [
  { value: 'template', label: 'Jak w szablonie' },
  { value: 'rectangle', label: 'Prostokąt' },
  { value: 'rounded', label: 'Zaokrąglone' },
  { value: 'circle', label: 'Koło' }
]

function PhotoCard({ editor, document, photoPicker }: CardProps) {
  const t = useDictionary().editor.photo
  const { pick, crop, error } = photoPicker
  const { photo } = document.header
  const shape = useStubOptions((state) => state.photoShape)
  const setStub = useStubOptions((state) => state.set)
  return (
    <Card id="photo" title="Zdjęcie">
      <div className="pc-photo">
        {photo ? (
          <img src={photo.dataUrl} alt="Zdjęcie w CV" className="pc-photo-big" data-hidden={photo.hidden || undefined} />
        ) : (
          <div className="pc-photo-big pc-photo-big--empty">Brak zdjęcia</div>
        )}
        <div className="pc-photo-actions">
          <button type="button" onClick={() => void pick()}>
            {photo ? 'Zmień…' : 'Wybierz zdjęcie…'}
          </button>
          {photo && (
            <button type="button" onClick={() => void crop(photo.dataUrl)}>
              Kadruj…
            </button>
          )}
          {photo && (
            <button type="button" className="danger" onClick={() => editor.edit(updateHeader({ photo: null }))}>
              Usuń
            </button>
          )}
          {photo?.hidden && <span className="pc-muted">Ukryte na CV (Elementy CV)</span>}
        </div>
      </div>
      {error && (
        <p className="pc-error" role="alert">
          {t.errors[error]}
        </p>
      )}
      <div className="pc-field">
        <span className="pc-field-label">
          Kształt <StubBadge />
        </span>
        <div role="radiogroup" aria-label="Kształt zdjęcia" className="pc-tiles">
          {SHAPES.map((item) => (
            <label key={item.value} className="pc-tile" title={item.label}>
              <input
                type="radio"
                name="pc-shape"
                checked={shape === item.value}
                onChange={() => setStub({ photoShape: item.value })}
              />
              <span className={`pc-shape pc-shape--${item.value}`} aria-hidden="true" />
              <span className="pc-tile-label">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ---------- 6. Układ i format (same atrapy) ----------
function LayoutCard() {
  const stub = useStubOptions()
  return (
    <Card id="layout" title="Układ i format">
      <div className="pc-field">
        <span className="pc-field-label">
          Gęstość <StubBadge />
        </span>
        <div role="radiogroup" aria-label="Gęstość" className="pc-tiles">
          {(
            [
              ['compact', 'Zwarta', 3],
              ['normal', 'Normalna', 5],
              ['airy', 'Przestronna', 8]
            ] as const
          ).map(([value, label, gap]) => (
            <label key={value} className="pc-tile">
              <input type="radio" name="pc-density" checked={stub.density === value} onChange={() => stub.set({ density: value })} />
              <span className="pc-density" style={{ gap }} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="pc-tile-label">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="pc-field">
        <span className="pc-field-label">
          Format dat <StubBadge />
        </span>
        <select value={stub.dateFormat} onChange={(event) => stub.set({ dateFormat: event.target.value as StubOptions['dateFormat'] })}>
          <option value="MM.YYYY">03.2024 – obecnie</option>
          <option value="MMM YYYY">mar 2024 – obecnie</option>
          <option value="YYYY">2024 – obecnie</option>
        </select>
      </label>
      <div className="pc-field">
        <span className="pc-field-label">
          Rozmiar strony <StubBadge />
        </span>
        <div role="radiogroup" aria-label="Rozmiar strony" className="pc-segmented pc-segmented--full">
          {(
            [
              ['A4', 'A4 (Europa)'],
              ['Letter', 'Letter (USA)']
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="pc-segment">
              <input type="radio" name="pc-page" checked={stub.pageSize === value} onChange={() => stub.set({ pageSize: value })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ---------- 7. Język CV ----------
function LanguageCard({ editor, document }: CardProps) {
  return (
    <Card id="language" title="Język CV">
      <label className="pc-field">
        <span className="pc-field-label">Język dokumentu</span>
        <select
          value={document.settings.language}
          onChange={(event) => editor.edit(updateSettings({ language: event.target.value as CvLanguage }))}
        >
          {cvLanguageCodes.map((language) => (
            <option key={language} value={language}>
              {interfaceLanguages[language].name}
            </option>
          ))}
        </select>
      </label>
      <p className="pc-muted pc-card-hint">Zmienia tylko stałe napisy na CV (np. „obecnie”, numery stron) – nie tłumaczy treści.</p>
    </Card>
  )
}
