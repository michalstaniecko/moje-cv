import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { PDFDocument } from 'pdf-lib'
import { cvDocumentSchema, type CvDocument } from '../renderer/src/domain/schema'
import type { ExportPdfResult } from '../shared/api'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { loadRenderer, secureWebPreferences } from './windows'

const PRINT_READY_TIMEOUT_MS = 30_000

// Dokumenty czekające na wydruk, według id webContents ukrytego okna.
const printJobs = new Map<number, { document: CvDocument; ready: () => void }>()
// Ścieżki zapisanych PDF-ów – tylko je renderer może potem otworzyć lub pokazać w Finderze.
const exportedPaths = new Set<string>()

// „Anna Przykładowa” → „CV_Anna_Przykladowa.pdf” (bez polskich znaków i spacji).
export function pdfFileName(fullName: string): string {
  const ascii = fullName
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const parts = ascii.split(/\s+/).map((part) => part.replace(/[^A-Za-z0-9-]/g, '')).filter(Boolean)
  return ['CV', ...parts].join('_') + '.pdf'
}

export function registerPdfExport(language: InterfaceLanguageState): void {
  ipcMain.handle('pdf:export', async (event, input: unknown): Promise<ExportPdfResult> => {
    const document = cvDocumentSchema.parse(input)
    const pdf = await withMetadata(await renderPdf(document), document.header.fullName)

    const owner = BrowserWindow.fromWebContents(event.sender)
    const { dialogs } = language.dictionary()
    const options = {
      title: dialogs.exportPdf,
      defaultPath: join(app.getPath('documents'), pdfFileName(document.header.fullName)),
      filters: [{ name: dialogs.pdfFilter, extensions: ['pdf'] }]
    }
    const { canceled, filePath } = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return { status: 'canceled' }

    await writeFile(filePath, pdf)
    exportedPaths.add(filePath)
    return { status: 'saved', filePath }
  })

  ipcMain.handle('pdf:open', async (_event, filePath: string) => {
    if (exportedPaths.has(filePath)) await shell.openPath(filePath)
  })
  ipcMain.handle('pdf:show-in-folder', (_event, filePath: string) => {
    if (exportedPaths.has(filePath)) shell.showItemInFolder(filePath)
  })

  ipcMain.handle('print:document', (event) => printJob(event).document)
  ipcMain.on('print:ready', (event) => printJobs.get(event.sender.id)?.ready())
}

function printJob(event: IpcMainInvokeEvent) {
  const job = printJobs.get(event.sender.id)
  if (!job) throw new Error('No print document for this window')
  return job
}

// Renderuje same strony CV w ukrytym oknie (skala 1:1) i drukuje je do PDF, gdy strona zgłosi gotowość.
async function renderPdf(document: CvDocument): Promise<Uint8Array> {
  const window = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { ...secureWebPreferences, backgroundThrottling: false }
  })
  const id = window.webContents.id
  try {
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The print page did not report ready')), PRINT_READY_TIMEOUT_MS)
      printJobs.set(id, {
        document,
        ready: () => {
          clearTimeout(timeout)
          resolve()
        }
      })
      // Awaria renderera okna wydruku kończy eksport od razu (renderer pokazuje zwykły komunikat o nieudanym eksporcie).
      window.webContents.once('render-process-gone', (_event, details) => {
        clearTimeout(timeout)
        reject(new Error(`The print window renderer process is gone (${details.reason})`))
      })
    })
    // Gdy ładowanie też się nie uda, jego błąd wygrywa, a odrzucenie gotowości nie może zostać nieobsłużone.
    ready.catch(() => {})
    await loadRenderer(window, '/print')
    await ready
    return await window.webContents.printToPDF({
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
      preferCSSPageSize: true
    })
  } finally {
    printJobs.delete(id)
    window.destroy()
  }
}

async function withMetadata(pdf: Uint8Array, fullName: string): Promise<Uint8Array> {
  const document = await PDFDocument.load(pdf)
  document.setTitle(fullName ? `CV – ${fullName}` : 'CV', { showInWindowTitleBar: true })
  document.setAuthor(fullName)
  document.setCreator('CV Press')
  return document.save()
}
