// PROTOTYP – wariant A „Inspektor”: prawy panel opcji (jak w Figmie, Keynote, Pages).
// Nic nie zaznaczone → „Dokument” (szablon, styl, elementy CV, język i formaty, strona). Zaznaczona część CV na stronie →
// jej opcje z okruszkiem „Dokument ›”. ⚙ na dole → „Aplikacja” (ustawienia wspólne dla wszystkich CV; atrapy).
// Wszystkie prawdziwe opcje idą przez `editor.edit`, więc zmieniają strony od razu i dają się cofnąć.
import { forwardRef, useState, type ReactNode } from 'react'
import { interfaceLanguages } from '../../../../shared/i18n/languages'
import { cvLanguageCodes, type Clause, type ClauseContent, type CvDocument, type CvLanguage, type Section } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { applyClause, moveSection, setPhotoHidden, updateConsent, updateHeader, updateSection, updateSettings } from '../../editor/documentEdits'
import { usePhotoPicker } from '../../editor/fields/PhotoField'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { SortableList } from '../../editor/SortableList'
import { useDictionary } from '../../i18n'
import { StubBadge } from '../StubBadge'
import { useStubOptions } from '../stubOptions'
import { FontCards, Group, Row, Segmented, Swatches, Switch, TemplateGrid } from './controls'
import type { InspectorSelection } from './useInspectorSelection'

type Tab = 'document' | 'app'

export type InspectorProps = {
  editor: CvEditor
  document: CvDocument
  clauses: Clause[]
  saveClause: (content: ClauseContent) => Promise<Clause | null>
  selection: InspectorSelection
  onSelect: (selection: InspectorSelection) => void
  preview: boolean
}

export const Inspector = forwardRef<HTMLElement, InspectorProps>(function Inspector(props, ref) {
  const [tab, setTab] = useState<Tab>('document')
  const showApp = tab === 'app' && !props.preview
  const element = showApp ? null : props.selection

  let title: ReactNode = 'Dokument'
  let body: ReactNode = <DocumentPanel {...props} />
  if (showApp) {
    title = 'Aplikacja'
    body = <AppPanel clauses={props.clauses} />
  } else if (element?.kind === 'section') {
    const section = props.document.sections.find((candidate) => candidate.id === element.id)
    if (section) {
      title = <SectionTitle section={section} />
      body = <SectionPanel {...props} section={section} />
    }
  } else if (element?.kind === 'photo' || element?.kind === 'header') {
    title = element.kind === 'photo' ? 'Zdjęcie' : 'Nagłówek'
    body = <PhotoPanel {...props} header={element.kind === 'header'} />
  } else if (element?.kind === 'consent') {
    title = 'Klauzula zgody'
    body = <ConsentPanel {...props} />
  }
  const nested = showApp || element !== null

  return (
    <aside ref={ref} className="pa-inspector" aria-label="Inspektor">
      <header className="pa-inspector-head">
        {nested ? (
          <nav className="pa-breadcrumb" aria-label="Okruszki">
            <button
              type="button"
              className="pa-crumb"
              onClick={() => {
                setTab('document')
                props.onSelect(null)
              }}
            >
              ‹ Dokument
            </button>
            <span className="pa-crumb-separator" aria-hidden="true">/</span>
            <h2 className="pa-inspector-title">{title}</h2>
          </nav>
        ) : (
          <h2 className="pa-inspector-title">{title}</h2>
        )}
      </header>
      <div className="pa-inspector-body">{body}</div>
      {!props.preview && (
        <footer className="pa-inspector-foot">
          <button
            type="button"
            className="pa-gear"
            aria-pressed={showApp}
            title="Ustawienia aplikacji (wszystkie CV)"
            onClick={() => setTab(showApp ? 'document' : 'app')}
          >
            <span aria-hidden="true">⚙</span> {showApp ? 'Wróć do dokumentu' : 'Aplikacja'}
          </button>
        </footer>
      )}
    </aside>
  )
})

function SectionTitle({ section }: { section: Section }) {
  const t = useDictionary().editor
  return <>{sectionName(section, t)}</>
}

// ---------- Dokument ----------

function DocumentPanel(props: InspectorProps) {
  const { editor, document } = props
  const { settings } = document
  const stub = useStubOptions()
  return (
    <>
      <Group title="Szablon">
        <TemplateGrid document={document} onChange={(template) => editor.edit(updateSettings({ template }))} />
      </Group>
      <Group title="Styl">
        <div className="pa-field">
          <span className="pa-field-label">Kolor akcentu</span>
          <Swatches
            value={settings.accentColor}
            onPreset={(accentColor) => editor.edit(updateSettings({ accentColor }))}
            onCustom={(accentColor) => editor.edit(updateSettings({ accentColor }), 'settings:accentColor')}
          />
        </div>
        <div className="pa-field">
          <span className="pa-field-label">Font</span>
          <FontCards value={settings.font} onChange={(font) => editor.edit(updateSettings({ font }))} />
        </div>
        <Row label="Rozmiar tekstu" stub>
          <Segmented
            label="Rozmiar tekstu"
            value={stub.fontSize}
            onChange={(fontSize) => stub.set({ fontSize })}
            options={[
              { value: 'small', label: 'S' },
              { value: 'normal', label: 'M' },
              { value: 'large', label: 'L' }
            ]}
          />
        </Row>
        <Row label="Gęstość" stub>
          <Segmented
            label="Gęstość"
            value={stub.density}
            onChange={(density) => stub.set({ density })}
            options={[
              { value: 'compact', label: 'Zwarta' },
              { value: 'normal', label: 'Zwykła' },
              { value: 'airy', label: 'Luźna' }
            ]}
          />
        </Row>
      </Group>
      <Group title="Elementy CV">
        <ElementsList {...props} />
      </Group>
      <Group title="Język i formaty">
        <Row label="Język CV" hint="Zmienia stałe napisy na stronach (np. „obecnie”), nie Twoją treść.">
          <select
            className="pa-select"
            value={settings.language}
            onChange={(event) => editor.edit(updateSettings({ language: event.target.value as CvLanguage }))}
          >
            {cvLanguageCodes.map((language) => (
              <option key={language} value={language}>
                {interfaceLanguages[language].name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Format dat" stub>
          <select
            className="pa-select"
            value={stub.dateFormat}
            onChange={(event) => stub.set({ dateFormat: event.target.value as typeof stub.dateFormat })}
          >
            <option value="MM.YYYY">03.2024</option>
            <option value="MMM YYYY">mar 2024</option>
            <option value="YYYY">2024</option>
          </select>
        </Row>
      </Group>
      <Group title="Strona">
        <Row label="Format papieru" stub>
          <Segmented
            label="Format papieru"
            value={stub.pageSize}
            onChange={(pageSize) => stub.set({ pageSize })}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'Letter', label: 'Letter' }
            ]}
          />
        </Row>
      </Group>
    </>
  )
}

// Jedna, jednolita lista: zdjęcie, wszystkie sekcje (przeciągane) i klauzula – ten sam przełącznik w każdym wierszu.
function ElementsList({ editor, document, onSelect }: InspectorProps) {
  const t = useDictionary().editor
  const { photo } = document.header
  return (
    <div className="pa-elements">
      <ElementRow
        name="Zdjęcie"
        badge={photo ? undefined : 'brak'}
        onOpen={() => onSelect({ kind: 'photo' })}
        toggle={
          <Switch
            label="Pokaż zdjęcie na CV"
            checked={photo !== null && !photo.hidden}
            disabled={photo === null}
            onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
          />
        }
      />
      <SortableList
        items={document.sections}
        label={(section) => t.order.section(sectionName(section, t))}
        handleLabel={(section) => t.order.handle.section(sectionName(section, t))}
        onMove={(id, toIndex) => editor.edit(moveSection(id, toIndex))}
        moreActions={(section, focusHandle) => [
          {
            label: 'Nowa strona przed',
            checked: section.pageBreakBefore,
            run: () => {
              editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
              focusHandle()
            }
          }
        ]}
      >
        {(section, row) => (
          <ElementRow
            handle={row.handle}
            name={sectionName(section, t)}
            badge={section.pageBreakBefore ? '↧ nowa strona' : undefined}
            onOpen={() => {
              onSelect({ kind: 'section', id: section.id })
              scrollToFragment(`sectionTitle:${section.id}`)
            }}
            toggle={
              <Switch
                label={`Pokaż sekcję „${sectionName(section, t)}” na CV`}
                checked={!section.hidden}
                onChange={(shown) => editor.edit(updateSection(section.id, { hidden: !shown }))}
              />
            }
          />
        )}
      </SortableList>
      <ElementRow
        name="Klauzula zgody"
        onOpen={() => {
          onSelect({ kind: 'consent' })
          scrollToFragment('consent')
        }}
        toggle={
          <Switch
            label="Pokaż klauzulę zgody na CV"
            checked={document.consent.enabled}
            onChange={(enabled) => editor.edit(updateConsent({ enabled }))}
          />
        }
      />
      <p className="pa-hint">Przeciągnij ⋮⋮, by zmienić kolejność sekcji. Kliknij nazwę, by zobaczyć jej opcje.</p>
    </div>
  )
}

function ElementRow({
  handle,
  name,
  badge,
  onOpen,
  toggle
}: {
  handle?: ReactNode
  name: string
  badge?: string
  onOpen: () => void
  toggle: ReactNode
}) {
  return (
    <div className="pa-element">
      <span className="pa-element-handle">{handle}</span>
      <button type="button" className="pa-element-name" onClick={onOpen} title="Pokaż opcje">
        <span className="pa-element-text">{name}</span>
        {badge && <span className="pa-element-badge">{badge}</span>}
        <span className="pa-element-chevron" aria-hidden="true">›</span>
      </button>
      {toggle}
    </div>
  )
}

export function scrollToFragment(key: string) {
  window.document.querySelector(`.cv-pages [data-fragment="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ---------- Sekcja ----------

function SectionPanel({ editor, document, section }: InspectorProps & { section: Section }) {
  const t = useDictionary().editor
  const index = document.sections.findIndex((candidate) => candidate.id === section.id)
  const count = document.sections.length
  return (
    <>
      <Group title="Sekcja">
        <label className="pa-field">
          <span className="pa-field-label">Nazwa</span>
          <input
            className="pa-input"
            value={section.title}
            placeholder={t.sectionTypes[section.type]}
            onChange={(event) => editor.edit(updateSection(section.id, { title: event.target.value }), `section:${section.id}:title`)}
          />
        </label>
        <Row label="Pokaż na CV" hint={section.hidden ? 'Ukrytej sekcji nie ma na stronach ani w PDF – treść zostaje.' : undefined}>
          <Switch label="Pokaż na CV" checked={!section.hidden} onChange={(shown) => editor.edit(updateSection(section.id, { hidden: !shown }))} />
        </Row>
        <Row label="Zacznij od nowej strony">
          <Switch
            label="Zacznij od nowej strony"
            checked={section.pageBreakBefore}
            onChange={(pageBreakBefore) => editor.edit(updateSection(section.id, { pageBreakBefore }))}
          />
        </Row>
      </Group>
      <Group title="Położenie">
        <div className="pa-move">
          <button type="button" disabled={index <= 0} onClick={() => editor.edit(moveSection(section.id, index - 1))}>
            ↑ Wyżej
          </button>
          <span className="pa-move-position">
            {index + 1} z {count}
          </span>
          <button type="button" disabled={index >= count - 1} onClick={() => editor.edit(moveSection(section.id, index + 1))}>
            ↓ Niżej
          </button>
        </div>
      </Group>
      <p className="pa-hint pa-hint--panel">Treść sekcji – wpisy, daty, punkty – edytujesz bezpośrednio na stronie.</p>
    </>
  )
}

// ---------- Zdjęcie ----------

function PhotoPanel({ editor, document, header }: InspectorProps & { header: boolean }) {
  const { photo } = document.header
  const errors = useDictionary().editor.photo.errors
  const { pick, crop, error, cropper } = usePhotoPicker(editor)
  const stub = useStubOptions()
  return (
    <>
      {header && <p className="pa-hint pa-hint--panel">Imię, kontakty i podsumowanie edytujesz na stronie. Tu są opcje zdjęcia w nagłówku.</p>}
      <Group title="Zdjęcie">
        <div className="pa-photo">
          {photo ? (
            <img className="pa-photo-thumb" src={photo.dataUrl} alt="Zdjęcie w CV" data-hidden={photo.hidden || undefined} />
          ) : (
            <div className="pa-photo-thumb pa-photo-thumb--empty" aria-hidden="true">
              brak
            </div>
          )}
          <div className="pa-photo-actions">
            <button type="button" className={photo ? undefined : 'button-primary'} onClick={() => void pick()}>
              {photo ? 'Zmień…' : 'Dodaj zdjęcie…'}
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
          </div>
        </div>
        {error && (
          <p className="pa-error" role="alert">
            {errors[error]}
          </p>
        )}
        <Row label="Pokaż na CV" hint={photo?.hidden ? 'Ukryte zdjęcie zostaje w CV, ale nie trafia na strony ani do PDF.' : undefined}>
          <Switch
            label="Pokaż zdjęcie na CV"
            checked={photo !== null && !photo.hidden}
            disabled={photo === null}
            onChange={(shown) => editor.edit(setPhotoHidden(!shown))}
          />
        </Row>
        <Row label="Kształt" stub>
          <select
            className="pa-select"
            value={stub.photoShape}
            onChange={(event) => stub.set({ photoShape: event.target.value as typeof stub.photoShape })}
          >
            <option value="template">Jak w szablonie</option>
            <option value="rectangle">Prostokąt</option>
            <option value="rounded">Zaokrąglony</option>
            <option value="circle">Koło</option>
          </select>
        </Row>
      </Group>
      {cropper}
    </>
  )
}

// ---------- Klauzula zgody ----------

function ConsentPanel({ editor, document, clauses, saveClause }: InspectorProps) {
  const { consent } = document
  const [name, setName] = useState('')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const matching = clauses.find((clause) => clause.id === consent.clauseId)
  const edited = matching !== undefined && matching.text !== consent.text

  async function save() {
    setSaving('saving')
    const clause = await saveClause({ name: name.trim() || 'Moja klauzula', text: consent.text })
    if (!clause) {
      setSaving('failed')
      return
    }
    editor.edit(applyClause(clause))
    setName('')
    setSaving('saved')
  }

  return (
    <>
      <Group title="Klauzula">
        <Row label="Pokaż na CV">
          <Switch label="Pokaż klauzulę zgody na CV" checked={consent.enabled} onChange={(enabled) => editor.edit(updateConsent({ enabled }))} />
        </Row>
      </Group>
      <Group title="Treść z biblioteki">
        {clauses.length === 0 ? (
          <p className="pa-hint">Biblioteka klauzul jest pusta. Zapisz poniżej bieżący tekst.</p>
        ) : (
          <div className="pa-clauses" role="radiogroup" aria-label="Klauzula z biblioteki">
            {clauses.map((clause) => (
              <label key={clause.id} className="pa-clause" data-checked={clause.id === consent.clauseId || undefined}>
                <input type="radio" name="pa-clause" checked={clause.id === consent.clauseId} onChange={() => editor.edit(applyClause(clause))} />
                <span className="pa-clause-name">{clause.name.trim() || 'Bez nazwy'}</span>
                <span className="pa-clause-text">{clause.text}</span>
              </label>
            ))}
          </div>
        )}
        {edited && <p className="pa-hint">Tekst na stronie różni się od wersji z biblioteki.</p>}
        <p className="pa-hint">Tekst klauzuli możesz poprawić bezpośrednio na stronie.</p>
      </Group>
      <Group title="Zapisz w bibliotece" defaultOpen={false}>
        <label className="pa-field">
          <span className="pa-field-label">Nazwa nowej klauzuli</span>
          <input className="pa-input" value={name} placeholder="np. Klauzula RODO – ogólna" onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="pa-actions">
          <button type="button" disabled={saving === 'saving' || consent.text.trim() === ''} onClick={() => void save()}>
            Zapisz bieżący tekst
          </button>
          {saving === 'saved' && <span className="pa-hint">Zapisano.</span>}
          {saving === 'failed' && <span className="pa-error">Nie udało się zapisać.</span>}
        </div>
      </Group>
    </>
  )
}

// ---------- Aplikacja (wspólne dla wszystkich CV) ----------

function AppPanel({ clauses }: { clauses: Clause[] }) {
  const [language, setLanguage] = useState('pl')
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>('system')
  return (
    <>
      <p className="pa-hint pa-hint--panel">Te ustawienia dotyczą całej aplikacji i wszystkich CV – nie trafiają do dokumentu.</p>
      <Group title="Interfejs">
        <Row label="Język interfejsu" stub>
          <select className="pa-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {Object.entries(interfaceLanguages).map(([code, entry]) => (
              <option key={code} value={code}>
                {entry.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Wygląd" stub>
          <Segmented
            label="Wygląd"
            value={appearance}
            onChange={setAppearance}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Jasny' },
              { value: 'dark', label: 'Ciemny' }
            ]}
          />
        </Row>
      </Group>
      <Group title="Biblioteka klauzul">
        <p className="pa-hint">
          Klauzule wspólne dla wszystkich CV. <StubBadge />
        </p>
        <ul className="pa-library">
          {clauses.map((clause) => (
            <li key={clause.id}>
              <span className="pa-clause-name">{clause.name.trim() || 'Bez nazwy'}</span>
              <span className="pa-library-actions">
                <button type="button" disabled title="Atrapa">
                  Edytuj
                </button>
              </span>
            </li>
          ))}
          {clauses.length === 0 && <li className="pa-hint">Brak klauzul.</li>}
        </ul>
        <div className="pa-actions">
          <button type="button" disabled title="Atrapa">
            + Nowa klauzula
          </button>
          <button type="button" disabled title="Atrapa">
            Domyślna dla nowych CV…
          </button>
        </div>
      </Group>
    </>
  )
}
