import type { CvDocument } from '../renderer/src/domain/schema'

// Kontrakt API wystawianego przez preload (window.api) – wspólny dla procesu głównego i renderera.
export type ExportPdfResult = { status: 'saved'; filePath: string } | { status: 'canceled' }

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
  }
  pdf: {
    export: (document: CvDocument) => Promise<ExportPdfResult>
    open: (filePath: string) => Promise<void>
    showInFolder: (filePath: string) => Promise<void>
  }
  // Używane wyłącznie przez ukryte okno wydruku.
  print: {
    getDocument: () => Promise<CvDocument>
    ready: () => void
  }
}
