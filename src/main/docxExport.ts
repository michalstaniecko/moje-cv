import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { cvDocumentSchema } from '../renderer/src/domain/schema'
import type { ExportDocxResult } from '../shared/api'
import { buildDocx } from './docx/docxDocument'
import { docxFonts } from './docx/docxFonts'
import { exportFileName } from './exportFileName'
import type { ExportedFiles } from './exportedFiles'
import type { InterfaceLanguageState } from './interfaceLanguage'

// DOCX export (zob. GLOSSARY.md, ADR-0008): walidacja CV, budowa pliku z osadzonymi fontami CV, natywne okno zapisu
// i zapis. Zapisany plik trafia na białą listę, z której powiadomienie może go otworzyć albo pokazać w Finderze.
// Anulowanie niczego nie zapisuje.
export function registerDocxExport(language: InterfaceLanguageState, exportedFiles: ExportedFiles): void {
  ipcMain.handle('docx:export', async (event, input: unknown): Promise<ExportDocxResult> => {
    const document = cvDocumentSchema.parse(input)
    const docx = await buildDocx(document, await docxFonts())
    const fileName = exportFileName({
      fullName: document.header.fullName,
      cvName: document.name,
      language: document.settings.language,
      extension: 'docx'
    })

    const owner = BrowserWindow.fromWebContents(event.sender)
    const { dialogs } = language.dictionary()
    const options = {
      title: dialogs.exportDocx,
      defaultPath: join(app.getPath('documents'), fileName),
      filters: [{ name: dialogs.docxFilter, extensions: ['docx'] }]
    }
    const { canceled, filePath } = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return { status: 'canceled' }

    await writeFile(filePath, docx)
    exportedFiles.remember(filePath)
    return { status: 'saved', filePath }
  })
}
