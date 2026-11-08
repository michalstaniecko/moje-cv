import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { PDFDocument } from 'pdf-lib'
import { cvDocumentSchema, type CvDocument } from '../renderer/src/domain/schema'
import type { ExportPdfResult } from '../shared/api'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { exportFileName } from './exportFileName'
import { loadRenderer, secureWebPreferences } from './windows'

// Limit oczekiwania na gotowość strony wydruku. `MOJE_CV_PRINT_TIMEOUT_MS` skraca go w testach e2e.
const PRINT_READY_TIMEOUT_MS = printReadyTimeout(process.env['MOJE_CV_PRINT_TIMEOUT_MS'])

function printReadyTimeout(override: string | undefined): number {
  const value = Number(override)
  return override && Number.isFinite(value) && value > 0 ? value : 30_000
}

// Strona wydruku nie zgłosiła gotowości w czasie – renderer pokazuje osobny komunikat zamiast ogólnego błędu.
class PrintTimeoutError extends Error {
  constructor() {
    super('The print page did not report ready in time')
    this.name = 'PrintTimeoutError'
  }
}

// Dokumenty czekające na wydruk, według id webContents ukrytego okna.
const printJobs = new Map<number, { document: CvDocument; ready: () => void }>()
// Ścieżki zapisanych PDF-ów – tylko je renderer może potem otworzyć lub pokazać w Finderze.
const exportedPaths = new Set<string>()

export function registerPdfExport(language: InterfaceLanguageState): void {
  ipcMain.handle('pdf:export', async (event, input: unknown): Promise<ExportPdfResult> => {
    const document = cvDocumentSchema.parse(input)
    let rendered: Uint8Array
    try {
      rendered = await renderPdf(document)
    } catch (error) {
      if (error instanceof PrintTimeoutError) return { status: 'timed-out' }
      throw error
    }
    const pdf = await withMetadata(rendered, document.header.fullName)
    const fileName = exportFileName({
      fullName: document.header.fullName,
      cvName: document.name,
      language: document.settings.language,
      extension: 'pdf'
    })

    const owner = BrowserWindow.fromWebContents(event.sender)
    const { dialogs } = language.dictionary()
    const options = {
      title: dialogs.exportPdf,
      defaultPath: join(app.getPath('documents'), fileName),
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
      const timeout = setTimeout(() => reject(new PrintTimeoutError()), PRINT_READY_TIMEOUT_MS)
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
  document.setCreator('CV Drawer')
  return document.save()
}
