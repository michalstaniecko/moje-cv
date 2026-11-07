import { app, ipcMain } from 'electron'

// Informacje o aplikacji i przeładowanie okna. Numer wersji ma jedno źródło: proces główny i `app.getVersion()` (czyli `version` z package.json), bez stałej
// wstrzykiwanej w buildzie – tak jak `process.mas` w ADR-0005. Renderer niczego nie przekazuje.
export function registerAppInfo(): void {
  ipcMain.handle('app:version', () => app.getVersion())
  // Przeładowanie okna, które o nie prosi (ekran błędu „Wczytaj ponownie”). Treść sama nie może nawigować
  // (`lockNavigation`), więc przeładowuje proces główny.
  ipcMain.handle('app:reload', (event) => event.sender.reload())
}
