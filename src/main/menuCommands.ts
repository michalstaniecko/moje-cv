import type { AppScreen, MenuCommand } from '../shared/api'

const createCommands: MenuCommand[] = ['new-cv', 'add-sample', 'import']
const exportCommands: MenuCommand[] = ['export-json', 'export-pdf']

// Aktywne komendy menu Plik na danym ekranie okna. Tworzenie i import działają w bibliotece CV i w edytorze (który
// najpierw wraca do biblioteki), eksport tylko w edytorze (w bibliotece żadne CV nie jest zaznaczone). W bibliotece
// klauzul nic, bo formularze klauzul nie mają autozapisu i skrót porzuciłby wpisany tekst. Bez okna – nic.
export function enabledMenuCommands(screen: AppScreen | undefined): ReadonlySet<MenuCommand> {
  switch (screen) {
    case 'library':
      return new Set(createCommands)
    case 'editor':
      return new Set([...createCommands, ...exportCommands])
    default:
      return new Set()
  }
}
