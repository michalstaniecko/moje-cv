import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

// Każdy test startuje z pustym katalogiem danych (pierwsze uruchomienie), żeby nie dotykać danych użytkownika.
test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  app = await electron.launch({ args: ['.', `--user-data-dir=${join(outputDir, 'user-data')}`] })
  window = await app.firstWindow()
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

test('on first run opens the sample CV from the library and exports it to a PDF identical to the preview', async () => {
  const pdfPath = join(outputDir, 'export.pdf')
  await stubSaveDialog(pdfPath)

  const library = window.getByRole('list', { name: 'Lista CV' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(library.getByText('Przykładowe CV')).toBeVisible()
  await library.getByRole('button', { name: 'Otwórz' }).click()

  await expect(window.locator('.cv-page').first()).toBeVisible()
  const previewPageCount = await window.locator('.preview .cv-page').count()

  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF')).toBeVisible()

  const saveDialogOptions = await app.evaluate(
    () => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls
  )
  expect(saveDialogOptions).toHaveLength(1)
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('CV_Anna_Przykladowa.pdf')

  const pdf = await readPdf(await readFile(pdfPath))
  expect(previewPageCount).toBe(2)
  expect(pdf.pages).toHaveLength(previewPageCount)
  for (const size of pdf.pageSizes) {
    expect(size.width).toBeCloseTo(A4_PT.width, 0)
    expect(size.height).toBeCloseTo(A4_PT.height, 0)
  }
  expect(pdf.pages[0]).toContain('Anna Przykładowa')
  expect(pdf.pages[0]).toContain('Starsza specjalistka ds. zakupów')
  expect(pdf.pages.at(-1)).toContain('Wyrażam zgodę na przetwarzanie moich danych osobowych')
  expect(pdf.pages.slice(0, -1).join('')).not.toContain('Wyrażam zgodę')
  expect(pdf.title).toBe('CV – Anna Przykładowa')
  expect(pdf.author).toBe('Anna Przykładowa')
  expect(pdf.embeddedFonts.some((name) => name.includes('Lato'))).toBe(true)
})

// A4 w punktach PDF (210 × 297 mm).
const A4_PT = { width: 595.28, height: 841.89 }

type ParsedPdf = { pages: string[]; pageSizes: { width: number; height: number }[]; title: string; author: string; embeddedFonts: string[] }

// Odczytuje PDF tak jak czytnik/ATS: zaznaczalny tekst każdej strony, metadane i osadzone fonty.
async function readPdf(bytes: Buffer): Promise<ParsedPdf> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(bytes), fontExtraProperties: true }).promise
  const pages: string[] = []
  const pageSizes: ParsedPdf['pageSizes'] = []
  const embeddedFonts = new Set<string>()
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const [, , width = 0, height = 0] = page.view
    pageSizes.push({ width, height })
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
    await page.getOperatorList()
    for (const fontId of new Set(content.items.flatMap((item) => ('fontName' in item ? [item.fontName] : [])))) {
      const font = page.commonObjs.get(fontId) as { name?: string; missingFile?: boolean }
      if (font.name && !font.missingFile) embeddedFonts.add(font.name)
    }
  }
  const { info } = (await document.getMetadata()) as { info: { Title?: string; Author?: string } }
  return { pages, pageSizes, title: info.Title ?? '', author: info.Author ?? '', embeddedFonts: [...embeddedFonts] }
}
