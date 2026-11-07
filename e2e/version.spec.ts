import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { HELP_URL } from '../src/shared/links'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w sponsor.spec.ts: tymczasowy katalog danych, wymuszony język interfejsu (`language: null` zostawia wybór menu)
// i jasny wygląd.
async function launch({ language = 'en' }: { language?: InterfaceLanguage | null } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
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

// Wersja z procesu głównego (`version` z package.json) – test jej nie wpisuje na sztywno.
const appVersion = () => app.evaluate(({ app }) => app.getVersion())

test('the CV library shows the app name and version at the bottom, without a second contentinfo landmark', async () => {
  const version = await appVersion()
  await expect(window.getByRole('button', { name: 'New CV' })).toBeVisible()
  await expect(window.locator('main.library')).toContainText(`CV Press ${version}`)
  await expect(window.getByRole('contentinfo')).toHaveCount(1)
})

test('the More dialog of the Sponsor bar shows the same app name and version', async () => {
  const version = await appVersion()
  await window.getByRole('contentinfo', { name: 'Support CV Press' }).getByRole('button', { name: 'More' }).click()
  const dialog = window.getByRole('dialog', { name: 'Why CV Press is free' })
  await expect(dialog).toContainText(`CV Press ${version}`)
})

// Wybiera język w menu Language w procesie głównym (jak w sponsor.spec.ts) – to przebudowuje menu i panel „O aplikacji”.
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

test('the About panel shows the name, version, copyright and help page address, also after switching the language', async () => {
  const version = await appVersion()
  await app.evaluate(({ app }) => {
    const calls: Electron.AboutPanelOptionsOptions[] = []
    ;(globalThis as { aboutPanelCalls?: typeof calls }).aboutPanelCalls = calls
    app.setAboutPanelOptions = (options) => {
      calls.push(options)
    }
  })
  await chooseLanguage('Polski')
  const lastOptions = () =>
    app.evaluate(() => (globalThis as { aboutPanelCalls?: Electron.AboutPanelOptionsOptions[] }).aboutPanelCalls?.at(-1))
  await expect
    .poll(lastOptions)
    .toMatchObject({ applicationName: 'CV Press', applicationVersion: version, copyright: '© 2026 Michal Staniecko', website: HELP_URL })
})
