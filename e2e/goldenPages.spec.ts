import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// „Złote strony” (docs/specs/inline-editing-redesign.md, Q24): wygląd dokumentu nie może się zmienić. Sample CV `en`
// w każdym szablonie – zrzut każdej strony w skali 100% oraz tekst i liczba stron eksportowanego PDF – porównane
// ze wzorcami zapisanymi z `main` przed przeprojektowaniem edytora. Wzorców nie aktualizujemy, żeby test przeszedł:
// różnica oznacza zmianę wyglądu dokumentu.

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych, angielski i jasny wygląd, okno w tle.
async function launch() {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { ...process.env, MOJE_CV_APPEARANCE: 'light' } as Record<string, string>
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  env['MOJE_CV_UPDATE_URL'] = 'off'
  env['MOJE_CV_LANGUAGE'] = 'en'
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

async function stubSaveDialog(filePath: string) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
  }, filePath)
}

// Zaznaczalny tekst każdej strony PDF (jak czytnik/ATS).
async function pdfPages(path: string): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise
  const pages: string[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  return pages
}

for (const template of ['Classic', 'Modern', 'Bold'] as const) {
  test(`golden pages: the Sample CV in the ${template} template looks exactly as before, on the pages and in the PDF`, async () => {
    const slug = template.toLowerCase()
    await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
    const preview = window.locator('.preview')
    const picker = window.getByRole('radiogroup', { name: 'Template' })
    await picker.locator('label', { has: window.getByRole('radio', { name: template }) }).click()
    await expect(picker.getByRole('radio', { name: template })).toBeChecked()
    await expect(preview.locator(`.cv.cv-template-${slug}`)).toHaveCount(1)
    await expect(window.getByRole('status').filter({ hasText: 'Saving…' })).toHaveCount(0)

    // Strony w Preview mode – tak jak trafią do PDF.
    await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Preview' }).click()
    await expect(window.locator('.editor-form')).toHaveCount(0)

    // Skala 1:1, niezależna od szerokości panelu stron, i obszar okna, w którym cała strona mieści się w panelu stron
    // (bez przykrycia paskiem podglądu); okno w tle ma rozmiar zależny od ekranu, więc obszar jest emulowany.
    await window.setViewportSize({ width: 1600, height: 1500 })
    await preview.getByRole('button', { name: '100%' }).click()
    const pages = preview.locator('.cv-page')
    await expect(pages.first()).toBeVisible()
    const pageCount = await pages.count()
    for (let index = 0; index < pageCount; index++) {
      await pages.nth(index).evaluate((page) => page.scrollIntoView({ block: 'center' }))
      await expect(pages.nth(index)).toHaveScreenshot(`${slug}-page-${index + 1}.png`, { animations: 'disabled', caret: 'hide' })
    }

    const pdfPath = join(outputDir, `${slug}.pdf`)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: 'Export to PDF' }).click()
    await expect(window.getByText(`Saved PDF: ${slug}.pdf`)).toBeVisible()
    const pdf = await pdfPages(pdfPath)
    expect(pdf).toHaveLength(pageCount)
    expect(pdf.map((text, index) => `--- page ${index + 1} ---\n${text}`).join('\n') + '\n').toMatchSnapshot(`${slug}-pdf.txt`)
  })
}
