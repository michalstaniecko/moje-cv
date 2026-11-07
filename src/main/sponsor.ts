import { ipcMain, shell } from 'electron'
import { SPONSOR_URL } from '../shared/sponsor'
import { isMacAppStore } from './channel'

// Sponsor bar. Aplikacja otwiera wyłącznie stałe adresy z `src/shared/sponsor.ts` i `src/shared/links.ts`, zawsze
// z procesu głównego. W buildzie Mac App Store belka jest ukryta, o czym decyduje `isMacAppStore()` – renderer
// dostaje tylko wartość logiczną (ADR-0005).
export function registerSponsor(): void {
  ipcMain.handle('sponsor:is-available', () => !isMacAppStore())
  ipcMain.handle('sponsor:open', () => shell.openExternal(SPONSOR_URL))
}
