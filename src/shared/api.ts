import type { AppSettings, Clause, ClauseContent, CvDocument } from '../renderer/src/domain/schema'

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

// Wynik importu CV z pliku .json. Niepoprawny plik niczego nie zmienia w bibliotece – `message` jest gotowy do pokazania.
export type ImportCvFileResult =
  | { status: 'imported'; document: CvDocument }
  | { status: 'canceled' }
  | { status: 'invalid'; message: string }

// Polecenie historii CV wysyłane z menu Edycja do otwartego edytora.
export type HistoryCommand = 'undo' | 'redo'

// Pozycja na liście CV. Uszkodzony plik (niepoprawny JSON lub niezgodny ze schematem) jest widoczny, ale nie da się go otworzyć.
export type CvListEntry =
  | { status: 'ok'; id: string; name: string; updatedAt: string }
  | { status: 'damaged'; id: string }

export type Api = {
  cv: {
    list: () => Promise<CvListEntry[]>
    get: (id: string) => Promise<CvDocument>
    create: () => Promise<CvDocument>
    duplicate: (id: string) => Promise<CvDocument>
    rename: (id: string, name: string) => Promise<CvDocument>
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
  // Edytor CV zgłasza, że jest otwarty, i dostaje Cofnij / Ponów kliknięte w menu Edycja.
  editor: {
    setActive: (active: boolean) => void
    // Zwraca funkcję wypisania.
    onHistoryCommand: (listener: (command: HistoryCommand) => void) => () => void
  }
  // Używane wyłącznie przez ukryte okno wydruku.
  print: {
    getDocument: () => Promise<CvDocument>
    ready: () => void
  }
}
