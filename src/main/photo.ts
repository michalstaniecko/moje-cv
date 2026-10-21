import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { PickPhotoResult } from '../shared/api'

// Formaty, które Chromium potrafi zdekodować (HEIC nie jest obsługiwany, więc nie ma go w oknie wyboru).
const PHOTO_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}
// Oryginał trafia do renderera tylko na czas kadrowania – limit chroni przed wczytaniem ogromnego pliku.
const MAX_PHOTO_FILE_BYTES = 30 * 1024 * 1024

// Wybór zdjęcia z dysku w systemowym oknie. Renderer dostaje oryginał jako data URL i sam go kadruje.
export function registerPhotoPicker(): void {
  ipcMain.handle('photo:pick', async (event): Promise<PickPhotoResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Wybierz zdjęcie',
      properties: ['openFile'],
      filters: [{ name: 'Obrazy', extensions: Object.keys(PHOTO_TYPES) }]
    }
    const { canceled, filePaths } = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    const [filePath] = filePaths
    if (canceled || !filePath) return { status: 'canceled' }

    const type = PHOTO_TYPES[extname(filePath).slice(1).toLowerCase()]
    if (!type) return { status: 'unsupported' }
    if ((await stat(filePath)).size > MAX_PHOTO_FILE_BYTES) return { status: 'too-large' }
    const content = await readFile(filePath)
    return { status: 'picked', dataUrl: `data:${type};base64,${content.toString('base64')}` }
  })
}
