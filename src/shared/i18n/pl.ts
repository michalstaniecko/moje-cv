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
  }
}
