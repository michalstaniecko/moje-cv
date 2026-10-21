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
  },
  // Tytuły i filtry systemowych okien plików (przyciski w nich są w języku systemu).
  dialogs: {
    exportPdf: 'Export to PDF',
    pdfFilter: 'PDF',
    choosePhoto: 'Choose Photo',
    imagesFilter: 'Images',
    exportCv: 'Export CV to File',
    importCv: 'Import CV from File',
    cvFilter: 'CV (JSON)'
  }
}

export type Dictionary = typeof en
