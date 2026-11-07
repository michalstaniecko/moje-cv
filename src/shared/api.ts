import type { AppSettings, Clause, ClauseContent, CvDocument } from '../renderer/src/domain/schema'
import type { InterfaceLanguage } from './i18n/languages'

// Kontrakt API wystawianego przez preload (window.api) – wspólny dla procesu głównego i renderera.
export type ExportPdfResult = { status: 'saved'; filePath: string } | { status: 'canceled' }

// Wynik wyboru zdjęcia z dysku: oryginał pliku jako data URL (przed kadrowaniem).
export type PickPhotoResult =
  | { status: 'picked'; dataUrl: string }
  | { status: 'canceled' }
  | { status: 'unsupported' }
  | { status: 'too-large' }

// Wynik eksportu CV do pliku .json.
export type ExportCvFileResult = { status: 'saved'; filePath: string } | { status: 'canceled' }

// Powód odrzucenia importowanego pliku. Renderer pokazuje go w języku interfejsu.
export type InvalidCvFileReason = 'too-large' | 'not-json' | 'not-a-cv' | 'newer-version' | 'tag-too-long'

// Wynik importu CV z pliku .json. Niepoprawny plik niczego nie zmienia w bibliotece.
export type ImportCvFileResult =
  | { status: 'imported'; document: CvDocument }
  | { status: 'canceled' }
  | { status: 'invalid'; reason: InvalidCvFileReason }

// Powód odrzucenia tagu CV. Renderer pokazuje go w języku interfejsu.
export type InvalidTagReason = 'too-long'

// Wynik ustawienia tagów CV. Odrzucone tagi niczego nie zmieniają.
export type SetCvTagsResult = { status: 'saved'; document: CvDocument } | { status: 'invalid'; reason: InvalidTagReason }

// Polecenie historii CV wysyłane z menu Edycja do otwartego edytora.
export type HistoryCommand = 'undo' | 'redo'

// Pozycja na liście CV. Uszkodzony plik (niepoprawny JSON lub niezgodny ze schematem) jest widoczny, ale nie da się go otworzyć.
export type CvListEntry =
  | { status: 'ok'; id: string; name: string; updatedAt: string; tags: string[] }
  | { status: 'damaged'; id: string }

export type Api = {
  // Informacje o aplikacji z procesu głównego – jedyne źródło numeru wersji (`app.getVersion()`).
  app: {
    version: () => Promise<string>
  }
  cv: {
    list: () => Promise<CvListEntry[]>
    get: (id: string) => Promise<CvDocument>
    create: () => Promise<CvDocument>
    // Dodaje Sample CV w bieżącym języku interfejsu jako nowe CV (zob. GLOSSARY.md).
    addSample: () => Promise<CvDocument>
    duplicate: (id: string) => Promise<CvDocument>
    rename: (id: string, name: string) => Promise<CvDocument>
    // Zastępuje tagi CV; repozytorium je normalizuje. Nie zmienia daty ostatniej zmiany.
    setTags: (id: string, tags: string[]) => Promise<SetCvTagsResult>
    update: (document: CvDocument) => Promise<void>
    delete: (id: string) => Promise<void>
    exportFile: (id: string) => Promise<ExportCvFileResult>
    importFile: () => Promise<ImportCvFileResult>
  }
  // Ustawienia globalne: biblioteka klauzul zgody.
  settings: {
    get: () => Promise<AppSettings>
    addClause: (content: ClauseContent) => Promise<Clause>
    updateClause: (id: string, content: ClauseContent) => Promise<AppSettings>
    deleteClause: (id: string) => Promise<AppSettings>
    setDefaultClause: (id: string | null) => Promise<AppSettings>
  }
  photo: {
    pick: () => Promise<PickPhotoResult>
  }
  pdf: {
    export: (document: CvDocument) => Promise<ExportPdfResult>
    open: (filePath: string) => Promise<void>
    showInFolder: (filePath: string) => Promise<void>
  }
  // Język interfejsu ustala proces główny; renderer tylko go wyświetla i dostaje jego zmiany.
  language: {
    get: () => Promise<InterfaceLanguage>
    // Zwraca funkcję wypisania.
    onChange: (listener: (language: InterfaceLanguage) => void) => () => void
  }
  // Edytor CV zgłasza, że jest otwarty, i dostaje Cofnij / Ponów kliknięte w menu Edycja.
  editor: {
    setActive: (active: boolean) => void
    // Zwraca funkcję wypisania.
    onHistoryCommand: (listener: (command: HistoryCommand) => void) => () => void
  }
  // Sponsor bar: proces główny mówi, czy belkę pokazać (nie w Mac App Store), i sam otwiera jedyny znany adres
  // Sponsor linku w systemowej przeglądarce – renderer nie przekazuje żadnego URL-a.
  sponsor: {
    isAvailable: () => Promise<boolean>
    open: () => Promise<void>
  }
  // Używane wyłącznie przez ukryte okno wydruku.
  print: {
    getDocument: () => Promise<CvDocument>
    ready: () => void
  }
}
