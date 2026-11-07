import type { InvalidCvFileReason, InvalidTagReason } from '../api'
import type { PluralForms } from './plural'

// Odmiana „page” – zmienna z typem, a nie rzutowanie, żeby brak formy `other` był błędem kompilacji.
const pages: PluralForms = { one: (count) => `${count} page`, other: (count) => `${count} pages` }

// Słownik angielski – źródło prawdy: każdy inny język musi spełniać jego typ (ADR-0001).
export const en = {
  appName: 'CV Press',
  menu: {
    about: (appName: string) => `About ${appName}`,
    services: 'Services',
    hide: (appName: string) => `Hide ${appName}`,
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: (appName: string) => `Quit ${appName}`,
    file: 'File',
    newCv: 'New CV',
    addSample: 'Add Sample CV',
    importCv: 'Import…',
    exportJson: 'Export JSON…',
    exportPdf: 'Export to PDF…',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    toggleFullScreen: 'Toggle Full Screen',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    closeWindow: 'Close Window',
    bringAllToFront: 'Bring All to Front',
    // W innych językach dwujęzyczne („Sprache / Language”), żeby dało się wrócić po wybraniu języka,
    // którego się nie czyta; po angielsku samo „Language”.
    language: 'Language',
    systemLanguage: 'System',
    // Wygląd interfejsu (Appearance): jasny, ciemny albo za systemem.
    appearance: 'Appearance',
    lightAppearance: 'Light',
    darkAppearance: 'Dark',
    systemAppearance: 'System',
    // Menu Pomoc (role help). Pozycja „supportApp” to Sponsor link – tylko poza Mac App Store.
    help: 'Help',
    helpPage: (appName: string) => `${appName} Help`,
    privacyPolicy: 'Privacy Policy',
    reportIssue: 'Report a Problem…',
    supportApp: (appName: string) => `Support ${appName}…`,
    checkForUpdates: 'Check for Updates…'
  },
  // Tytuły i filtry systemowych okien plików (przyciski w nich są w języku systemu).
  dialogs: {
    exportPdf: 'Export to PDF',
    pdfFilter: 'PDF',
    choosePhoto: 'Choose Photo',
    imagesFilter: 'Images',
    exportCv: 'Export CV to File',
    importCv: 'Import CV from File',
    cvFilter: 'CV (JSON)',
    // Natywne pytanie przy zamykaniu okna lub aplikacji, gdy edytor CV nie zdołał zapisać zmian.
    unsavedChanges: {
      message: 'Your changes to the CV weren’t saved.',
      closeDetail: 'If you close the window now, your latest changes will be lost.',
      quitDetail: (appName: string) =>
        `If you quit ${appName} now, your latest changes will be lost.`,
      closeAnyway: 'Close Anyway',
      quitAnyway: 'Quit Anyway',
      backToEditor: 'Back to Editor'
    }
  },
  common: {
    back: '← CV library',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Confirm deletion',
    done: 'Done'
  },
  library: {
    clauses: 'Consent clauses',
    importFile: 'Import from file',
    newCv: 'New CV',
    // Strzałka obok „New CV” i jedyna pozycja jej menu.
    moreCreateOptions: 'More ways to create',
    addSample: 'Add sample CV',
    empty: 'You don’t have any CVs yet. Click “New CV”.',
    list: 'CV list',
    modified: (date: string) => `Modified ${date}`,
    open: 'Open',
    duplicate: 'Duplicate',
    exportFile: 'Export to file',
    rename: 'Rename',
    name: 'CV name',
    // Tagi CV (zob. GLOSSARY.md) – tryb „Tags” w wierszu listy.
    tags: 'Tags',
    tagsOf: (name: string) => `Tags of “${name}”`,
    noTags: 'No tags yet.',
    newTag: 'New tag',
    addTag: 'Add',
    removeTag: (tag: string) => `Remove tag “${tag}”`,
    // Pasek filtra nad listą CV: lista pokazuje tylko CV mające wszystkie zaznaczone tagi.
    tagFilter: 'Filter by tag',
    clearTagFilter: 'Clear',
    noFilterMatches: 'No CV has all of these tags.',
    // Podpowiedzi z tagów innych CV w bibliotece.
    suggestedTags: 'Suggested tags',
    addSuggestedTag: (tag: string) => `Add tag “${tag}”`,
    // Dlaczego tag został odrzucony – pokazywane po „Couldn’t change the tags.”.
    tagErrors: {
      'too-long': (maxTagLength: number) => `A tag can have at most ${maxTagLength} characters.`
    } satisfies Record<InvalidTagReason, (maxTagLength: number) => string>,
    // Nazwa wyświetlana zamiast pustej nazwy CV (np. z importowanego pliku); nie trafia do CV.
    untitled: 'Untitled CV',
    confirmDelete: (name: string) => `Delete “${name}”? This can’t be undone.`,
    confirmDeleteDamaged: (fileName: string) => `Delete the damaged file “${fileName}”? This can’t be undone.`,
    damaged: 'Damaged file – it can’t be opened',
    // Plik CV zapisany w nowszej wersji aplikacji: poprawny, ale ta wersja go nie zna.
    newerVersion: (appName: string) => `Needs a newer version of ${appName}`,
    confirmDeleteNewer: (fileName: string, appName: string) =>
      `Delete the file “${fileName}”? It is a CV from a newer version of ${appName} and will be lost. This can’t be undone.`,
    loading: 'Loading…',
    imported: (name: string) => `Imported “${name}”.`,
    savedFile: (fileName: string) => `Saved file: ${fileName}`,
    // Dlaczego importowany plik został odrzucony – pokazywane po „Couldn’t import the CV.”.
    importErrors: {
      'too-large': 'The file is too large to be a CV file.',
      'not-json': 'The file isn’t a valid CV file (invalid JSON format).',
      'not-a-cv': 'The file doesn’t contain a valid CV.',
      'newer-version': 'The file comes from a newer version of the app. Update the app to import it.',
      'tag-too-long': (maxTagLength: number) => `The CV in the file has a tag longer than ${maxTagLength} characters.`
    } satisfies Record<InvalidCvFileReason, string | ((maxTagLength: number) => string)>,
    errors: {
      load: 'Couldn’t load the CV list.',
      open: 'Couldn’t open the CV.',
      create: 'Couldn’t create the CV.',
      duplicate: 'Couldn’t duplicate the CV.',
      rename: 'Couldn’t rename the CV.',
      tags: 'Couldn’t change the tags.',
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
  },
  editor: {
    saveStatus: { idle: '', pending: 'Saving…', saved: 'Changes saved', failed: 'Couldn’t save changes' },
    exportPdf: 'Export to PDF',
    exporting: 'Exporting…',
    savedPdf: (fileName: string) => `Saved PDF: ${fileName}`,
    openPdf: 'Open',
    showInFolder: 'Show in Finder',
    exportFailed: 'Couldn’t save the PDF. Try again.',
    exportCutOff: 'Some content doesn’t fit on a page and will be cut off. Export anyway?',
    exportCutOffHint: 'The fragments that are too long are highlighted in the preview.',
    exportAnyway: 'Export anyway',
    preparingPdf: 'Preparing the PDF…',
    exportTimedOut: 'Preparing the PDF took too long and was stopped. Try again.',
    dismissNotice: 'Dismiss message',
    saveFailed: 'Couldn’t save changes. Your latest edits are only in this window for now.',
    retrySave: 'Try again',
    leaveUnsaved: 'Your changes weren’t saved. Leave anyway?',
    leaveAnyway: 'Leave anyway',
    stayInEditor: 'Stay in the editor',
    renameCv: (name: string) => `Rename CV: ${name}`,
    removed: 'Removed.',
    undoRemoval: 'Undo',
    remove: 'Remove',
    cvDesign: 'CV design',
    accentColor: 'Accent color',
    font: 'Font',
    // CV language (zob. GLOSSARY.md): język stałego tekstu na dokumencie, np. „present”.
    cvLanguage: 'CV language',
    template: 'Template',
    templateNames: { classic: 'Classic', modern: 'Modern', bold: 'Bold' },
    header: 'Header',
    fullName: 'Full name',
    contact: 'Contact',
    contactLabel: (number: number) => `Contact label ${number}`,
    contactLabelPlaceholder: 'Label',
    contactValue: (number: number) => `Contact value ${number}`,
    contactValuePlaceholder: 'Value',
    removeContact: (number: number) => `Remove contact ${number}`,
    addContact: 'Add contact',
    summary: 'Summary',
    // Nazwa sekcji bez tytułu – według jej typu.
    sectionTypes: { experience: 'Work experience', education: 'Education', list: 'List' },
    sectionTitle: (name: string) => `Section title “${name}”`,
    hideSection: 'Hide section',
    pageBreakBeforeSection: 'New page before this section',
    pageBreakBeforeEntry: 'New page before this entry',
    newPosition: 'New position',
    addPosition: 'Add position',
    removePosition: 'Remove position',
    role: 'Job title',
    company: 'Company',
    location: 'City',
    from: 'From',
    to: 'To',
    currentlyWorkHere: 'I currently work here',
    bullets: 'Bullet points',
    bullet: (number: number) => `Bullet ${number}`,
    removeBullet: (number: number) => `Remove bullet ${number}`,
    addBullet: 'Add bullet',
    newEducation: 'New education',
    addEducation: 'Add education',
    removeEducation: 'Remove education',
    level: 'Level',
    levelPlaceholder: 'e.g. Master’s degree',
    field: 'Field of study',
    fieldPlaceholder: 'e.g. Logistics',
    institution: 'School',
    institutionPlaceholder: 'e.g. University of Economics',
    startOptional: 'From (optional)',
    graduation: 'Graduation date',
    endBeforeStart: 'The end date is earlier than the start date.',
    listItem: (number: number) => `Item ${number}`,
    removeListItem: (number: number) => `Remove item ${number}`,
    addListItem: 'Add item',
    // Elementy list z ręczną kolejnością w etykietach przycisków (np. „Move section “Languages” up”).
    order: {
      moveUp: (item: string) => `Move ${item} up`,
      moveDown: (item: string) => `Move ${item} down`,
      drag: (item: string) => `Drag ${item} to reorder`,
      section: (name: string) => `section “${name}”`,
      position: (name: string) => `position “${name}”`,
      education: (name: string) => `entry “${name}”`,
      bullet: (number: number) => `bullet ${number}`,
      listItem: (number: number) => `item ${number}`
    },
    consent: {
      title: 'Consent clause',
      show: 'Show the clause at the bottom of the last page',
      fromLibrary: 'Clause from the library',
      deleted: 'Clause deleted from the library',
      choose: 'Choose a clause…',
      emptyLibrary: 'The library is empty',
      text: 'Text in this CV',
      modified: 'The text differs from the library version.',
      restore: 'Restore from library',
      saveAsNew: 'Save as new clause',
      newName: 'New clause name',
      newNamePlaceholder: 'Name, e.g. Talent Partners',
      saveFailed: 'Couldn’t save the clause.'
    },
    photo: {
      legend: 'Photo',
      thumbnail: 'Photo in the CV',
      change: 'Change photo',
      choose: 'Choose photo',
      remove: 'Remove photo',
      errors: {
        unsupported: 'Couldn’t load the photo – choose a JPEG, PNG or WebP file.',
        'too-large': 'Couldn’t load the photo – the file is too large (max. 30 MB).',
        undecodable: 'Couldn’t load the photo – the file is damaged, unavailable or in an unsupported format.'
      },
      crop: 'Crop photo',
      cropHint: 'Drag the photo or use the arrow keys to set the frame.',
      cropPreview: 'Frame preview',
      zoom: 'Zoom',
      apply: 'Apply'
    }
  },
  preview: {
    pages,
    lengthNotice: (pages: string) => `The CV is longer than ${pages} – consider shortening it.`,
    // Tylko w podglądzie – nigdy nie trafia do PDF.
    oversized: 'This fragment is too long to fit on a page – shorten it',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fit: 'Fit'
  },
  // Sponsor bar i okno „Więcej” (zob. GLOSSARY.md). Podziękowanie, nie płatność: niczego nie odblokowuje.
  sponsor: {
    bar: (appName: string) => `Support ${appName}`,
    message: (appName: string) => `${appName} is free. If it helped you, you can thank the author with a coffee.`,
    link: 'Buy me a coffee',
    more: 'More',
    dialogTitle: (appName: string) => `Why ${appName} is free`,
    paragraphs: (appName: string) => [
      `${appName} is free and will stay free: no ads, no account, no paid features.`,
      'It is built by one person in their spare time.',
      'If a CV made here helped you get a job, or you simply find the app useful, you can say thanks by buying a coffee through GitHub Sponsors.',
      'This is a thank-you only. It unlocks nothing: the app works exactly the same either way.'
    ],
    close: 'Close'
  },
  // Update notice i dialogi „Check for Updates…” – tylko w `.dmg` (ADR-0006). Aplikacja tylko informuje o nowej
  // wersji; pobranie i podmiana aplikacji należą do użytkownika.
  updates: {
    noticeLabel: 'New version',
    available: (appName: string, version: string) => `A new version of ${appName} is available: ${version}.`,
    availableDetail: (current: string) => `You have version ${current}. Download the new version and replace the app in your Applications folder.`,
    download: 'Download',
    dismiss: 'Close',
    later: 'Later',
    upToDate: (appName: string, version: string) => `You have the latest version of ${appName} (${version}).`,
    failed: 'Couldn’t check for updates.',
    failedDetail: 'Check your internet connection or see the latest version on the releases page.',
    openReleases: 'Open Releases Page',
    ok: 'OK'
  },
  // Obsługa awarii: ekran błędu renderowania i natywne okna procesu głównego. Nie obiecują, że zachowana jest
  // każda zmiana (autozapis ma opóźnienie), tylko że zapisane CV są bezpieczne.
  crash: {
    title: 'Something went wrong',
    message: 'Your CVs are safe – changes are saved automatically. Reload the app to continue.',
    reload: 'Reload',
    repeated: {
      message: (appName: string) => `The ${appName} window stopped working several times in a row.`,
      detail: 'Your saved CVs are safe. You can reload the window or quit the app.'
    },
    unexpected: {
      title: 'An unexpected error occurred',
      message: (appName: string) =>
        `${appName} ran into a problem. Your saved CVs are safe. If something doesn’t work as expected, quit the app and open it again.`
    }
  },
  // Treść domyślna: powstaje w języku interfejsu z chwili utworzenia, potem jest zwykłą treścią CV (zob. GLOSSARY.md).
  defaultContent: {
    cvName: 'New CV',
    copyName: (name: string) => `${name} (copy)`,
    // Etykiety kontaktu w nowym CV i podpowiedzi w edytorze.
    contactLabels: ['Phone', 'Email', 'LinkedIn', 'City'],
    sectionTitles: { experience: 'Work experience', education: 'Education', skills: 'Skills', languages: 'Languages' }
  },
  // Stały tekst na dokumencie CV: pochodzi z CV language (zob. GLOSSARY.md), nie z języka interfejsu.
  cvText: {
    // Koniec trwającego zakresu dat, np. „03.2021 – present”.
    present: 'present'
  }
}

export type Dictionary = typeof en
export type DefaultContent = Dictionary['defaultContent']
