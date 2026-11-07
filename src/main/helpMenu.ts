import type { MenuItemConstructorOptions } from 'electron'
import type { Dictionary } from '../shared/i18n/en'
import { HELP_URL, PRIVACY_URL, REPORT_ISSUE_URL, SPONSOR_URL } from '../shared/links'

// Pozycje menu Pomoc. Bez importu `electron` w czasie wykonania, więc oba kanały da się sprawdzić w vitest.
// Każda pozycja otwiera w przeglądarce (`open`, w aplikacji `shell.openExternal`) jedną stałą z `src/shared/links.ts`
// – bez IPC. Część po separatorze istnieje tylko poza Mac App Store (ADR-0005: link do płatności poza sklepem łamie
// wytyczną 3.1.1); w MAS znika razem z separatorem, żeby menu nie kończyło się separatorem. Do tej części dochodzą
// kolejne pozycje tylko dla `.dmg` (sprawdzanie aktualizacji, #78).
export function helpMenuItems({
  dictionary,
  macAppStore,
  open
}: {
  dictionary: Dictionary
  macAppStore: boolean
  open: (url: string) => void
}): MenuItemConstructorOptions[] {
  const { appName, menu } = dictionary
  const link = (label: string, url: string): MenuItemConstructorOptions => ({ label, click: () => open(url) })
  const outsideMacAppStore: MenuItemConstructorOptions[] = [link(menu.supportApp(appName), SPONSOR_URL)]
  return [
    link(menu.helpPage(appName), HELP_URL),
    link(menu.privacyPolicy, PRIVACY_URL),
    link(menu.reportIssue, REPORT_ISSUE_URL),
    ...(macAppStore ? [] : [{ type: 'separator' } as const, ...outsideMacAppStore])
  ]
}
