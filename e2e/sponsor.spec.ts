import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { SPONSOR_URL } from '../src/shared/sponsor'
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

// Podmienia otwieranie adresów w przeglądarce systemowej i zapamiętuje, z czym je wywołano.
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

// Wybiera język w menu Language w procesie głównym (jak w export.spec.ts). Etykieta menu jest w języku interfejsu
// („Language”, „Język / Language”…), więc menu jest szukane po pozycji English.
async function chooseLanguage(itemLabel: string) {
  await app.evaluate(
    ({ BrowserWindow, Menu }, { itemLabel }) => {
      const menu = Menu.getApplicationMenu()?.items.find((item) => item.submenu?.items.some((entry) => entry.label === 'English'))
      const item = menu?.submenu?.items.find((item) => item.label === itemLabel)
      if (!item) throw new Error(`Brak pozycji menu Language → ${itemLabel}`)
      const window = BrowserWindow.getAllWindows().find((window) => window.isVisible())
      item.click(undefined, window, window?.webContents)
    },
    { itemLabel }
  )
}

const sponsorBar = () => window.getByRole('contentinfo', { name: 'Sponsor' })

test('on first launch the Sponsor bar is visible on the library screen with the Sponsor link and the More button', async () => {
  await expect(window.getByRole('button', { name: 'New CV' })).toBeVisible()
  const bar = sponsorBar()
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('CV Press is free')
  await expect(bar.getByRole('button', { name: 'Buy me a coffee' })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'More' })).toBeVisible()
})

test('after opening a CV the Sponsor bar is still visible on the editor screen and does not overlap the page preview', async () => {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()
  const bar = sponsorBar()
  await expect(bar).toBeVisible()
  const previewBox = (await preview.boundingBox())!
  const barBox = (await bar.boundingBox())!
  expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(barBox.y)
  // Jedna linia: belka jest niska w porównaniu z oknem.
  expect(barBox.height).toBeLessThan(48)
})

test('More opens the dialog explaining why the app is free; Escape, Close and a click on the backdrop close it', async () => {
  await sponsorBar().getByRole('button', { name: 'More' }).click()
  const dialog = window.getByRole('dialog', { name: 'Why CV Press is free' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('no ads, no account')
  await expect(dialog).toContainText('It unlocks nothing')
  await expect(dialog.getByRole('button', { name: 'Buy me a coffee' })).toBeVisible()

  await window.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await sponsorBar().getByRole('button', { name: 'More' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()

  await sponsorBar().getByRole('button', { name: 'More' }).click()
  await expect(dialog).toBeVisible()
  await window.mouse.click(5, 5)
  await expect(dialog).toBeHidden()
})

test('the Sponsor link in the bar and in the dialog opens only the GitHub Sponsors address in the system browser', async () => {
  await stubOpenExternal()
  await sponsorBar().getByRole('button', { name: 'Buy me a coffee' }).click()
  await expect.poll(openExternalCalls).toEqual([SPONSOR_URL])

  await sponsorBar().getByRole('button', { name: 'More' }).click()
  const dialog = window.getByRole('dialog', { name: 'Why CV Press is free' })
  await dialog.getByRole('button', { name: 'Buy me a coffee' }).click()
  await expect.poll(openExternalCalls).toEqual([SPONSOR_URL, SPONSOR_URL])
})

test('the Sponsor bar and the dialog follow the interface language switched in the menu', async () => {
  await app.close()
  await launch({ language: null })
  await app.evaluate(({ app }) => {
    app.getPreferredSystemLanguages = () => ['en-US']
  })
  await expect(sponsorBar()).toContainText('CV Press is free')

  await chooseLanguage('Polski')
  const bar = sponsorBar()
  await expect(bar).toContainText('CV Press jest darmowe')
  await expect(bar.getByRole('button', { name: 'Postaw mi kawę' })).toBeVisible()
  await bar.getByRole('button', { name: 'Więcej' }).click()
  const dialog = window.getByRole('dialog', { name: 'Dlaczego CV Press jest darmowe' })
  await expect(dialog).toContainText('Niczego nie odblokowuje')
  await dialog.getByRole('button', { name: 'Zamknij' }).click()
  await expect(dialog).toBeHidden()

  await chooseLanguage('English')
  await expect(sponsorBar().getByRole('button', { name: 'Buy me a coffee' })).toBeVisible()
})
