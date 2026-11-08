import type { IpcMain, Shell } from 'electron'
import { requireString } from './ipcArgs'

// Biała lista plików zapisanych przez eksport (PDF, DOCX). Renderer może otworzyć albo pokazać w Finderze tylko
// ścieżkę, którą proces główny sam zapisał – każda inna jest po cichu odrzucana. Bez importu `electron` w czasie
// wykonania, więc regułę da się sprawdzić w vitest.
export type ExportedFiles = {
  remember: (filePath: string) => void
  open: (filePath: string) => Promise<void>
  showInFolder: (filePath: string) => void
}

export function createExportedFiles(shell: Pick<Shell, 'openPath' | 'showItemInFolder'>): ExportedFiles {
  const paths = new Set<string>()
  return {
    remember: (filePath) => {
      paths.add(filePath)
    },
    open: async (filePath) => {
      if (paths.has(filePath)) await shell.openPath(filePath)
    },
    showInFolder: (filePath) => {
      if (paths.has(filePath)) shell.showItemInFolder(filePath)
    }
  }
}

export function registerExportedFiles(ipc: Pick<IpcMain, 'handle'>, files: ExportedFiles): void {
  ipc.handle('exported:open', (_event, filePath: unknown) => files.open(requireString(filePath)))
  ipc.handle('exported:show-in-folder', (_event, filePath: unknown) => files.showInFolder(requireString(filePath)))
}
