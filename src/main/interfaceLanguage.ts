import { app, BrowserWindow, ipcMain } from 'electron'
import { dictionaryFor, isInterfaceLanguage, resolveInterfaceLanguage, type InterfaceLanguage } from '../shared/i18n/languages'
import type { Dictionary } from '../shared/i18n/en'
import type { SettingsRepository } from './settingsRepository'

export type InterfaceLanguageState = Awaited<ReturnType<typeof createInterfaceLanguage>>

// Proces główny ustala język interfejsu i jest jego właścicielem: buduje w nim menu i powiadamia renderer o zmianie.
// `MOJE_CV_LANGUAGE=<kod języka>` (np. `de`) wymusza język ponad wybór użytkownika i system (dla testów, także w zbudowanej aplikacji).
export async function createInterfaceLanguage(settings: SettingsRepository) {
  const override = isInterfaceLanguage(process.env['MOJE_CV_LANGUAGE']) ? process.env['MOJE_CV_LANGUAGE'] : undefined
  // Uszkodzony plik ustawień nie blokuje startu – wtedy język systemu.
  let preference: InterfaceLanguage | undefined = await settings.get().then(
    (saved) => saved.interfaceLanguage,
    () => undefined
  )
  const listeners = new Set<() => void>()
  const systemLanguages = () => {
    const preferred = app.getPreferredSystemLanguages()
    return preferred.length > 0 ? preferred : [app.getLocale()]
  }
  const current = (): InterfaceLanguage => resolveInterfaceLanguage(override ?? preference, systemLanguages())

  return {
    current,
    dictionary: (): Dictionary => dictionaryFor(current()),
    // Wybór w menu Language; `undefined` = język systemu.
    preference: () => preference,

    // `null` wraca do języka systemu. Zmiana działa od razu – bez restartu – i jest zapamiętywana.
    async choose(language: InterfaceLanguage | null): Promise<void> {
      try {
        await settings.setInterfaceLanguage(language)
        preference = language ?? undefined
      } finally {
        for (const listener of listeners) listener()
        for (const window of BrowserWindow.getAllWindows()) window.webContents.send('language:changed', current())
      }
    },

    // Zwraca funkcję wypisania.
    onChange(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

// Bieżący język interfejsu dla renderera; zmiany dostaje on zdarzeniem `language:changed`.
export function registerInterfaceLanguage(language: InterfaceLanguageState): void {
  ipcMain.handle('language:get', () => language.current())
}
