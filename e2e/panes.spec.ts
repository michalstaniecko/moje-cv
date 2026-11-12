import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych (ten sam przy ponownym uruchomieniu), angielski i jasny wygląd.
async function launch() {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
  // Okno w tle (bez fokusu i niewidoczne); `MOJE_CV_E2E_HEADED=1` pokazuje je normalnie do debugowania.
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  // Bez sprawdzania nowej wersji przy starcie: żaden test nie łączy się z GitHubem (ADR-0006).
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
}

async function setWindowWidth(width: number) {
  await app.evaluate(({ BrowserWindow }, width) => {
    const [browserWindow] = BrowserWindow.getAllWindows()
    const [, height] = browserWindow!.getSize()
    browserWindow!.setSize(width, height!)
  }, width)
}

const separator = () => window.getByRole('separator', { name: 'Resize the form and the preview' })
const formWidth = async () => (await window.locator('.editor-form').boundingBox())!.width
const previewWidth = async () => (await window.locator('.preview').boundingBox())!.width
const panesWidth = async () => (await window.locator('.editor-panes').boundingBox())!.width

test('dragging the separator resizes the form and the preview within their minimum widths', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  await expect.poll(formWidth).toBeCloseTo(440, 0)

  const handle = (await separator().boundingBox())!
  const y = handle.y + handle.height / 2
  await window.mouse.move(handle.x + handle.width / 2, y)
  await window.mouse.down()
  await window.mouse.move(handle.x + handle.width / 2 + 120, y, { steps: 5 })
  await window.mouse.up()
  await expect.poll(formWidth).toBeCloseTo(560, 0)
  await expect(separator()).toHaveAttribute('aria-valuenow', '560')

  // Za daleko w prawo: podgląd zostaje na 360 px; za daleko w lewo: formularz zostaje na 360 px.
  const moved = (await separator().boundingBox())!
  await window.mouse.move(moved.x + moved.width / 2, y)
  await window.mouse.down()
  await window.mouse.move(1270, y, { steps: 5 })
  await window.mouse.up()
  await expect.poll(previewWidth).toBeCloseTo(360, 0)
  await expect.poll(async () => (await formWidth()) + 360).toBeCloseTo(await panesWidth(), 0)

  const atMax = (await separator().boundingBox())!
  await window.mouse.move(atMax.x + atMax.width / 2, y)
  await window.mouse.down()
  await window.mouse.move(5, y, { steps: 5 })
  await window.mouse.up()
  await expect.poll(formWidth).toBeCloseTo(360, 0)

  // Podwójne kliknięcie przywraca szerokość domyślną.
  await separator().dblclick()
  await expect.poll(formWidth).toBeCloseTo(440, 0)
})

test('the separator works from the keyboard and tells screen readers its value and bounds', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  const bar = separator()
  await expect(bar).toHaveAttribute('aria-orientation', 'vertical')
  await expect(bar).toHaveAttribute('aria-valuenow', '440')
  await expect(bar).toHaveAttribute('aria-valuemin', '360')
  await expect(bar).toHaveAttribute('aria-valuemax', String(Math.round(await panesWidth()) - 360))

  await bar.focus()
  await window.keyboard.press('ArrowRight')
  await expect(bar).toHaveAttribute('aria-valuenow', '456')
  await window.keyboard.press('Shift+ArrowLeft')
  await expect(bar).toHaveAttribute('aria-valuenow', '392')
  await window.keyboard.press('Home')
  await expect(bar).toHaveAttribute('aria-valuenow', '360')
  await expect.poll(formWidth).toBeCloseTo(360, 0)
  await window.keyboard.press('End')
  await expect.poll(previewWidth).toBeCloseTo(360, 0)
})

test('the form width is one preference kept across CVs and restarts; a narrower window shrinks it only for the time being', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  await separator().focus()
  for (let i = 0; i < 3; i++) await window.keyboard.press('Shift+ArrowRight')
  await expect.poll(formWidth).toBeCloseTo(632, 0)

  // Po powrocie do biblioteki i ponownym otwarciu CV szerokość zostaje.
  await window.getByRole('button', { name: '← CV library' }).click()
  await openFirstCv()
  await expect.poll(formWidth).toBeCloseTo(632, 0)

  // Węższe okno zmniejsza formularz tak, żeby podgląd miał 360 px, a szersze przywraca preferencję.
  await setWindowWidth(960)
  await expect.poll(previewWidth).toBeCloseTo(360, 0)
  await setWindowWidth(1280)
  await expect.poll(formWidth).toBeCloseTo(632, 0)

  // Po restarcie aplikacji (stan okna też wraca, więc szerokość okna jest ta sama).
  await app.close()
  await launch()
  await openFirstCv()
  await expect.poll(formWidth).toBeCloseTo(632, 0)
})

test('in fit mode the preview rescales while the separator moves; a chosen zoom stays and only the view scrolls', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  const page = window.locator('.preview .cv-page').first()
  const pageWidth = async () => (await page.boundingBox())!.width
  const fitted = await pageWidth()

  await separator().focus()
  await window.keyboard.press('Shift+ArrowRight')
  await window.keyboard.press('Shift+ArrowRight')
  await expect.poll(pageWidth).toBeCloseTo(fitted - 128, 0)

  await window.locator('.preview').getByRole('button', { name: '100%' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7, 0)
  await separator().focus()
  await window.keyboard.press('Shift+ArrowRight')
  await expect.poll(pageWidth).toBeCloseTo(793.7, 0)
})

test('a long bullet field fits its text again after the separator moves: shorter in a wider form, taller in a narrower one', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  const bullet = window.getByRole('textbox', { name: 'Bullet 1', exact: true }).first()
  await bullet.fill('A long bullet that wraps over several lines in a narrow form, '.repeat(6))
  const fits = () => bullet.evaluate((element) => element.scrollHeight <= element.clientHeight)
  const height = async () => (await bullet.boundingBox())!.height

  await separator().focus()
  await window.keyboard.press('Home')
  await expect.poll(formWidth).toBeCloseTo(360, 0)
  const narrow = await height()
  expect(await fits()).toBe(true)

  await window.keyboard.press('End')
  await expect.poll(height).toBeLessThan(narrow)
  expect(await fits()).toBe(true)
})

test('the editor screen itself never scrolls: only the form and the preview do, with their hidden helpers kept inside', async () => {
  await setWindowWidth(1280)
  await openFirstCv()
  await expect(window.locator('.preview .cv-page').first()).toBeVisible()
  // Ukryte elementy pozycjonowane absolutnie (komunikaty dla czytnika ekranu, kontener pomiaru stron) nie mogą
  // wystawać poza panele: inaczej ekran dostaje własny pasek przewijania i panele odjeżdżają spod paska narzędzi.
  await window.locator('.editor-form').evaluate((form) => (form.scrollTop = form.scrollHeight))
  const screen = window.locator('.app-screen')
  await screen.evaluate((element) => (element.scrollTop = 10_000))
  expect(await screen.evaluate((element) => element.scrollTop)).toBe(0)
  expect(await screen.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0)
})
