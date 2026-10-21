// Weryfikacja argumentów przychodzących przez IPC.
export function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oczekiwano tekstu')
  return value
}
