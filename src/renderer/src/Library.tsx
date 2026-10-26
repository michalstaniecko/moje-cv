import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CvListEntry, InvalidCvFileReason } from '../../shared/api'
import type { Dictionary } from '../../shared/i18n/en'
import type { InterfaceLanguage } from '../../shared/i18n/languages'
import { cvDisplayName, type CvDocument } from './domain/schema'
import { cleanTag, MAX_TAG_LENGTH, sortTags, tagKey } from './domain/tags'
import { useDictionary, useInterfaceLanguage } from './i18n'

type OkEntry = Extract<CvListEntry, { status: 'ok' }>
type DamagedEntry = Extract<CvListEntry, { status: 'damaged' }>

// Tryb pojedynczego wiersza: zwykły, zmiana nazwy, edycja tagów albo potwierdzenie usunięcia.
type RowMode = { id: string; kind: 'rename' | 'tags' | 'confirm-delete' } | null

// Komunikat tłumaczony przy wyświetlaniu, więc zmiana języka obejmuje także widoczny już komunikat.
type Message = (dictionary: Dictionary) => string
type Failure = keyof Dictionary['library']['errors']
const failureMessage =
  (failure: Failure): Message =>
  ({ library }) =>
    library.errors[failure]

// Ekran startowy: lista CV z akcjami Nowe / Importuj / Otwórz / Duplikuj / Eksportuj / Tagi / Zmień nazwę / Usuń i wejście do biblioteki klauzul.
export function Library({
  tagFilter,
  onTagFilterChange,
  onOpen,
  onOpenClauses
}: {
  // Zaznaczone tagi filtra; lista pokazuje tylko CV mające wszystkie z nich.
  tagFilter: string[]
  onTagFilterChange: (tags: string[]) => void
  onOpen: (document: CvDocument) => void
  onOpenClauses: () => void
}) {
  const [entries, setEntries] = useState<CvListEntry[] | null>(null)
  const [rowMode, setRowMode] = useState<RowMode>(null)
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
  // Przy aktywnym filtrze uszkodzone pliki są ukryte – nie mają tagów.
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

  // Wykonuje operację, odświeża listę i zamyka edycję wiersza; błąd pokazuje jako komunikat.
  const runAndRefresh = async (action: () => Promise<unknown>, failure: Failure) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      setRowMode(null)
      await refresh()
    } catch {
      showError(failureMessage(failure))
    }
  }

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
        <button type="button" onClick={() => runAndRefresh(() => window.api.cv.create().then(() => onTagFilterChange([])), 'create')}>
          {t.newCv}
        </button>
      </header>
      <main className="library">
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
        {entries?.length === 0 && <p className="library-empty">{t.empty}</p>}
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
                      entry.status === 'ok' ? t.confirmDelete(cvDisplayName(entry.name, t.untitled)) : t.confirmDeleteDamaged(`${entry.id}.json`)
                    }
                    onDelete={() => runAndRefresh(() => window.api.cv.delete(entry.id), 'delete')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : entry.status === 'damaged' ? (
                  <DamagedRow entry={entry} onDelete={askDelete} />
                ) : mode === 'rename' ? (
                  <RenameForm
                    entry={entry}
                    onSubmit={(name) => runAndRefresh(() => window.api.cv.rename(entry.id, name), 'rename')}
                    onCancel={() => setRowMode(null)}
                  />
                ) : mode === 'tags' ? (
                  <TagsEditor
                    entry={entry}
                    otherTags={tagsOf((entries ?? []).filter((other) => other.id !== entry.id))}
                    onChange={(tags) => saveTags(entry.id, tags)}
                    onDone={() => setRowMode(null)}
                  />
                ) : (
                  <>
                    <div className="library-item-info">
                      <span className="library-item-name">{cvDisplayName(entry.name, t.untitled)}</span>
                      <span className="library-item-date">{t.modified(formatDateTime(entry.updatedAt, language))}</span>
                      {entry.tags.length > 0 && <TagChips tags={entry.tags} />}
                    </div>
                    <div className="library-item-actions">
                      <button type="button" onClick={() => open(entry.id)}>
                        {t.open}
                      </button>
                      <button type="button" onClick={() => runAndRefresh(() => window.api.cv.duplicate(entry.id), 'duplicate')}>
                        {t.duplicate}
                      </button>
                      <button type="button" onClick={() => exportFile(entry.id)}>
                        {t.exportFile}
                      </button>
                      <button type="button" onClick={() => setRowMode({ id: entry.id, kind: 'tags' })}>
                        {t.tags}
                      </button>
                      <button type="button" onClick={() => setRowMode({ id: entry.id, kind: 'rename' })}>
                        {t.rename}
                      </button>
                      <button type="button" onClick={askDelete}>
                        {common.delete}
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </>
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
        <button type="submit" disabled={!name.trim()}>
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
          <button type="submit" disabled={!newTag.trim()}>
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

function DamagedRow({ entry, onDelete }: { entry: DamagedEntry; onDelete: () => void }) {
  const { common, library } = useDictionary()
  return (
    <>
      <div className="library-item-info">
        <span className="library-item-name">{entry.id}.json</span>
        <span className="library-item-damaged">{library.damaged}</span>
      </div>
      <div className="library-item-actions">
        <button type="button" onClick={onDelete}>
          {common.delete}
        </button>
      </div>
    </>
  )
}

// Tagi wszystkich poprawnych CV (z powtórzeniami); uszkodzone pliki nie mają tagów.
const tagsOf = (entries: readonly CvListEntry[]) => entries.flatMap((entry) => (entry.status === 'ok' ? entry.tags : []))

// Powód odrzucenia importu jako tekst; komunikat o za długim tagu podaje limit długości.
const importErrorText = (library: Dictionary['library'], reason: InvalidCvFileReason) => {
  const message = library.importErrors[reason]
  return typeof message === 'function' ? message(MAX_TAG_LENGTH) : message
}

const formatDateTime = (iso: string, language: InterfaceLanguage) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? filePath
