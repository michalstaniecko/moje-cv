import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { dictionaryFor, type InterfaceLanguage } from '../src/shared/i18n/languages'
import { _electron as electron, expect, test, type CDPSession, type ElectronApplication, type Page } from '@playwright/test'

// Zrzuty ekranu do wpisu w Mac App Store: 2880×1800 (16:10), interfejs i Sample CV w danym języku.
// Wynik w `dist/screenshots/<język>/` (katalog ignorowany przez git).
const SCREENSHOT_SIZE = { width: 2880, height: 1800 }
const outputRoot = resolve(__dirname, '../dist/screenshots')

let app: ElectronApplication
let window: Page
let cdp: CDPSession
let tempDir: string

// Aplikacja zawsze na tymczasowym, pustym katalogu danych (pierwsze uruchomienie z Sample CV), nigdy na prawdziwej
// bibliotece użytkownika. Okno w tle jak w testach e2e, jasny wygląd, bez sprawdzania aktualizacji.
async function launch(language: InterfaceLanguage) {
  const env = { ...process.env, MOJE_CV_LANGUAGE: language, MOJE_CV_APPEARANCE: 'light', MOJE_CV_UPDATE_URL: 'off' } as Record<string, string>
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  // `--lang`: pola natywne Chromium (np. miesiąc w polu daty) w języku zrzutu, a nie w języku systemu.
  const args = ['.', `--user-data-dir=${join(tempDir, 'user-data')}`, `--lang=${language}`]
  app = await electron.launch({ args, env, colorScheme: null })
  window = await app.firstWindow()
  // Zrzuty są do Mac App Store, gdzie Sponsor bar jest ukryta (ADR-0005): kanał podmieniony w procesie głównym
  // i okno wczytane od nowa, żeby renderer zapytał o niego jeszcze raz.
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('sponsor:is-available')
    ipcMain.handle('sponsor:is-available', () => false)
  })
  await window.reload()
  await expect(window.locator('.sponsor-bar')).toHaveCount(0)
  // Okno 1440×900 punktów w skali Retina (2×), niezależnie od ekranu, na którym działa skrypt: emulacja w rendererze
  // zamiast zmiany rozmiaru okna, którego macOS nie pozwoliłby powiększyć ponad ekran.
  cdp = await window.context().newCDPSession(window)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: SCREENSHOT_SIZE.width / 2,
    height: SCREENSHOT_SIZE.height / 2,
    deviceScaleFactor: 2,
    mobile: false
  })
}

// Szerokość i wysokość z nagłówka IHDR pliku PNG.
async function pngSize(path: string) {
  const bytes = await readFile(path)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function shoot(language: InterfaceLanguage, name: string) {
  const path = join(outputRoot, language, `${name}.png`)
  // Bez przejściowego „Zapisywanie…” w pasku narzędzi edytora.
  await expect(window.getByText(dictionaryFor(language).editor.saveStatus.pending)).toHaveCount(0)
  // Bez obwódki fokusu i wyróżnienia pod kursorem po ostatnim kliknięciu.
  await window.mouse.move(0, 0)
  await window.locator('body').evaluate((body) => (body.ownerDocument.activeElement as typeof body | null)?.blur())
  // Bezpośrednio przez CDP: zrzut Playwrighta skaluje do pikseli CSS, a potrzebne są piksele urządzenia (2×).
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(path, Buffer.from(data, 'base64'))
  expect(await pngSize(path)).toEqual(SCREENSHOT_SIZE)
}

// Systemowe okno zapisu zastąpione zapisem do katalogu tymczasowego pod proponowaną nazwą pliku.
async function stubSaveDialog() {
  await app.evaluate(({ dialog }, dir) => {
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      const fileName = ((args.at(-1) as Electron.SaveDialogOptions).defaultPath ?? 'cv.pdf').split('/').at(-1)!
      return { canceled: false, filePath: `${dir}/${fileName}` }
    }) as typeof dialog.showSaveDialog
  }, tempDir)
}

test.beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'moje-cv-screenshots-'))
})

test.afterEach(async () => {
  await app?.close()
  await rm(tempDir, { recursive: true, force: true })
})

// Biblioteka CV na zrzucie: Sample CV (pod nową nazwą) i kilka dalszych CV z tagami, od najstarszego.
const library: Record<'pl' | 'en', { name: string; tags: string[] }[]> = {
  pl: [
    { name: 'Specjalistka ds. zakupów', tags: ['zakupy', 'PL'] },
    { name: 'Liderka obsługi klienta', tags: ['obsługa klienta'] },
    { name: 'Analityczka łańcucha dostaw', tags: ['logistyka', 'zdalnie'] },
    { name: 'Kierowniczka zakupów', tags: ['zakupy', 'kierownicze', 'EN'] }
  ],
  en: [
    { name: 'Senior Procurement Specialist', tags: ['procurement', 'EN'] },
    { name: 'Customer Service Lead', tags: ['customer service'] },
    { name: 'Supply Chain Analyst', tags: ['logistics', 'remote'] },
    { name: 'Purchasing Manager – Harbor Foods', tags: ['procurement', 'management', 'PL'] }
  ]
}

for (const language of ['pl', 'en'] as const) {
  test(`App Store screenshots in ${language}`, async () => {
    const t = dictionaryFor(language)
    await rm(join(outputRoot, language), { recursive: true, force: true })
    await mkdir(join(outputRoot, language), { recursive: true })
    await launch(language)

    // Biblioteka CV z tagami. Sample CV jest jedynym CV po pierwszym uruchomieniu; kolejne CV trafiają na górę listy.
    const list = window.getByRole('list', { name: t.library.list })
    const rows = list.locator(':scope > li')
    await expect(rows).toHaveCount(1)
    for (const [index, { name, tags }] of library[language].entries()) {
      if (index > 0) await window.getByRole('button', { name: t.library.newCv, exact: true }).click()
      await expect(rows).toHaveCount(index + 1)
      const row = rows.first()
      await row.getByRole('button', { name: t.library.rename }).click()
      await list.getByLabel(t.library.name).fill(name)
      await list.getByLabel(t.library.name).press('Enter')
      await expect(rows.first().locator('.library-item-name')).toHaveText(name)
      await rows.first().getByRole('button', { name: t.library.tags }).click()
      for (const tag of tags) {
        await list.getByLabel(t.library.newTag).fill(tag)
        await list.getByLabel(t.library.newTag).press('Enter')
      }
      await list.getByRole('button', { name: t.common.done }).click()
    }
    await expect(rows).toHaveCount(library[language].length)
    await shoot(language, '02-library')

    // Edytor z podglądem stron A4 (Sample CV).
    const sample = library[language][0]!
    await rows.filter({ hasText: sample.name }).getByRole('button', { name: t.library.open }).click()
    const preview = window.locator('.preview')
    await expect(preview.locator('.cv-page').first()).toBeVisible()
    // Formularz przewinięty do nagłówka CV, żeby edytor pokazywał treść, a nie tylko wybór wyglądu (ten jest w 03).
    await window.getByLabel(t.editor.fullName).evaluate((element) => element.closest('section, fieldset')?.scrollIntoView({ block: 'start' }))
    await shoot(language, '01-editor')

    // Wybór templatu: sekcja CV design z miniaturami, wybrany „Nowoczesny” / „Modern”.
    const picker = window.getByRole('radiogroup', { name: t.editor.template })
    const modern = picker.getByRole('radio', { name: t.editor.templateNames.modern })
    await picker.locator('label', { has: window.getByRole('radio', { name: t.editor.templateNames.modern }) }).click()
    await expect(modern).toBeChecked()
    await expect(preview.locator('.cv.cv-template-modern')).toHaveCount(1)
    await window.getByRole('heading', { name: t.editor.cvDesign }).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await shoot(language, '03-templates')

    // Eksport do PDF: komunikat o zapisanym pliku z przyciskami „Otwórz” i „Pokaż w Finderze”.
    await stubSaveDialog()
    await window.getByRole('button', { name: t.editor.exportPdf }).click()
    await expect(window.getByText(new RegExp(t.editor.savedPdf('').trim()))).toBeVisible()
    await shoot(language, '04-pdf-export')
  })
}
