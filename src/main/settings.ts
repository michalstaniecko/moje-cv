import { ipcMain } from 'electron'
import { clauseContentSchema, editorSidebarSchema, formWidthSchema } from '../renderer/src/domain/schema'
import { requireString } from './ipcArgs'
import type { SettingsRepository } from './settingsRepository'

// Biblioteka klauzul zgody i szerokość formularza i pasek boczny w edytorze dostępne dla renderera. Argumenty z IPC są weryfikowane przed użyciem.
export function registerSettings(settings: SettingsRepository): void {
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:add-clause', (_event, content: unknown) => settings.addClause(clauseContentSchema.parse(content)))
  ipcMain.handle('settings:update-clause', (_event, id: unknown, content: unknown) =>
    settings.updateClause(requireString(id), clauseContentSchema.parse(content))
  )
  ipcMain.handle('settings:delete-clause', (_event, id: unknown) => settings.deleteClause(requireString(id)))
  ipcMain.handle('settings:set-default-clause', (_event, id: unknown) =>
    settings.setDefaultClause(id === null ? null : requireString(id))
  )
  ipcMain.handle('settings:set-form-width', (_event, width: unknown) => settings.setFormWidth(formWidthSchema.parse(width)))
  ipcMain.handle('settings:set-editor-sidebar', (_event, sidebar: unknown) =>
    settings.setEditorSidebar(editorSidebarSchema.parse(sidebar))
  )
}
