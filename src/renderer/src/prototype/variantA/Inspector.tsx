// PROTOTYP – wariant A „Inspektor”: prawy panel opcji (jak w Figmie, Keynote, Pages) – jedyny pasek boczny ekranu.
// Nic nie zaznaczone → „Dokument” (szablon, styl, elementy CV, język, atrapy „wkrótce”). „Elementy CV” to też konspekt:
// klik w wiersz otwiera opcje części (także ukrytej i pustej) i przewija do niej strony. Zaznaczona część CV na stronie
// albo na liście → jej opcje z okruszkiem „‹ Dokument”. ⚙ na dole → „Aplikacja” (ustawienia wspólne; atrapy).
// Wszystkie prawdziwe opcje idą przez `editor.edit`, więc zmieniają strony od razu i dają się cofnąć.
import { forwardRef, useState, type ReactNode } from 'react'
import { interfaceLanguages } from '../../../../shared/i18n/languages'
import type { EditSession } from '../../canvas/useEditSession'
import { cvLanguageCodes, type Clause, type ClauseContent, type CvDocument, type CvLanguage, type Section } from '../../domain/schema'
import type { CvEditor } from '../../editor/cvEditor'
import { updateSettings } from '../../editor/documentEdits'
import { sectionName } from '../../editor/fields/SectionTitleField'
import { useDictionary } from '../../i18n'
import { StubBadge } from '../StubBadge'
import { useStubOptions } from '../stubOptions'
import { FontCards, Group, Row, Segmented, Swatches, TemplateGrid } from './controls'
import { ElementsList } from './ElementsList'
import { ConsentPanel, HeaderPanel, PhotoPanel, SectionPanel } from './panels'
import type { InspectorSelection } from './useInspectorSelection'

type Tab = 'document' | 'app'

export type InspectorProps = {
  editor: CvEditor
  document: CvDocument
  session: EditSession
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
  let key = 'document'
  if (showApp) {
    title = 'Aplikacja'
    key = 'app'
    body = <AppPanel clauses={props.clauses} />
  } else if (element?.kind === 'section') {
    const section = props.document.sections.find((candidate) => candidate.id === element.id)
    if (section) {
      title = <SectionTitle section={section} />
      key = `section:${section.id}`
      body = <SectionPanel {...props} section={section} />
    }
  } else if (element?.kind === 'photo') {
    title = 'Zdjęcie'
    key = 'photo'
    body = <PhotoPanel {...props} />
  } else if (element?.kind === 'header') {
    title = 'Nagłówek'
    key = 'header'
    body = <HeaderPanel {...props} />
  } else if (element?.kind === 'consent') {
    title = 'Klauzula zgody'
    key = 'consent'
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
              <span aria-hidden="true">‹</span> Dokument
            </button>
            <h2 className="pa-inspector-title">{title}</h2>
          </nav>
        ) : (
          <h2 className="pa-inspector-title">{title}</h2>
        )}
      </header>
      {/* `key` – każdy panel startuje przewinięty do góry. */}
      <div key={key} className="pa-inspector-body" data-panel={key}>
        {body}
      </div>
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
      </Group>
      <Group title="Elementy CV" id="elements">
        <ElementsList {...props} />
      </Group>
      <Group title="Język">
        <Row label="Język CV" hint="Zmienia stałe napisy na stronach (np. „obecnie”), nie Twoją treść.">
          <select
            className="pa-select"
            aria-label="Język CV"
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
      </Group>
      <Group title="Układ i format (wkrótce)" id="stubs" aside={<StubBadge />} defaultOpen={false}>
        <p className="pa-hint pa-hint--flush">Opcje w przygotowaniu – pokazują, gdzie się znajdą. Nie zmieniają CV.</p>
        <Row label="Rozmiar tekstu">
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
        <Row label="Gęstość">
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
        <Row label="Format dat">
          <select
            className="pa-select"
            aria-label="Format dat"
            value={stub.dateFormat}
            onChange={(event) => stub.set({ dateFormat: event.target.value as typeof stub.dateFormat })}
          >
            <option value="MM.YYYY">03.2024</option>
            <option value="MMM YYYY">mar 2024</option>
            <option value="YYYY">2024</option>
          </select>
        </Row>
        <Row label="Format papieru">
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

// ---------- Aplikacja (wspólne dla wszystkich CV) ----------

function AppPanel({ clauses }: { clauses: Clause[] }) {
  const [language, setLanguage] = useState('pl')
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>('system')
  return (
    <>
      <p className="pa-hint pa-hint--panel">Te ustawienia dotyczą całej aplikacji i wszystkich CV – nie trafiają do dokumentu.</p>
      <Group title="Interfejs" aside={<StubBadge />}>
        <Row label="Język interfejsu">
          <select className="pa-select" aria-label="Język interfejsu" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {Object.entries(interfaceLanguages).map(([code, entry]) => (
              <option key={code} value={code}>
                {entry.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Wygląd">
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
      <Group title="Biblioteka klauzul" aside={<StubBadge />}>
        <p className="pa-hint pa-hint--flush">Klauzule wspólne dla wszystkich CV.</p>
        <ul className="pa-library">
          {clauses.map((clause) => (
            <li key={clause.id}>
              <span className="pa-clause-name">{clause.name.trim() || 'Bez nazwy'}</span>
              <button type="button" className="pa-button pa-button--small" disabled title="Atrapa">
                Edytuj
              </button>
            </li>
          ))}
          {clauses.length === 0 && <li className="pa-hint">Brak klauzul.</li>}
        </ul>
        <div className="pa-actions">
          <button type="button" className="pa-button" disabled title="Atrapa">
            + Nowa klauzula
          </button>
          <button type="button" className="pa-button" disabled title="Atrapa">
            Domyślna dla nowych CV…
          </button>
        </div>
      </Group>
    </>
  )
}
