import { app, ipcMain } from 'electron'

// Numer wersji ma jedno źródło: proces główny i `app.getVersion()` (czyli `version` z package.json), bez stałej
// wstrzykiwanej w buildzie – tak jak `process.mas` w ADR-0005. Renderer niczego nie przekazuje.
export function registerAppInfo(): void {
  ipcMain.handle('app:version', () => app.getVersion())
}
