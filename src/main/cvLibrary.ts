import { app, ipcMain } from 'electron'
import { cvDocumentSchema } from '../renderer/src/domain/schema'
import type { CvRepository } from './cvRepository'

// Operacje biblioteki CV dostępne dla renderera. Argumenty z IPC są weryfikowane przed użyciem.
export function registerCvLibrary(repository: CvRepository): void {
  // Autozapis wysłany przy zamykaniu okna musi trafić na dysk, zanim aplikacja się zakończy.
  const pendingUpdates = new Set<Promise<void>>()
  app.on('will-quit', (event) => {
    if (pendingUpdates.size === 0) return
    event.preventDefault()
    void Promise.allSettled(pendingUpdates).then(() => app.quit())
  })

  ipcMain.handle('cv:list', () => repository.list())
  ipcMain.handle('cv:get', (_event, id: unknown) => repository.get(requireString(id)))
  ipcMain.handle('cv:create', () => repository.create())
  ipcMain.handle('cv:duplicate', (_event, id: unknown) => repository.duplicate(requireString(id)))
  ipcMain.handle('cv:rename', (_event, id: unknown, name: unknown) => repository.rename(requireString(id), requireString(name)))
  ipcMain.handle('cv:update', (_event, document: unknown) => {
    const update = repository.update(cvDocumentSchema.parse(document))
    pendingUpdates.add(update)
    void update.catch(() => undefined).finally(() => pendingUpdates.delete(update))
    return update
  })
  ipcMain.handle('cv:delete', (_event, id: unknown) => repository.delete(requireString(id)))
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oczekiwano tekstu')
  return value
}
