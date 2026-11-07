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

// Polecenie z menu Plik wysyłane do okna; wykonuje je zamontowany ekran (biblioteka CV albo edytor).
export type MenuCommand = 'new-cv' | 'add-sample' | 'import' | 'export-json' | 'export-pdf'

// Bieżący ekran okna zgłaszany procesowi głównemu: od niego zależy aktywność pozycji menu Plik i Cofnij / Ponów.
export type AppScreen = 'library' | 'clauses' | 'editor'

// Pozycja na liście CV. Uszkodzony plik (niepoprawny JSON lub niezgodny ze schematem) jest widoczny, ale nie da się go otworzyć.
// Dlaczego pliku CV nie da się otworzyć: uszkodzony (niepoprawny JSON, niezgodność ze schematem) albo zapisany
// w nowszej wersji aplikacji (poprawny, ale ta wersja go nie zna). Renderer pokazuje kod w języku interfejsu.
export type UnreadableCvReason = 'damaged' | 'newer-version'

export type CvListEntry =
  | { status: 'ok'; id: string; name: string; updatedAt: string; tags: string[] }
  | { status: 'damaged'; id: string; reason: UnreadableCvReason }

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
  // Otwarty edytor CV dostaje Cofnij / Ponów kliknięte w menu Edycja (gdy okno zgłosiło ekran `editor`).
  editor: {
    // Zwraca funkcję wypisania.
    onHistoryCommand: (listener: (command: HistoryCommand) => void) => () => void
  }
  // Renderer zgłasza bieżący ekran okna (od niego zależy aktywność menu Plik i Cofnij / Ponów) i dostaje
  // komendy menu Plik. Poza zgłoszeniem ekranu nic nie wraca do procesu głównego.
  menu: {
    setScreen: (screen: AppScreen) => void
    // Zwraca funkcję wypisania.
    onCommand: (listener: (command: MenuCommand) => void) => () => void
  }
  // Sponsor bar: proces główny mówi, czy belkę pokazać (nie w Mac App Store), i sam otwiera jedyny znany adres
  // Sponsor linku w systemowej przeglądarce – renderer nie przekazuje żadnego URL-a.
  sponsor: {
    isAvailable: () => Promise<boolean>
    open: () => Promise<void>
  }
  // Update notice (ADR-0006): wersję do pokazania zna proces główny (w Mac App Store zawsze `null`); on też buduje
  // adres strony wydania i zapamiętuje zamknięcie. Renderer nie przekazuje ani URL-a, ani numeru wersji.
  updates: {
    notice: () => Promise<string | null>
    // Zwraca funkcję wypisania.
    onNotice: (listener: (version: string) => void) => () => void
    download: () => Promise<void>
    dismiss: () => Promise<void>
  }
  // Używane wyłącznie przez ukryte okno wydruku.
  print: {
    getDocument: () => Promise<CvDocument>
    ready: () => void
  }
}
