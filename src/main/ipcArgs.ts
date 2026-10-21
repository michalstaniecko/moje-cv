// Weryfikacja argumentów przychodzących przez IPC.
export function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oczekiwano tekstu')
  return value
}

export function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Oczekiwano wartości logicznej')
  return value
}
