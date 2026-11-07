import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sampleCvs } from '../src/renderer/src/domain/sampleCv'
import { dictionaryFor, interfaceLanguageCodes, interfaceLanguages, type InterfaceLanguage } from '../src/shared/i18n/languages'
import { plural } from '../src/shared/i18n/plural'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych (pierwsze uruchomienie), wymuszony język interfejsu i jasny wygląd,
// bez emulacji `prefers-color-scheme` przez Playwrighta.
async function launch(language: InterfaceLanguage) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env, MOJE_CV_LANGUAGE: language } as Record<string, string>
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  // Bez sprawdzania nowej wersji przy starcie: żaden test nie łączy się z GitHubem (ADR-0006).
  env['MOJE_CV_UPDATE_URL'] = 'off'
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env, colorScheme: null }
      : { args: ['.', userDataDir], env, colorScheme: null }
  )
  window = await app.firstWindow()
}

test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
})

test.afterEach(async () => {
  await app?.close()
  await rm(outputDir, { recursive: true, force: true })
})

// Podmienia systemowe okno zapisu: zwraca podaną ścieżkę i zapamiętuje proponowaną nazwę pliku.
async function stubSaveDialog(filePath: string) {
  await app.evaluate(({ dialog }, filePath) => {
    const defaultPaths: string[] = []
    ;(globalThis as { defaultPaths?: string[] }).defaultPaths = defaultPaths
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      defaultPaths.push((args.at(-1) as Electron.SaveDialogOptions).defaultPath ?? '')
      return { canceled: false, filePath }
    }) as typeof dialog.showSaveDialog
  }, filePath)
}

// Proponowane nazwy PDF Sample CV, gdzie transliteracja ma dokładny wynik (cyrylica, zasady rosyjskie i ukraińskie).
const expectedPdfNames: Partial<Record<InterfaceLanguage, string>> = {
  ru: 'CV_Anna_Obraztsova.pdf',
  uk: 'CV_Olena_Zrazkova.pdf'
}

// Górny poziom menu aplikacji i pozycje menu Language (zaznaczone radio z dopiskiem „✓”).
async function menu() {
  return app.evaluate(({ Menu }) => {
    const items = Menu.getApplicationMenu()?.items ?? []
    const languageMenu = items.find((item) => item.submenu?.items.some((entry) => entry.label === 'English'))
    return {
      top: items.map((item) => item.label),
      languages: (languageMenu?.submenu?.items ?? []).map((item) => item.label + (item.checked ? ' ✓' : ''))
    }
  })
}

// Przyciski i paski, które nie mieszczą się w jednej linii: pasek szerszy niż jego miejsce albo przycisk, którego
// tekst się zawija lub wystaje. Dłuższe tłumaczenia (np. niemieckie) nie mogą rozpychać przycisków ani pasków.
async function controlsThatDoNotFit(selector: string) {
  return window.locator('body').evaluate((body, selector) => {
    const document = body.ownerDocument
    const problems: string[] = []
    for (const container of document.querySelectorAll(selector)) {
      if (!container.checkVisibility()) continue
      if (container.scrollWidth > container.clientWidth + 1) {
        // Najgłębszy element wystający poza pasek – zwykle to on jest za długi.
        const right = container.getBoundingClientRect().left + container.clientWidth
        const sticking = [...container.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > right + 1)
        const culprit = sticking.find((element) => !sticking.some((other) => other !== element && element.contains(other)))
        problems.push(`${container.className}: ${container.scrollWidth}px > ${container.clientWidth}px (“${culprit?.textContent}”)`)
      }
      for (const button of container.querySelectorAll('button, [role="menuitem"]')) {
        if (!button.checkVisibility()) continue
        const range = document.createRange()
        range.selectNodeContents(button)
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
        if (lines > 1 || button.scrollWidth > button.clientWidth + 1) problems.push(`“${button.textContent}” in ${container.className}`)
      }
    }
    return problems
  }, selector)
}

// Sprawdza, czy przyciski i paski mieszczą się także w oknie o rozmiarze minimalnym, i przywraca poprzedni rozmiar.
async function controlsThatDoNotFitAtMinimumSize(selector: string) {
  const windowSize = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getContentSize())
  const innerWidth = () => window.locator('html').evaluate((html) => html.clientWidth)
  const [width, height] = await windowSize()
  // Mniejszego rozmiaru okno nie przyjmie – zostaje na minimum.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(400, 300))
  const [minWidth] = await windowSize()
  await expect.poll(innerWidth).toBe(minWidth)
  const problems = await controlsThatDoNotFit(selector)
  await app.evaluate(({ BrowserWindow }, [width, height]) => BrowserWindow.getAllWindows()[0]!.setContentSize(width!, height!), [width, height])
  await expect.poll(innerWidth).toBe(width)
  return problems
}

// Pozycje menu Language: języki w ich własnych nazwach, alfabetycznie (łacinka przed cyrylicą); po nich System.
const languageMenuItems = [
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
  'Українська'
]

// Sample CV w każdym języku ma tyle stron co angielskie i polskie.
const SAMPLE_CV_PAGES = 2

// Font, z którym startuje Sample CV: cyrylicy i pełnego wietnamskiego nie ma Lato.
const sourceSansLanguages: InterfaceLanguage[] = ['ru', 'uk', 'vi']

for (const language of interfaceLanguageCodes) {
  test(`in ${interfaceLanguages[language].name} the app starts with its menu and Sample CV, every label fits and the PDF has the Sample CV pages`, async () => {
    const t = dictionaryFor(language)
    const sample = sampleCvs[language]
    await launch(language)

    // Start: dokument i menu w tym języku; menu Language dwujęzyczne (po angielsku samo „Language”).
    await expect(window.locator('html')).toHaveAttribute('lang', language)
    await expect.poll(() => window.title()).toBe('CV Press')
    expect(t.menu.language).toEqual(language === 'en' ? 'Language' : expect.stringMatching(/^\S.* \/ Language$/))
    await expect.poll(menu).toEqual({
      top: [t.appName, t.menu.file, t.menu.edit, t.menu.view, t.menu.language, t.menu.appearance, t.menu.window, t.menu.help],
      languages: [...languageMenuItems, `${t.menu.systemLanguage} ✓`]
    })

    // Biblioteka: pierwsze uruchomienie dodaje Sample CV w tym języku; paski, wiersz listy i menu „Nowe CV” się mieszczą.
    const library = window.getByRole('list', { name: t.library.list })
    await expect(library.getByRole('listitem')).toHaveCount(1)
    await expect(library.locator('.library-item-name')).toHaveText(sample.name)
    await window.getByRole('button', { name: t.library.moreCreateOptions }).click()
    await expect(window.getByRole('menuitem', { name: t.library.addSample })).toBeVisible()
    expect(await controlsThatDoNotFit('.toolbar, .library-item, .split-button-menu, .sponsor-bar')).toEqual([])
    await window.keyboard.press('Escape')
    expect(await controlsThatDoNotFitAtMinimumSize('.toolbar, .library-item, .sponsor-bar')).toEqual([])

    // Biblioteka klauzul.
    await window.getByRole('button', { name: t.library.clauses }).click()
    await expect(window.getByRole('heading', { name: t.clauses.title })).toBeVisible()
    expect(await controlsThatDoNotFit('.toolbar, .sponsor-bar')).toEqual([])
    await window.getByRole('button', { name: t.common.back(t.appName) }).click()

    // Edytor: Sample CV w swoim CV language i foncie, licznik stron, paski i przyciski formularza się mieszczą.
    await library.getByRole('button', { name: t.library.open }).click()
    const preview = window.locator('.preview')
    await expect(preview.locator('.cv-page .cv-name')).toHaveText(sample.header.fullName)
    await expect(preview.locator('.cv')).toHaveAttribute('lang', language)
    await expect(window.getByLabel(t.editor.cvLanguage)).toHaveValue(language)
    await expect(
      window.locator('label.form-field', { has: window.getByText(t.editor.font, { exact: true }) }).locator('select')
    ).toHaveValue(
      sourceSansLanguages.includes(language) ? 'source-sans-3' : 'lato'
    )
    await expect(preview.locator('.cv-page .cv-date').first()).toHaveText(`03.2023 – ${t.cvText.present}`)
    await expect(window.locator('.preview-page-count')).toHaveText(plural(language, t.preview.pages, SAMPLE_CV_PAGES))
    expect(await controlsThatDoNotFit('.toolbar, .preview-bar, .editor-form, .sponsor-bar')).toEqual([])
    expect(await controlsThatDoNotFitAtMinimumSize('.toolbar, .preview-bar, .editor-form, .sponsor-bar')).toEqual([])

    // PDF ma tyle stron co podgląd Sample CV.
    const pdfPath = join(outputDir, `${language}.pdf`)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: t.editor.exportPdf }).click()
    await expect(window.getByText(t.editor.savedPdf(`${language}.pdf`))).toBeVisible()
    expect(await controlsThatDoNotFit('.toolbar, .export-notice')).toEqual([])
    const [defaultPath] = await app.evaluate(() => (globalThis as { defaultPaths?: string[] }).defaultPaths!)
    const fileName = defaultPath!.split('/').at(-1)
    expect(fileName).toMatch(/^CV_[A-Za-z0-9_-]+\.pdf$/)
    if (expectedPdfNames[language]) expect(fileName).toBe(expectedPdfNames[language])
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await getDocument({ data: new Uint8Array(await readFile(pdfPath)) }).promise
    expect(pdf.numPages).toBe(SAMPLE_CV_PAGES)
    const firstPage = await (await pdf.getPage(1)).getTextContent()
    expect(firstPage.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain(sample.header.fullName)

    // Pusta biblioteka: tekst i przycisk „Dodaj przykładowe CV” się mieszczą.
    await window.getByRole('button', { name: t.common.back(t.appName) }).click()
    await library.getByRole('button', { name: t.common.delete }).click()
    await library.getByRole('alertdialog').getByRole('button', { name: t.common.delete }).click()
    await expect(library.getByRole('listitem')).toHaveCount(0)
    await expect(window.locator('.library-empty-state').getByRole('button', { name: t.library.addSample })).toBeVisible()
    expect(await controlsThatDoNotFit('.toolbar, .library-empty-state, .sponsor-bar')).toEqual([])
  })
}
