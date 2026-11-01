import { ipcMain, shell } from 'electron'
import { SPONSOR_URL } from '../shared/sponsor'

// Sponsor bar: jedyna zewnętrzna strona, jaką aplikacja otwiera. W buildzie Mac App Store belka jest ukryta,
// o czym decyduje tutaj `process.mas` – renderer dostaje tylko wartość logiczną (ADR-0005).
export function registerSponsor(): void {
  ipcMain.handle('sponsor:is-available', () => !process.mas)
  ipcMain.handle('sponsor:open', () => shell.openExternal(SPONSOR_URL))
}
