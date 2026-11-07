import { useCallback, useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import type { CvListEntry, InvalidCvFileReason, MenuCommand } from '../../shared/api'
import type { Dictionary } from '../../shared/i18n/en'
import type { InterfaceLanguage } from '../../shared/i18n/languages'
import { cvDisplayName, type CvDocument } from './domain/schema'
import { cleanTag, MAX_TAG_LENGTH, sortTags, tagKey } from './domain/tags'
import { AppVersion } from './appVersion'
import { UpdateNotice } from './UpdateNotice'
import { useDictionary, useInterfaceLanguage } from './i18n'
import { useMenuCommands } from './menuCommands'

type OkEntry = Extract<CvListEntry, { status: 'ok' }>
type UnreadableEntry = Extract<CvListEntry, { status: 'unreadable' }>

// Tryb pojedynczego wiersza: zwykły, zmiana nazwy, edycja tagów albo potwierdzenie usunięcia.
type RowMode = { id: string; kind: 'rename' | 'tags' | 'confirm-delete' } | null

// Przycisk, który dostaje fokus po zamknięciu trybu wiersza albo po usunięciu CV. Szukany po atrybutach
// `data-cv-id` i `data-action` dopiero po odświeżeniu listy, bo zmiana nazwy przesuwa CV na górę.
type RowAction = 'open' | 'tags' | 'rename' | 'delete'
type FocusTarget = { id: string; action: RowAction } | 'new-cv'

// Komunikat tłumaczony przy wyświetlaniu, więc zmiana języka obejmuje także widoczny już komunikat.
type Message = (dictionary: Dictionary) => string
type Failure = keyof Dictionary['library']['errors']
const failureMessage =
  (failure: Failure): Message =>
  ({ library }) =>
    library.errors[failure]

// Ekran startowy: lista CV z akcjami Nowe / Importuj / Otwórz / Duplikuj / Eksportuj / Tagi / Zmień nazwę / Usuń i wejście do biblioteki klauzul.
export function Library({
  initialCommand,
  tagFilter,
  onTagFilterChange,
  onOpen,
  onOpenClauses
}: {
  // Komenda menu Plik wydana w edytorze, wykonywana raz po zamontowaniu biblioteki.
  initialCommand?: MenuCommand
  // Zaznaczone tagi filtra; lista pokazuje tylko CV mające wszystkie z nich.
  tagFilter: string[]
  onTagFilterChange: (tags: string[]) => void
  onOpen: (document: CvDocument) => void
  onOpenClauses: () => void
}) {
  const [entries, setEntries] = useState<CvListEntry[] | null>(null)
  const [rowMode, setRowMode] = useState<RowMode>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const main = useRef<HTMLElement>(null)
  const [error, setError] = useState<Message | null>(null)
  const [notice, setNotice] = useState<Message | null>(null)
  const showError = (message: Message) => setError(() => message)
  const showNotice = (message: Message) => setNotice(() => message)
  const dictionary = useDictionary()
  const { appName, common, library: t } = dictionary
  const language = useInterfaceLanguage()

  // Wszystkie istniejące tagi (suma tagów poprawnych CV).
  const allTags = sortTags([...new Set(tagsOf(entries ?? []))])
  // Zaznaczony tag, którego nie ma już żadne CV, przestaje filtrować od razu, a z filtra znika w efekcie poniżej.
  const selectedTags = tagFilter.filter((tag) => allTags.includes(tag))
  const toggleTag = (tag: string) =>
    onTagFilterChange(selectedTags.includes(tag) ? selectedTags.filter((other) => other !== tag) : [...selectedTags, tag])
  // Przy aktywnym filtrze nieczytelne pliki (uszkodzone i z nowszej wersji) są ukryte – nie mają tagów.
  const visibleEntries = entries?.filter(
    (entry) => selectedTags.length === 0 || (entry.status === 'ok' && selectedTags.every((tag) => entry.tags.includes(tag)))
  )

  const refresh = useCallback(async () => setEntries(await window.api.cv.list()), [])

  useEffect(() => {
    refresh().catch(() => showError(failureMessage('load')))
  }, [refresh])

  // Tag, którego nie ma już żadne CV, wypada z filtra – gdy później wróci, nie jest zaznaczony.
  useEffect(() => {
    if (!entries) return
    const existing = new Set(tagsOf(entries))
    if (tagFilter.some((tag) => !existing.has(tag))) onTagFilterChange(tagFilter.filter((tag) => existing.has(tag)))
  }, [entries, tagFilter, onTagFilterChange])

  // Fokus na przycisk wskazany przez `focusTarget`, gdy już jest na ekranie. Wiersz pliku nieczytelnego nie ma „Otwórz”,
  // więc fokus trafia wtedy na jego „Usuń”.
  useEffect(() => {
    if (!focusTarget) return
    const button =
      focusTarget === 'new-cv'
        ? document.querySelector<HTMLElement>('[data-action="new-cv"]')
        : (main.current?.querySelector<HTMLElement>(`[data-cv-id="${CSS.escape(focusTarget.id)}"][data-action="${focusTarget.action}"]`) ??
          main.current?.querySelector<HTMLElement>(`[data-cv-id="${CSS.escape(focusTarget.id)}"][data-action="delete"]`))
    if (!button) return
    button.focus()
    setFocusTarget(null)
  }, [focusTarget, entries, rowMode])

  // Zamyka tryb wiersza i oddaje fokus przyciskowi, który go otworzył.
  const closeRow = (id: string, action: RowAction) => {
    setRowMode(null)
    setFocusTarget({ id, action })
  }

  // Wykonuje operację, odświeża listę i zamyka edycję wiersza (fokus na `focusAfter`); błąd pokazuje jako komunikat.
  const runAndRefresh = async (action: () => Promise<unknown>, failure: Failure, focusAfter?: FocusTarget) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      await refresh()
      setRowMode(null)
      if (focusAfter) setFocusTarget(focusAfter)
    } catch {
      showError(failureMessage(failure))
    }
  }

  // Po usunięciu CV fokus idzie na następny wiersz, przy ostatnim na poprzedni, a przy pustej liście na „Nowe CV”.
  const deleteEntry = (id: string) => {
    const visible = visibleEntries ?? []
    const index = visible.findIndex((entry) => entry.id === id)
    const neighbour = visible[index + 1] ?? visible[index - 1]
    return runAndRefresh(() => window.api.cv.delete(id), 'delete', neighbour ? { id: neighbour.id, action: 'open' } : 'new-cv')
  }

  const addSample = () => createAndShow(() => window.api.cv.addSample())

  // Nowe CV (puste lub Sample CV): filtr tagów jest czyszczony, żeby nowe CV (bez tagów) było widać na liście.
  const createAndShow = (create: () => Promise<unknown>) =>
    runAndRefresh(() => create().then(() => onTagFilterChange([])), 'create')

  // Zapisuje tagi CV, nie zamykając trybu „Tagi”. Zwraca, czy się udało; odrzucony tag kończy się komunikatem z powodem.
  const saveTags = async (id: string, tags: string[]): Promise<boolean> => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.setTags(id, tags)
      if (result.status === 'invalid') {
        const { reason } = result
        showError(({ library }) => `${library.errors.tags} ${library.tagErrors[reason](MAX_TAG_LENGTH)}`)
        return false
      }
      await refresh()
      return true
    } catch {
      showError(failureMessage('tags'))
      await refresh()
      return false
    }
  }

  const open = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      onOpen(await window.api.cv.get(id))
    } catch {
      showError(failureMessage('open'))
      await refresh()
    }
  }

  const importFile = async () => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.importFile()
      if (result.status === 'invalid') {
        const { reason } = result
        showError(({ library }) => `${library.errors.import} ${importErrorText(library, reason)}`)
      }
      if (result.status !== 'imported') return
      const { name } = result.document
      onTagFilterChange([])
      showNotice(({ library }) => library.imported(cvDisplayName(name, library.untitled)))
      await refresh()
    } catch {
      showError(failureMessage('import'))
    }
  }

  const exportFile = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.cv.exportFile(id)
      if (result.status === 'saved') {
        const fileName = baseName(result.filePath)
        showNotice(({ library }) => library.savedFile(fileName))
      }
    } catch {
      showError(failureMessage('export'))
      await refresh()
    }
  }

  // Menu Plik: te same akcje co przyciski „Nowe CV”, „Dodaj przykładowe CV” i „Importuj z pliku”.
  const runMenuCommand = (command: MenuCommand) => {
    if (command === 'new-cv') void createAndShow(() => window.api.cv.create())
    else if (command === 'add-sample') void addSample()
    else if (command === 'import') void importFile()
  }
  useMenuCommands(runMenuCommand)
  // Komenda z edytora tylko raz po zamontowaniu (strażnik także na podwójny efekt w StrictMode).
  const initialCommandDone = useRef(false)
  useEffect(() => {
    if (!initialCommand || initialCommandDone.current) return
    initialCommandDone.current = true
    runMenuCommand(initialCommand)
  }, [])

  return (
    <>
      <header className="toolbar">
        <h1 className="toolbar-title">{appName}</h1>
        <button type="button" onClick={onOpenClauses}>
          {t.clauses}
        </button>
        <button type="button" onClick={importFile}>
          {t.importFile}
        </button>
        <NewCvButton
          onCreate={() => createAndShow(() => window.api.cv.create())}
          onAddSample={addSample}
        />
      </header>
      <main ref={main} className="library">
        <UpdateNotice />
        {error && (
          <p className="library-error" role="alert">
            {error(dictionary)}
          </p>
        )}
        {notice && (
          <p className="library-notice" role="status">
            {notice(dictionary)}
          </p>
        )}
        {entries === null && !error && (
          <p className="library-loading" role="status">
            {t.loading}
          </p>
        )}
        {entries?.length === 0 && (
          <div className="library-empty-state">
            <p className="library-empty">{t.empty}</p>
            <button type="button" onClick={addSample}>
              {t.addSample}
            </button>
          </div>
        )}
        {allTags.length > 0 && (
          <TagFilterBar tags={allTags} selected={selectedTags} onToggle={toggleTag} onClear={() => onTagFilterChange([])} />
        )}
        {entries && entries.length > 0 && visibleEntries?.length === 0 && <p className="library-empty">{t.noFilterMatches}</p>}
        <ul className="library-list" aria-label={t.list}>
          {visibleEntries?.map((entry) => {
            const mode = rowMode?.id === entry.id ? rowMode.kind : null
            const askDelete = () => setRowMode({ id: entry.id, kind: 'confirm-delete' })
            return (
              <li key={entry.id} className="library-item">
                {mode === 'confirm-delete' ? (
                  <ConfirmDelete
                    label={
                      entry.status === 'ok'
                        ? t.confirmDelete(cvDisplayName(entry.name, t.untitled))
                        : unreadableTexts(entry, t, appName).confirmDelete
                    }
                    onDelete={() => deleteEntry(entry.id)}
                    onCancel={() => closeRow(entry.id, 'delete')}
                  />
                ) : entry.status === 'unreadable' ? (
                  <UnreadableRow entry={entry} onDelete={askDelete} />
                ) : mode === 'rename' ? (
                  <RenameForm
                    entry={entry}
                    onSubmit={(name) =>
                      runAndRefresh(() => window.api.cv.rename(entry.id, name), 'rename', { id: entry.id, action: 'rename' })
                    }
                    onCancel={() => closeRow(entry.id, 'rename')}
                  />
                ) : mode === 'tags' ? (
                  <TagsEditor
                    entry={entry}
                    otherTags={tagsOf((entries ?? []).filter((other) => other.id !== entry.id))}
                    onChange={(tags) => saveTags(entry.id, tags)}
                    onDone={() => closeRow(entry.id, 'tags')}
                  />
                ) : (
                  <>
                    <div className="library-item-info">
                      <span className="library-item-name">{cvDisplayName(entry.name, t.untitled)}</span>
                      <span className="library-item-date">{t.modified(formatDateTime(entry.updatedAt, language))}</span>
                      {entry.tags.length > 0 && <TagChips tags={entry.tags} />}
                    </div>
                    <div className="library-item-actions">
                      <button type="button" data-cv-id={entry.id} data-action="open" onClick={() => open(entry.id)}>
                        {t.open}
                      </button>
                      <button type="button" onClick={() => runAndRefresh(() => window.api.cv.duplicate(entry.id), 'duplicate')}>
                        {t.duplicate}
                      </button>
                      <button type="button" onClick={() => exportFile(entry.id)}>
                        {t.exportFile}
                      </button>
                      <button
                        type="button"
                        data-cv-id={entry.id}
                        data-action="tags"
                        onClick={() => setRowMode({ id: entry.id, kind: 'tags' })}
                      >
                        {t.tags}
                      </button>
                      <button
                        type="button"
                        data-cv-id={entry.id}
                        data-action="rename"
                        onClick={() => setRowMode({ id: entry.id, kind: 'rename' })}
                      >
                        {t.rename}
                      </button>
                      <button type="button" data-cv-id={entry.id} data-action="delete" onClick={askDelete}>
                        {common.delete}
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <AppVersion className="library-version" />
      </main>
    </>
  )
}

// Split button „Nowe CV”: główna część tworzy puste CV, strzałka obok otwiera menu z „Dodaj przykładowe CV”.
// Menu zamyka wybór pozycji, Escape (fokus wraca na strzałkę), kliknięcie poza nim i przejście fokusu poza przycisk.
function NewCvButton({ onCreate, onAddSample }: { onCreate: () => void; onAddSample: () => void }) {
  const [open, setOpen] = useState(false)
  const arrow = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const { library: t } = useDictionary()

  useEffect(() => {
    if (!open) return
    firstItem.current?.focus()
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  const closeAndFocusArrow = () => {
    setOpen(false)
    arrow.current?.focus()
  }
  const closeOnFocusLeave = (event: FocusEvent) => {
    if (!container.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div
      ref={container}
      className="split-button"
      onBlur={closeOnFocusLeave}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          closeAndFocusArrow()
        }
      }}
    >
      <button type="button" className="button-primary split-button-main" data-action="new-cv" onClick={onCreate}>
        {t.newCv}
      </button>
      <button
        ref={arrow}
        type="button"
        className="button-primary split-button-arrow"
        aria-label={t.moreCreateOptions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        ▾
      </button>
      {open && (
        <ul className="split-button-menu" role="menu" aria-label={t.moreCreateOptions}>
          <li role="none">
            <button
              ref={firstItem}
              type="button"
              role="menuitem"
              onClick={() => {
                closeAndFocusArrow()
                onAddSample()
              }}
            >
              {t.addSample}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

// Pasek filtra nad listą: wszystkie istniejące tagi alfabetycznie, wielokrotny wybór (przełączniki) i „Wyczyść”.
function TagFilterBar({
  tags,
  selected,
  onToggle,
  onClear
}: {
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}) {
  const { library } = useDictionary()
  return (
    <div className="tag-filter" role="group" aria-label={library.tagFilter}>
      <span className="tag-filter-label">{library.tagFilter}</span>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag-filter-tag"
          aria-pressed={selected.includes(tag)}
          onClick={() => onToggle(tag)}
        >
          {tag}
        </button>
      ))}
      {selected.length > 0 && (
        <button type="button" className="tag-filter-clear" onClick={onClear}>
          {library.clearTagFilter}
        </button>
      )}
    </div>
  )
}

function RenameForm({ entry, onSubmit, onCancel }: { entry: OkEntry; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(entry.name)
  const { common, library } = useDictionary()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onSubmit(name.trim())
  }

  return (
    <form className="library-item-form" onSubmit={submit}>
      <input
        aria-label={library.name}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      />
      <div className="library-item-actions">
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          {common.save}
        </button>
        <button type="button" onClick={onCancel}>
          {common.cancel}
        </button>
      </div>
    </form>
  )
}

// Tagi CV jako chipy, alfabetycznie. Z `onRemove` każdy chip ma przycisk usunięcia.
function TagChips({ tags, onRemove }: { tags: string[]; onRemove?: (tag: string) => void }) {
  const { library } = useDictionary()
  return (
    <ul className="tag-chips" aria-label={library.tags}>
      {sortTags(tags).map((tag) => (
        <li key={tag} className="tag-chip">
          {tag}
          {onRemove && (
            <button type="button" className="tag-chip-remove" aria-label={library.removeTag(tag)} onClick={() => onRemove(tag)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// Tryb „Tagi” wiersza: dodawanie tagu z klawiatury (Enter) i usuwanie pojedynczych tagów. Każda zmiana zapisuje się od razu.
// Podpowiedzi to tagi innych CV (`otherTags`), których to CV jeszcze nie ma, zawężone do zawierających wpisany tekst.
function TagsEditor({
  entry,
  otherTags,
  onChange,
  onDone
}: {
  entry: OkEntry
  otherTags: string[]
  onChange: (tags: string[]) => Promise<boolean>
  onDone: () => void
}) {
  const [newTag, setNewTag] = useState('')
  const { common, library } = useDictionary()
  const addTag = async (tag: string) => {
    if (await onChange([...entry.tags, tag])) setNewTag('')
  }
  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (newTag.trim()) await addTag(newTag)
  }
  const ownTags = new Set(entry.tags.map(tagKey))
  const typed = tagKey(cleanTag(newTag))
  const suggestions = sortTags([...new Set(otherTags)]).filter((tag) => !ownTags.has(tagKey(tag)) && tagKey(tag).includes(typed))

  return (
    <div className="library-item-form tags-editor" role="group" aria-label={library.tagsOf(cvDisplayName(entry.name, library.untitled))}>
      <div className="tags-editor-content">
        {entry.tags.length > 0 ? (
          <TagChips tags={entry.tags} onRemove={(tag) => void onChange(entry.tags.filter((other) => other !== tag))} />
        ) : (
          <span className="library-item-date">{library.noTags}</span>
        )}
        <form className="tags-editor-add" onSubmit={add}>
          <input
            aria-label={library.newTag}
            placeholder={library.newTag}
            value={newTag}
            autoFocus
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && onDone()}
          />
          <button type="submit" className="button-primary" disabled={!newTag.trim()}>
            {library.addTag}
          </button>
        </form>
        {suggestions.length > 0 && (
          <ul className="tag-chips tag-suggestions" aria-label={library.suggestedTags}>
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="tag-chip tag-suggestion"
                  aria-label={library.addSuggestedTag(tag)}
                  onClick={() => void addTag(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="library-item-actions">
        <button type="button" onClick={onDone}>
          {common.done}
        </button>
      </div>
    </div>
  )
}

function ConfirmDelete({ label, onDelete, onCancel }: { label: string; onDelete: () => void; onCancel: () => void }) {
  const { common } = useDictionary()
  return (
    <div className="library-item-form" role="alertdialog" aria-label={common.confirmDelete}>
      <span>{label}</span>
      <div className="library-item-actions">
        <button type="button" className="danger" onClick={onDelete}>
          {common.delete}
        </button>
        <button type="button" onClick={onCancel} autoFocus>
          {common.cancel}
        </button>
      </div>
    </div>
  )
}

// Wiersz pliku, którego ta wersja aplikacji nie otworzy: uszkodzonego albo zapisanego w nowszej wersji.
function UnreadableRow({ entry, onDelete }: { entry: UnreadableEntry; onDelete: () => void }) {
  const { appName, common, library } = useDictionary()
  return (
    <>
      <div className="library-item-info">
        <span className="library-item-name">{entry.id}.json</span>
        <span className="library-item-damaged">{unreadableTexts(entry, library, appName).note}</span>
      </div>
      <div className="library-item-actions">
        <button type="button" data-cv-id={entry.id} data-action="delete" onClick={onDelete}>
          {common.delete}
        </button>
      </div>
    </>
  )
}

// Tagi wszystkich poprawnych CV (z powtórzeniami); uszkodzone pliki nie mają tagów.
// Teksty wiersza pliku, którego nie da się odczytać: dopisek przy nazwie pliku i pytanie przy usuwaniu – według powodu.
function unreadableTexts(entry: UnreadableEntry, t: Dictionary['library'], appName: string) {
  const fileName = `${entry.id}.json`
  return entry.reason === 'newer-version'
    ? { note: t.newerVersion(appName), confirmDelete: t.confirmDeleteNewer(fileName, appName) }
    : { note: t.damaged, confirmDelete: t.confirmDeleteDamaged(fileName) }
}

const tagsOf = (entries: readonly CvListEntry[]) => entries.flatMap((entry) => (entry.status === 'ok' ? entry.tags : []))

// Powód odrzucenia importu jako tekst; komunikat o za długim tagu podaje limit długości.
const importErrorText = (library: Dictionary['library'], reason: InvalidCvFileReason) => {
  const message = library.importErrors[reason]
  return typeof message === 'function' ? message(MAX_TAG_LENGTH) : message
}

const formatDateTime = (iso: string, language: InterfaceLanguage) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? filePath
