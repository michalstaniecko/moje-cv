import { ipcMain } from 'electron'
import type { CvRepository } from './cvRepository'

// Operacje biblioteki CV dostępne dla renderera. Argumenty z IPC są weryfikowane przed użyciem.
export function registerCvLibrary(repository: CvRepository): void {
  ipcMain.handle('cv:list', () => repository.list())
  ipcMain.handle('cv:get', (_event, id: unknown) => repository.get(requireString(id)))
  ipcMain.handle('cv:create', () => repository.create())
  ipcMain.handle('cv:duplicate', (_event, id: unknown) => repository.duplicate(requireString(id)))
  ipcMain.handle('cv:rename', (_event, id: unknown, name: unknown) => repository.rename(requireString(id), requireString(name)))
  ipcMain.handle('cv:delete', (_event, id: unknown) => repository.delete(requireString(id)))
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oczekiwano tekstu')
  return value
}
