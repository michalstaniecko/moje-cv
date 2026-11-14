import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

// Edycja na stronach CV (docs/specs/inline-editing-redesign.md): tryby Edit mode / Preview mode, warstwa edycji
// i Edit card.

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

// ---------- Warstwa edycji i Edit card ----------

// Klik w miejsce na stronie, jak użytkownik: nad stronami leży warstwa edycji (przyciski fragmentów), więc klik
// współrzędnymi, a nie w element strony (Playwright nie kliknie elementu przykrytego przyciskiem).
async function clickOnPage(element: Locator) {
  await element.scrollIntoViewIfNeeded()
  const box = (await element.boundingBox())!
  await window.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

const fragment = (what: string) => window.locator('.edit-layer').getByRole('button', { name: `Edit: ${what}`, exact: true })
const card = (name: string) => window.getByRole('dialog', { name, exact: true })
const pageName = () => window.locator('.preview .cv-page .cv-name')

async function stubSaveDialog(filePath: string) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
  }, filePath)
}

async function pdfText(path: string): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise
  const pages: string[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  return pages.join('\n')
}

// Karta stoi obok kartki na wysokości fragmentu albo pod nim / nad nim (anchoredPosition) – zawsze w skali 1:1.
async function expectCardNextTo(dialog: Locator, button: Locator) {
  await expect
    .poll(async () => {
      const cardBox = (await dialog.boundingBox())!
      const anchor = (await button.boundingBox())!
      const viewport = window.viewportSize()!
      const beside = Math.abs(cardBox.y - Math.max(4, Math.min(anchor.y, viewport.height - cardBox.height - 4))) < 1.5
      const below = Math.abs(cardBox.y - (anchor.y + anchor.height + 8)) < 1.5
      const above = Math.abs(cardBox.y + cardBox.height - (anchor.y - 8)) < 1.5
      return (cardBox.x >= anchor.x + anchor.width && beside) || below || above
    })
    .toBe(true)
  expect((await dialog.boundingBox())!.width).toBe(340)
}

test('clicking the name on the page opens its Edit card with the focus in the field; typing changes the page and the PDF, and Cmd+Z undoes it in one step', async () => {
  await openFirstCv()
  await clickOnPage(pageName())
  const nameCard = card('Full name')
  await expect(nameCard).toBeVisible()
  const field = nameCard.getByLabel('Full name')
  await expect(field).toBeFocused()

  // Kursor na końcu: pisanie dopisuje do imienia, strona zmienia się od razu (tak samo jak pole formularza).
  await window.keyboard.type(' Jr')
  await expect(pageName()).toHaveText('Jane Example Jr')
  await expect(window.locator('.editor-form').getByLabel('Full name')).toHaveValue('Jane Example Jr')
  await expect(fragment('Full name')).toHaveAttribute('aria-expanded', 'true')

  // Seria znaków w karcie to jeden krok cofania – jak w formularzu.
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveText('Jane Example')
  await expect(field).toHaveValue('Jane Example')
  await window.keyboard.press('Meta+Shift+z')
  await expect(pageName()).toHaveText('Jane Example Jr')
  await expect(nameCard).toBeVisible()

  const pdfPath = join(outputDir, 'cv.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: cv.pdf')).toBeVisible()
  expect(await pdfText(pdfPath)).toContain('Jane Example Jr')
})

test('Escape closes the card and returns the focus to its fragment; clicking another fragment switches the card; clicking the page background closes it', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  await clickOnPage(preview.locator('.cv-page .cv-summary'))
  await expect(card('Summary')).toBeVisible()
  await expect(card('Summary').getByLabel('Summary')).toBeFocused()

  // Jedna karta naraz: klik innego fragmentu przełącza kartę.
  await clickOnPage(preview.locator('.cv-page .cv-section-title', { hasText: 'Education' }))
  const titleCard = card('Section title “Education”')
  await expect(titleCard).toBeVisible()
  await expect(card('Summary')).toHaveCount(0)
  await expect(titleCard.getByLabel('Section title')).toBeFocused()
  await titleCard.getByLabel('Section title').fill('Studies')
  await expect(preview.locator('.cv-page .cv-section-title', { hasText: 'Studies' })).toBeVisible()
  await expect(card('Section title “Studies”')).toBeVisible()

  await window.keyboard.press('Escape')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(fragment('Section title “Studies”')).toBeFocused()

  // Klik w tło strony (margines kartki) albo obok strony zamyka kartę.
  await window.keyboard.press('Enter')
  await expect(card('Section title “Studies”')).toBeVisible()
  const page = (await preview.locator('.cv-page').first().boundingBox())!
  await window.mouse.click(page.x + 4, page.y + 4)
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()
  await window.mouse.click(page.x - 8, page.y + 40)
  await expect(window.getByRole('dialog')).toHaveCount(0)

  // Pasek podglądu nie zamyka karty (powiększenie przy otwartej karcie).
  await clickOnPage(pageName())
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(card('Full name')).toBeVisible()
})

test('the editing layer works from the keyboard alone: Tab goes through the fragments in document order, Enter opens a card, Tab leaves it to the next fragment', async () => {
  await openFirstCv()
  const names = ['Full name', 'Summary', ...['Work experience', 'Education', 'Skills', 'Languages'].map((title) => `Section title “${title}”`)]
  await expect(window.locator('.edit-layer .edit-fragment')).toHaveCount(names.length)
  await fragment('Full name').focus()
  for (const name of names.slice(1)) {
    await window.keyboard.press('Tab')
    await expect(fragment(name)).toBeFocused()
  }

  await fragment('Summary').focus()
  await window.keyboard.press('Enter')
  const summaryCard = card('Summary')
  const summary = summaryCard.getByLabel('Summary')
  await expect(summary).toBeFocused()
  // Karta nie więzi fokusu: Tab z ostatniego pola – kolejny fragment, Shift+Tab z niego – fragment karty, a Tab z niego
  // wraca do karty (karta jest „za” swoim fragmentem).
  await window.keyboard.press('Tab')
  await expect(fragment('Section title “Work experience”')).toBeFocused()
  await expect(summaryCard).toBeVisible()
  await window.keyboard.press('Shift+Tab')
  await expect(fragment('Summary')).toBeFocused()
  await window.keyboard.press('Tab')
  await expect(summaryCard.getByRole('button', { name: 'Close' })).toBeFocused()
  await window.keyboard.press('Tab')
  await expect(summary).toBeFocused()
  await window.keyboard.press('Shift+Tab')
  await window.keyboard.press('Shift+Tab')
  await expect(fragment('Summary')).toBeFocused()

  // Spacja też otwiera; „×” zamyka.
  await fragment('Section title “Skills”').focus()
  await window.keyboard.press('Space')
  await expect(card('Section title “Skills”').getByLabel('Section title')).toBeFocused()
  await card('Section title “Skills”').getByRole('button', { name: 'Close' }).click()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(fragment('Section title “Skills”')).toBeFocused()
})

test('the Edit card follows its fragment when the page split and the zoom change, always at 100%', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1500 })
  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('50%')

  // Długie podsumowanie przenosi pierwszą sekcję na drugą stronę; karta jej tytułu otwarta przy nim.
  await window.locator('.editor-form').getByLabel('Summary').fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(70))
  const title = fragment('Section title “Work experience”')
  await expect(title).toHaveAttribute('data-page', '1')
  await clickOnPage(preview.locator('.cv-page .cv-section-title', { hasText: 'Work experience' }))
  const titleCard = card('Section title “Work experience”')
  await expect(titleCard).toBeVisible()
  await expectCardNextTo(titleCard, title)
  // Położenie na stronach, nie w oknie: przewijanie panelu (scroll anchoring) może trzymać fragment w miejscu okna.
  const offset = () => title.evaluate((button) => (button as unknown as { offsetTop: number }).offsetTop)
  const before = await offset()

  // Cofnięcie (z fokusem w karcie) zmienia podział stron – karta jedzie za fragmentem.
  await window.keyboard.press('Meta+z')
  await expect(window.locator('.editor-form').getByLabel('Summary')).not.toHaveValue(/Lorem/)
  await expect(title).toHaveAttribute('data-page', '0')
  await expect.poll(offset).not.toBeCloseTo(before, 0)
  await expect(titleCard).toBeVisible()
  await expectCardNextTo(titleCard, title)

  // Zmiana skali: fragment rośnie, karta zostaje w skali 1:1 i dalej stoi przy nim.
  const small = (await title.boundingBox())!
  await preview.getByRole('button', { name: 'Zoom in' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('75%')
  await expect.poll(async () => (await title.boundingBox())!.width).toBeGreaterThan(small.width * 1.4)
  await expect(titleCard).toBeVisible()
  await expectCardNextTo(titleCard, title)
})

test('Preview mode has no editing layer: switching closes the open card and focuses the toggle; Edit mode does not reopen it', async () => {
  await openFirstCv()
  await expect(window.locator('.edit-layer')).toHaveCount(1)
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()

  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(previewButton()).toBeFocused()
  await expect(window.locator('.edit-layer, .edit-fragment, .edit-card')).toHaveCount(0)
  await expect(window.getByRole('dialog')).toHaveCount(0)

  await editButton().click()
  await expectEditMode()
  await expect(window.locator('.edit-layer')).toHaveCount(1)
  await expect(fragment('Full name')).toBeVisible()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

// Kontrakt znaczników edycji (ADR-0009): w każdym szablonie każdy fragment Sample CV, który ma już Edit card, ma swój
// przycisk w warstwie edycji, a przycisk leży na swoim fragmencie strony. Tytuły list w Classic stoją obok listy
// (wewnątrz wiersza listy), w Modern i Bold nad nią.
for (const template of ['Classic', 'Modern', 'Bold'] as const) {
  test(`markup contract: every fragment of the Sample CV in the ${template} template has its element in the editing layer`, async () => {
    await openFirstCv()
    const preview = window.locator('.preview')
    const picker = window.getByRole('radiogroup', { name: 'Template' })
    await picker.locator('label', { has: window.getByRole('radio', { name: template }) }).click()
    await expect(preview.locator(`.cv.cv-template-${template.toLowerCase()}`)).toHaveCount(1)

    const titles = ['Work experience', 'Education', 'Skills', 'Languages']
    const expected: [string, Locator][] = [
      ['Full name', preview.locator('.cv-page .cv-name')],
      ['Summary', preview.locator('.cv-page .cv-summary')],
      ...titles.map((title): [string, Locator] => [
        `Section title “${title}”`,
        preview.locator('.cv-page .cv-section-title', { hasText: title })
      ])
    ]
    await expect
      .poll(() => window.locator('.edit-layer .edit-fragment').evaluateAll((buttons) => buttons.map((button) => button.textContent)))
      .toEqual(expected.map(([name]) => `Edit: ${name}`))
    for (const [name, element] of expected) {
      const box = (await element.boundingBox())!
      const button = (await fragment(name).boundingBox())!
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      expect(x, name).toBeGreaterThanOrEqual(button.x)
      expect(x, name).toBeLessThanOrEqual(button.x + button.width)
      expect(y, name).toBeGreaterThanOrEqual(button.y)
      expect(y, name).toBeLessThanOrEqual(button.y + button.height)
    }
  })
}
