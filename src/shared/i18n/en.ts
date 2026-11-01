import type { InvalidCvFileReason, InvalidTagReason } from '../api'
import type { PluralForms } from './plural'

// Odmiana „page” – zmienna z typem, a nie rzutowanie, żeby brak formy `other` był błędem kompilacji.
const pages: PluralForms = { one: (count) => `${count} page`, other: (count) => `${count} pages` }

// Słownik angielski – źródło prawdy: każdy inny język musi spełniać jego typ (ADR-0001).
export const en = {
  appName: 'CV Press',
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
    systemLanguage: 'System',
    // Wygląd interfejsu (Appearance): jasny, ciemny albo za systemem.
    appearance: 'Appearance',
    lightAppearance: 'Light',
    darkAppearance: 'Dark',
    systemAppearance: 'System'
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
    confirmDelete: 'Confirm deletion',
    done: 'Done'
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
    remove: 'Remove',
    appearance: 'Appearance',
    accentColor: 'Accent color',
    font: 'Font',
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
    present: 'present',
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
      cropHint: 'Drag the photo to set the frame.',
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
  // Treść domyślna: powstaje w języku interfejsu z chwili utworzenia, potem jest zwykłą treścią CV (zob. GLOSSARY.md).
  defaultContent: {
    cvName: 'New CV',
    copyName: (name: string) => `${name} (copy)`,
    // Etykiety kontaktu w nowym CV i podpowiedzi w edytorze.
    contactLabels: ['Phone', 'Email', 'LinkedIn', 'City'],
    sectionTitles: { experience: 'Work experience', education: 'Education', skills: 'Skills', languages: 'Languages' }
  }
}

export type Dictionary = typeof en
export type DefaultContent = Dictionary['defaultContent']
