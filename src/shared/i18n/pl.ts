import type { Dictionary } from './en'

export const pl: Dictionary = {
  appName: 'Moje CV',
  menu: {
    about: (appName) => `O aplikacji ${appName}`,
    hide: (appName) => `Ukryj ${appName}`,
    hideOthers: 'Ukryj pozostałe',
    showAll: 'Pokaż wszystkie',
    quit: (appName) => `Zakończ ${appName}`,
    edit: 'Edycja',
    undo: 'Cofnij',
    redo: 'Ponów',
    cut: 'Wytnij',
    copy: 'Kopiuj',
    paste: 'Wklej',
    selectAll: 'Zaznacz wszystko',
    window: 'Okno',
    minimize: 'Minimalizuj',
    zoom: 'Zoom',
    closeWindow: 'Zamknij okno',
    language: 'Language / Język',
    systemLanguage: 'System'
  },
  dialogs: {
    exportPdf: 'Eksportuj do PDF',
    pdfFilter: 'PDF',
    choosePhoto: 'Wybierz zdjęcie',
    imagesFilter: 'Obrazy',
    exportCv: 'Eksportuj CV do pliku',
    importCv: 'Importuj CV z pliku',
    cvFilter: 'CV (JSON)'
  },
  common: {
    back: (appName) => `← ${appName}`,
    save: 'Zapisz',
    cancel: 'Anuluj',
    delete: 'Usuń',
    confirmDelete: 'Potwierdź usunięcie'
  },
  library: {
    clauses: 'Klauzule zgody',
    importFile: 'Importuj z pliku',
    newCv: 'Nowe CV',
    empty: 'Nie masz jeszcze żadnego CV. Kliknij „Nowe CV”.',
    list: 'Lista CV',
    modified: (date) => `Zmieniono ${date}`,
    open: 'Otwórz',
    duplicate: 'Duplikuj',
    exportFile: 'Eksportuj do pliku',
    rename: 'Zmień nazwę',
    name: 'Nazwa CV',
    confirmDelete: (name) => `Usunąć „${name}”? Tej operacji nie można cofnąć.`,
    confirmDeleteDamaged: (fileName) => `Usunąć uszkodzony plik „${fileName}”? Tej operacji nie można cofnąć.`,
    damaged: 'Plik uszkodzony – nie można go otworzyć',
    imported: (name) => `Zaimportowano „${name}”.`,
    savedFile: (fileName) => `Zapisano plik: ${fileName}`,
    errors: {
      load: 'Nie udało się wczytać listy CV.',
      open: 'Nie udało się otworzyć CV.',
      create: 'Nie udało się utworzyć CV.',
      duplicate: 'Nie udało się zduplikować CV.',
      rename: 'Nie udało się zmienić nazwy.',
      delete: 'Nie udało się usunąć CV.',
      export: 'Nie udało się wyeksportować CV.',
      import: 'Nie udało się zaimportować CV.'
    }
  },
  clauses: {
    title: 'Klauzule zgody',
    add: 'Dodaj klauzulę',
    hint: 'Klauzula domyślna trafia do każdego nowego CV. Zmiany w bibliotece nie zmieniają klauzul w istniejących CV.',
    empty: 'Biblioteka jest pusta. Kliknij „Dodaj klauzulę”.',
    list: 'Lista klauzul',
    isDefault: '(domyślna)',
    edit: 'Edytuj',
    setDefault: 'Ustaw jako domyślną',
    unsetDefault: 'Usuń oznaczenie domyślnej',
    confirmDelete: (name) => `Usunąć klauzulę „${name}”? CV, które jej używają, zachowają swoją kopię treści.`,
    form: 'Klauzula',
    name: 'Nazwa',
    namePlaceholder: 'np. Talent Partners',
    text: 'Treść',
    untitled: 'Bez nazwy',
    errors: {
      load: 'Nie udało się wczytać biblioteki klauzul.',
      add: 'Nie udało się dodać klauzuli.',
      save: 'Nie udało się zapisać klauzuli.',
      delete: 'Nie udało się usunąć klauzuli.',
      setDefault: 'Nie udało się zmienić klauzuli domyślnej.'
    }
  }
}
