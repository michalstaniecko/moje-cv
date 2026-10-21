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
  },
  common: {
    back: (appName: string) => `← ${appName}`,
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Confirm deletion'
  },
  library: {
    clauses: 'Consent clauses',
    importFile: 'Import from file',
    newCv: 'New CV',
    empty: 'You don’t have any CVs yet. Click “New CV”.',
    list: 'CV list',
    modified: (date: string) => `Modified ${date}`,
    open: 'Open',
    duplicate: 'Duplicate',
    exportFile: 'Export to file',
    rename: 'Rename',
    name: 'CV name',
    confirmDelete: (name: string) => `Delete “${name}”? This can’t be undone.`,
    confirmDeleteDamaged: (fileName: string) => `Delete the damaged file “${fileName}”? This can’t be undone.`,
    damaged: 'Damaged file – it can’t be opened',
    imported: (name: string) => `Imported “${name}”.`,
    savedFile: (fileName: string) => `Saved file: ${fileName}`,
    errors: {
      load: 'Couldn’t load the CV list.',
      open: 'Couldn’t open the CV.',
      create: 'Couldn’t create the CV.',
      duplicate: 'Couldn’t duplicate the CV.',
      rename: 'Couldn’t rename the CV.',
      delete: 'Couldn’t delete the CV.',
      export: 'Couldn’t export the CV.',
      import: 'Couldn’t import the CV.'
    }
  },
  clauses: {
    title: 'Consent clauses',
    add: 'Add clause',
    hint: 'The default clause is added to every new CV. Changes in the library don’t change clauses in existing CVs.',
    empty: 'The library is empty. Click “Add clause”.',
    list: 'Clause list',
    isDefault: '(default)',
    edit: 'Edit',
    setDefault: 'Set as default',
    unsetDefault: 'Remove default',
    confirmDelete: (name: string) => `Delete the clause “${name}”? CVs that use it keep their own copy of the text.`,
    form: 'Clause',
    name: 'Name',
    namePlaceholder: 'e.g. Talent Partners',
    text: 'Text',
    untitled: 'Untitled',
    errors: {
      load: 'Couldn’t load the clause library.',
      add: 'Couldn’t add the clause.',
      save: 'Couldn’t save the clause.',
      delete: 'Couldn’t delete the clause.',
      setDefault: 'Couldn’t change the default clause.'
    }
  }
}

export type Dictionary = typeof en
