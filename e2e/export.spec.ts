import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { sampleCvs } from '../src/renderer/src/domain/sampleCv'
import { PX_PER_MM } from '../src/renderer/src/domain/templateGeometry'
import { isAppearance, type Appearance } from '../src/shared/appearance'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { HELP_URL, PRIVACY_URL, REPORT_ISSUE_URL, SPONSOR_URL } from '../src/shared/links'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

// Ścieżka do pliku wykonywalnego zbudowanej aplikacji (np. z `pnpm test:e2e:packaged`); bez niej testy uruchamiają kod z `out/`.
const packagedExecutable = process.env['MOJE_CV_APP']

// Uruchamia aplikację na tymczasowym katalogu danych testu, żeby nie dotykać danych użytkownika.
// Język interfejsu jest wymuszony (`MOJE_CV_LANGUAGE`, domyślnie angielski), żeby testy nie zależały od języka systemu;
// `language: null` uruchamia aplikację bez wymuszenia (wybór z menu Language, a bez niego system).
// Wygląd tak samo (`MOJE_CV_APPEARANCE`, domyślnie jasny; zmienna z otoczenia testu ma pierwszeństwo, żeby dało się
// przejść cały zestaw w ciemnym wyglądzie), a `appearance: null` zostawia wybór menu Wygląd / Appearance.
// Playwright domyślnie emuluje `prefers-color-scheme: light` w każdym oknie; `colorScheme: null` wyłącza emulację
// i zostawia to Electronowi (`nativeTheme`), bo inaczej ciemny wygląd nigdy nie dotarłby do renderera.
// `extraEnv` dokłada zmienne dla jednego testu (np. krótszy limit czasu wydruku `MOJE_CV_PRINT_TIMEOUT_MS`).
async function launch({
  language = 'en',
  appearance = isAppearance(process.env['MOJE_CV_APPEARANCE']) ? process.env['MOJE_CV_APPEARANCE'] : 'light',
  extraEnv = {}
}: { language?: InterfaceLanguage | null; appearance?: Appearance | null; extraEnv?: Record<string, string> } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { ...process.env, ...extraEnv } as Record<string, string>
  // Okno w tle (bez fokusu i niewidoczne); `MOJE_CV_E2E_HEADED=1` pokazuje je normalnie do debugowania.
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  // Bez sprawdzania nowej wersji przy starcie: żaden test nie łączy się z GitHubem (ADR-0006).
  env['MOJE_CV_UPDATE_URL'] = 'off'
  if (language) env['MOJE_CV_LANGUAGE'] = language
  else delete env['MOJE_CV_LANGUAGE']
  if (appearance) env['MOJE_CV_APPEARANCE'] = appearance
  else delete env['MOJE_CV_APPEARANCE']
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env, colorScheme: null }
      : { args: ['.', userDataDir], env, colorScheme: null }
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

// Aktywność pozycji wskazanego menu (bez separatorów): etykieta → czy da się ją kliknąć.
async function menuEnabled(menuLabel: string) {
  return app.evaluate(({ Menu }, menuLabel) => {
    const submenu = Menu.getApplicationMenu()?.items.find((item) => item.label === menuLabel)?.submenu?.items ?? []
    return Object.fromEntries(submenu.filter((item) => item.type !== 'separator').map((item) => [item.label, item.enabled]))
  }, menuLabel)
}

// Menu Language ma etykietę w języku interfejsu („Language”, „Język / Language”…), więc szukamy go po pozycji English.
async function languageMenuLabel() {
  return app.evaluate(({ Menu }) => {
    const items = Menu.getApplicationMenu()?.items ?? []
    const menu = items.find((item) => item.submenu?.items.some((entry) => entry.label === 'English'))
    if (!menu) throw new Error('Brak menu Language')
    return menu.label
  })
}

// Wybiera język w menu Language (etykieta pozycji w jej własnym języku, np. „Polski”, albo „System” po angielsku).
async function chooseLanguage(itemLabel: string) {
  await clickMenuItem(await languageMenuLabel(), itemLabel)
}

// Pozycje menu Language: wszystkie języki w ich własnych nazwach, alfabetycznie, i System na końcu.
const languageItems = (checked: string) =>
  [
    'Bahasa Indonesia',
    'Čeština',
    'Deutsch',
    'English',
    'Español',
    'Français',
    'Italiano',
    'Nederlands',
    'Polski',
    'Português',
    'Română',
    'Svenska',
    'Tiếng Việt',
    'Türkçe',
    'Русский',
    'Українська',
    'System'
  ].map((label) => (label === checked ? `${label} ✓` : label))

// Podmienia otwieranie adresów w przeglądarce systemowej i zapamiętuje, z czym je wywołano (jak w sponsor.spec.ts).
async function stubOpenExternal() {
  await app.evaluate(({ shell }) => {
    const calls: string[] = []
    ;(globalThis as { openExternalCalls?: typeof calls }).openExternalCalls = calls
    shell.openExternal = async (url: string) => {
      calls.push(url)
    }
  })
}

const openExternalCalls = () => app.evaluate(() => (globalThis as { openExternalCalls?: string[] }).openExternalCalls)

const clearOpenExternalCalls = () =>
  app.evaluate(() => {
    ;(globalThis as { openExternalCalls?: string[] }).openExternalCalls?.splice(0)
  })

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
    await expect.poll(() => window.title()).toBe('CV Press')
  }

  await app.close()
  await launch({ language: 'en' })
  expect((await menuLabels('Edit')).top).toEqual(['CV Press', 'File', 'Edit', 'View', 'Language', 'Appearance', 'Window', 'Help'])
  expect((await menuLabels('CV Press')).items).toEqual([
    'About CV Press',
    'Services',
    'Hide CV Press',
    'Hide Others',
    'Show All',
    'Quit CV Press'
  ])
  expect((await menuLabels('File')).items).toEqual([
    'New CV',
    'Add Sample CV',
    'Import…',
    'Export JSON…',
    'Export to PDF…',
    'Close Window'
  ])
  expect((await menuLabels('Edit')).items).toEqual(['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select All'])
  expect((await menuLabels('View')).items).toEqual(['Toggle Full Screen'])
  expect((await menuLabels('Window')).items).toEqual(['Minimize', 'Zoom', 'Bring All to Front'])
  expect((await menuLabels('Language')).items).toEqual(languageItems('System'))
  expect((await menuLabels('Help')).items).toEqual([
    'CV Press Help',
    'Privacy Policy',
    'Report a Problem…',
    'Check for Updates…',
    'Support CV Press…'
  ])

  await app.close()
  await launch({ language: 'pl' })
  expect((await menuLabels('Edycja')).top).toEqual(['CV Press', 'Plik', 'Edycja', 'Widok', 'Język / Language', 'Wygląd', 'Okno', 'Pomoc'])
  expect((await menuLabels('CV Press')).items).toEqual([
    'O aplikacji CV Press',
    'Usługi',
    'Ukryj CV Press',
    'Ukryj pozostałe',
    'Pokaż wszystkie',
    'Zakończ CV Press'
  ])
  expect((await menuLabels('Edycja')).items).toEqual(['Cofnij', 'Ponów', 'Wytnij', 'Kopiuj', 'Wklej', 'Zaznacz wszystko'])
  expect((await menuLabels('Plik')).items).toEqual([
    'Nowe CV',
    'Dodaj przykładowe CV',
    'Importuj…',
    'Eksportuj JSON…',
    'Eksportuj do PDF…',
    'Zamknij okno'
  ])
  expect((await menuLabels('Widok')).items).toEqual(['Przełącz pełny ekran'])
  expect((await menuLabels('Okno')).items).toEqual(['Minimalizuj', 'Zoom', 'Przenieś wszystko na wierzch'])
  expect((await menuLabels('Pomoc')).items).toEqual([
    'Pomoc CV Press',
    'Polityka prywatności',
    'Zgłoś problem…',
    'Sprawdź aktualizacje…',
    'Wesprzyj CV Press…'
  ])
})

// „Check for Updates…” nie otwiera adresu sam, tylko pokazuje dialog – sprawdza to e2e/updates.spec.ts.
test('each Help menu item opens exactly its own address in the system browser, also after switching the language', async () => {
  await app.close()
  await launch({ language: null })
  await chooseLanguage('English')
  await stubOpenExternal()
  const expected = [
    ['CV Press Help', HELP_URL],
    ['Privacy Policy', PRIVACY_URL],
    ['Report a Problem…', REPORT_ISSUE_URL],
    ['Support CV Press…', SPONSOR_URL]
  ] as const
  for (const [label, url] of expected) {
    await clearOpenExternalCalls()
    await clickMenuItem('Help', label)
    expect(await openExternalCalls()).toEqual([url])
  }

  await chooseLanguage('Polski')
  await expect.poll(() => menuLabels('Pomoc')).toMatchObject({
    items: ['Pomoc CV Press', 'Polityka prywatności', 'Zgłoś problem…', 'Sprawdź aktualizacje…', 'Wesprzyj CV Press…']
  })
  await clearOpenExternalCalls()
  await clickMenuItem('Pomoc', 'Zgłoś problem…')
  expect(await openExternalCalls()).toEqual([REPORT_ISSUE_URL])
})

test('the Language menu switches the menu and the window immediately, the choice survives a restart and System follows the system again', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['ja-JP', 'pl-PL'])

  await chooseLanguage('English')
  await expect.poll(() => menuLabels('Language')).toEqual({
    top: ['CV Press', 'File', 'Edit', 'View', 'Language', 'Appearance', 'Window', 'Help'],
    items: languageItems('English')
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'en')

  await chooseLanguage('Polski')
  await expect.poll(() => menuLabels('Język / Language')).toEqual({
    top: ['CV Press', 'Plik', 'Edycja', 'Widok', 'Język / Language', 'Wygląd', 'Okno', 'Pomoc'],
    items: languageItems('Polski')
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
  expect((await menuLabels('Język / Language')).items).toEqual(languageItems('Polski'))
  await expect(window.locator('html')).toHaveAttribute('lang', 'pl')

  // System: pierwszy obsługiwany język systemu, a bez takiego angielski.
  await stubSystemLanguages(['ja-JP'])
  await chooseLanguage('System')
  await expect.poll(() => menuLabels('Language')).toEqual({
    top: ['CV Press', 'File', 'Edit', 'View', 'Language', 'Appearance', 'Window', 'Help'],
    items: languageItems('System')
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'en')

  // System z niemieckim systemem: niemiecki, z dwujęzyczną etykietą menu.
  await stubSystemLanguages(['de-DE', 'en-US'])
  await chooseLanguage('System')
  await expect.poll(() => menuLabels('Sprache / Language')).toEqual({
    top: ['CV Press', 'Ablage', 'Bearbeiten', 'Darstellung', 'Sprache / Language', 'Erscheinungsbild', 'Fenster', 'Hilfe'],
    items: languageItems('System')
  })
  await expect(window.locator('html')).toHaveAttribute('lang', 'de')
})

test('Appearance switches the app immediately, the choice survives a restart and System follows the system again', async () => {
  const themeSource = () => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)
  const prefersDark = () =>
    window
      .locator('html')
      .evaluate((element) => element.ownerDocument.defaultView!.matchMedia('(prefers-color-scheme: dark)').matches)
  // Wybór jest stosowany od razu, a zapis do pliku ustawień kończy się chwilę później; przed zamknięciem aplikacji
  // czekamy na zapis, żeby restart nie wyprzedził pliku.
  const savedAppearance = async () => {
    const settings = await readFile(join(outputDir, 'user-data', 'settings.json'), 'utf8').catch(() => '{}')
    return (JSON.parse(settings) as { appearance?: string }).appearance
  }

  // Bez wymuszenia i bez wyboru: Systemowy.
  await app.close()
  await launch({ appearance: null })
  expect((await menuLabels('Appearance')).items).toEqual(['Light', 'Dark', 'System ✓'])
  expect(await themeSource()).toBe('system')

  await clickMenuItem('Appearance', 'Dark')
  await expect.poll(() => menuLabels('Appearance')).toMatchObject({ items: ['Light', 'Dark ✓', 'System'] })
  expect(await themeSource()).toBe('dark')
  await expect.poll(prefersDark).toBe(true)
  await expect.poll(savedAppearance).toBe('dark')

  await app.close()
  await launch({ language: 'pl', appearance: null })
  expect((await menuLabels('Wygląd')).items).toEqual(['Jasny', 'Ciemny ✓', 'Systemowy'])
  expect(await themeSource()).toBe('dark')
  await expect.poll(prefersDark).toBe(true)

  await clickMenuItem('Wygląd', 'Jasny')
  await expect.poll(() => menuLabels('Wygląd')).toMatchObject({ items: ['Jasny ✓', 'Ciemny', 'Systemowy'] })
  expect(await themeSource()).toBe('light')
  await expect.poll(prefersDark).toBe(false)

  await clickMenuItem('Wygląd', 'Systemowy')
  await expect.poll(() => menuLabels('Wygląd')).toMatchObject({ items: ['Jasny', 'Ciemny', 'Systemowy ✓'] })
  expect(await themeSource()).toBe('system')

  // Wymuszenie zmienną środowiskową wygrywa z zapisanym wyborem, ale zaznaczenie w menu pokazuje wybór użytkownika.
  await clickMenuItem('Wygląd', 'Ciemny')
  await expect.poll(themeSource).toBe('dark')
  await expect.poll(savedAppearance).toBe('dark')
  await app.close()
  await launch({ language: 'en', appearance: 'light' })
  expect((await menuLabels('Appearance')).items).toEqual(['Light', 'Dark ✓', 'System'])
  expect(await themeSource()).toBe('light')
  await expect.poll(prefersDark).toBe(false)
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
  await expect(window.getByRole('heading', { name: 'CV Press' })).toBeVisible()
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
  await window.getByRole('button', { name: '← CV library' }).click()
  await expect(library).toBeVisible()
})

test('switching the language in the menu immediately translates the CV library and the clause library', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['en-US'])
  await expect(window.getByRole('button', { name: 'New CV' })).toBeVisible()
  await expect(window.getByRole('listitem').first()).toContainText(/Modified \d{1,2}\/\d{1,2}\/\d{2}/)

  await chooseLanguage('Polski')
  await expect(window.getByRole('button', { name: 'Nowe CV' })).toBeVisible()
  await expect(window.getByRole('list', { name: 'Lista CV' }).getByRole('listitem')).toContainText(
    /Zmieniono \d{1,2}\.\d{2}\.\d{4}, \d{2}:\d{2}/
  )

  await window.getByRole('button', { name: 'Klauzule zgody' }).click()
  await expect(window.getByRole('heading', { name: 'Klauzule zgody' })).toBeVisible()
  await chooseLanguage('English')
  await expect(window.getByRole('heading', { name: 'Consent clauses' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add clause' })).toBeVisible()
})

test('the CV editor is in English, including the save status, photo cropping and the export actions', async () => {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()

  // Pasek narzędzi: powrót do biblioteki CV i nazwa CV jako przycisk zmiany nazwy w nagłówku.
  await expect(window.getByRole('button', { name: '← CV library' })).toBeVisible()
  await expect(window.locator('.toolbar').getByRole('heading').getByRole('button', { name: 'Rename CV: Sample CV' })).toBeVisible()

  // Formularz: CV design, nagłówek, sekcje z kolejnością, wpisy i klauzula zgody.
  await expect(window.getByRole('heading', { name: 'CV design', exact: true })).toBeVisible()
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
  for (const label of ['Job title', 'Company', 'City', 'From', 'To', 'I currently work here', 'Bullet 1', 'New page before this entry']) {
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
  // Powiadomienie jest pod paskiem narzędzi (nie rozpycha go) i da się je zamknąć.
  await expect(window.locator('.toolbar').getByText('Saved PDF')).toHaveCount(0)
  await exported.getByRole('button', { name: 'Dismiss message' }).click()
  await expect(window.getByText('Saved PDF')).toHaveCount(0)
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = (async () => {
      throw new Error('disk full')
    }) as typeof dialog.showSaveDialog
  })
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  const exportFailed = window.getByRole('alert').filter({ hasText: 'Couldn’t save the PDF. Try again.' })
  await expect(exportFailed).toBeVisible()
  await exportFailed.getByRole('button', { name: 'Dismiss message' }).click()
  await expect(exportFailed).toHaveCount(0)

  // Nieudany autozapis (plik CV zniknął z dysku).
  await rm(join(outputDir, 'user-data', 'cvs'), { recursive: true })
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('alert').filter({ hasText: 'Couldn’t save changes' })).toHaveText(
    'Couldn’t save changes. Your latest edits are only in this window for now.Try again'
  )
  await leaveEditorAnyway()
})

test('switching the language in the menu translates the open editor without losing unsaved changes or the undo history', async () => {
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['en-US'])
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  const original = await window.getByLabel('Full name').inputValue()
  await window.getByLabel('Full name').fill('Ewa Nowak')

  await chooseLanguage('Polski')
  const fullName = window.getByLabel('Imię i nazwisko')
  await expect(fullName).toHaveValue('Ewa Nowak')
  await expect(window.getByRole('button', { name: 'Eksportuj do PDF' })).toBeVisible()
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()

  await clickMenuItem('Edycja', 'Cofnij')
  await expect(fullName).toHaveValue(original)
  await chooseLanguage('English')
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
  await window.getByRole('button', { name: '← CV library' }).click()

  // Nowe CV i kopia po angielsku.
  await window.getByRole('button', { name: 'New CV' }).click()
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Duplicate' }).click()
  await expect(rows.filter({ hasText: 'Sample CV (copy)' })).toHaveCount(1)
  await rows.filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByRole('heading', { name: 'New CV' })).toBeVisible()
  await expect.poll(() => inputValues(window.locator('.form-contact-label'))).toEqual(['Phone', 'Email', 'LinkedIn', 'City'])
  await expect.poll(() => inputValues(window.getByLabel(/^Section title/))).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
  await window.getByRole('button', { name: '← CV library' }).click()

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
  await window.getByRole('button', { name: '← Biblioteka CV' }).click()
  await polishRows.filter({ hasText: 'Nowe CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect.poll(() => inputValues(window.locator('.form-contact-label'))).toEqual(['Tel', 'E-mail', 'LinkedIn', 'Miasto'])
  await expect.poll(() => inputValues(window.getByLabel(/^Tytuł sekcji/))).toEqual(['Doświadczenie zawodowe', 'Wykształcenie', 'Umiejętności', 'Języki'])
})

test('the arrow next to New CV adds the Sample CV again in the interface language, clearing the tag filter', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem')
  const cvNames = () => rows.locator('.library-item-name')
  const arrow = window.getByRole('button', { name: 'More ways to create' })
  const menu = window.getByRole('menu')

  // Użytkownik usunął Sample CV – biblioteka jest pusta, a „New CV” nadal tworzy puste CV jednym kliknięciem.
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rows).toHaveCount(0)
  await expect(window.getByText('You don’t have any CVs yet. Click “New CV”.')).toBeVisible()
  await window.getByRole('button', { name: 'New CV', exact: true }).click()
  await expect(cvNames()).toHaveText(['New CV'])
  await expect(menu).toHaveCount(0)

  // Strzałka to przycisk rozwijający menu; Escape i kliknięcie poza menu je zamykają.
  await expect(arrow).toHaveAttribute('aria-haspopup', 'menu')
  await expect(arrow).toHaveAttribute('aria-expanded', 'false')
  await arrow.click()
  await expect(arrow).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('menuitem')).toHaveText(['Add sample CV'])
  await window.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(arrow).toHaveAttribute('aria-expanded', 'false')
  await expect(arrow).toBeFocused()
  await arrow.click()
  await expect(menu).toBeVisible()
  await window.locator('.library').click({ position: { x: 5, y: 5 } })
  await expect(menu).toHaveCount(0)

  // Z klawiatury: Enter otwiera menu z fokusem na pozycji, Enter ją wybiera. Filtr tagów zostaje wyczyszczony.
  await rows.filter({ hasText: 'New CV' }).getByRole('button', { name: 'Tags' }).click()
  const newTag = library.getByLabel('New tag')
  await newTag.fill('mine')
  await newTag.press('Enter')
  await library.getByRole('button', { name: 'Done' }).click()
  const filterBar = window.getByRole('group', { name: 'Filter by tag' })
  await filterBar.getByRole('button', { name: 'mine', exact: true }).click()
  await expect(cvNames()).toHaveText(['New CV'])
  await arrow.focus()
  await window.keyboard.press('Enter')
  await expect(menu.getByRole('menuitem', { name: 'Add sample CV' })).toBeFocused()
  await window.keyboard.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(filterBar.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(cvNames()).toHaveText(['Sample CV', 'New CV'])

  // Dodany Sample CV jest po angielsku, bez klauzuli; każde dodanie to osobne CV o tej samej nazwie.
  await arrow.click()
  await menu.getByRole('menuitem', { name: 'Add sample CV' }).click()
  await expect(cvNames()).toHaveText(['Sample CV', 'Sample CV', 'New CV'])
  await rows.first().getByRole('button', { name: 'Open' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-name')).toHaveText('Jane Example')
  await expect(preview.locator('.cv-page .cv-section-title')).toHaveText(['Work experience', 'Education', 'Skills', 'Languages'])
  await expect(preview.locator('.cv-consent')).toHaveCount(0)
  await window.getByRole('button', { name: '← CV library' }).click()

  // Po przełączeniu na polski etykiety zmieniają się od razu, a nowy Sample CV jest polski, z wbudowaną klauzulą zgody.
  await app.close()
  await launch({ language: null })
  await stubSystemLanguages(['en-US'])
  await expect(window.getByRole('button', { name: 'More ways to create' })).toBeVisible()
  await chooseLanguage('Polski')
  const polishArrow = window.getByRole('button', { name: 'Więcej opcji tworzenia' })
  await polishArrow.click()
  await window.getByRole('menu').getByRole('menuitem', { name: 'Dodaj przykładowe CV' }).click()
  const polishRows = window.getByRole('list', { name: 'Lista CV' }).getByRole('listitem')
  await expect(polishRows.locator('.library-item-name')).toHaveText(['Przykładowe CV', 'Sample CV', 'Sample CV', 'New CV'])
  await polishRows.first().getByRole('button', { name: 'Otwórz' }).click()
  const polishPreview = window.locator('.preview')
  await expect(polishPreview.locator('.cv-page .cv-name')).toHaveText('Anna Przykładowa')
  await expect(polishPreview.locator('.cv-page .cv-consent')).toContainText('Wyrażam zgodę na przetwarzanie moich danych osobowych')
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
    ['{ "schemaVersion": 99 }', 'Couldn’t import the CV. The file comes from a newer version of the app. Update the app to import it.'],
    [
      JSON.stringify({ ...sampleCvs.en, tags: ['Allegro', 'x'.repeat(31)] }),
      'Couldn’t import the CV. The CV in the file has a tag longer than 30 characters.'
    ]
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
  await expect(window.getByRole('radiogroup', { name: 'Szablon' }).getByRole('radio', { name: 'Klasyczny' })).toBeChecked()
  await expect(window.getByRole('heading', { name: 'Projekt CV', exact: true })).toBeVisible()
  await expect(window.getByLabel('Nadal tu pracuję').first()).toBeChecked()
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
  await window.getByRole('button', { name: '← Biblioteka CV' }).click()
  const invalidPath = join(outputDir, 'zepsute.json')
  await writeFile(invalidPath, '{ "name": "Nie CV" }')
  await stubOpenDialog(invalidPath)
  await window.getByRole('button', { name: 'Importuj z pliku' }).click()
  await expect(window.getByRole('alert')).toHaveText('Nie udało się zaimportować CV. Plik nie zawiera poprawnego CV.')
  await expect(library.getByRole('listitem')).toHaveCount(1)
})

// Folder danych („Moje CV”) nie wynika z tej nazwy – jest przypięty w `src/main/index.ts`.
test('the packaged app identifies itself as „CV Press”', async () => {
  test.skip(!packagedExecutable, 'dotyczy tylko zbudowanej aplikacji')
  const identity = await app.evaluate(({ app }) => ({ name: app.getName(), isPackaged: app.isPackaged }))
  expect(identity).toEqual({ name: 'CV Press', isPackaged: true })
})

test('on first run opens the sample CV, edits it and exports it to a PDF identical to the preview; the edit survives a restart', async () => {
  const pdfPath = join(outputDir, 'export.pdf')
  await stubSaveDialog(pdfPath)

  const library = window.getByRole('list', { name: 'CV list' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(library.getByText('Sample CV')).toBeVisible()
  await library.getByRole('button', { name: 'Open' }).click()

  await expect(window.locator('.cv-page').first()).toBeVisible()
  // Podgląd renderuje szablon zapisany w CV – przykładowe CV ma „Klasyczny”.
  await expect(window.locator('.preview .cv.cv-template-classic')).toHaveCount(1)

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
  await window.getByRole('button', { name: '← CV library' }).click()
  await window.getByRole('button', { name: 'New CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Accent color')).toHaveValue('#1a6e72')
  await expect(window.getByLabel('Font')).toHaveValue('lato')
  await window.getByRole('button', { name: '← CV library' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Accent color')).toHaveValue('#8a2be2')
  await expect(window.getByLabel('Font')).toHaveValue('arimo')
})

test('the CV language sets the fixed text and the page language of the document, never the CV content', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  const firstDates = preview.locator('.cv-page .cv-date').first()
  const sectionTitles = preview.locator('.cv-page .cv-section-title')
  await expect(firstDates).toHaveText('03.2023 – present')

  // Angielskie Sample CV jest w języku, w którym je napisano: „present” w podglądzie i w PDF.
  const language = window.getByLabel('CV language')
  await expect(language).toHaveValue('en')
  await expect(preview.locator('.cv')).toHaveAttribute('lang', 'en')
  const englishPdf = join(outputDir, 'english.pdf')
  await stubSaveDialog(englishPdf)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: english.pdf')).toBeVisible()
  const english = (await readPdf(await readFile(englishPdf))).pages.join('')
  expect(english).toContain('03.2023 – present')
  expect(english).not.toContain('obecnie')

  // Polski jako CV language: stały tekst po polsku, tytuły sekcji i reszta treści bez zmian; wybór zostaje w CV.
  const titlesBefore = await sectionTitles.allTextContents()
  await language.selectOption('pl')
  await expect(firstDates).toHaveText('03.2023 – obecnie')
  await expect(preview.locator('.cv')).toHaveAttribute('lang', 'pl')
  expect(await sectionTitles.allTextContents()).toEqual(titlesBefore)
  await expect(window.getByText('Changes saved')).toBeVisible()
  const polishPdf = join(outputDir, 'polish.pdf')
  await stubSaveDialog(polishPdf)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: polish.pdf')).toBeVisible()
  const polish = (await readPdf(await readFile(polishPdf))).pages.join('')
  expect(polish).toContain('03.2023 – obecnie')
  expect(polish).toContain('Work experience')

  await window.getByRole('button', { name: '← CV library' }).click()
  await openFirstCv()
  await expect(window.getByLabel('CV language')).toHaveValue('pl')

  // Nowe CV startuje w języku interfejsu.
  await window.getByRole('button', { name: '← CV library' }).click()
  await window.getByRole('button', { name: 'New CV' }).click()
  await window
    .getByRole('list', { name: 'CV list' })
    .getByRole('listitem')
    .filter({ hasText: 'New CV' })
    .getByRole('button', { name: 'Open' })
    .click()
  await expect(window.getByLabel('CV language')).toHaveValue('en')
})

test('Cyrillic text in a Lato CV is rendered with the bundled Source Sans 3, not a system font', async () => {
  const pdfPath = join(outputDir, 'cyrillic.pdf')
  await stubSaveDialog(pdfPath)
  await openFirstCv()
  await expect(window.getByLabel('Font')).toHaveValue('lato')
  await window.getByLabel('Full name').fill('Олена Шевченко')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Олена Шевченко')
  await expect(window.getByText('Changes saved')).toBeVisible()

  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: cyrillic.pdf')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages[0]).toContain('Олена Шевченко')
  expect(pdf.embeddedFonts.some((name) => name.includes('SourceSans3'))).toBe(true)
  expect(pdf.embeddedFonts.some((name) => name.includes('Lato'))).toBe(true)
  expect(pdf.embeddedFonts.every((name) => name.includes('Lato') || name.includes('SourceSans3'))).toBe(true)
})

test('picks the Template next to the colour and font from a live thumbnail of the CV, without changing the preview or the PDF', async () => {
  const pdfPath = join(outputDir, 'template.pdf')
  await stubSaveDialog(pdfPath)
  await openFirstCv()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()

  // Wybór w sekcji wyglądu, za fontem, dostępny z klawiatury; przykładowe CV ma „Klasyczny”.
  const picker = window.getByRole('radiogroup', { name: 'Template' })
  await expect(picker.getByRole('radio')).toHaveCount(3)
  const classic = picker.getByRole('radio', { name: 'Classic' })
  await expect(classic).toBeChecked()
  await window.getByLabel('Font').focus()
  await window.keyboard.press('Tab')
  await expect(classic).toBeFocused()

  // Miniatura: pomniejszona pierwsza strona bieżącego CV w tym szablonie, odświeżana po edycji treści, koloru i fontu.
  const thumbnail = picker
    .locator('label', { has: window.getByRole('radio', { name: 'Classic' }) })
    .locator('.cv.cv-template-classic')
  await expect(thumbnail.locator('.cv-page')).toHaveCount(1)
  await expect(thumbnail.locator('.cv-page .cv-name')).toHaveText('Jane Example')
  // Bloki są mierzone na szerokości obszaru treści z geometrii szablonu („Klasyczny”: 210 − 12 − 16 = 182 mm) –
  // tej samej co treść na stronie, w podglądzie i w miniaturze (skalowane są same strony, nie pomiar).
  for (const cv of [preview.locator('.cv'), thumbnail]) {
    const widths = await cv.evaluate((element) => {
      const style = (selector: string) => element.ownerDocument.defaultView!.getComputedStyle(element.querySelector(selector)!)
      const width = (selector: string) => parseFloat(style(selector).width)
      return { measure: width('.cv-measure'), pageContent: width('.cv-page-content') }
    })
    expect(widths.measure).toBeCloseTo(182 * PX_PER_MM, 1)
    expect(widths.pageContent).toBeCloseTo(widths.measure, 1)
  }
  const thumbnailBox = await thumbnail.locator('.cv-page').boundingBox()
  const previewPageBox = await preview.locator('.cv-page').first().boundingBox()
  expect(thumbnailBox!.width).toBeLessThan(previewPageBox!.width / 2)

  await window.getByLabel('Full name').fill('Ewa Nowak')
  await expect(thumbnail.locator('.cv-page .cv-name')).toHaveText('Ewa Nowak')
  await window.getByLabel('Accent color').fill('#8a2be2')
  await expect(thumbnail.locator('.cv-page .cv-name')).toHaveCSS('color', 'rgb(138, 43, 226)')
  await window.getByLabel('Font').selectOption('arimo')
  await expect(thumbnail.locator('.cv-page .cv-name')).toHaveCSS('font-family', /^"?Arimo"?,/)
  await expect(window.getByText('Changes saved')).toBeVisible()

  // Podgląd i PDF jak dotąd: jeden dokument „Klasyczny”, ta sama liczba stron, bez miniatur.
  await expect(window.locator('.preview .cv')).toHaveCount(1)
  await expect(window.locator('.preview .cv.cv-template-classic')).toHaveCount(1)
  const previewPageCount = await preview.locator('.cv-page').count()
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: template.pdf')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(previewPageCount)
  expect(pdf.pages[0]!.match(/Ewa Nowak/g)).toHaveLength(1)
})

test('switches the CV to the Modern template and back: the preview and PDF follow, with page footers, and nothing else changes', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()
  // Każdy eksport do osobnego pliku, żeby komunikat o zapisie wskazywał właśnie ten eksport.
  const exportPdf = async (fileName: string) => {
    const pdfPath = join(outputDir, fileName)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: 'Export to PDF' }).click()
    await expect(window.getByText(`Saved PDF: ${fileName}`)).toBeVisible()
    return readPdf(await readFile(pdfPath))
  }

  // Kolor, font i ręczny podział strony – mają przetrwać zmianę szablonu.
  await window.getByLabel('Accent color').fill('#e9b949')
  await window.getByLabel('Font').selectOption('arimo')
  const education = window.getByRole('region', { name: 'Education', exact: true })
  await education.getByLabel('New page before this section').check()
  const firstBlocks = preview.locator('.cv-page-content > .cv-block:first-child')
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Education'])
  const classicPageCount = await preview.locator('.cv-page').count()
  const classicPdf = await exportPdf('classic.pdf')

  // „Nowoczesny” z miniatury: podgląd od razu w nowym szablonie, ze stopką „imię … n / N” na każdej stronie.
  const picker = window.getByRole('radiogroup', { name: 'Template' })
  const modern = picker.getByRole('radio', { name: 'Modern' })
  const option = (name: string) => picker.locator('label', { has: window.getByRole('radio', { name }) })
  await expect(option('Modern').locator('.cv.cv-template-modern .cv-page .cv-page-footer')).toContainText('Jane Example')
  await option('Modern').click()
  await expect(modern).toBeChecked()
  await expect(preview.locator('.cv.cv-template-modern')).toHaveCount(1)
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Education'])
  const pageCount = await preview.locator('.cv-page').count()
  expect(pageCount).toBeGreaterThan(1)
  await expect(preview.locator('.cv-page .cv-page-footer')).toHaveText(
    Array.from({ length: pageCount }, (_, index) => `Jane Example${index + 1} / ${pageCount}`)
  )
  // Stopka stoi w dolnym marginesie, pod obszarem treści.
  const contentBox = await preview.locator('.cv-page-content').first().boundingBox()
  const footerBox = await preview.locator('.cv-page-footer').first().boundingBox()
  expect(footerBox!.y).toBeGreaterThanOrEqual(contentBox!.y + contentBox!.height)
  // Akcent tylko jako znak: tekst zawsze ciemny, także przy jasnym akcencie.
  await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('color', 'rgb(31, 31, 31)')
  await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('font-family', /^"?Arimo"?,/)
  await expect(window.getByText('Changes saved')).toBeVisible()

  // PDF jak podgląd: te same strony, stopka z numerem strony i ta sama treść.
  const modernPdf = await exportPdf('modern.pdf')
  expect(modernPdf.pages).toHaveLength(pageCount)
  modernPdf.pages.forEach((page, index) => expect(page).toContain(`${index + 1} / ${pageCount}`))
  const text = modernPdf.pages.join(' ').toLowerCase()
  for (const content of ['Jane Example', 'Senior Procurement Specialist', 'Driving licence (category B)', 'English – native']) {
    expect(text).toContain(content.toLowerCase())
  }
  expect(modernPdf.embeddedFonts.some((name) => name.includes('Arimo'))).toBe(true)

  // Cofnij / Ponów jak przy kolorze czy foncie.
  await window.keyboard.press('Meta+z')
  await expect(picker.getByRole('radio', { name: 'Classic' })).toBeChecked()
  await expect(preview.locator('.cv.cv-template-classic')).toHaveCount(1)
  await window.keyboard.press('Meta+Shift+z')
  await expect(modern).toBeChecked()

  // Powrót do „Klasycznego” bez strat: ten sam podgląd i ten sam PDF co przed zmianą szablonu.
  await option('Classic').click()
  await expect(preview.locator('.cv.cv-template-classic')).toHaveCount(1)
  await expect(preview.locator('.cv-page-footer')).toHaveCount(0)
  await expect(window.getByLabel('Accent color')).toHaveValue('#e9b949')
  await expect(window.getByLabel('Font')).toHaveValue('arimo')
  await expect(education.getByLabel('New page before this section')).toBeChecked()
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Education'])
  await expect(preview.locator('.cv-page')).toHaveCount(classicPageCount)
  const classicAgainPdf = await exportPdf('classic-again.pdf')
  expect(classicAgainPdf.pages).toEqual(classicPdf.pages)
})

test('switches the CV to the Bold template and back: text on the accent follows its lightness, the PDF has the same content, and nothing else changes', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()
  const exportPdf = async (fileName: string) => {
    const pdfPath = join(outputDir, fileName)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: 'Export to PDF' }).click()
    await expect(window.getByText(`Saved PDF: ${fileName}`)).toBeVisible()
    return readPdf(await readFile(pdfPath))
  }

  // Jasny akcent, font i ręczny podział strony – mają przetrwać zmianę szablonu.
  await window.getByLabel('Accent color').fill('#e9b949')
  await window.getByLabel('Font').selectOption('arimo')
  const education = window.getByRole('region', { name: 'Education', exact: true })
  await education.getByLabel('New page before this section').check()
  const firstBlocks = preview.locator('.cv-page-content > .cv-block:first-child')
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Education'])
  const classicPageCount = await preview.locator('.cv-page').count()
  const classicPdf = await exportPdf('classic.pdf')

  const picker = window.getByRole('radiogroup', { name: 'Template' })
  const bold = picker.getByRole('radio', { name: 'Bold' })
  const option = (name: string) => picker.locator('label', { has: window.getByRole('radio', { name }) })
  await expect(option('Bold').locator('.cv.cv-template-bold .cv-page .cv-name')).toHaveText('Jane Example')
  await option('Bold').click()
  await expect(bold).toBeChecked()
  await expect(preview.locator('.cv.cv-template-bold')).toHaveCount(1)
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Education'])
  const pageCount = await preview.locator('.cv-page').count()
  expect(pageCount).toBeGreaterThan(1)
  await expect(preview.locator('.cv-page .cv-page-footer')).toHaveText(
    Array.from({ length: pageCount }, (_, index) => `Jane Example${index + 1} / ${pageCount}`)
  )
  // Na jasnym akcencie tekst na pasie i w pigułkach jest czarny, na ciemnym – biały.
  const name = preview.locator('.cv-page .cv-name')
  await expect(name).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(preview.locator('.cv-page .cv-section-title').first()).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(name).toHaveCSS('font-family', /^"?Arimo"?,/)
  await window.getByLabel('Accent color').fill('#1a6e72')
  await expect(name).toHaveCSS('color', 'rgb(255, 255, 255)')
  await window.getByLabel('Accent color').fill('#e9b949')
  await expect(window.getByText('Changes saved')).toBeVisible()

  const boldPdf = await exportPdf('bold.pdf')
  expect(boldPdf.pages).toHaveLength(pageCount)
  const text = boldPdf.pages.join(' ').toLowerCase()
  for (const content of ['Jane Example', 'Senior Procurement Specialist', 'Driving licence (category B)', 'English – native']) {
    expect(text).toContain(content.toLowerCase())
  }
  expect(boldPdf.embeddedFonts.some((name) => name.includes('Arimo'))).toBe(true)

  // Powrót do „Klasycznego” bez strat: ten sam podgląd i ten sam PDF co przed zmianą szablonu.
  await option('Classic').click()
  await expect(preview.locator('.cv.cv-template-classic')).toHaveCount(1)
  await expect(window.getByLabel('Accent color')).toHaveValue('#e9b949')
  await expect(window.getByLabel('Font')).toHaveValue('arimo')
  await expect(education.getByLabel('New page before this section')).toBeChecked()
  await expect(preview.locator('.cv-page')).toHaveCount(classicPageCount)
  const classicAgainPdf = await exportPdf('classic-again.pdf')
  expect(classicAgainPdf.pages).toEqual(classicPdf.pages)
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
  await window.getByRole('button', { name: '← CV library' }).click()
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
  await window.getByRole('button', { name: '← CV library' }).click()
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

  // Eksport najpierw pyta, czy uciąć treść: „Cancel” wraca do edycji bez okna zapisu.
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  const confirm = window.getByRole('dialog', { name: 'Some content doesn’t fit on a page and will be cut off. Export anyway?' })
  await expect(confirm).toContainText('The fragments that are too long are highlighted in the preview.')
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toBeHidden()
  const saveDialogCalls = () =>
    app.evaluate(() => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls!.length)
  expect(await saveDialogCalls()).toBe(0)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await window.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
  expect(await saveDialogCalls()).toBe(0)

  // „Export anyway” eksportuje jak dotąd, a wyróżnienie nie trafia do PDF.
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await confirm.getByRole('button', { name: 'Export anyway' }).click()
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

test('while the PDF is prepared a progress bar is shown, and a print page that never gets ready ends with its own message', async () => {
  await app.close()
  await launch({ extraEnv: { MOJE_CV_PRINT_TIMEOUT_MS: '2000' } })
  await stubSaveDialog(join(outputDir, 'never.pdf'))
  await app.evaluate(({ ipcMain }) => ipcMain.removeAllListeners('print:ready'))
  await openFirstCv()
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByRole('progressbar', { name: 'Preparing the PDF…' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Exporting…' })).toBeDisabled()
  const timedOut = window.getByRole('alert').filter({ hasText: 'Preparing the PDF took too long and was stopped. Try again.' })
  await expect(timedOut).toBeVisible()
  await expect(window.getByRole('progressbar')).toHaveCount(0)
  await expect(window.getByText('Couldn’t save the PDF')).toHaveCount(0)
  expect(await app.evaluate(() => (globalThis as { saveDialogCalls?: unknown[] }).saveDialogCalls!.length)).toBe(0)
  await timedOut.getByRole('button', { name: 'Dismiss message' }).click()
  await expect(timedOut).toHaveCount(0)
  await expect(window.getByRole('button', { name: 'Export to PDF' })).toBeEnabled()
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
  await window.getByRole('button', { name: '← CV library' }).click()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
  await expect(window.getByLabel('Summary')).toHaveValue(originalSummary)
})

test('in the CV library Edit → Undo undoes typing in the rename field and never changes the closed CV', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  await library.getByRole('button', { name: 'Open' }).click()
  await window.getByLabel('Full name').fill('Ewa Nowak')
  await expect(window.getByText('Changes saved')).toBeVisible()
  await window.getByRole('button', { name: '← CV library' }).click()

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

test('the CV name in the editor header is renamed in place: Enter or leaving the field keeps it, Escape and an empty name do not, Cmd+Z undoes it', async () => {
  await openFirstCv()
  const toolbar = window.locator('.toolbar')
  const heading = toolbar.getByRole('heading')
  const nameButton = (name: string) => heading.getByRole('button', { name: `Rename CV: ${name}`, exact: true })
  const field = toolbar.getByLabel('CV name')
  await expect(heading).toHaveText('Sample CV')

  // Kliknięcie zamienia nazwę w pole z zaznaczonym tekstem; Escape anuluje i oddaje fokus przyciskowi.
  await nameButton('Sample CV').click()
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('Sample CV')
  await expect(field).toHaveJSProperty('selectionStart', 0)
  await expect(field).toHaveJSProperty('selectionEnd', 'Sample CV'.length)
  await field.fill('Not this one')
  await field.press('Escape')
  await expect(nameButton('Sample CV')).toBeFocused()

  // Pusta nazwa (same spacje) nie powstaje: wraca poprzednia.
  await nameButton('Sample CV').click()
  await field.fill('   ')
  await field.press('Enter')
  await expect(nameButton('Sample CV')).toBeFocused()

  // Enter zatwierdza przyciętą nazwę; nazwa CV nie trafia do dokumentu.
  await nameButton('Sample CV').click()
  await field.fill('  CV for the bank ')
  await field.press('Enter')
  await expect(nameButton('CV for the bank')).toBeFocused()
  await expect(window.locator('.preview')).not.toContainText('CV for the bank')

  // Zmiana nazwy to jeden krok cofania, jak każda zmiana CV.
  await window.keyboard.press('Meta+z')
  await expect(heading).toHaveText('Sample CV')
  await window.keyboard.press('Meta+Shift+z')
  await expect(heading).toHaveText('CV for the bank')

  // Kliknięcie obok też zatwierdza; nazwa zapisuje się autozapisem: w bibliotece i po ponownym uruchomieniu.
  await nameButton('CV for the bank').click()
  await field.fill('CV for the bank, 2026')
  await window.getByLabel('Full name').click()
  await expect(heading).toHaveText('CV for the bank, 2026')
  await window.getByRole('button', { name: '← CV library' }).click()
  const library = window.getByRole('list', { name: 'CV list' })
  await expect(library.locator('.library-item-name')).toHaveText('CV for the bank, 2026')
  await app.close()
  await launch()
  await expect(window.getByRole('list', { name: 'CV list' }).locator('.library-item-name')).toHaveText('CV for the bank, 2026')
})

test('“I currently work here” ends a position with “present” in the CV language, in the preview and the PDF', async () => {
  const pdfPath = join(outputDir, 'present.pdf')
  await stubSaveDialog(pdfPath)
  await openFirstCv()
  const position = window.locator('.form fieldset').filter({ has: window.getByLabel('Job title') }).nth(1)
  const dates = window.locator('.preview .cv-page .cv-date').nth(1)
  await expect(dates).toHaveText('02.2019 – 02.2023')

  await position.getByLabel('I currently work here').check()
  await expect(position.getByLabel('To', { exact: true })).toBeDisabled()
  await expect(dates).toHaveText('02.2019 – present')
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()
  expect((await readPdf(await readFile(pdfPath))).pages.join('')).toContain('02.2019 – present')

  // Odznaczenie przywraca poprzednią datę końca.
  await position.getByLabel('I currently work here').uncheck()
  await expect(dates).toHaveText('02.2019 – 02.2023')
})

test('an end date before the start date shows a warning under the dates, without blocking the export, for positions and education', async () => {
  const warning = 'The end date is earlier than the start date.'
  await stubSaveDialog(join(outputDir, 'dates.pdf'))
  await openFirstCv()

  const position = window.locator('.form fieldset').filter({ has: window.getByLabel('Job title') }).nth(1)
  const to = position.getByLabel('To', { exact: true })
  await expect(position.getByText(warning)).toHaveCount(0)
  await to.fill('2018-05')
  await expect(position.getByText(warning)).toBeVisible()
  await expect(to).toHaveAccessibleDescription(warning)
  await expect(window.locator('.preview .cv-page .cv-date').nth(1)).toHaveText('02.2019 – 05.2018')
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF')).toBeVisible()
  await expect(window.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()

  // Ten sam miesiąc nie jest błędem.
  await to.fill('2019-02')
  await expect(position.getByText(warning)).toHaveCount(0)
  await expect(to).toHaveAccessibleDescription('')

  // Wykształcenie: data ukończenia przed (opcjonalnym) początkiem; poprawa początku usuwa ostrzeżenie.
  const entry = window.getByRole('region', { name: 'Education', exact: true }).locator('fieldset').last()
  const graduation = entry.getByLabel('Graduation date')
  await graduation.fill('2008-06')
  await expect(entry.getByText(warning)).toBeVisible()
  await expect(graduation).toHaveAccessibleDescription(warning)
  await entry.getByLabel('From (optional)').fill('2007-10')
  await expect(entry.getByText(warning)).toHaveCount(0)
})

test('removing a position says “Removed.” with Undo, which brings it back with its bullets; any later change hides the message', async () => {
  await openFirstCv()
  const roles = window.locator('.preview .cv-page .cv-role')
  const allRoles = ['Senior Procurement Specialist', 'Procurement Specialist', 'Procurement Assistant', 'Junior Customer Service Specialist']
  const positions = window.locator('.form fieldset').filter({ has: window.getByLabel('Job title') })
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  await expect(removed).toHaveCount(0)

  await positions.nth(1).getByRole('button', { name: 'Remove position' }).click()
  await expect(roles).toHaveText([allRoles[0]!, allRoles[2]!, allRoles[3]!])
  await expect(removed).toBeVisible()
  // Komunikat jest w kolumnie formularza, nie na podglądzie stron, i nie zabiera fokusu.
  await expect(window.locator('.editor-form').getByRole('status').filter({ hasText: 'Removed.' })).toBeVisible()
  await expect(removed.getByRole('button', { name: 'Undo' })).not.toBeFocused()

  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(roles).toHaveText(allRoles)
  await expect(positions.nth(1).getByLabel(/^Bullet \d+$/)).toHaveCount(7)
  await expect(removed).toHaveCount(0)
  await expect(positions.nth(1).getByLabel('Job title')).toBeFocused()

  // Każda kolejna zmiana chowa komunikat, więc „Undo” nigdy nie cofa czegoś innego niż usunięcie.
  await positions.first().getByRole('button', { name: 'Remove bullet 1' }).click()
  await expect(removed).toBeVisible()
  await window.getByLabel('Full name').fill('Ewa Nowak')
  await expect(removed).toHaveCount(0)
  // Cmd+Z po usunięciu też je chowa.
  await window.getByRole('region', { name: 'Languages', exact: true }).getByRole('button', { name: 'Remove item 2' }).click()
  await expect(removed).toBeVisible()
  await window.keyboard.press('Meta+z')
  await expect(removed).toHaveCount(0)
  await expect(window.locator('.preview')).toContainText('German – B2')
})

test('a second removal replaces the “Removed.” message and its Undo brings back only the second item', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })

  await window.getByRole('region', { name: 'Languages', exact: true }).getByRole('button', { name: 'Remove item 2' }).click()
  await expect(preview).not.toContainText('German – B2')
  const education = window.getByRole('region', { name: 'Education', exact: true })
  await education.getByRole('button', { name: 'Remove education' }).last().click()
  await expect(preview).not.toContainText('Fictional Academy')
  await expect(removed).toHaveCount(1)

  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(preview).toContainText('Fictional Academy')
  await expect(preview).not.toContainText('German – B2')
  await expect(removed).toHaveCount(0)
  await expect(education.getByLabel('Level').last()).toBeFocused()

  // Kontakt też daje „Removed. Undo”, a „Undo” wraca do jego pola.
  await window.getByRole('button', { name: 'Remove contact 1' }).click()
  await expect(removed).toBeVisible()
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(window.getByLabel('Contact label 1')).toBeFocused()
})

test('the “Removed.” message goes away by itself after a while, but not while the pointer or the focus is on it', async () => {
  await window.clock.install()
  await openFirstCv()
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  const removeContact = () => window.getByRole('button', { name: 'Remove contact 1' }).click()

  await removeContact()
  await expect(removed).toBeVisible()
  await window.clock.runFor(7000)
  await expect(removed).toBeVisible()
  await window.clock.runFor(1500)
  await expect(removed).toHaveCount(0)

  // Kursor nad komunikatem wstrzymuje odliczanie; po zjechaniu kursorem liczy się od nowa.
  await removeContact()
  await removed.hover()
  await window.clock.runFor(20_000)
  await expect(removed).toBeVisible()
  await window.getByLabel('Full name').hover()
  await window.clock.runFor(8500)
  await expect(removed).toHaveCount(0)

  // Fokus na „Undo” (np. Tabem z czytnikiem ekranu) też.
  await removeContact()
  await removed.getByRole('button', { name: 'Undo' }).focus()
  await window.clock.runFor(20_000)
  await expect(removed).toBeVisible()
  await window.getByLabel('Full name').focus()
  await window.clock.runFor(8500)
  await expect(removed).toHaveCount(0)
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

test('tags a CV from the list: chips sorted with Polish letters, invalid tags rejected, nothing in the preview or PDF', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem').filter({ has: window.getByRole('button', { name: 'Open' }) })
  await window.getByRole('button', { name: 'New CV' }).click()
  await expect(rows).toHaveCount(2)
  const sample = rows.filter({ hasText: 'Sample CV' })
  await expect(rows.first()).toContainText('New CV')
  const modifiedBefore = await sample.locator('.library-item-date').textContent()

  // Tryb „Tags”: dodawanie z klawiatury (Enter) i usuwanie pojedynczych tagów.
  await sample.getByRole('button', { name: 'Tags' }).click()
  const editor = library.getByRole('group', { name: 'Tags of “Sample CV”' })
  const newTag = editor.getByLabel('New tag')
  for (const tag of ['Zakopane', '  Senior   Frontend ', 'Ząbki', 'Łódź', 'Lublin', 'Allegro', 'allegro']) {
    await newTag.fill(tag)
    await newTag.press('Enter')
    await expect(newTag).toHaveValue('')
  }
  const chips = editor.getByRole('list', { name: 'Tags' }).getByRole('listitem')
  await expect(chips).toHaveText(['Allegro', 'Lublin', 'Łódź', 'Senior Frontend', 'Zakopane', 'Ząbki'].map((tag) => new RegExp(`^${tag}`)))
  await editor.getByRole('button', { name: 'Remove tag “Allegro”' }).click()
  await expect(chips).toHaveCount(5)

  // Za długi tag – komunikat w języku interfejsu, tagi bez zmian.
  await newTag.fill('x'.repeat(31))
  await newTag.press('Enter')
  await expect(window.getByRole('alert')).toHaveText('Couldn’t change the tags. A tag can have at most 30 characters.')
  await expect(chips).toHaveCount(5)
  await editor.getByRole('button', { name: 'Done' }).click()

  // Chipy w wierszu, alfabetycznie z polskimi znakami; data „Modified” i kolejność listy bez zmian.
  await expect(sample.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText([
    'Lublin',
    'Łódź',
    'Senior Frontend',
    'Zakopane',
    'Ząbki'
  ])
  await expect(sample.locator('.library-item-date')).toHaveText(modifiedBefore!)
  await expect(rows.first()).toContainText('New CV')
  await expect(rows.filter({ hasText: 'New CV' }).getByRole('list', { name: 'Tags' })).toHaveCount(0)

  // Tagi nie trafiają do podglądu ani do PDF, a autozapis z edytora ich nie usuwa.
  await sample.getByRole('button', { name: 'Open' }).click()
  await window.getByLabel('Full name').fill('Ewa Nowak')
  await expect(window.getByText('Changes saved')).toBeVisible()
  await expect(window.locator('.preview')).not.toContainText('Zakopane')
  const pdfPath = join(outputDir, 'tagged.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: tagged.pdf')).toBeVisible()
  const pdf = (await readPdf(await readFile(pdfPath))).pages.join('')
  expect(pdf).toContain('Ewa Nowak')
  for (const tag of ['Lublin', 'Łódź', 'Senior Frontend', 'Zakopane', 'Ząbki']) expect(pdf).not.toContain(tag)
  await window.getByRole('button', { name: '← CV library' }).click()
  await expect(rows.first().getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText([
    'Lublin',
    'Łódź',
    'Senior Frontend',
    'Zakopane',
    'Ząbki'
  ])

  // Podpowiedzi z tagów innych CV: wybór podpowiedzi dodaje tag, wpisanie innej wielkości liter przejmuje istniejącą pisownię.
  const newCv = rows.filter({ hasText: 'New CV' })
  await newCv.getByRole('button', { name: 'Tags' }).click()
  const newCvEditor = library.getByRole('group', { name: 'Tags of “New CV”' })
  const suggestions = newCvEditor.getByRole('list', { name: 'Suggested tags' }).getByRole('listitem')
  await expect(suggestions).toHaveText(['Lublin', 'Łódź', 'Senior Frontend', 'Zakopane', 'Ząbki'])
  await newCvEditor.getByLabel('New tag').fill('fro')
  await expect(suggestions).toHaveText(['Senior Frontend'])
  await newCvEditor.getByRole('button', { name: 'Add tag “Senior Frontend”' }).click()
  const newCvChips = newCvEditor.getByRole('list', { name: 'Tags' }).getByRole('listitem')
  await expect(newCvChips).toHaveText([/^Senior Frontend/])
  await expect(newCvEditor.getByLabel('New tag')).toHaveValue('')
  await newCvEditor.getByLabel('New tag').fill('zakopane')
  await newCvEditor.getByLabel('New tag').press('Enter')
  await expect(newCvChips).toHaveText([/^Senior Frontend/, /^Zakopane/])
  await expect(suggestions).toHaveText(['Lublin', 'Łódź', 'Ząbki'])
  await newCvEditor.getByRole('button', { name: 'Done' }).click()

  // Tag usunięty z ostatniego CV, które go miało, znika z podpowiedzi.
  await sample.getByRole('button', { name: 'Tags' }).click()
  await editor.getByRole('button', { name: 'Remove tag “Lublin”' }).click()
  await editor.getByRole('button', { name: 'Done' }).click()
  await newCv.getByRole('button', { name: 'Tags' }).click()
  await expect(suggestions).toHaveText(['Łódź', 'Ząbki'])
})

test('filters the CV list by tags (all selected tags), keeps the filter for the session and clears it on New CV and import', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem').filter({ has: window.getByRole('button', { name: 'Open' }) })
  const filterBar = window.getByRole('group', { name: 'Filter by tag' })
  const cvNames = () => rows.locator('.library-item-name')
  const tagButton = (tag: string) => filterBar.getByRole('button', { name: tag, exact: true })

  // Bez żadnego tagu w bibliotece paska nie ma.
  await expect(rows).toHaveCount(1)
  await expect(filterBar).toHaveCount(0)

  // Trzy CV z tagami: „Sample CV” (frontend, EN), „Backend PL” (backend, PL), „Frontend PL” (frontend, Łódź, PL).
  const tagRow = async (name: string, tags: string[]) => {
    await rows.filter({ hasText: name }).getByRole('button', { name: 'Tags' }).click()
    const newTag = library.getByRole('group', { name: `Tags of “${name}”` }).getByLabel('New tag')
    for (const tag of tags) {
      await newTag.fill(tag)
      await newTag.press('Enter')
      await expect(newTag).toHaveValue('')
    }
    await library.getByRole('button', { name: 'Done' }).click()
  }
  const createCv = async (name: string) => {
    await window.getByRole('button', { name: 'New CV' }).click()
    await rows.filter({ hasText: 'New CV' }).getByRole('button', { name: 'Rename' }).click()
    await library.getByLabel('CV name').fill(name)
    await library.getByRole('button', { name: 'Save' }).click()
    await expect(rows.filter({ hasText: name })).toHaveCount(1)
  }
  await tagRow('Sample CV', ['frontend', 'EN'])
  await createCv('Backend PL')
  await tagRow('Backend PL', ['backend', 'PL'])
  await createCv('Frontend PL')
  await tagRow('Frontend PL', ['frontend', 'Łódź', 'PL'])

  // Pasek: wszystkie tagi alfabetycznie z polskimi znakami, nic nie zaznaczone.
  await expect(filterBar.getByRole('button', { pressed: false })).toHaveText(['backend', 'EN', 'frontend', 'Łódź', 'PL'])
  await expect(filterBar.getByRole('button', { name: 'Clear' })).toHaveCount(0)

  // Kilka zaznaczonych tagów – tylko CV mające wszystkie (AND).
  await tagButton('frontend').click()
  await expect(tagButton('frontend')).toHaveAttribute('aria-pressed', 'true')
  await expect(cvNames()).toHaveText(['Frontend PL', 'Sample CV'])
  await tagButton('PL').click()
  await expect(cvNames()).toHaveText(['Frontend PL'])

  // Ponowne kliknięcie odznacza tag.
  await tagButton('frontend').click()
  await expect(tagButton('frontend')).toHaveAttribute('aria-pressed', 'false')
  await expect(cvNames()).toHaveText(['Frontend PL', 'Backend PL'])

  // Pusty wynik – komunikat zamiast listy.
  await tagButton('EN').click()
  await expect(rows).toHaveCount(0)
  await expect(window.getByText('No CV has all of these tags.')).toBeVisible()

  // „Clear” wraca do pełnej listy.
  await filterBar.getByRole('button', { name: 'Clear' }).click()
  await expect(filterBar.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(cvNames()).toHaveText(['Frontend PL', 'Backend PL', 'Sample CV'])
  await expect(window.getByText('No CV has all of these tags.')).toHaveCount(0)

  // Zaznaczony tag, którego nie ma już żadne CV, znika z paska i z filtra – gdy wróci, nie jest zaznaczony.
  await tagButton('backend').click()
  await expect(cvNames()).toHaveText(['Backend PL'])
  await rows.filter({ hasText: 'Backend PL' }).getByRole('button', { name: 'Tags' }).click()
  await library.getByRole('button', { name: 'Remove tag “backend”' }).click()
  await library.getByRole('button', { name: 'Done' }).click()
  await expect(filterBar.getByRole('button', { pressed: false })).toHaveText(['EN', 'frontend', 'Łódź', 'PL'])
  await expect(cvNames()).toHaveText(['Frontend PL', 'Backend PL', 'Sample CV'])
  await tagRow('Backend PL', ['backend'])
  await expect(filterBar.getByRole('button', { pressed: false })).toHaveText(['backend', 'EN', 'frontend', 'Łódź', 'PL'])
  await expect(cvNames()).toHaveText(['Frontend PL', 'Backend PL', 'Sample CV'])
  await rows.filter({ hasText: 'Backend PL' }).getByRole('button', { name: 'Tags' }).click()
  await library.getByRole('button', { name: 'Remove tag “backend”' }).click()
  await library.getByRole('button', { name: 'Done' }).click()
  await expect(filterBar.getByRole('button', { pressed: false })).toHaveText(['EN', 'frontend', 'Łódź', 'PL'])

  // Uszkodzony plik CV: ukryty przy aktywnym filtrze, widoczny bez filtra. Filtr przetrwa wejście do biblioteki klauzul.
  await writeFile(join(outputDir, 'user-data', 'cvs', 'broken.json'), '{ not json')
  const damaged = library.getByRole('listitem').filter({ hasText: 'broken.json' })
  await tagButton('frontend').click()
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  await window.getByRole('button', { name: '← CV library' }).click()
  await expect(tagButton('frontend')).toHaveAttribute('aria-pressed', 'true')
  await expect(cvNames()).toHaveText(['Frontend PL', 'Sample CV'])
  await expect(damaged).toHaveCount(0)

  // Filtr przetrwa otwarcie CV w edytorze i powrót do listy.
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane Example')
  await window.getByRole('button', { name: '← CV library' }).click()
  await expect(tagButton('frontend')).toHaveAttribute('aria-pressed', 'true')
  await expect(cvNames()).toHaveText(['Frontend PL', 'Sample CV'])

  await filterBar.getByRole('button', { name: 'Clear' }).click()
  await expect(damaged).toHaveCount(1)
  await expect(damaged).toContainText('Damaged file')

  // „New CV” przy aktywnym filtrze czyści filtr, żeby nowe CV było widoczne.
  await tagButton('PL').click()
  await expect(rows).toHaveCount(2)
  await window.getByRole('button', { name: 'New CV' }).click()
  await expect(filterBar.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(cvNames()).toHaveText(['New CV', 'Frontend PL', 'Backend PL', 'Sample CV'])

  // „Import from file” przy aktywnym filtrze też czyści filtr.
  const jsonPath = join(outputDir, 'sample.json')
  await stubSaveDialog(jsonPath)
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Export to file' }).click()
  await expect(window.getByRole('status')).toHaveText('Saved file: sample.json')
  await tagButton('Łódź').click()
  await expect(cvNames()).toHaveText(['Frontend PL'])
  await stubOpenDialog(jsonPath)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('status')).toHaveText('Imported “Sample CV”.')
  await expect(filterBar.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(rows).toHaveCount(5)

  // Po ponownym uruchomieniu filtr jest pusty.
  await tagButton('PL').click()
  await expect(rows).toHaveCount(2)
  await app.close()
  await launch()
  const rowsAfterRestart = window.getByRole('list', { name: 'CV list' }).getByRole('listitem').filter({ has: window.getByRole('button', { name: 'Open' }) })
  await expect(rowsAfterRestart).toHaveCount(5)
  await expect(window.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { pressed: true })).toHaveCount(0)
})

test('File menu: creating and importing in the CV library and the editor, exporting only in the editor, nothing in the clause library', async () => {
  const fileMenu = (create: boolean, exports: boolean) => ({
    'New CV': create,
    'Add Sample CV': create,
    'Import…': create,
    'Export JSON…': exports,
    'Export to PDF…': exports,
    'Close Window': true
  })
  await expect(window.getByRole('list', { name: 'CV list' })).toBeVisible()
  await expect.poll(() => menuEnabled('File')).toEqual(fileMenu(true, false))

  await openFirstCv()
  await expect.poll(() => menuEnabled('File')).toEqual(fileMenu(true, true))

  await window.getByRole('button', { name: '← CV library' }).click()
  await expect.poll(() => menuEnabled('File')).toEqual(fileMenu(true, false))

  // Formularze klauzul nie mają autozapisu, więc skrót nie może porzucić wpisanej klauzuli.
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  await expect.poll(() => menuEnabled('File')).toEqual(fileMenu(false, false))
})

test('File → New CV, Add Sample CV and Import… work like the library buttons, and from the editor they go back to the library first', async () => {
  const rows = window.getByRole('list', { name: 'CV list' }).getByRole('listitem')
  await expect(rows).toHaveCount(1)

  // W bibliotece: nowe CV z Default content na górze listy.
  await clickMenuItem('File', 'New CV')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('New CV')

  // Z edytora: powrót do biblioteki z nowym CV na liście.
  await rows.first().getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Full name')).toBeVisible()
  await clickMenuItem('File', 'Add Sample CV')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Sample CV')

  // Importuj… w bibliotece i z edytora: komunikat jak przy przycisku.
  const jsonPath = join(outputDir, 'sample.json')
  await stubSaveDialog(jsonPath)
  await rows.first().getByRole('button', { name: 'Export to file' }).click()
  await expect(window.getByRole('status')).toHaveText('Saved file: sample.json')
  await stubOpenDialog(jsonPath)
  await clickMenuItem('File', 'Import…')
  await expect(window.getByRole('status')).toHaveText('Imported “Sample CV”.')
  await expect(rows).toHaveCount(4)
  await rows.first().getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Full name')).toBeVisible()
  await clickMenuItem('File', 'Import…')
  await expect(window.getByRole('status').filter({ hasText: 'Imported “Sample CV”.' })).toBeVisible()
  await expect(rows).toHaveCount(5)
})

test('File → New CV after a failed autosave asks before leaving the editor, like ← Back', async () => {
  await openFirstCv()
  await breakAutosave()
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('alert')).toContainText('Couldn’t save changes')

  await clickMenuItem('File', 'New CV')
  const alert = window.getByRole('alert')
  await expect(alert).toContainText('Your changes weren’t saved. Leave anyway?')
  await expect(window.getByLabel('Full name')).toHaveValue('Jane Doe')
  await alert.getByRole('button', { name: 'Leave anyway' }).click()
  await expect(window.locator('.library')).toBeVisible()
})

test('leaving the editor after a failed autosave asks first: Stay keeps the edit and the focus, Leave anyway goes to the library', async () => {
  await openFirstCv()
  await breakAutosave()
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('alert')).toContainText('Couldn’t save changes')

  const back = window.getByRole('button', { name: '← CV library' })
  await back.click()
  const alert = window.getByRole('alert')
  await expect(alert).toContainText('Your changes weren’t saved. Leave anyway?')
  await expect(alert.getByRole('button', { name: 'Stay in the editor' })).toBeFocused()
  await alert.getByRole('button', { name: 'Stay in the editor' }).click()
  await expect(alert).toContainText('Couldn’t save changes. Your latest edits are only in this window for now.')
  await expect(back).toBeFocused()
  await expect(window.getByLabel('Full name')).toHaveValue('Jane Doe')

  // Escape działa jak „Zostań w edytorze”.
  await back.click()
  await expect(alert.getByRole('button', { name: 'Stay in the editor' })).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(alert).toContainText('Couldn’t save changes.')
  await expect(back).toBeFocused()

  await back.click()
  await alert.getByRole('button', { name: 'Leave anyway' }).click()
  await expect(window.locator('.library')).toBeVisible()
})

// Nieudany autozapis: katalog CV znika z dysku (plik zapamiętany, żeby dało się go przywrócić).
async function breakAutosave() {
  const cvsDir = join(outputDir, 'user-data', 'cvs')
  const [fileName] = (await readdir(cvsDir)).filter((name) => name.endsWith('.json'))
  const content = await readFile(join(cvsDir, fileName!), 'utf8')
  await rm(cvsDir, { recursive: true })
  return async () => {
    await mkdir(cvsDir, { recursive: true })
    await writeFile(join(cvsDir, fileName!), content)
  }
}

// Wyjście z edytora mimo nieudanego zapisu, żeby zamknięcie aplikacji w `afterEach` nie czekało na pytanie.
async function leaveEditorAnyway() {
  await window.getByRole('button', { name: '← CV library' }).click()
  await window.getByRole('button', { name: 'Leave anyway' }).click()
  await expect(window.locator('.library')).toBeVisible()
}

test('a failed autosave shows an alert with Try again, which saves once the cause is gone and hides the alert', async () => {
  await openFirstCv()
  const restore = await breakAutosave()
  await window.getByLabel('Full name').fill('Jane Doe')
  const alert = window.getByRole('alert')
  await expect(alert).toContainText('Couldn’t save changes. Your latest edits are only in this window for now.')
  // Komunikat jest raz – w alercie, a nie także w statusie paska narzędzi.
  await expect(window.getByRole('status').filter({ hasText: 'Couldn’t save changes' })).toHaveCount(0)

  await restore()
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(window.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  await expect(window.getByRole('alert')).toHaveCount(0)
  await app.close()
  await launch()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Jane Doe')
})

// Autozapis trwający 1,5 s: zapis z edytora czeka, a dopiero potem trafia do pliku CV (jak w repozytorium: z tagami
// z pliku). Liczba otrzymanych zapisów jest w `updateCalls`.
async function slowDownAutosave() {
  await app.evaluate(({ app, ipcMain }) => {
    const state = globalThis as { updateCalls?: number }
    state.updateCalls = 0
    ipcMain.removeHandler('cv:update')
    ipcMain.handle('cv:update', async (_event, document: { id: string }) => {
      state.updateCalls = (state.updateCalls ?? 0) + 1
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const { readFile, writeFile } = process.getBuiltinModule('node:fs/promises')
      const { join } = process.getBuiltinModule('node:path')
      const filePath = join(app.getPath('userData'), 'cvs', `${document.id}.json`)
      const { tags } = JSON.parse(await readFile(filePath, 'utf8'))
      await writeFile(filePath, JSON.stringify({ ...document, tags }, null, 2))
    })
  })
}

const updateCalls = () => app.evaluate(() => (globalThis as { updateCalls?: number }).updateCalls ?? 0)

// Zamyka okno aplikacji jak Cmd+W albo czerwony przycisk (bez kończenia aplikacji).
async function closeAppWindow() {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((window) => window.isVisible())
      ?.close()
  })
}

const appWindowCount = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length)

// Podmienia natywne okno komunikatu: odpowiada przyciskiem `globalThis.messageBoxResponse` i zapamiętuje opcje.
async function stubMessageBox(response: number) {
  await app.evaluate(({ dialog }, response) => {
    const state = globalThis as { messageBoxCalls?: Electron.MessageBoxOptions[]; messageBoxResponse?: number }
    state.messageBoxCalls = []
    state.messageBoxResponse = response
    dialog.showMessageBox = (async (...args: unknown[]) => {
      state.messageBoxCalls!.push(args.at(-1) as Electron.MessageBoxOptions)
      return { response: state.messageBoxResponse, checkboxChecked: false }
    }) as typeof dialog.showMessageBox
  }, response)
}

const setMessageBoxResponse = (response: number) =>
  app.evaluate((_electron, response) => {
    ;(globalThis as { messageBoxResponse?: number }).messageBoxResponse = response
  }, response)

const messageBoxCalls = () =>
  app.evaluate(() => (globalThis as { messageBoxCalls?: Electron.MessageBoxOptions[] }).messageBoxCalls ?? [])

// Zapis w toku i zmiana czekająca za nim: pierwsza zmiana jest już zapisywana, druga dopiero wpisana.
async function editDuringSave() {
  await openFirstCv()
  await slowDownAutosave()
  await window.getByLabel('Full name').fill('Ewa')
  await expect.poll(updateCalls).toBe(1)
  await window.getByLabel('Full name').fill('Ewa Nowak')
}

test('closing the window right after an edit waits for the save in progress and the change queued behind it', async () => {
  await editDuringSave()
  await closeAppWindow()
  await expect.poll(appWindowCount, { timeout: 10_000 }).toBe(0)
  await app.close()
  await launch()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
})

test('quitting right after an edit waits for the save in progress and the change queued behind it', async () => {
  await editDuringSave()
  await app.close()
  await launch()
  await openFirstCv()
  await expect(window.getByLabel('Full name')).toHaveValue('Ewa Nowak')
})

test('closing the window after a failed autosave asks natively: Back to Editor keeps it open, Close Anyway closes it', async () => {
  await openFirstCv()
  await breakAutosave()
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('alert')).toContainText('Couldn’t save changes')

  await stubMessageBox(1)
  await closeAppWindow()
  await expect.poll(async () => (await messageBoxCalls()).length).toBe(1)
  const [options] = await messageBoxCalls()
  expect(options).toMatchObject({
    type: 'warning',
    message: 'Your changes to the CV weren’t saved.',
    detail: 'If you close the window now, your latest changes will be lost.',
    buttons: ['Close Anyway', 'Back to Editor'],
    defaultId: 1,
    cancelId: 1
  })
  expect(await appWindowCount()).toBe(1)
  await expect(window.getByLabel('Full name')).toHaveValue('Jane Doe')

  await setMessageBoxResponse(0)
  await closeAppWindow()
  await expect.poll(appWindowCount).toBe(0)
})

test('quitting after a failed autosave asks natively, and Back to Editor keeps the app running', async () => {
  await openFirstCv()
  await breakAutosave()
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('alert')).toContainText('Couldn’t save changes')

  await stubMessageBox(1)
  await app.evaluate(({ app }) => app.quit())
  await expect.poll(async () => (await messageBoxCalls()).length).toBe(1)
  const [options] = await messageBoxCalls()
  expect(options).toMatchObject({
    message: 'Your changes to the CV weren’t saved.',
    detail: 'If you quit CV Press now, your latest changes will be lost.',
    buttons: ['Quit Anyway', 'Back to Editor']
  })
  expect(await appWindowCount()).toBe(1)
  await expect(window.getByLabel('Full name')).toHaveValue('Jane Doe')

  // Zamknięcie okna po „Wróć do edytora” to już nie zakończenie aplikacji.
  await closeAppWindow()
  await expect.poll(async () => (await messageBoxCalls()).length).toBe(2)
  expect((await messageBoxCalls())[1]).toMatchObject({ buttons: ['Close Anyway', 'Back to Editor'] })

  // `afterEach` kończy aplikację: „Zakończ mimo to”.
  await setMessageBoxResponse(0)
})

test('closing the window from the CV library or with saved changes asks nothing', async () => {
  await openFirstCv()
  await stubMessageBox(1)
  await window.getByLabel('Full name').fill('Jane Doe')
  await expect(window.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  await closeAppWindow()
  await expect.poll(appWindowCount).toBe(0)
  expect(await messageBoxCalls()).toEqual([])

  await app.close()
  await launch()
  await stubMessageBox(1)
  await expect(window.getByRole('list', { name: 'CV list' })).toBeVisible()
  await closeAppWindow()
  await expect.poll(appWindowCount).toBe(0)
  expect(await messageBoxCalls()).toEqual([])
})

test('in the editor File → Export to PDF… and Export JSON… export the open CV, the JSON with the change typed just before', async () => {
  await openFirstCv()
  await expect(window.locator('.cv-page').first()).toBeVisible()
  const previewPageCount = await window.locator('.preview .cv-page').count()

  const pdfPath = join(outputDir, 'menu.pdf')
  await stubSaveDialog(pdfPath)
  await clickMenuItem('File', 'Export to PDF…')
  await expect(window.getByRole('status').filter({ hasText: 'Saved PDF: menu.pdf' })).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(previewPageCount).toBeGreaterThan(0)
  expect(pdf.pages).toHaveLength(previewPageCount)
  expect(pdf.pages[0]).toContain('Jane Example')

  // Zmiana wpisana tuż przed komendą (autozapis jeszcze nie ruszył) trafia do pliku.
  const jsonPath = join(outputDir, 'menu.json')
  await stubSaveDialog(jsonPath)
  await window.getByLabel('Full name').fill('Ewa Nowak')
  await clickMenuItem('File', 'Export JSON…')
  await expect(window.getByRole('status').filter({ hasText: 'Saved file: menu.json' })).toBeVisible()
  expect(JSON.parse(await readFile(jsonPath, 'utf8'))).toMatchObject({ header: { fullName: 'Ewa Nowak' } })

  // Plik daje się zaimportować.
  await window.getByRole('button', { name: '← CV library' }).click()
  await stubOpenDialog(jsonPath)
  await clickMenuItem('File', 'Import…')
  await expect(window.getByRole('status')).toHaveText('Imported “Sample CV”.')
  await expect(window.getByRole('list', { name: 'CV list' }).getByRole('listitem')).toHaveCount(2)

  // Nieudany eksport JSON: komunikat błędu pod paskiem narzędzi, do zamknięcia.
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).first().click()
  await expect(window.getByLabel('Full name')).toBeVisible()
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = (async () => {
      throw new Error('disk full')
    }) as typeof dialog.showSaveDialog
  })
  await clickMenuItem('File', 'Export JSON…')
  const exportFailed = window.getByRole('alert').filter({ hasText: 'Couldn’t export the CV.' })
  await expect(exportFailed).toBeVisible()
  await exportFailed.getByRole('button', { name: 'Dismiss message' }).click()
  await expect(exportFailed).toHaveCount(0)
})

test('a CV file from a newer version of the app is marked as needing a newer version, not as damaged, and its deletion says what is lost', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  const cvDir = join(outputDir, 'user-data', 'cvs')
  await writeFile(join(cvDir, 'future.json'), JSON.stringify({ ...sampleCvs.en, id: 'future', schemaVersion: 99 }))
  await writeFile(join(cvDir, 'broken.json'), '{ not json')
  await window.getByRole('button', { name: 'Consent clauses' }).click()
  await window.getByRole('button', { name: '← CV library' }).click()

  const future = library.getByRole('listitem').filter({ hasText: 'future.json' })
  const broken = library.getByRole('listitem').filter({ hasText: 'broken.json' })
  await expect(future).toContainText('Needs a newer version of CV Press')
  await expect(future).not.toContainText('Damaged file')
  await expect(future.getByRole('button', { name: 'Open' })).toHaveCount(0)
  await expect(broken).toContainText('Damaged file')

  await future.getByRole('button', { name: 'Delete' }).click()
  await expect(future.getByRole('alertdialog')).toContainText(
    'Delete the file “future.json”? It is a CV from a newer version of CV Press and will be lost. This can’t be undone.'
  )
  await future.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(future).toHaveCount(0)
  await expect(broken).toHaveCount(1)
})

test('an empty library offers “Add sample CV”, which adds the Sample CV at the top without opening it', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem')
  await rows.filter({ hasText: 'Sample CV' }).getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rows).toHaveCount(0)

  const emptyState = window.locator('.library-empty-state')
  await expect(emptyState).toContainText('You don’t have any CVs yet. Click “New CV”.')
  await emptyState.getByRole('button', { name: 'Add sample CV' }).click()
  await expect(rows.locator('.library-item-name')).toHaveText(['Sample CV'])
  await expect(emptyState).toHaveCount(0)
  await expect(window.locator('.preview')).toHaveCount(0)
})

test('while the CV list is loading the library says “Loading…”, not that it is empty', async () => {
  await app.evaluate(({ ipcMain }) => {
    const release: { resolve?: () => void } = {}
    ;(globalThis as { releaseCvList?: typeof release }).releaseCvList = release
    ipcMain.removeHandler('cv:list')
    ipcMain.handle('cv:list', () => new Promise((resolve) => (release.resolve = () => resolve([]))))
  })
  await window.reload()

  const libraryScreen = window.locator('.library')
  await expect(libraryScreen.getByRole('status')).toHaveText('Loading…')
  await expect(window.getByText('You don’t have any CVs yet. Click “New CV”.')).toHaveCount(0)
  await app.evaluate(() => (globalThis as { releaseCvList?: { resolve?: () => void } }).releaseCvList?.resolve?.())
  await expect(window.getByText('You don’t have any CVs yet. Click “New CV”.')).toBeVisible()
  await expect(window.getByText('Loading…')).toHaveCount(0)
})

test('closing a row form returns the focus to the button that opened it, and deleting a CV moves it to the next one', async () => {
  const library = window.getByRole('list', { name: 'CV list' })
  const rows = library.getByRole('listitem')
  const row = (name: string) => rows.filter({ hasText: name })
  for (const name of ['First', 'Second']) {
    await window.getByRole('button', { name: 'New CV', exact: true }).click()
    await row('New CV').getByRole('button', { name: 'Rename' }).click()
    await library.getByLabel('CV name').fill(name)
    await library.getByLabel('CV name').press('Enter')
    await expect(row(name)).toHaveCount(1)
  }
  await expect(rows.locator('.library-item-name')).toHaveText(['Second', 'First', 'Sample CV'])

  // Zmiana nazwy: Escape i zapis wracają na „Rename” tego CV, także gdy CV przeskoczyło na górę listy.
  await row('First').getByRole('button', { name: 'Rename' }).click()
  await library.getByLabel('CV name').press('Escape')
  await expect(row('First').getByRole('button', { name: 'Rename' })).toBeFocused()
  await row('First').getByRole('button', { name: 'Rename' }).click()
  await library.getByLabel('CV name').fill('First renamed')
  await library.getByLabel('CV name').press('Enter')
  await expect(rows.locator('.library-item-name')).toHaveText(['First renamed', 'Second', 'Sample CV'])
  await expect(row('First renamed').getByRole('button', { name: 'Rename' })).toBeFocused()

  // Tagi: „Done” wraca na „Tags”.
  await row('Second').getByRole('button', { name: 'Tags' }).click()
  await library.getByRole('button', { name: 'Done' }).click()
  await expect(row('Second').getByRole('button', { name: 'Tags' })).toBeFocused()

  // Usuwanie: „Cancel” wraca na „Delete”, a usunięcie przenosi fokus na „Open” następnego CV, przy ostatnim na poprzednie.
  await row('Second').getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(row('Second').getByRole('button', { name: 'Delete' })).toBeFocused()
  await row('Second').getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rows.locator('.library-item-name')).toHaveText(['First renamed', 'Sample CV'])
  await expect(row('Sample CV').getByRole('button', { name: 'Open' })).toBeFocused()
  await row('Sample CV').getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(row('First renamed').getByRole('button', { name: 'Open' })).toBeFocused()

  // Po usunięciu ostatniego CV fokus jest na „New CV”.
  await row('First renamed').getByRole('button', { name: 'Delete' }).click()
  await library.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rows).toHaveCount(0)
  await expect(window.getByRole('button', { name: 'New CV', exact: true })).toBeFocused()
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
  expect(exported).toMatchObject({
    schemaVersion: 6,
    name: 'CV – Talent Partners',
    settings: { template: 'classic', language: 'en' },
    header: { fullName: 'Jane Example' }
  })

  // Import tego samego pliku dodaje nowe CV obok istniejącego – niczego nie nadpisuje.
  await stubOpenDialog(jsonPath)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('status')).toHaveText('Imported “CV – Talent Partners”.')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'CV – Talent Partners' })).toHaveCount(2)
  await rows.first().getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Jane Example')
  await window.getByRole('button', { name: '← CV library' }).click()

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

// Prostokąt i stan okna aplikacji oraz obszar roboczy ekranu głównego.
async function windowGeometry() {
  return app.evaluate(({ BrowserWindow, screen }) => {
    const [browserWindow] = BrowserWindow.getAllWindows()
    return {
      bounds: browserWindow!.getBounds(),
      maximized: browserWindow!.isMaximized(),
      minimized: browserWindow!.isMinimized(),
      workArea: screen.getPrimaryDisplay().workArea
    }
  })
}

test('the window opens where it was left, maximized again if it was, and not on a screen that is gone', async () => {
  const settingsPath = join(outputDir, 'user-data', 'settings.json')
  const { workArea } = await windowGeometry()
  const bounds = { x: workArea.x + 40, y: workArea.y + 30, width: 1000, height: 700 }
  await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0]!.setBounds(bounds), bounds)
  await expect.poll(async () => (await windowGeometry()).bounds).toEqual(bounds)

  // Zamknięcie zapisuje stan od razu, bez czekania na opóźniony zapis.
  await app.close()
  await launch()
  await expect.poll(async () => (await windowGeometry()).bounds).toEqual(bounds)
  // Zapamiętanie okna nie zmienia biblioteki CV.
  await expect(window.getByRole('list', { name: 'CV list' }).getByRole('listitem')).toHaveCount(1)

  // Zmaksymalizowane okno wraca zmaksymalizowane, a po odmaksymalizowaniu ma wymiary sprzed maksymalizacji.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.maximize())
  await expect.poll(async () => (await windowGeometry()).maximized).toBe(true)
  await app.close()
  expect(JSON.parse(await readFile(settingsPath, 'utf8')).windowState).toEqual({ ...bounds, maximized: true })
  await launch()
  await expect.poll(async () => (await windowGeometry()).maximized).toBe(true)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.unmaximize())
  await expect.poll(async () => (await windowGeometry()).bounds).toEqual(bounds)

  // Okno zostawione na odłączonym monitorze startuje w rozmiarze domyślnym, wyśrodkowane na ekranie głównym.
  await app.close()
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
  const offScreen = { x: -10000, y: 100, width: 1100, height: 800, maximized: false }
  await writeFile(settingsPath, JSON.stringify({ ...settings, windowState: offScreen }))
  await launch()
  const width = Math.min(1280, workArea.width)
  const height = Math.min(900, workArea.height)
  await expect.poll(async () => (await windowGeometry()).bounds).toEqual({
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height
  })
})

test('the window cannot be made smaller than 960×640, where a long CV name does not push the editor toolbar apart', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(400, 300))

  const [width, height] = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize())
  expect(width).toBeGreaterThanOrEqual(960)
  expect(height).toBeGreaterThanOrEqual(640)

  // Długa nazwa CV jest ucinana wielokropkiem; „Eksportuj do PDF” zostaje w pasku.
  const library = window.getByRole('list', { name: 'CV list' })
  await library.getByRole('button', { name: 'Rename' }).click()
  const longName = 'Sample CV for the international senior product design leadership position, version for the bank'
  await library.getByLabel('CV name').fill(longName)
  await library.getByLabel('CV name').press('Enter')
  await library.getByRole('button', { name: 'Open' }).click()
  const toolbar = window.locator('.toolbar')
  const title = toolbar.getByRole('heading', { name: longName })
  await expect(title).toBeVisible()
  // Nazwa jest tekstem przycisku zmiany nazwy w nagłówku – liczą się linie tego tekstu.
  const titleLines = await title.getByRole('button').evaluate((element) => {
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  })
  expect(titleLines).toBe(1)
  expect(await toolbar.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const exportButton = await toolbar.getByRole('button', { name: 'Export to PDF' }).boundingBox()
  expect(exportButton!.x + exportButton!.width).toBeLessThanOrEqual(await window.locator('html').evaluate((html) => html.clientWidth))
})

test('starting the app again brings the running window to the front instead of a second copy; another data folder runs its own copy', async () => {
  const executable = packagedExecutable ?? ((await import('electron')).default as unknown as string)
  const args = (userDataDir: string) => [...(packagedExecutable ? [] : ['.']), `--user-data-dir=${userDataDir}`]
  const env = { ...process.env, MOJE_CV_E2E_HIDDEN: '1', MOJE_CV_LANGUAGE: 'en', MOJE_CV_UPDATE_URL: 'off' } as Record<string, string>
  // Okno zminimalizowane przed pokazaniem (`ready-to-show`) zostałoby przez nie przywrócone.
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(true)
  await app.evaluate(({ app, BrowserWindow }) => {
    const state = { secondInstances: 0 }
    ;(globalThis as { singleInstance?: typeof state }).singleInstance = state
    app.on('second-instance', () => state.secondInstances++)
    BrowserWindow.getAllWindows()[0]!.minimize()
  })
  await expect.poll(async () => (await windowGeometry()).minimized).toBe(true)

  // Druga kopia na tym samym folderze danych kończy się od razu, a działające okno wraca.
  const second = spawn(executable, args(join(outputDir, 'user-data')), { env, stdio: 'ignore' })
  expect(await new Promise<number | null>((resolve) => second.on('exit', resolve))).toBe(0)
  const secondInstances = () =>
    app.evaluate(() => (globalThis as { singleInstance?: { secondInstances: number } }).singleInstance!.secondInstances)
  await expect.poll(secondInstances).toBe(1)
  await expect.poll(async () => (await windowGeometry()).minimized).toBe(false)
  await expect(window.getByRole('list', { name: 'CV list' }).getByRole('listitem')).toHaveCount(1)

  // Kopia na innym folderze danych otwiera własne okno.
  const other = await electron.launch({
    ...(packagedExecutable && { executablePath: packagedExecutable }),
    args: args(join(outputDir, 'other-user-data')),
    env,
    colorScheme: null
  })
  try {
    const otherLibrary = (await other.firstWindow()).getByRole('list', { name: 'CV list' })
    await expect(otherLibrary.getByRole('listitem')).toHaveCount(1)
  } finally {
    await other.close()
  }
})

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
