// Słownik angielski – źródło prawdy: każdy inny język musi spełniać jego typ (ADR-0001).
export const en = {
  appName: 'Moje CV',
  menu: {
    about: (appName: string) => `About ${appName}`,
    hide: (appName: string) => `Hide ${appName}`,
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: (appName: string) => `Quit ${appName}`,
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    closeWindow: 'Close Window',
    // Dwujęzyczne, żeby dało się wrócić po wybraniu języka, którego się nie czyta.
    language: 'Language / Język',
    systemLanguage: 'System'
  }
}

export type Dictionary = typeof en
