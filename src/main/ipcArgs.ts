import { appScreens, type AppScreen } from '../shared/api'

// Weryfikacja argumentów przychodzących przez IPC.
export function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

export function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean')
  return value
}

export function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Expected an array of strings')
  return value
}

export function requireAppScreen(value: unknown): AppScreen {
  if (!(appScreens as readonly unknown[]).includes(value)) throw new Error('Expected an app screen')
  return value as AppScreen
}
