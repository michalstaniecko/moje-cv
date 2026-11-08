import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych, wymuszony język interfejsu (`language: null` zostawia wybór menu)
// i jasny wygląd (zmienna `MOJE_CV_APPEARANCE` z otoczenia testu ma pierwszeństwo), bez emulacji
// `prefers-color-scheme` przez Playwrighta.
async function launch({ language = 'en' }: { language?: InterfaceLanguage | null } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
  // Okno w tle (bez fokusu i niewidoczne); `MOJE_CV_E2E_HEADED=1` pokazuje je normalnie do debugowania.
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  // Bez sprawdzania nowej wersji przy starcie: żaden test nie łączy się z GitHubem (ADR-0006).
  env['MOJE_CV_UPDATE_URL'] = 'off'
  if (language) env['MOJE_CV_LANGUAGE'] = language
  else delete env['MOJE_CV_LANGUAGE']
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env, colorScheme: null }
      : { args: ['.', userDataDir], env, colorScheme: null }
  )
  window = await app.firstWindow()
}

test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  await launch()
})

test.afterEach(async () => {
  await app.close()
  await rm(outputDir, { recursive: true, force: true })
})

const cvList = () => window.getByRole('list', { name: 'CV list' })

test('content cannot navigate the app window away or open a new window', async () => {
  await expect(cvList()).toBeVisible()
  const appUrl = window.url()
  const strangePage = join(outputDir, 'strange.html')
  await writeFile(strangePage, '<h1>Strange page</h1>')

  // Kod wykonywany w oknie; konfiguracja TypeScriptu testów nie zna typów DOM.
  await window.evaluate((url) => {
    ;(globalThis as unknown as { location: { href: string } }).location.href = url
  }, pathToFileURL(strangePage).href)
  await window.evaluate(() => {
    ;(globalThis as unknown as { open: (url: string) => unknown }).open('about:blank')
  })

  // Nawigacja i nowe okno są asynchroniczne: dajemy im czas, a potem sprawdzamy, że nic się nie zmieniło.
  // Stan sprawdzamy w procesie głównym: Playwright po zablokowanej nawigacji czeka w lokatorach na jej koniec.
  await window.waitForTimeout(1_000)
  const state = await app.evaluate(async ({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows()
    const contents = windows[0]!.webContents
    return {
      windows: windows.length,
      url: contents.getURL(),
      text: (await contents.executeJavaScript('document.body.innerText')) as string
    }
  })
  expect(state.windows).toBe(1)
  expect(state.url).toBe(appUrl)
  expect(state.text).toContain('New CV')
  expect(state.text).not.toContain('Strange page')
})

test('content cannot reload the app window by itself either', async () => {
  await expect(cvList()).toBeVisible()
  await window.evaluate(() => {
    ;(globalThis as unknown as { notReloaded: boolean }).notReloaded = true
    ;(globalThis as unknown as { location: { reload: () => void } }).location.reload()
  })

  await window.waitForTimeout(1_000)
  const notReloaded = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.webContents.executeJavaScript('globalThis.notReloaded === true')
  )
  expect(notReloaded).toBe(true)
})

// Formatowanie dat w bibliotece rzuca wyjątkiem przy następnym renderowaniu (podmiana żyje do przeładowania okna).
async function breakDateFormatting() {
  await window.evaluate(() => {
    ;(globalThis.Intl as { DateTimeFormat: unknown }).DateTimeFormat = function () {
      throw new Error('boom')
    }
  })
}

// Wybiera język w menu Language w procesie głównym (jak w export.spec.ts).
async function chooseLanguage(itemLabel: string) {
  await app.evaluate(
    ({ BrowserWindow, Menu }, { itemLabel }) => {
      const menu = Menu.getApplicationMenu()?.items.find((item) => item.submenu?.items.some((entry) => entry.label === 'English'))
      const item = menu?.submenu?.items.find((item) => item.label === itemLabel)
      if (!item) throw new Error(`No menu item Language → ${itemLabel}`)
      const window = BrowserWindow.getAllWindows().find((window) => window.isVisible())
      item.click(undefined, window, window?.webContents)
    },
    { itemLabel }
  )
}

// Język z menu Language (bez wymuszenia przez `MOJE_CV_LANGUAGE`), startowo angielski jako język systemu.
async function launchWithLanguageMenu() {
  await app.close()
  await launch({ language: null })
  await app.evaluate(({ app }) => {
    app.getPreferredSystemLanguages = () => ['en-US']
  })
}

test('a rendering error shows a translated “Something went wrong” screen whose Reload brings the library back', async () => {
  await launchWithLanguageMenu()
  await expect(cvList()).toBeVisible()

  await breakDateFormatting()
  await chooseLanguage('Polski')

  await expect(window.getByRole('alert')).toHaveText('Coś poszło nie tak')
  await expect(window.getByText('Twoje CV są bezpieczne')).toBeVisible()
  await expect(window.getByRole('contentinfo', { name: 'Support CV Drawer' })).toBeHidden()
  const reload = window.getByRole('button', { name: 'Wczytaj ponownie' })
  await expect(reload).toBeFocused()

  await reload.click()
  await expect(window.getByRole('list', { name: 'Lista CV' })).toBeVisible()
})

test('a change made in the editor right before a rendering error is kept after Reload', async () => {
  await launchWithLanguageMenu()
  await cvList().getByRole('button', { name: 'Open' }).click()
  const fullName = window.getByLabel('Full name')
  await expect(fullName).toBeVisible()

  // Zmiana w polu, a zaraz potem – przed autozapisem (~500 ms) – błąd przy przerysowaniu po zmianie języka:
  // podgląd odmienia liczbę stron przez `Intl.PluralRules`.
  await fullName.fill('Ewa Nowak')
  await window.evaluate(() => {
    ;(globalThis.Intl as { PluralRules: unknown }).PluralRules = function () {
      throw new Error('boom')
    }
  })
  await chooseLanguage('Polski')

  await expect(window.getByRole('alert')).toHaveText('Coś poszło nie tak')
  await window.getByRole('button', { name: 'Wczytaj ponownie' }).click()
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.getByLabel('Imię i nazwisko')).toHaveValue('Ewa Nowak')
})

// Podmienia natywne okno błędu i zapamiętuje tytuł oraz treść każdego wywołania.
async function stubErrorBox() {
  await app.evaluate(({ dialog }) => {
    const calls: { title: string; content: string }[] = []
    ;(globalThis as { errorBoxCalls?: typeof calls }).errorBoxCalls = calls
    dialog.showErrorBox = (title, content) => void calls.push({ title, content })
  })
}

const errorBoxCalls = () =>
  app.evaluate(() => (globalThis as { errorBoxCalls?: { title: string; content: string }[] }).errorBoxCalls ?? [])

test('an unexpected error in the main process is reported once in a native error box and the app keeps working', async () => {
  await expect(cvList()).toBeVisible()
  await stubErrorBox()

  await app.evaluate(() => {
    setTimeout(() => {
      throw new Error('boom')
    })
    void Promise.reject(new Error('boom'))
  })

  await expect.poll(errorBoxCalls).toHaveLength(1)
  const [errorBox] = await errorBoxCalls()
  expect(errorBox!.title).toBe('An unexpected error occurred')
  expect(errorBox!.content).toContain('CV Drawer ran into a problem. Your saved CVs are safe.')
  expect(errorBox!.content).toMatch(/\nDetails: boom$/)

  // Drugi błąd w tej samej minucie jest tylko logowany, a aplikacja działa dalej.
  await window.waitForTimeout(500)
  expect(await errorBoxCalls()).toHaveLength(1)
  await window.getByRole('button', { name: 'New CV' }).click()
  await expect(cvList().getByRole('listitem')).toHaveCount(2)
})

test('when the hidden print window crashes, PDF export fails right away instead of waiting 30 seconds', async () => {
  await cvList().getByRole('button', { name: 'Open' }).click()
  // Każde nowe (ukryte) okno wydruku pada, gdy tylko załaduje się jego dokument.
  await app.evaluate(({ app }) => {
    app.on('browser-window-created', (_event, printWindow) => {
      printWindow.webContents.once('dom-ready', () => printWindow.webContents.forcefullyCrashRenderer())
    })
  })

  const started = Date.now()
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByRole('alert').filter({ hasText: 'Couldn’t save the PDF. Try again.' })).toBeVisible({
    timeout: 10_000
  })
  expect(Date.now() - started).toBeLessThan(10_000)
})

// Zabija proces renderera okna aplikacji, jak przy awarii.
async function crashRenderer() {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]!.webContents.forcefullyCrashRenderer()
  })
}

// Czy okno znów pokazuje bibliotekę CV. Stan sprawdzamy w procesie głównym, bo obiekt `Page` Playwrighta
// nie musi przetrwać awarii renderera.
const libraryShown = () =>
  app.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]!.webContents
    if (contents.isCrashed() || contents.isLoading()) return false
    const text = (await contents.executeJavaScript('document.body.innerText').catch(() => '')) as string
    return text.includes('New CV')
  })

// Podmienia natywne okno komunikatu: zapamiętuje opcje i zwraca wskazany przycisk.
async function stubMessageBox(response: number) {
  await app.evaluate(({ dialog }, response) => {
    const calls: Electron.MessageBoxOptions[] = []
    ;(globalThis as { messageBoxCalls?: typeof calls }).messageBoxCalls = calls
    const stub = async (...args: unknown[]) => {
      calls.push(args.at(-1) as Electron.MessageBoxOptions)
      return { response, checkboxChecked: false }
    }
    dialog.showMessageBox = stub as typeof dialog.showMessageBox
  }, response)
}

const messageBoxCalls = () =>
  app.evaluate(() => (globalThis as { messageBoxCalls?: Electron.MessageBoxOptions[] }).messageBoxCalls ?? [])

test('a crashed app window reloads itself and shows the library again', async () => {
  await expect(cvList()).toBeVisible()
  await crashRenderer()
  await expect.poll(libraryShown, { timeout: 10_000 }).toBe(true)
})

test('after the fourth crash within a minute the app asks whether to reload or quit instead of reloading in a loop', async () => {
  await expect(cvList()).toBeVisible()
  await stubMessageBox(0)
  for (let crash = 0; crash < 3; crash++) {
    await crashRenderer()
    await expect.poll(libraryShown, { timeout: 10_000 }).toBe(true)
  }
  expect(await messageBoxCalls()).toEqual([])

  await crashRenderer()
  await expect.poll(messageBoxCalls).toHaveLength(1)
  const [question] = await messageBoxCalls()
  expect(question).toMatchObject({
    message: 'The CV Drawer window stopped working several times in a row.',
    detail: 'Your saved CVs are safe. You can reload the window or quit the app.',
    buttons: ['Reload', 'Quit CV Drawer']
  })
  // „Wczytaj ponownie” przeładowuje okno i zeruje licznik: kolejna awaria znów tylko przeładowuje.
  await expect.poll(libraryShown, { timeout: 10_000 }).toBe(true)
  await crashRenderer()
  await expect.poll(libraryShown, { timeout: 10_000 }).toBe(true)
  expect(await messageBoxCalls()).toHaveLength(1)
})
