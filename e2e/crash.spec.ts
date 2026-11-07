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
  await expect(window.getByRole('contentinfo', { name: 'Sponsor' })).toBeHidden()
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
