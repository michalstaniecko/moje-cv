import { BrowserWindow, nativeTheme } from 'electron'
import {
  darkWindowBackground,
  isAppearance,
  lightWindowBackground,
  resolveAppearance,
  type Appearance,
  type ResolvedAppearance
} from '../shared/appearance'
import type { SettingsRepository } from './settingsRepository'

export type AppearanceState = Awaited<ReturnType<typeof createAppearance>>

// Proces główny jest właścicielem wyglądu interfejsu (Appearance), na wzór języka interfejsu: czyta preferencję
// z ustawień i stosuje ją przez `nativeTheme.themeSource`. Electron sam przełącza `prefers-color-scheme` w rendererze,
// więc renderer nie dostaje IPC ani stanu (ADR-0004). `MOJE_CV_APPEARANCE=light|dark` wymusza wygląd ponad wybór
// użytkownika i system (dla testów); niepoprawna wartość jest ignorowana.
export async function createAppearance(settings: SettingsRepository) {
  const override = isAppearance(process.env['MOJE_CV_APPEARANCE']) ? process.env['MOJE_CV_APPEARANCE'] : undefined
  // Uszkodzony plik ustawień nie blokuje startu – wtedy Systemowy.
  let preference: Appearance | undefined = await settings.get().then(
    (saved) => saved.appearance,
    () => undefined
  )
  const listeners = new Set<() => void>()
  const current = (): ResolvedAppearance => resolveAppearance(override, preference)
  const apply = () => {
    nativeTheme.themeSource = current()
  }
  apply()

  // Tło okien podąża za efektywnym wyglądem (także przy Systemowy, gdy zmienia się system).
  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(windowBackground())
  })

  return {
    current,
    // Wybór w menu Wygląd / Appearance; `undefined` = Systemowy.
    preference: () => preference,

    // `null` wraca do Systemowy. Zmiana działa od razu – bez restartu – i jest zapamiętywana. Błąd zapisu jest
    // logowany, a wybór i tak zastosowany (inaczej niż przy języku: wygląd nie zależy od pliku ustawień).
    async choose(appearance: Appearance | null): Promise<void> {
      preference = appearance ?? undefined
      apply()
      for (const listener of listeners) listener()
      try {
        await settings.setAppearance(appearance)
      } catch (error) {
        console.error('Nie udało się zapisać wyglądu interfejsu', error)
      }
    },

    // Zwraca funkcję wypisania.
    onChange(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

// Kolor tła okna równy tłu aplikacji w efektywnym wyglądzie, żeby okno nie błyskało inną barwą.
export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? darkWindowBackground : lightWindowBackground
}
