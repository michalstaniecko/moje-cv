import type { AppScreen } from '../shared/api'

// Weryfikacja argumentów przychodzących przez IPC.
export function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oczekiwano tekstu')
  return value
}

export function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Oczekiwano listy tekstów')
  return value
}

const appScreens: readonly AppScreen[] = ['library', 'clauses', 'editor']

export function requireAppScreen(value: unknown): AppScreen {
  if (!appScreens.includes(value as AppScreen)) throw new Error('Oczekiwano ekranu aplikacji')
  return value as AppScreen
}
