import { shell } from 'electron'

// Otwiera adres w systemowej przeglądarce. Wywołujący przekazuje wyłącznie stałe z `src/shared/links.ts` (albo adres
// z nich zbudowany). Błąd jest tylko logowany: obietnica się nie odrzuca, więc nie trafi do okna błędu procesu głównego.
export function openExternal(url: string): Promise<void> {
  return shell.openExternal(url).catch((error: unknown) => console.error('Failed to open the address', url, error))
}
