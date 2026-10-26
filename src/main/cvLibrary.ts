import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { cvDocumentSchema } from '../renderer/src/domain/schema'
import type { ExportCvFileResult, ImportCvFileResult, SetCvTagsResult } from '../shared/api'
import { InvalidCvFileError, InvalidTagError, type CvRepository } from './cvRepository'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { requireString, requireStringArray } from './ipcArgs'
import type { SettingsRepository } from './settingsRepository'

// CV ze zdjęciem to kilkaset kB – limit chroni przed wczytaniem ogromnego pliku wybranego przez pomyłkę.
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024

// „CV – Talent Partners” → „CV – Talent Partners.json” (bez znaków niedozwolonych w nazwach plików).
// CV bez nazwy dostaje nazwę `untitled` w języku interfejsu.
export function cvFileName(name: string, untitled: string): string {
  const safe = (text: string) => text.replace(/[/\\:*?"<>|\p{Cc}]/gu, '-').trim().replace(/^\.+/, '')
  return `${safe(name) || safe(untitled)}.json`
}

// Operacje biblioteki CV dostępne dla renderera. Argumenty z IPC są weryfikowane przed użyciem.
export function registerCvLibrary(
  repository: CvRepository,
  settings: SettingsRepository,
  language: InterfaceLanguageState
): void {
  const jsonFilters = () => [{ name: language.dictionary().dialogs.cvFilter, extensions: ['json'] }]

  // Autozapis wysłany przy zamykaniu okna musi trafić na dysk, zanim aplikacja się zakończy.
  const pendingUpdates = new Set<Promise<void>>()
  app.on('will-quit', (event) => {
    if (pendingUpdates.size === 0) return
    event.preventDefault()
    void Promise.allSettled(pendingUpdates).then(() => app.quit())
  })

  ipcMain.handle('cv:list', () => repository.list())
  ipcMain.handle('cv:get', (_event, id: unknown) => repository.get(requireString(id)))
  // Treść domyślna nowego CV i kopii powstaje w bieżącym języku interfejsu.
  const defaultContent = () => language.dictionary().defaultContent
  ipcMain.handle('cv:create', async () => repository.create(defaultContent(), await settings.defaultClause()))
  ipcMain.handle('cv:duplicate', (_event, id: unknown) => repository.duplicate(requireString(id), defaultContent()))
  ipcMain.handle('cv:rename', (_event, id: unknown, name: unknown) => repository.rename(requireString(id), requireString(name)))
  ipcMain.handle('cv:set-tags', async (_event, id: unknown, tags: unknown): Promise<SetCvTagsResult> => {
    try {
      return { status: 'saved', document: await repository.setTags(requireString(id), requireStringArray(tags)) }
    } catch (error) {
      if (error instanceof InvalidTagError) return { status: 'invalid', reason: error.reason }
      throw error
    }
  })
  ipcMain.handle('cv:update', (_event, document: unknown) => {
    const update = repository.update(cvDocumentSchema.parse(document))
    pendingUpdates.add(update)
    void update.catch(() => undefined).finally(() => pendingUpdates.delete(update))
    return update
  })
  ipcMain.handle('cv:delete', (_event, id: unknown) => repository.delete(requireString(id)))

  ipcMain.handle('cv:export-file', async (event, id: unknown): Promise<ExportCvFileResult> => {
    const { name, content } = await repository.exportJson(requireString(id))
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: language.dictionary().dialogs.exportCv,
      defaultPath: join(app.getPath('documents'), cvFileName(name, language.dictionary().library.untitled)),
      filters: jsonFilters()
    }
    const { canceled, filePath } = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return { status: 'canceled' }
    await writeFile(filePath, content)
    return { status: 'saved', filePath }
  })

  ipcMain.handle('cv:import-file', async (event): Promise<ImportCvFileResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: language.dictionary().dialogs.importCv,
      properties: ['openFile'],
      filters: jsonFilters()
    }
    const { canceled, filePaths } = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    const [filePath] = filePaths
    if (canceled || !filePath) return { status: 'canceled' }

    if ((await stat(filePath)).size > MAX_IMPORT_FILE_BYTES) {
      return { status: 'invalid', reason: 'too-large' }
    }
    try {
      return { status: 'imported', document: await repository.importJson(await readFile(filePath, 'utf8')) }
    } catch (error) {
      if (error instanceof InvalidCvFileError) return { status: 'invalid', reason: error.reason }
      throw error
    }
  })
}
