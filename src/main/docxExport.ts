import { ipcMain } from 'electron'
import { cvDocumentSchema } from '../renderer/src/domain/schema'
import type { ExportDocxResult } from '../shared/api'
import { buildDocx } from './docx/docxDocument'
import { docxFonts } from './docx/docxFonts'
import { exportFileName } from './exportFileName'
import type { ExportedFiles } from './exportedFiles'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { saveExportedFile } from './saveExportedFile'

// DOCX export (zob. GLOSSARY.md, ADR-0008): walidacja CV, budowa pliku z osadzonymi fontami CV, natywne okno zapisu
// i zapis (`saveExportedFile`, wspólne z eksportem PDF).
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

    const { dialogs } = language.dictionary()
    return saveExportedFile({
      event,
      data: docx,
      fileName,
      extension: 'docx',
      title: dialogs.exportDocx,
      filterName: dialogs.docxFilter,
      exportedFiles
    })
  })
}
