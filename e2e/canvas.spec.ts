import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// Edycja na stronach CV (docs/specs/inline-editing-redesign.md): tryby Edit mode / Preview mode.

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych, angielski i jasny wygląd, okno w tle.
async function launch() {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
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

async function openFirstCv() {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page').first()).toBeVisible()
}

// Pozycja menu aplikacji wywołana w procesie głównym (natywnego menu Playwright nie kliknie), jak w export.spec.ts.
async function clickMenuItem(menuLabel: string, itemLabel: string) {
  await app.evaluate(
    ({ BrowserWindow, Menu }, { menuLabel, itemLabel }) => {
      const menu = Menu.getApplicationMenu()?.items.find((item) => item.label === menuLabel)
      const item = menu?.submenu?.items.find((item) => item.label === itemLabel)
      if (!item) throw new Error(`Brak pozycji menu ${menuLabel} → ${itemLabel}`)
      const window = BrowserWindow.getAllWindows().find((window) => window.isVisible())
      item.click(undefined, window, window?.webContents)
    },
    { menuLabel, itemLabel }
  )
}

// Widok → Podgląd: aktywność, zaznaczenie i skrót.
async function previewMenuItem() {
  return app.evaluate(({ Menu }) => {
    const view = Menu.getApplicationMenu()?.items.find((item) => item.label === 'View')
    const item = view?.submenu?.items.find((item) => item.label === 'Preview')
    if (!item) throw new Error('Brak pozycji menu View → Preview')
    return { enabled: item.enabled, checked: item.checked, type: item.type, accelerator: item.accelerator }
  })
}

const modeGroup = () => window.getByRole('group', { name: 'Mode' })
const editButton = () => modeGroup().getByRole('button', { name: 'Edit', exact: true })
const previewButton = () => modeGroup().getByRole('button', { name: 'Preview', exact: true })

async function expectEditMode() {
  await expect(editButton()).toHaveAttribute('aria-pressed', 'true')
  await expect(previewButton()).toHaveAttribute('aria-pressed', 'false')
  await expect(window.locator('.editor-form')).toHaveCount(1)
  await expect(window.locator('.pane-separator')).toHaveCount(1)
  await expect.poll(async () => (await previewMenuItem()).checked).toBe(false)
}

async function expectPreviewMode() {
  await expect(previewButton()).toHaveAttribute('aria-pressed', 'true')
  await expect(editButton()).toHaveAttribute('aria-pressed', 'false')
  // Bez paska bocznego: ani formularza, ani separatora w DOM; strony na całą szerokość.
  await expect(window.locator('.editor-form')).toHaveCount(0)
  await expect(window.locator('.pane-separator')).toHaveCount(0)
  await expect(window.getByLabel('Full name')).toHaveCount(0)
  await expect.poll(async () => (await previewMenuItem()).checked).toBe(true)
}

test('the Edit | Preview toggle switches the editor between Edit mode and Preview mode; every opened CV starts in Edit mode', async () => {
  // Poza edytorem Widok → Podgląd jest nieaktywne.
  await expect.poll(async () => (await previewMenuItem()).enabled).toBe(false)
  await openFirstCv()
  await expectEditMode()
  expect(await previewMenuItem()).toEqual({ enabled: true, checked: false, type: 'checkbox', accelerator: 'CmdOrCtrl+Shift+P' })

  await previewButton().click()
  await expectPreviewMode()
  await expect(previewButton()).toBeFocused()
  const preview = window.locator('.preview')
  const panes = window.locator('.editor-panes')
  await expect.poll(async () => (await preview.boundingBox())!.width).toBeCloseTo((await panes.boundingBox())!.width, 0)
  // Pasek narzędzi i pasek podglądu zostają.
  await expect(window.getByRole('button', { name: 'Export to PDF' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Zoom in' })).toBeVisible()

  await editButton().click()
  await expectEditMode()
  await expect(window.getByLabel('Full name')).toBeVisible()

  // Tryb nie jest zapamiętywany: po wyjściu i ponownym otwarciu CV – Edit mode, a menu znów nieaktywne poza edytorem.
  await previewButton().click()
  await expectPreviewMode()
  await window.getByRole('button', { name: '← CV library' }).click()
  await expect(window.getByRole('list', { name: 'CV list' })).toBeVisible()
  await expect.poll(previewMenuItem).toMatchObject({ enabled: false, checked: false })
  await openFirstCv()
  await expectEditMode()
})

test('Cmd+Shift+P and View → Preview switch the modes, also from a text field, and move the focus to the toggle', async () => {
  await openFirstCv()
  await window.getByLabel('Full name').focus()
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(previewButton()).toBeFocused()
  await window.keyboard.press('Meta+Shift+P')
  await expectEditMode()

  await clickMenuItem('View', 'Preview')
  await expectPreviewMode()
  await expect(previewButton()).toBeFocused()
  await clickMenuItem('View', 'Preview')
  await expectEditMode()
})

test('switching the mode is not an undo step and does not change the document; zoom and scroll stay', async () => {
  await openFirstCv()
  const status = window.locator('.toolbar-status')
  await expect(status).toHaveText('')

  // Przełączenie trybu nie zapisuje niczego i nie dodaje kroku cofania.
  await previewButton().click()
  await expectPreviewMode()
  await editButton().click()
  await expectEditMode()
  await expect(status).toHaveText('')
  await window.keyboard.press('Meta+z')
  await expectEditMode()

  // Zmiana dokumentu, potem przełączenie: Cmd+Z cofa zmianę dokumentu, a nie tryb.
  const fullName = window.getByLabel('Full name')
  await fullName.fill('Jane Changed')
  await expect(status).toHaveText('Changes saved')
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-name')).toHaveText('Jane Changed')
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await window.keyboard.press('Meta+z')
  await expect(preview.locator('.cv-page .cv-name')).toHaveText('Jane Example')
  await expectPreviewMode()
  await window.keyboard.press('Meta+Shift+z')
  await expect(preview.locator('.cv-page .cv-name')).toHaveText('Jane Changed')
  await expectPreviewMode()

  // Skala wybrana w pasku podglądu i przewinięcie stron zostają po zmianie trybu (w obie strony).
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.evaluate((element) => (element.scrollTop = 400))
  await window.keyboard.press('Meta+Shift+P')
  await expectEditMode()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('100%')
  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBe(400)
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('100%')
  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBe(400)
})

test('Preview mode does not highlight oversized fragments on the pages but warns in the preview bar, and “Show” switches to Edit mode', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  const warning = preview.getByText('Some content doesn’t fit on a page')
  await previewButton().click()
  await expect(warning).toHaveCount(0)
  await editButton().click()

  await window.getByLabel('Summary').fill(Array.from({ length: 200 }, (_, i) => `A very long summary, line ${i + 1}.`).join('\n'))
  const message = 'This fragment is too long to fit on a page – shorten it'
  await expect(preview.locator('.cv-block--oversized')).toHaveCount(1)
  await expect(preview.getByText(message)).toBeVisible()
  await expect(warning).toHaveCount(0)

  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(preview.locator('.cv-block--oversized')).toHaveCount(0)
  await expect(preview.getByText(message)).toHaveCount(0)
  await expect(warning).toBeVisible()
  // Klik w kartkę nic nie robi.
  await preview.locator('.cv-page').first().click()
  await expectPreviewMode()

  await preview.getByRole('button', { name: 'Show' }).click()
  await expectEditMode()
  await expect(editButton()).toBeFocused()
  await expect(preview.locator('.cv-block--oversized')).toHaveCount(1)
  await expect(warning).toHaveCount(0)

  // Podpowiedź przed eksportem mówi, gdzie są wyróżnione za długie fragmenty.
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  const confirm = window.getByRole('dialog', { name: 'Some content doesn’t fit on a page and will be cut off. Export anyway?' })
  await expect(confirm).toContainText('The fragments that are too long are highlighted in edit mode.')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
})
