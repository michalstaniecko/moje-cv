import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron'
import type { ExportExtension } from './exportFileName'
import type { ExportedFiles } from './exportedFiles'

export type SaveExportedFileResult = { status: 'canceled' } | { status: 'saved'; filePath: string }

// Wspólny koniec eksportu PDF i DOCX: natywne okno zapisu (nad oknem, z którego przyszło żądanie) z domyślną nazwą
// w Dokumentach, zapis i dopisanie pliku do białej listy, z której powiadomienie może go otworzyć albo pokazać
// w Finderze. Anulowanie niczego nie zapisuje.
export async function saveExportedFile({
  event,
  data,
  fileName,
  extension,
  title,
  filterName,
  exportedFiles
}: {
  event: IpcMainInvokeEvent
  data: Uint8Array
  fileName: string
  extension: ExportExtension
  title: string
  filterName: string
  exportedFiles: ExportedFiles
}): Promise<SaveExportedFileResult> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title,
    defaultPath: join(app.getPath('documents'), fileName),
    filters: [{ name: filterName, extensions: [extension] }]
  }
  const { canceled, filePath } = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return { status: 'canceled' }

  await writeFile(filePath, data)
  exportedFiles.remember(filePath)
  return { status: 'saved', filePath }
}
