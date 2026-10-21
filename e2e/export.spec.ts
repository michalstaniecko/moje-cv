import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

// Ścieżka do pliku wykonywalnego zbudowanej aplikacji (np. z `pnpm test:e2e:packaged`); bez niej testy uruchamiają kod z `out/`.
const packagedExecutable = process.env['MOJE_CV_APP']

// Uruchamia aplikację na tymczasowym katalogu danych testu, żeby nie dotykać danych użytkownika.
// Język interfejsu jest wymuszony (`MOJE_CV_LANGUAGE`, domyślnie angielski), żeby testy nie zależały od języka systemu;
// `language: null` uruchamia aplikację bez wymuszenia (wybór z menu Language / Język, a bez niego system).
async function launch({ language = 'en' }: { language?: InterfaceLanguage | null } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { ...process.env } as Record<string, string>
  if (language) env['MOJE_CV_LANGUAGE'] = language
  else delete env['MOJE_CV_LANGUAGE']
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env }
      : { args: ['.', userDataDir], env }
  )
  window = await app.firstWindow()
}

// Każdy test startuje z pustym katalogiem danych (pierwsze uruchomienie).
test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  await launch()
})

test.afterEach(async () => {
  await app.close()
  await rm(outputDir, { recursive: true, force: true })
})

// Podmienia systemowe okno zapisu: zwraca podaną ścieżkę i zapamiętuje opcje, z którymi je otwarto.
async function stubSaveDialog(filePath: string) {
  await app.evaluate(({ dialog }, filePath) => {
    const calls: Electron.SaveDialogOptions[] = []
    ;(globalThis as { saveDialogCalls?: typeof calls }).saveDialogCalls = calls
    const stub = async (...args: unknown[]) => {
      calls.push(args.at(-1) as Electron.SaveDialogOptions)
      return { canceled: false, filePath }
    }
    dialog.showSaveDialog = stub as typeof dialog.showSaveDialog
  }, filePath)
}

// Podmienia systemowe okno wyboru pliku: zwraca podany plik (albo anulowanie) i zapamiętuje opcje, z którymi je otwarto.
async function stubOpenDialog(filePath: string | null) {
  await app.evaluate(({ dialog }, filePath) => {
    const calls: Electron.OpenDialogOptions[] = []
    ;(globalThis as { openDialogCalls?: typeof calls }).openDialogCalls = calls
    const stub = async (...args: unknown[]) => {
      calls.push(args.at(-1) as Electron.OpenDialogOptions)
      return filePath ? { canceled: false, filePaths: [filePath] } : { canceled: true, filePaths: [] }
    }
    dialog.showOpenDialog = stub as typeof dialog.showOpenDialog
  }, filePath)
}

// Otwiera pierwsze CV z biblioteki (przy pierwszym uruchomieniu – przykładowe CV).
async function openFirstCv() {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
}

// Klika pozycję menu aplikacji (np. Edycja → Cofnij) tak jak użytkownik: z widocznym oknem aplikacji jako oknem z fokusem.
// Natywnego menu Playwright nie kliknie, więc pozycja jest wywoływana w procesie głównym. Pozycje z rolą edycji
// (Wytnij, Kopiuj, Wklej, Zaznacz wszystko) macOS obsługuje natywnie, a `click()` z JS ich nie wykonuje – wtedy
// rola trafia do treści okna, tak jak przy prawdziwym kliknięciu.
async function clickMenuItem(menuLabel: string, itemLabel: string) {
  await app.evaluate(
    ({ BrowserWindow, Menu }, { menuLabel, itemLabel }) => {
      const menu = Menu.getApplicationMenu()?.items.find((item) => item.label === menuLabel)
      const item = menu?.submenu?.items.find((item) => item.label === itemLabel)
      if (!item) throw new Error(`Brak pozycji menu ${menuLabel} → ${itemLabel}`)
      const window = BrowserWindow.getAllWindows().find((window) => window.isVisible())
      const editRoles = ['cut', 'copy', 'paste', 'selectall'] as const
      const role = editRoles.find((role) => role === item.role?.toLowerCase())
      if (role && window) window.webContents[role === 'selectall' ? 'selectAll' : role]()
      else item.click(undefined, window, window?.webContents)
    },
    { menuLabel, itemLabel }
  )
}

// Etykiety menu aplikacji: górny poziom i pozycje wskazanego podmenu (zaznaczone radio z dopiskiem „✓”).
async function menuLabels(menuLabel: string) {
  return app.evaluate(({ Menu }, menuLabel) => {
    const items = Menu.getApplicationMenu()?.items ?? []
    const submenu = items.find((item) => item.label === menuLabel)?.submenu?.items ?? []
    return {
      top: items.map((item) => item.label),
      items: submenu.filter((item) => item.type !== 'separator').map((item) => item.label + (item.checked ? ' ✓' : ''))
    }
  }, menuLabel)
}

// Język systemu widziany przez aplikację, żeby wybór „System” dawał przewidywalny wynik.
async function stubSystemLanguages(languages: string[]) {
  await app.evaluate(({ app }, languages) => {
    app.getPreferredSystemLanguages = () => languages
  }, languages)
}

test('the whole menu and the document follow the interface language forced for the session', async () => {
  for (const language of ['en', 'pl'] satisfies InterfaceLanguage[]) {
    await app.close()
    await launch({ language })
    await expect(window.locator('html')).toHaveAttribute('lang', language)
    await expect.poll(() => window.title()).toBe('Moje CV')
  }

  await app.close()
  await launch({ language: 'en' })
  expect((await menuLabels('Edit')).top).toEqual(['Moje CV', 'Edit', 'Language / Język', 'Window'])
  expect((await menuLabels('Moje CV')).items).toEqual(['About Moje CV', 'Hide Moje CV', 'Hide Others', 'Show All', 'Quit Moje CV'])
  expect((await menuLabels('Edit')).items).toEqual(['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select All'])
  expect((await menuLabels('Window')).items).toEqual(['Minimize', 'Zoom', 'Close Window'])
  expect((await menuLabels('Language / Język')).items).toEqual(['English', 'Polski', 'System ✓'])

  await app.close()
  await launch({ language: 'pl' })
  expect((await menuLabels('Edycja')).top).toEqual(['Moje CV', 'Edycja', 'Language / Język', 'Okno'])
  expect((await menuLabels('Moje CV')).items).toEqual([
    'O aplikacji Moje CV',
    'Ukryj Moje CV',
    'Ukryj pozostałe',
    'Pokaż wszystkie',
    'Zakończ Moje CV'
  ])
  expect((await menuLabels('Edycja')).items).toEqual(['Cofnij', 'Ponów', 'Wytnij', 'Kopiuj', 'Wklej', 'Zaznacz wszystko'])
  expect((await menuLabels('Okno')).items).toEqual(['Minimalizuj', 'Zoom', 'Zamknij okno'])
})

test('Language / Język switches the menu and the window immediately, the choice survives a restart and System follows the system again', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['de-DE', 'pl-PL'])

  await clickMenuItem('Language / Język', 'English')
  await expect.poll(() => menuLabels('Language / Język')).toEqual({
    top: ['Moje CV', 'Edit', 'Language / Język', 'Window'],
    items: ['English ✓', 'Polski', 'System']
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'en')

  await clickMenuItem('Language / Język', 'Polski')
  await expect.poll(() => menuLabels('Language / Język')).toEqual({
    top: ['Moje CV', 'Edycja', 'Language / Język', 'Okno'],
    items: ['English', 'Polski ✓', 'System']
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'pl')

  // Cofnij z przebudowanego menu nadal działa na historii CV.
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  const fullName = window.getByLabel('Imię i nazwisko')
  await fullName.fill('Ewa Nowak')
  await clickMenuItem('Edycja', 'Cofnij')
  await expect(fullName).toHaveValue('Jane Example')

  await app.close()
  await launch({ language: null })
  expect((await menuLabels('Language / Język')).items).toEqual(['English', 'Polski ✓', 'System'])
  await expect(window.locator('html')).toHaveAttribute('lang', 'pl')

  // System: pierwszy obsługiwany język systemu, a bez takiego angielski.
  await stubSystemLanguages(['de-DE'])
  await clickMenuItem('Language / Język', 'System')
  await expect.poll(() => menuLabels('Language / Język')).toEqual({
    top: ['Moje CV', 'Edit', 'Language / Język', 'Window'],
    items: ['English', 'Polski', 'System ✓']
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'en')
})

test('native file dialogs get their titles and file-type filters in the interface language', async () => {
  const dialogTexts = async () => {
    const options = await app.evaluate(() => {
      const calls = globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[]; openDialogCalls?: Electron.OpenDialogOptions[] }
      return [...(calls.saveDialogCalls ?? []), ...(calls.openDialogCalls ?? [])]
    })
    return options.map(({ title, filters }) => ({ title, filters: filters?.map((filter) => filter.name) }))
  }

  for (const language of ['en', 'pl'] satisfies InterfaceLanguage[]) {
    await app.close()
    await launch({ language })
    await stubSaveDialog(join(outputDir, `${language}.out`))
    await stubOpenDialog(null)
    const ui = {
      en: { importFile: 'Import from file', list: 'CV list', exportFile: 'Export to file', open: 'Open', exportPdf: 'Export to PDF', photo: 'Photo', changePhoto: 'Change photo' },
      pl: { importFile: 'Importuj z pliku', list: 'Lista CV', exportFile: 'Eksportuj do pliku', open: 'Otwórz', exportPdf: 'Eksportuj do PDF', photo: 'Zdjęcie', changePhoto: 'Zmień zdjęcie' }
    }[language]
    await window.getByRole('button', { name: ui.importFile }).click()
    const list = window.getByRole('list', { name: ui.list })
    await list.getByRole('button', { name: ui.exportFile }).click()
    await expect(window.getByRole('status')).toBeVisible()
    await list.getByRole('button', { name: ui.open }).click()
    await window.getByRole('button', { name: ui.exportPdf }).click()
    await expect(window.getByRole('status').filter({ hasText: 'PDF:' })).toBeVisible()
    await window.getByRole('group', { name: ui.photo, exact: true }).getByRole('button', { name: ui.changePhoto }).click()

    expect(await dialogTexts()).toEqual(
      language === 'en'
        ? [
            { title: 'Export CV to File', filters: ['CV (JSON)'] },
            { title: 'Export to PDF', filters: ['PDF'] },
            { title: 'Import CV from File', filters: ['CV (JSON)'] },
            { title: 'Choose Photo', filters: ['Images'] }
          ]
        : [
            { title: 'Eksportuj CV do pliku', filters: ['CV (JSON)'] },
            { title: 'Eksportuj do PDF', filters: ['PDF'] },
            { title: 'Importuj CV z pliku', filters: ['CV (JSON)'] },
            { title: 'Wybierz zdjęcie', filters: ['Obrazy'] }
          ]
    )
  }
})

test('the CV library and the consent clause library are in English', async () => {

  // Biblioteka CV: przyciski, wiersz z datą zmiany w formacie angielskim, zmiana nazwy i potwierdzenie usunięcia.
  await expect(window.getByRole('heading', { name: 'Moje CV' })).toBeVisible()
  const library = window.getByRole('list', { name: 'CV list' })
  const row = library.getByRole('listitem').first()
  await expect(row).toContainText(/Modified \d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2}\s?[AP]M/)
  for (const name of ['Open', 'Duplicate', 'Export to file', 'Rename', 'Delete']) {
    await expect(row.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await row.getByRole('button', { name: 'Rename' }).click()
  await expect(row.getByLabel('CV name')).toBeVisible()
  await row.getByRole('button', { name: 'Cancel' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row.getByRole('alertdialog', { name: 'Confirm deletion' })).toContainText(/^Delete “.+”\? This can’t be undone\./)
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(window.getByText('You don’t have any CVs yet. Click “New CV”.')).toBeVisible()
  await window.getByRole('button', { name: 'New CV' }).click()
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(window.getByRole('button', { name: 'Import from file' })).toBeVisible()

  // Biblioteka klauzul: pusta, dodanie klauzuli, oznaczenie domyślnej i potwierdzenie usunięcia.
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  await expect(window.getByRole('heading', { name: 'Consent clauses' })).toBeVisible()
  await expect(window.getByText('The default clause is added to every new CV.', { exact: false })).toBeVisible()
  await expect(window.getByText('The library is empty. Click “Add clause”.')).toBeVisible()
  await window.getByRole('button', { name: 'Add clause' }).click()
  const form = window.getByRole('form', { name: 'Clause' })
  await expect(form.getByLabel('Name')).toHaveAttribute('placeholder', 'e.g. Talent Partners')
  await form.getByLabel('Name').fill('General')
  await form.getByLabel('Text').fill('I agree to the processing of my personal data.')
  await form.getByRole('button', { name: 'Save' }).click()
  const clause = window.getByRole('list', { name: 'Clause list' }).getByRole('listitem')
  await clause.getByRole('button', { name: 'Set as default' }).click()
  await expect(clause).toContainText('General (default)')
  await expect(clause.getByRole('button', { name: 'Remove default' })).toBeVisible()
  await clause.getByRole('button', { name: 'Edit' }).click()
  await form.getByRole('button', { name: 'Cancel' }).click()
  await clause.getByRole('button', { name: 'Delete' }).click()
  await expect(clause.getByRole('alertdialog', { name: 'Confirm deletion' })).toHaveText(
    /Delete the clause “General”\? CVs that use it keep their own copy of the text\./
  )
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await expect(library).toBeVisible()
})

test('switching the language in the menu immediately translates the CV library and the clause library', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['en-US'])
  await expect(window.getByRole('button', { name: 'New CV' })).toBeVisible()
  await expect(window.getByRole('listitem').first()).toContainText(/Modified \d{1,2}\/\d{1,2}\/\d{2}/)

  await clickMenuItem('Language / Język', 'Polski')
  await expect(window.getByRole('button', { name: 'Nowe CV' })).toBeVisible()
  await expect(window.getByRole('list', { name: 'Lista CV' }).getByRole('listitem')).toContainText(
    /Zmieniono \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/
  )

  await window.getByRole('button', { name: 'Klauzule zgody' }).click()
  await expect(window.getByRole('heading', { name: 'Klauzule zgody' })).toBeVisible()
  await clickMenuItem('Language / Język', 'English')
  await expect(window.getByRole('heading', { name: 'Consent clauses' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add clause' })).toBeVisible()
})

test('the CV editor is in English, including the save status, photo cropping and the export actions', async () => {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()

  // Formularz: wygląd, nagłówek, sekcje z kolejnością, wpisy i klauzula zgody.
  for (const label of ['Accent color', 'Full name', 'Contact label 1', 'Contact value 1', 'Summary']) {
    await expect(window.getByLabel(label)).toBeVisible()
  }
  await expect(window.getByLabel('Font')).toHaveValue('lato')
  await expect(window.getByRole('button', { name: 'Remove contact 1' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add contact' })).toBeVisible()
  await expect(window.getByRole('button', { name: /^Move section “.+” down$/ }).first()).toBeVisible()
  await expect(window.getByRole('button', { name: /^Drag section “.+” to reorder$/ }).first()).toBeVisible()
  await expect(window.getByLabel(/^Section title “.+”$/).first()).toBeVisible()
  await expect(window.getByLabel('Hide section').first()).toBeVisible()
  await expect(window.getByLabel('New page before this section').first()).toBeVisible()
  const position = window.locator('.form fieldset').filter({ has: window.getByLabel('Job title') }).first()
  for (const label of ['Job title', 'Company', 'City', 'From', 'To', 'present', 'Bullet 1', 'New page before this entry']) {
    await expect(position.getByLabel(label, { exact: true })).toBeVisible()
  }
  for (const name of ['Remove bullet 1', 'Move bullet 2 up', 'Drag bullet 1 to reorder', 'Add bullet', 'Remove position']) {
    await expect(position.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await window.getByRole('button', { name: 'Add education' }).click()
  for (const [label, placeholder] of [
    ['Level', 'e.g. Master’s degree'],
    ['Field of study', 'e.g. Logistics'],
    ['School', 'e.g. University of Economics']
  ] as const) {
    await expect(window.getByLabel(label, { exact: true }).last()).toHaveAttribute('placeholder', placeholder)
  }
  await expect(window.getByRole('group', { name: 'New education' })).toBeVisible()
  await expect(window.getByLabel('From (optional)').last()).toBeVisible()
  await expect(window.getByLabel('Graduation date').last()).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add position' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add item' }).first()).toBeVisible()
  await expect(window.getByLabel('Item 1', { exact: true }).first()).toBeVisible()
  const consent = window.getByRole('region', { name: 'Consent clause' })
  await consent.getByLabel('Show the clause at the bottom of the last page').check()
  await expect(consent.getByLabel('Clause from the library')).toContainText('The library is empty')
  await expect(consent.getByLabel('Text in this CV')).toBeVisible()
  await consent.getByLabel('Text in this CV').fill('I agree.')
  await consent.getByRole('button', { name: 'Save as new clause' }).click()
  await expect(consent.getByLabel('New clause name')).toHaveAttribute('placeholder', 'Name, e.g. Talent Partners')
  await consent.getByRole('button', { name: 'Cancel' }).click()
  await expect(window.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()

  // Zdjęcie: komunikat o pliku, którego nie da się wczytać, i okno kadrowania.
  const photoField = window.getByRole('group', { name: 'Photo', exact: true })
  const brokenPath = join(outputDir, 'broken.jpg')
  await writeFile(brokenPath, 'not an image')
  await stubOpenDialog(brokenPath)
  await photoField.getByRole('button', { name: 'Change photo' }).click()
  await expect(photoField.getByRole('alert')).toHaveText(
    'Couldn’t load the photo – the file is damaged, unavailable or in an unsupported format.'
  )
  const photoPath = join(outputDir, 'photo.png')
  const png = await app.evaluate(({ nativeImage }) =>
    nativeImage.createFromBitmap(Buffer.alloc(30 * 40 * 4, 128), { width: 30, height: 40 }).toPNG().toString('base64')
  )
  await writeFile(photoPath, Buffer.from(png, 'base64'))
  await stubOpenDialog(photoPath)
  await photoField.getByRole('button', { name: 'Change photo' }).click()
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })
  await expect(cropper).toContainText('Drag the photo to set the frame.')
  await expect(cropper.getByRole('img', { name: 'Frame preview' })).toBeVisible()
  await expect(cropper.getByLabel('Zoom')).toBeVisible()
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(photoField.getByRole('img', { name: 'Photo in the CV' })).toBeVisible()
  await photoField.getByRole('button', { name: 'Remove photo' }).click()
  await expect(photoField.getByRole('button', { name: 'Choose photo' })).toBeVisible()

  // Eksport do PDF: zapisany plik z akcjami, a potem nieudany zapis.
  await stubSaveDialog(join(outputDir, 'cv.pdf'))
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  const exported = window.getByRole('status').filter({ hasText: 'Saved PDF: cv.pdf' })
  await expect(exported.getByRole('button', { name: 'Open' })).toBeVisible()
  await expect(exported.getByRole('button', { name: 'Show in Finder' })).toBeVisible()
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = (async () => {
      throw new Error('disk full')
    }) as typeof dialog.showSaveDialog
  })
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByRole('alert')).toHaveText('Couldn’t save the PDF. Try again.')

  // Nieudany autozapis (plik CV zniknął z dysku).
  await rm(join(outputDir, 'user-data', 'cvs'), { recursive: true })
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('status').filter({ hasText: 'Couldn’t save changes' })).toBeVisible()
})

test('switching the language in the menu translates the open editor without losing unsaved changes or the undo history', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['en-US'])
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  const original = await window.getByLabel('Full name').inputValue()
  await window.getByLabel('Full name').fill('Ewa Nowak')

  await clickMenuItem('Language / Język', 'Polski')
  const fullName = window.getByLabel('Imię i nazwisko')
  await expect(fullName).toHaveValue('Ewa Nowak')
  await expect(window.getByRole('button', { name: 'Eksportuj do PDF' })).toBeVisible()
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()

  await clickMenuItem('Edycja', 'Cofnij')
  await expect(fullName).toHaveValue(original)
  await clickMenuItem('Language / Język', 'English')
  await window.keyboard.press('Meta+Shift+z')
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
})

test('Default content follows the interface language at creation and never changes existing CVs afterwards', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem')

  // Pierwsze uruchomienie (po angielsku): angielskie przykładowe CV bez klauzuli zgody.
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Sample CV')
  await rows.first().getByRole('button', { name: 'Open' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-name')).toHaveText('Jane Example')
  await expect(preview.locator('.cv-page .cv-section-title')).toHaveText(['Work experience', 'Education', 'Skills', 'Languages'])
  await expect(preview.locator('.cv-consent')).toHaveCount(0)
  await expect(window.getByRole('region', { name: 'Consent clause' }).getByLabel('Show the clause at the bottom of the last page')).not.toBeChecked()
  await window.getByRole('button', { name: '← Moje CV' }).click()

  // Nowe CV i kopia po angielsku.
  await window.getByRole('button', { name: 'New CV' }).click()
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Duplicate' }).click()
  await expect(rows.filter({ hasText: 'Sample CV (copy)' })).toHaveCount(1)
  await rows.filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByRole('heading', { name: 'New CV' })).toBeVisible()
  await expect.poll(() => inputValues(window.locator('.form-contact-label'))).toEqual(['Phone', 'Email', 'LinkedIn', 'City'])
  await expect.poll(() => inputValues(window.getByLabel(/^Section title/))).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
  await window.getByRole('button', { name: '← Moje CV' }).click()

  // Po zmianie języka istniejące CV są bez zmian, a nowe treści powstają po polsku.
  await app.close()
  await launch({ language: 'pl' })
  const polishRows = window.getByRole('list', { name: 'Lista CV' }).getByRole('listitem')
  await expect(polishRows.filter({ hasText: 'Sample CV' })).toHaveCount(2)
  await window.getByRole('button', { name: 'Nowe CV' }).click()
  await polishRows.filter({ hasText: 'Sample CV (copy)' }).getByRole('button', { name: 'Duplikuj' }).click()
  await expect(polishRows.filter({ hasText: 'Sample CV (copy) (kopia)' })).toHaveCount(1)
  await polishRows.filter({ hasText: /^New CV/ }).getByRole('button', { name: 'Otwórz' }).click()
  await expect.poll(() => inputValues(window.locator('.form-contact-label'))).toEqual(['Phone', 'Email', 'LinkedIn', 'City'])
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await polishRows.filter({ hasText: 'Nowe CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect.poll(() => inputValues(window.locator('.form-contact-label'))).toEqual(['Tel', 'E-mail', 'LinkedIn', 'Miasto'])
  await expect.poll(() => inputValues(window.getByLabel(/^Tytuł sekcji/))).toEqual(['Doświadczenie zawodowe', 'Wykształcenie', 'Umiejętności', 'Języki'])
})

test('a CV without a name is shown and exported under a fallback name in the interface language', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const untitledPath = join(outputDir, 'untitled.json')
  await stubSaveDialog(untitledPath)
  await library.getByRole('button', { name: 'Export to file' }).click()
  await expect(window.getByRole('status')).toBeVisible()
  await writeFile(untitledPath, JSON.stringify({ ...JSON.parse(await readFile(untitledPath, 'utf8')), name: '' }))
  await stubOpenDialog(untitledPath)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('status')).toHaveText('Imported “Untitled CV”.')
  const untitled = library.getByRole('listitem').filter({ hasText: 'Untitled CV' })
  await stubSaveDialog(join(outputDir, 'again.json'))
  await untitled.getByRole('button', { name: 'Export to file' }).click()
  const saveDialogOptions = await app.evaluate(() => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls)
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('Untitled CV.json')
  await untitled.getByRole('button', { name: 'Open' }).click()
  await expect(window.getByRole('heading', { name: 'Untitled CV' })).toBeVisible()
})

test('importing an invalid file shows why in English and leaves the library unchanged', async () => {
  const rows = window.getByRole('list', { name: 'CV list' }).getByRole('listitem')
  await expect(rows).toHaveCount(1)

  for (const [content, message] of [
    ['{ "name": "Not a CV" }', 'Couldn’t import the CV. The file doesn’t contain a valid CV.'],
    ['{ "name": ', 'Couldn’t import the CV. The file isn’t a valid CV file (invalid JSON format).'],
    ['{ "schemaVersion": 99 }', 'Couldn’t import the CV. The file comes from a newer version of the app. Update the app to import it.']
  ]) {
    const invalidPath = join(outputDir, 'invalid.json')
    await writeFile(invalidPath, content!)
    await stubOpenDialog(invalidPath)
    await window.getByRole('button', { name: 'Import from file' }).click()
    await expect(window.getByRole('alert')).toHaveText(message!)
    await expect(rows).toHaveCount(1)
  }
})

test('in a Polish run the sample CV, the editor, the menu, the exported PDF and import errors are in Polish', async () => {
  await app.close()
  await rm(join(outputDir, 'user-data'), { recursive: true })
  await launch({ language: 'pl' })
  const pdfPath = join(outputDir, 'polskie.pdf')
  await stubSaveDialog(pdfPath)

  const library = window.getByRole('list', { name: 'Lista CV' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(library.getByText('Przykładowe CV')).toBeVisible()
  await library.getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.locator('.preview-page-count')).toHaveText('2 strony')
  const fullName = window.getByLabel('Imię i nazwisko')
  await fullName.fill('Ewa Nowak')
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()

  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF: polskie.pdf')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(2)
  expect(pdf.pages[0]).toContain('Ewa Nowak')
  expect(pdf.pages[0]).toContain('Starsza specjalistka ds. zakupów')
  expect(pdf.pages.at(-1)).toContain('Wyrażam zgodę na przetwarzanie moich danych osobowych')
  expect(pdf.pages.slice(0, -1).join('')).not.toContain('Wyrażam zgodę')

  await clickMenuItem('Edycja', 'Cofnij')
  await expect(fullName).toHaveValue('Anna Przykładowa')

  // Niepoprawny plik importu → komunikat po polsku, biblioteka bez zmian.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  const invalidPath = join(outputDir, 'zepsute.json')
  await writeFile(invalidPath, '{ "name": "Nie CV" }')
  await stubOpenDialog(invalidPath)
  await window.getByRole('button', { name: 'Importuj z pliku' }).click()
  await expect(window.getByRole('alert')).toHaveText('Nie udało się zaimportować CV. Plik nie zawiera poprawnego CV.')
  await expect(library.getByRole('listitem')).toHaveCount(1)
})

test('the packaged app identifies itself as „Moje CV” (which names its application data folder)', async () => {
  test.skip(!packagedExecutable, 'dotyczy tylko zbudowanej aplikacji')
  const identity = await app.evaluate(({ app }) => ({ name: app.getName(), isPackaged: app.isPackaged }))
  expect(identity).toEqual({ name: 'Moje CV', isPackaged: true })
})

test('on first run opens the sample CV, edits it and exports it to a PDF identical to the preview; the edit survives a restart', async () => {
  const pdfPath = join(outputDir, 'export.pdf')
  await stubSaveDialog(pdfPath)

  const library = window.getByRole('list', { name: 'CV list' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(library.getByText('Sample CV')).toBeVisible()
  await library.getByRole('button', { name: 'Open' }).click()

  await expect(window.locator('.cv-page').first()).toBeVisible()

  // Edycja w formularzu od razu zmienia podgląd; Cmd+Z / Cmd+Shift+Z cofa i ponawia zmianę.
  const fullName = window.getByLabel('Full name')
  await fullName.fill('Ewa Nowak-Żelazna')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Ewa Nowak-Żelazna')
  await window.keyboard.press('Meta+z')
  await expect(fullName).toHaveValue('Jane Example')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane Example')
  await window.keyboard.press('Meta+Shift+z')
  await expect(fullName).toHaveValue('Ewa Nowak-Żelazna')
  await expect(window.getByText('Changes saved')).toBeVisible()

  const previewPageCount = await window.locator('.preview .cv-page').count()

  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()

  const saveDialogOptions = await app.evaluate(
    () => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls
  )
  expect(saveDialogOptions).toHaveLength(1)
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('CV_Ewa_Nowak-Zelazna.pdf')

  const pdf = await readPdf(await readFile(pdfPath))
  expect(previewPageCount).toBeGreaterThan(0)
  expect(pdf.pages).toHaveLength(previewPageCount)
  for (const size of pdf.pageSizes) {
    expect(size.width).toBeCloseTo(A4_PT.width, 0)
    expect(size.height).toBeCloseTo(A4_PT.height, 0)
  }
  expect(pdf.pages[0]).toContain('Ewa Nowak-Żelazna')
  expect(pdf.pages.join('')).not.toContain('Jane Example')
  expect(pdf.pages[0]).toContain('Senior Procurement Specialist')
  expect(pdf.title).toBe('CV – Ewa Nowak-Żelazna')
  expect(pdf.author).toBe('Ewa Nowak-Żelazna')
  expect(pdf.embeddedFonts.some((name) => name.includes('Lato'))).toBe(true)

  // Autozapis: po ponownym uruchomieniu zachowana jest także zmiana wpisana tuż przed zamknięciem aplikacji.
  await fullName.fill('Ewa Nowak')
  await app.close()
  await launch()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
})

test('edits education and lists, reorders and hides sections, and forces page breaks in the preview and PDF', async () => {
  const pdfPath = join(outputDir, 'layout.pdf')
  await stubSaveDialog(pdfPath)
  await openFirstCv()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()

  // Wykształcenie: nowy wpis renderowany jako „poziom, kierunek, uczelnia”, tytuł sekcji edytowalny.
  const education = window.getByRole('region', { name: 'Education', exact: true })
  await education.getByRole('button', { name: 'Add education' }).click()
  await education.getByLabel('Level').last().fill('A levels')
  await education.getByLabel('Field of study').last().fill('Mathematics and Physics')
  await education.getByLabel('School').last().fill('Leeds Grammar School')
  await expect(preview).toContainText('A levels, Mathematics and Physics, Leeds Grammar School')
  await education.getByLabel('Section title “Education”').fill('Schooling')
  const educationSection = window.getByRole('region', { name: 'Schooling', exact: true })

  // Lista: dodanie i usunięcie elementu.
  const languages = window.getByRole('region', { name: 'Languages', exact: true })
  await languages.getByRole('button', { name: 'Add item' }).click()
  await languages.getByRole('textbox', { name: 'Item 3', exact: true }).fill('Spanish – B1')
  await expect(preview).toContainText('Spanish – B1')
  await languages.getByRole('button', { name: 'Remove item 2' }).click()
  await expect(preview).not.toContainText('German – B2')

  // Kolejność sekcji, wpisów i punktów strzałkami.
  await window.getByRole('button', { name: 'Move section “Languages” up' }).click()
  await expect(preview.locator('.cv-page .cv-section-title')).toHaveText(['Work experience', 'Schooling', 'Languages', 'Skills'])
  await window.getByRole('button', { name: 'Move position “Procurement Assistant” up' }).click()
  await expect(preview.locator('.cv-page .cv-role')).toHaveText([
    'Senior Procurement Specialist',
    'Procurement Assistant',
    'Procurement Specialist',
    'Junior Customer Service Specialist'
  ])
  await window.locator('.form fieldset', { hasText: 'Senior Procurement Specialist' }).getByRole('button', { name: 'Move bullet 2 up' }).click()
  await expect(preview.locator('.cv-page .cv-bullets li').first()).toHaveText(
    'Managing a portfolio of more than 60 suppliers of components and auxiliary materials.'
  )

  // Przeciąganie za uchwyt: ostatnia umiejętność na pierwsze miejsce.
  const skills = window.getByRole('region', { name: 'Skills', exact: true })
  await dragOnto(
    skills.getByRole('button', { name: 'Drag item 5 to reorder' }),
    skills.getByRole('button', { name: 'Drag item 1 to reorder' })
  )
  await expect(skills.getByRole('textbox', { name: 'Item 1', exact: true })).toHaveValue('Driving licence (category B)')
  await expect(preview.locator('.cv-page .cv-two-col', { hasText: 'Skills' })).toContainText('Driving licence (category B)')

  // Ukryta sekcja znika z podglądu, ale zostaje w formularzu.
  await languages.getByLabel('Hide section').check()
  await expect(preview).not.toContainText('English – native')
  await expect(languages.getByRole('textbox', { name: 'Item 1', exact: true })).toHaveValue('English – native')

  // Nowa strona przed sekcją i przed wpisem.
  await educationSection.getByLabel('New page before this section').check()
  const firstBlocks = preview.locator('.cv-page-content > .cv-block:first-child')
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Schooling'])
  await window
    .locator('.form fieldset', { hasText: 'Junior Customer Service Specialist' })
    .getByLabel('New page before this entry')
    .check()
  await expect(firstBlocks.locator('.cv-role')).toHaveText(['Junior Customer Service Specialist'])
  const previewPageCount = await preview.locator('.cv-page').count()

  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(previewPageCount)
  expect(pdf.pages.some((page) => page.startsWith('Junior Customer Service Specialist'))).toBe(true)
  expect(pdf.pages.some((page) => page.startsWith('Schooling'))).toBe(true)
  expect(pdf.pages.join('')).not.toContain('English – native')
})

test('changes the accent colour and font of one CV in the preview and PDF, with fonts embedded from the app', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  await library.getByRole('button', { name: 'Open' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()

  // Kolor akcentu: imię, tytuły sekcji i kropki przy datach.
  const accent = window.getByLabel('Accent color')
  await expect(accent).toHaveValue('#1a6e72')
  await accent.fill('#8a2be2')
  const purple = 'rgb(138, 43, 226)'
  await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('color', purple)
  await expect(preview.locator('.cv-page .cv-section-title').first()).toHaveCSS('color', purple)
  const dotColor = await preview
    .locator('.cv-page .cv-date--dot')
    .first()
    .evaluate((element) => element.ownerDocument.defaultView!.getComputedStyle(element, '::after').backgroundColor)
  expect(dotColor).toBe(purple)

  // Każdy font: podgląd przeliczony po załadowaniu fontu, PDF z tą samą liczbą stron i osadzonym tylko tym fontem.
  const font = window.getByLabel('Font')
  await expect(font).toHaveValue('lato')
  for (const { value, family, pdfName } of [
    { value: 'lato', family: 'Lato', pdfName: 'Lato' },
    { value: 'source-sans-3', family: 'Source Sans 3', pdfName: 'SourceSans3' },
    { value: 'arimo', family: 'Arimo', pdfName: 'Arimo' }
  ]) {
    await font.selectOption(value)
    await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('font-family', new RegExp(`^"?${family}"?,`))
    await expect(window.getByText('Changes saved')).toBeVisible()
    const previewPageCount = await preview.locator('.cv-page').count()

    const pdfPath = join(outputDir, `${value}.pdf`)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: 'Export to PDF' }).click()
    await expect(window.getByText(`Saved PDF: ${basename(pdfPath)}`)).toBeVisible()
    const pdf = await readPdf(await readFile(pdfPath))
    expect(pdf.pages).toHaveLength(previewPageCount)
    expect(pdf.pages[0]).toContain('Jane Example')
    expect(pdf.embeddedFonts.length).toBeGreaterThan(0)
    expect(pdf.embeddedFonts.every((name) => name.includes(pdfName))).toBe(true)
    expect(pdf.fillColors).toContain('#8a2be2')
  }

  // Ustawienia należą do CV: nowe CV ma domyślne, a zmienione zostają w swoim CV.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'New CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Accent color')).toHaveValue('#1a6e72')
  await expect(window.getByLabel('Font')).toHaveValue('lato')
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Accent color')).toHaveValue('#8a2be2')
  await expect(window.getByLabel('Font')).toHaveValue('arimo')
})

test('manages the consent clause library, uses a clause in a CV without changing the library and leaves a switched-off clause out of the PDF', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  await expect(library.getByRole('listitem')).toHaveCount(1)

  // Biblioteka: dodanie dwóch klauzul, edycja, domyślna i usunięcie.
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  const clauses = window.getByRole('list', { name: 'Clause list' })
  const addClause = async (name: string, text: string) => {
    await window.getByRole('button', { name: 'Add clause' }).click()
    await window.getByLabel('Name').fill(name)
    await window.getByLabel('Text').fill(text)
    await window.getByRole('button', { name: 'Save' }).click()
  }
  await addClause('General', 'I consent to the processing of my data – general version.')
  await addClause('To delete', 'Temporary')
  await addClause('Talent', 'I consent for Talent Partners.')
  const row = (name: string) => clauses.getByRole('listitem').filter({ hasText: name })
  await row('Talent').getByRole('button', { name: 'Edit' }).click()
  await window.getByLabel('Name').fill('Talent Partners')
  await window.getByRole('button', { name: 'Save' }).click()
  await row('To delete').getByRole('button', { name: 'Delete' }).click()
  await window.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await row('General').getByRole('button', { name: 'Set as default' }).click()
  await expect(row('General')).toContainText('(default)')
  await expect(clauses.getByRole('listitem')).toHaveCount(2)
  await expect(row('Talent Partners')).toContainText('I consent for Talent Partners.')

  // Nowe CV dostaje klauzulę domyślną, widoczną w podglądzie.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'New CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  const preview = window.locator('.preview')
  const consent = window.getByRole('region', { name: 'Consent clause' })
  await expect(consent.getByLabel('Clause from the library')).toHaveValue(/.+/)
  await expect(preview.locator('.cv-page .cv-consent')).toHaveText('I consent to the processing of my data – general version.')

  // Wybór innej klauzuli, poprawka w CV, przywrócenie z biblioteki i zapis poprawionej jako nowej.
  await consent.getByLabel('Clause from the library').selectOption({ label: 'Talent Partners' })
  const text = consent.getByLabel('Text in this CV')
  await expect(text).toHaveValue('I consent for Talent Partners.')
  await text.fill('I consent for Talent Partners and the Bank.')
  await expect(preview.locator('.cv-page .cv-consent')).toHaveText('I consent for Talent Partners and the Bank.')
  await consent.getByRole('button', { name: 'Restore from library' }).click()
  await expect(text).toHaveValue('I consent for Talent Partners.')
  await text.fill('I consent for the Bank.')
  await consent.getByRole('button', { name: 'Save as new clause' }).click()
  await consent.getByLabel('New clause name').fill('Bank')
  await consent.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(consent.getByLabel('Clause from the library').locator('option:checked')).toHaveText('Bank')
  await expect(consent.getByRole('button', { name: 'Restore from library' })).toHaveCount(0)

  // Wyłączona klauzula znika z podglądu i PDF.
  await consent.getByLabel('Show the clause at the bottom of the last page').uncheck()
  await expect(preview.locator('.cv-consent')).toHaveCount(0)
  await expect(window.getByText('Changes saved')).toBeVisible()
  const pdfPath = join(outputDir, 'without-clause.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()
  expect((await readPdf(await readFile(pdfPath))).pages.join('')).not.toContain('I consent')

  // Poprawki w CV nie zmieniły biblioteki.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  await expect(clauses.getByRole('listitem')).toHaveCount(3)
  await expect(row('Talent Partners')).toContainText('I consent for Talent Partners.')
  await expect(row('Bank')).toContainText('I consent for the Bank.')
})

test('picks a photo from disk, crops it to 3:4 for the header and removes it, in the preview and PDF', async () => {
  // Zdjęcie poziome 1200 × 800: lewa połowa czerwona, prawa niebieska.
  const photoPath = join(outputDir, 'photo.png')
  const png = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [1200, 800]
    const bitmap = Buffer.alloc(width * height * 4)
    // Piksele w kolejności BGRA.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) bitmap.set(x < width / 2 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4)
    return nativeImage.createFromBitmap(bitmap, { width, height }).toPNG().toString('base64')
  })
  await writeFile(photoPath, Buffer.from(png, 'base64'))
  const brokenPath = join(outputDir, 'broken.jpg')
  await writeFile(brokenPath, 'not an image')
  await openFirstCv()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-photo')).toHaveCount(1)
  const photoField = window.getByRole('group', { name: 'Photo', exact: true })

  // Plik, którego nie da się odczytać jako obraz, daje komunikat i nie zmienia zdjęcia.
  await stubOpenDialog(brokenPath)
  await photoField.getByRole('button', { name: 'Change photo' }).click()
  await expect(photoField.getByRole('alert')).toContainText('Couldn’t load the photo')
  await expect(window.getByRole('dialog', { name: 'Crop photo' })).toHaveCount(0)

  // Wybór pliku z dysku przez systemowe okno, kadrowanie i zapis.
  await stubOpenDialog(photoPath)
  await photoField.getByRole('button', { name: 'Change photo' }).click()
  const openDialogOptions = await app.evaluate(
    () => (globalThis as { openDialogCalls?: Electron.OpenDialogOptions[] }).openDialogCalls
  )
  expect(openDialogOptions![0]!.filters![0]!.extensions).toEqual(expect.arrayContaining(['jpg', 'jpeg', 'png']))
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })
  await expect(cropper).toBeVisible()
  // Kadr przesunięty maksymalnie w prawo – na zdjęciu zostaje sam niebieski.
  const frame = cropper.getByRole('img', { name: 'Frame preview' })
  const box = (await frame.boundingBox())!
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await window.mouse.down()
  await window.mouse.move(box.x - box.width * 3, box.y + box.height / 2, { steps: 10 })
  await window.mouse.up()
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(cropper).toHaveCount(0)

  // W CV wykadrowany JPEG 3:4 w rozdzielczości do druku (42 mm przy 300 dpi), o szerokości 42 mm.
  const photo = preview.locator('.cv-page .cv-photo')
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  const stored = await photo.evaluate(async (element) => {
    const image = element as typeof element & { naturalWidth: number; naturalHeight: number; src: string; decode: () => Promise<void> }
    await image.decode()
    const view = element.ownerDocument.defaultView!
    const canvas = element.ownerDocument.createElement('canvas') as unknown as {
      width: number
      height: number
      getContext: (type: '2d') => {
        drawImage: (image: unknown, x: number, y: number) => void
        getImageData: (x: number, y: number, width: number, height: number) => { data: Uint8ClampedArray }
      }
    }
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      cssWidth: view.getComputedStyle(element).width,
      corners: [pixel(2, 2), pixel(canvas.width - 3, canvas.height - 3)],
      length: image.src.length
    }
  })
  expect(stored.width).toBe(496)
  expect(stored.height).toBe(661)
  expect(parseFloat(stored.cssWidth)).toBeCloseTo((42 * 96) / 25.4, 0)
  for (const [r = 0, , b = 0] of stored.corners) {
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(40)
  }
  expect(stored.length).toBeLessThan(300_000)
  await expect(window.getByText('Changes saved')).toBeVisible()

  // Eksport PDF czeka na wczytanie zdjęcia – jest na pierwszej stronie.
  const withPhoto = join(outputDir, 'with-photo.pdf')
  await stubSaveDialog(withPhoto)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText(`Saved PDF: ${basename(withPhoto)}`)).toBeVisible()
  expect((await readPdf(await readFile(withPhoto))).imagesPerPage[0]).toBe(1)

  // Bez zdjęcia nagłówek zajmuje pełną szerokość, a w PDF nie ma obrazu.
  await photoField.getByRole('button', { name: 'Remove photo' }).click()
  await expect(preview.locator('.cv-photo')).toHaveCount(0)
  await expect(preview.locator('.cv-page .cv-header')).toHaveCSS('grid-template-columns', /^\S+$/)
  await expect(photoField.getByRole('button', { name: 'Choose photo' })).toBeVisible()
  await expect(window.getByText('Changes saved')).toBeVisible()
  const withoutPhoto = join(outputDir, 'without-photo.pdf')
  await stubSaveDialog(withoutPhoto)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText(`Saved PDF: ${basename(withoutPhoto)}`)).toBeVisible()
  const pdf = await readPdf(await readFile(withoutPhoto))
  expect(pdf.imagesPerPage.every((count) => count === 0)).toBe(true)
  expect(pdf.pages[0]).toContain('Jane Example')

  // Anulowane okno wyboru niczego nie zmienia.
  await stubOpenDialog(null)
  await photoField.getByRole('button', { name: 'Choose photo' }).click()
  await expect(window.getByRole('dialog', { name: 'Crop photo' })).toHaveCount(0)
  await expect(preview.locator('.cv-photo')).toHaveCount(0)
})

test('shows the page count, warns about long CVs and oversized fragments only in the preview, and zooms without changing the page split', async () => {
  const pdfPath = join(outputDir, 'long.pdf')
  await stubSaveDialog(pdfPath)
  await openFirstCv()
  const preview = window.locator('.preview')
  const pageCount = preview.locator('.preview-page-count')
  await expect(pageCount).toHaveText(/^[12] pages?$/)
  await expect(preview).not.toContainText('longer than 2 pages')

  // Podsumowanie dłuższe niż strona: nagłówek dostaje własną stronę, jest wyróżniony i CV ma ponad 2 strony.
  await window.getByLabel('Summary').fill(Array.from({ length: 200 }, (_, i) => `A very long summary, line ${i + 1}.`).join('\n'))
  const message = 'This fragment is too long to fit on a page – shorten it'
  await expect(preview.getByText(message)).toBeVisible()
  await expect(preview.locator('.cv-page').first().locator('.cv-block--oversized .cv-header')).toHaveCount(1)
  await expect(pageCount).toHaveText(/^\d+ pages$/)
  const longPageCount = parseInt((await pageCount.textContent())!)
  expect(longPageCount).toBeGreaterThan(2)
  await expect(preview).toContainText('The CV is longer than 2 pages – consider shortening it.')

  // Eksport nie jest blokowany, a wyróżnienie nie trafia do PDF.
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(longPageCount)
  expect(pdf.pages.join('')).not.toContain('This fragment is too long')
  expect(pdf.pages.join('')).not.toContain('longer than')
  expect(pdf.fillColors).not.toContain('#b42318')

  // Domyślnie strona wypełnia szerokość panelu (z marginesami 24 px), także po zmianie rozmiaru okna.
  const page = preview.locator('.cv-page').first()
  const pageWidth = async () => (await page.boundingBox())!.width
  const panelWidth = () => preview.evaluate((element) => element.clientWidth)
  await expect.poll(async () => (await pageWidth()) - ((await panelWidth()) - 48)).toBeCloseTo(0, 0)
  const widthBefore = await pageWidth()
  await app.evaluate(({ BrowserWindow }) => {
    const [browserWindow] = BrowserWindow.getAllWindows()
    const [width, height] = browserWindow!.getSize()
    browserWindow!.setSize(width! + 300, height!)
  })
  await expect.poll(pageWidth).toBeGreaterThan(widthBefore + 200)
  await expect.poll(async () => (await pageWidth()) - ((await panelWidth()) - 48)).toBeCloseTo(0, 0)

  // 100%, +, −: strona w skali 1:1 (210 mm = 793,7 px) i o jeden poziom większa/mniejsza; podział stron bez zmian.
  const pageTexts = () => preview.locator('.cv-page').evaluateAll((pages) => pages.map((page) => page.textContent))
  const textsAtFit = await pageTexts()
  await preview.getByRole('button', { name: '100%' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7, 0)
  await preview.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7 * 1.25, 0)
  expect(await pageTexts()).toEqual(textsAtFit)
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7 * 0.75, 0)
  expect(await pageTexts()).toEqual(textsAtFit)
  await expect(pageCount).toHaveText(`${longPageCount} pages`)
})

test('Edit → Undo / Redo in the menu undo and redo CV changes in the form and the preview', async () => {
  await openFirstCv()
  const fullName = window.getByLabel('Full name')
  const previewName = window.locator('.preview .cv-page .cv-name')
  await fullName.fill('Ewa Nowak')
  await expect(previewName).toHaveText('Ewa Nowak')

  // Kursor zostaje w polu tekstowym – mimo to cofana jest historia CV, a nie samo pole.
  await clickMenuItem('Edit', 'Undo')
  await expect(fullName).toHaveValue('Jane Example')
  await expect(previewName).toHaveText('Jane Example')
  await clickMenuItem('Edit', 'Redo')
  await expect(fullName).toHaveValue('Ewa Nowak')
  await expect(previewName).toHaveText('Ewa Nowak')
})

test('one Cmd+Z / Cmd+Shift+Z press with the Edit menu in place undoes and redoes exactly one CV change', async () => {
  await openFirstCv()
  const fullName = window.getByLabel('Full name')
  const summary = window.getByLabel('Summary')
  const originalSummary = await summary.inputValue()
  await fullName.fill('Ewa Nowak')
  await summary.fill('New summary.')
  await expect(window.locator('.preview .cv-page .cv-summary')).toHaveText('New summary.')

  await window.keyboard.press('Meta+z')
  await expect(summary).toHaveValue(originalSummary)
  await expect(fullName).toHaveValue('Ewa Nowak')
  await window.keyboard.press('Meta+Shift+z')
  await expect(summary).toHaveValue('New summary.')
  await expect(fullName).toHaveValue('Ewa Nowak')
  // Druga zmiana z dwóch pozostaje cofnięta/ponowiona dokładnie raz także po chwili (bez opóźnionego drugiego kroku).
  await window.waitForTimeout(300)
  await expect(fullName).toHaveValue('Ewa Nowak')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Ewa Nowak')
})

test('after Edit → Undo in the menu, Cmd+Z undoes the earlier CV change and the result is saved', async () => {
  await openFirstCv()
  const fullName = window.getByLabel('Full name')
  const summary = window.getByLabel('Summary')
  const originalSummary = await summary.inputValue()
  await fullName.fill('Ewa Nowak')
  await summary.fill('New summary.')

  await clickMenuItem('Edit', 'Undo')
  await expect(summary).toHaveValue(originalSummary)
  await expect(fullName).toHaveValue('Ewa Nowak')
  await window.keyboard.press('Meta+z')
  await expect(fullName).toHaveValue('Jane Example')
  await expect(summary).toHaveValue(originalSummary)
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane Example')

  // Ponów z menu, a potem skrótem: kolejno obie zmiany.
  await clickMenuItem('Edit', 'Redo')
  await expect(fullName).toHaveValue('Ewa Nowak')
  await expect(summary).toHaveValue(originalSummary)
  await window.keyboard.press('Meta+Shift+z')
  await expect(summary).toHaveValue('New summary.')

  // Zmiana z menu zapisuje się automatycznie jak przy skrócie.
  await clickMenuItem('Edit', 'Undo')
  await expect(summary).toHaveValue(originalSummary)
  await expect(window.getByText('Changes saved')).toBeVisible()
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
  await expect(window.getByLabel('Summary')).toHaveValue(originalSummary)
})

test('in the CV library Edit → Undo undoes typing in the rename field and never changes the closed CV', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  await library.getByRole('button', { name: 'Open' }).click()
  await window.getByLabel('Full name').fill('Ewa Nowak')
  await expect(window.getByText('Changes saved')).toBeVisible()
  await window.getByRole('button', { name: '← Moje CV' }).click()

  // Po wyjściu z edytora menu cofa tekst w polu, a nie historię zamkniętego CV.
  await library.getByRole('button', { name: 'Rename' }).click()
  const name = library.getByLabel('CV name')
  await name.pressSequentially(' for the bank')
  await expect(name).toHaveValue('Sample CV for the bank')
  await clickMenuItem('Edit', 'Undo')
  await expect(name).toHaveValue('Sample CV')
  await clickMenuItem('Edit', 'Redo')
  await expect(name).toHaveValue('Sample CV for the bank')

  // Cmd+Z w polu działa jak dotąd.
  await window.keyboard.press('Meta+z')
  await expect(name).toHaveValue('Sample CV')
  await library.getByRole('button', { name: 'Cancel' }).click()

  await library.getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
})

test('Edit → Select All, Cut, Copy and Paste in the menu work in a form field', async () => {
  await openFirstCv()
  const fullName = window.getByLabel('Full name')
  await fullName.focus()

  await clickMenuItem('Edit', 'Select All')
  await clickMenuItem('Edit', 'Cut')
  await expect(fullName).toHaveValue('')
  await clickMenuItem('Edit', 'Paste')
  await expect(fullName).toHaveValue('Jane Example')

  await clickMenuItem('Edit', 'Select All')
  await clickMenuItem('Edit', 'Copy')
  await fullName.press('ArrowRight')
  await clickMenuItem('Edit', 'Paste')
  await expect(fullName).toHaveValue('Jane ExampleJane Example')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane ExampleJane Example')
})

test('exports a CV to a JSON file and imports it back as a new CV; an invalid file leaves the library unchanged', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem')
  await expect(rows).toHaveCount(1)
  await library.getByRole('button', { name: 'Rename' }).click()
  await library.getByLabel('CV name').fill('CV – Talent Partners')
  await library.getByRole('button', { name: 'Save' }).click()
  await expect(rows.first()).toContainText('CV – Talent Partners')

  // Eksport przez systemowe okno zapisu, z nazwą pliku podpowiedzianą z nazwy CV.
  const jsonPath = join(outputDir, 'copy.json')
  await stubSaveDialog(jsonPath)
  await library.getByRole('button', { name: 'Export to file' }).click()
  await expect(window.getByRole('status')).toHaveText('Saved file: copy.json')
  const saveDialogOptions = await app.evaluate(
    () => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls
  )
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('CV – Talent Partners.json')
  const exported = JSON.parse(await readFile(jsonPath, 'utf8'))
  expect(exported).toMatchObject({ schemaVersion: 1, name: 'CV – Talent Partners', header: { fullName: 'Jane Example' } })

  // Import tego samego pliku dodaje nowe CV obok istniejącego – niczego nie nadpisuje.
  await stubOpenDialog(jsonPath)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('status')).toHaveText('Imported “CV – Talent Partners”.')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'CV – Talent Partners' })).toHaveCount(2)
  await rows.first().getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane Example')
  await window.getByRole('button', { name: '← Moje CV' }).click()

  // Niepoprawny plik → komunikat, biblioteka bez zmian.
  const invalidPath = join(outputDir, 'broken.json')
  await writeFile(invalidPath, '{ "name": "Not a CV" }')
  await stubOpenDialog(invalidPath)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('alert')).toHaveText('Couldn’t import the CV. The file doesn’t contain a valid CV.')
  await expect(rows).toHaveCount(2)

  // Anulowane okno wyboru niczego nie zmienia.
  await stubOpenDialog(null)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('alert')).toHaveCount(0)
  await expect(rows).toHaveCount(2)
})

// Wartości wszystkich pól wskazanych lokatorem, w kolejności z formularza.
function inputValues(fields: Locator) {
  return fields.evaluateAll((elements) => elements.map((element) => (element as unknown as { value: string }).value))
}

// Przeciąga element za uchwyt myszą krok po kroku, tak jak użytkownik (dnd-kit reaguje na zdarzenia wskaźnika).
async function dragOnto(handle: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await handle.scrollIntoViewIfNeeded()
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await window.mouse.down()
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 10, { steps: 5 })
  await window.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await window.mouse.up()
  // dnd-kit przez 50 ms po upuszczeniu blokuje kliknięcia (żeby upuszczenie nie było kliknięciem).
  await window.waitForTimeout(100)
}

// A4 w punktach PDF (210 × 297 mm).
const A4_PT = { width: 595.28, height: 841.89 }

type ParsedPdf = { pages: string[]; pageSizes: { width: number; height: number }[]; title: string; author: string; embeddedFonts: string[]; fillColors: string[]; imagesPerPage: number[] }

// Odczytuje PDF tak jak czytnik/ATS: zaznaczalny tekst każdej strony, metadane, osadzone fonty, kolory wypełnień i liczbę obrazów na stronach.
async function readPdf(bytes: Buffer): Promise<ParsedPdf> {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(bytes), fontExtraProperties: true }).promise
  const pages: string[] = []
  const pageSizes: ParsedPdf['pageSizes'] = []
  const embeddedFonts = new Set<string>()
  const fillColors = new Set<string>()
  const imagesPerPage: number[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const [, , width = 0, height = 0] = page.view
    pageSizes.push({ width, height })
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
    const operators = await page.getOperatorList()
    imagesPerPage.push(operators.fnArray.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject).length)
    operators.fnArray.forEach((fn, index) => {
      if (fn === OPS.setFillRGBColor) fillColors.add(String(operators.argsArray[index]?.[0]).toLowerCase())
    })
    for (const fontId of new Set(content.items.flatMap((item) => ('fontName' in item ? [item.fontName] : [])))) {
      const font = page.commonObjs.get(fontId) as { name?: string; missingFile?: boolean }
      if (font.name && !font.missingFile) embeddedFonts.add(font.name)
    }
  }
  const { info } = (await document.getMetadata()) as { info: { Title?: string; Author?: string } }
  return { pages, pageSizes, title: info.Title ?? '', author: info.Author ?? '', embeddedFonts: [...embeddedFonts], fillColors: [...fillColors], imagesPerPage }
}
