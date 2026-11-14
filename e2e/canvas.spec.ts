import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
const fragmentNames = () =>
  window
    .locator('.edit-layer .edit-fragment')
    .evaluateAll((buttons) => buttons.map((button) => button.textContent!.replace(/^Edit: /, '')))
// Kolejne powtórzenia nazwy (fragmenty jednego wpisu na dwóch stronach) jako jedna nazwa.
const dedupe = (names: string[]) => names.filter((name, index) => name !== names[index - 1])
const positions = ['Senior Procurement Specialist', 'Procurement Specialist', 'Procurement Assistant', 'Junior Customer Service Specialist']
const educations = ['Postgraduate diploma, Procurement Management', 'Master’s degree, Logistics']
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

  // Jedna karta naraz: klik innego fragmentu przełącza kartę (imię jest nad podsumowaniem, więc karta go nie zasłania).
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()
  await expect(card('Summary')).toHaveCount(0)
  await expect(card('Full name').getByLabel('Full name')).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(fragment('Full name')).toBeFocused()

  await clickOnPage(preview.locator('.cv-page .cv-section-title', { hasText: 'Education' }))
  const titleCard = card('Section title “Education”')
  await expect(titleCard).toBeVisible()
  await expect(titleCard.getByLabel('Section title')).toBeFocused()
  await titleCard.getByLabel('Section title').fill('Studies')
  await expect(preview.locator('.cv-page .cv-section-title', { hasText: 'Studies' })).toBeVisible()
  await expect(card('Section title “Studies”')).toBeVisible()

  await window.keyboard.press('Escape')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(fragment('Section title “Studies”')).toBeFocused()

  // Klik w tło strony (margines kartki) albo obok strony zamyka kartę.
  const firstPage = preview.locator('.cv-page').first()
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()
  let page = (await firstPage.boundingBox())!
  await window.mouse.click(page.x + 4, page.y + 4)
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()
  page = (await firstPage.boundingBox())!
  await window.mouse.click(page.x - 8, page.y + 40)
  await expect(window.getByRole('dialog')).toHaveCount(0)

  // Pasek podglądu nie zamyka karty (powiększenie przy otwartej karcie).
  await clickOnPage(pageName())
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(card('Full name')).toBeVisible()
})

test('the editing layer works from the keyboard alone: Tab goes through the fragments in document order, Enter opens a card, Tab leaves it to the next fragment', async () => {
  await openFirstCv()
  // Classic: tytuł listy obok niej, więc przed jej elementami. Wpis rozdzielony podziałem stron ma fragment na każdej
  // stronie (ta sama nazwa dwa razy z rzędu).
  const names = [
    'Photo',
    'Full name',
    'Contact',
    'Summary',
    'Section title “Work experience”',
    ...positions.map((role) => `Position “${role}”`),
    'Section title “Education”',
    ...educations.map((name) => `Education “${name}”`),
    'Section title “Skills”',
    'List “Skills”',
    'Section title “Languages”',
    'List “Languages”'
  ]
  await expect.poll(() => fragmentNames()).toEqual(expect.arrayContaining(names))
  expect(dedupe(await fragmentNames())).toEqual(names)
  // Tytuły sekcji i wpisy mają uchwyt menu tuż przed sobą (w marginesie kartki, jak uchwyt wiersza w CV form).
  const stops = window.locator('.edit-layer .edit-fragment, .edit-layer .edit-handle .row-handle')
  expect(await stops.evaluateAll((elements) => elements.map((element) => element.textContent || element.getAttribute('aria-label'))))
    .toEqual(expect.arrayContaining(['Actions for section “Work experience”', 'Edit: Section title “Work experience”']))
  const count = await stops.count()
  await stops.first().focus()
  for (let index = 1; index < count; index++) {
    await window.keyboard.press('Tab')
    await expect(stops.nth(index)).toBeFocused()
  }

  await fragment('Summary').focus()
  await window.keyboard.press('Enter')
  const summaryCard = card('Summary')
  const summary = summaryCard.getByLabel('Summary')
  await expect(summary).toBeFocused()
  // Karta nie więzi fokusu: Tab z ostatniego pola – kolejny element warstwy (tu uchwyt tytułu sekcji), Shift+Tab z niego
  // – fragment karty, a Tab z niego wraca do karty (karta jest „za” swoim fragmentem).
  await window.keyboard.press('Tab')
  await expect(window.locator('.edit-layer').getByRole('button', { name: 'Actions for section “Work experience”' })).toBeFocused()
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

// Kontrakt znaczników edycji (ADR-0009): w każdym szablonie każdy fragment Sample CV (z włączoną klauzulą zgody), który
// ma już Edit card, ma swój przycisk w warstwie edycji, a przycisk leży na swoim fragmencie strony. Tytuły list
// w Classic stoją obok listy (wewnątrz wiersza listy), w Modern i Bold nad nią.
for (const template of ['Classic', 'Modern', 'Bold'] as const) {
  test(`markup contract: every fragment of the Sample CV in the ${template} template has its element in the editing layer`, async () => {
    await openFirstCv()
    const preview = window.locator('.preview')
    const picker = window.getByRole('radiogroup', { name: 'Template' })
    await picker.locator('label', { has: window.getByRole('radio', { name: template }) }).click()
    await expect(preview.locator(`.cv.cv-template-${template.toLowerCase()}`)).toHaveCount(1)
    await enableConsent('I agree to the processing of my personal data.')

    const page = (selector: string, text?: string) =>
      preview.locator(`.cv-page ${selector}`, text ? { hasText: new RegExp(`^${text.replace(/[()]/g, '\\$&')}$`) } : {})
    const titles = ['Work experience', 'Education', 'Skills', 'Languages']
    const contacts = preview.locator('.cv-page .cv-contact > *')
    await expect(contacts).toHaveCount(4)
    const expected: [string, Locator][] = [
      ['Photo', page('.cv-photo')],
      ['Full name', page('.cv-name')],
      ...[0, 1, 2, 3].map((index): [string, Locator] => ['Contact', contacts.nth(index)]),
      ['Summary', page('.cv-summary')],
      ...titles.map((title): [string, Locator] => [`Section title “${title}”`, page('.cv-section-title', title)]),
      ...positions.map((role): [string, Locator] => [`Position “${role}”`, page('.cv-role', role)]),
      // Classic nie ma .cv-education-level (poziom i kierunek w jednym tekście) – wpis po jego bloku.
      ...educations.map((name, index): [string, Locator] => [`Education “${name}”`, page(`[data-block-id="ed${index + 1}"] > :first-child`)]),
      ...['Commercial negotiation', 'Driving licence (category B)'].map((item): [string, Locator] => ['List “Skills”', page('li', item)]),
      ...['English – native', 'German – B2'].map((item): [string, Locator] => ['List “Languages”', page('li', item)]),
      ['Consent clause', page('.cv-consent')]
    ]
    await expect
      .poll(async () => [...new Set(await fragmentNames())].sort())
      .toEqual([...new Set(expected.map(([name]) => name))].sort())
    for (const [name, element] of expected) {
      const box = (await element.boundingBox())!
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      // Fragment rozdzielony podziałem stron ma przycisk na każdej stronie – element leży pod jednym z nich.
      const buttons = await Promise.all((await fragment(name).all()).map((button) => button.boundingBox()))
      expect(
        buttons.some((button) => button && x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height),
        name
      ).toBe(true)
    }

    // Kliknięte pole, punkt i element listy dostają fokus w karcie w każdym szablonie.
    const clicks: [Locator, string, string][] = [
      [page('li', 'Preparing and analysing requests for quotation and bid comparisons.'), 'Position “Senior Procurement Specialist”', 'Bullet 3'],
      [page('.cv-role', 'Procurement Assistant'), 'Position “Procurement Assistant”', 'Job title'],
      [page('li', 'German – B2'), 'List “Languages”', 'Item 2'],
      [page('[data-block-id="ed1"] > :first-child'), `Education “${educations[0]}”`, 'Level'],
      [page('.cv-consent'), 'Consent clause', 'Text in this CV']
    ]
    for (const [element, name, field] of clicks) {
      await clickOnPage(element)
      await expect(card(name).getByRole('textbox', { name: field }), name).toBeFocused()
      await window.keyboard.press('Escape')
      await expect(window.getByRole('dialog')).toHaveCount(0)
    }

    // N-te dziecko `.cv-contact` to n-ty kontakt: fokus na jego wartości w karcie kontaktów.
    for (const index of [1, 3]) {
      await clickOnPage(contacts.nth(index))
      await expect(card('Contact').getByRole('textbox', { name: `Contact value ${index + 1}` })).toBeFocused()
      await window.keyboard.press('Escape')
      await expect(window.getByRole('dialog')).toHaveCount(0)
    }
    // Zdjęcie: karta zdjęcia z fokusem na „Change photo” (karta nie ma pól tekstowych).
    await clickOnPage(page('.cv-photo'))
    await expect(card('Photo').getByRole('button', { name: 'Change photo' })).toBeFocused()
    await window.keyboard.press('Escape')
    await expect(fragment('Photo')).toBeFocused()
  })
}

// Klauzula zgody w formularzu: włączona, z treścią (Sample CV po angielsku jej nie ma).
async function enableConsent(text: string) {
  const form = window.locator('.editor-form')
  await form.getByLabel('Show the clause at the bottom of the last page').check()
  await form.getByLabel('Text in this CV').fill(text)
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveText(text)
}

// ---------- Karty wpisów, list i klauzuli zgody ----------

// Przeciąga element za uchwyt myszą krok po kroku, jak w export.spec.ts (dnd-kit reaguje na zdarzenia wskaźnika).
async function dragOnto(handle: Locator, target: Locator) {
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await window.mouse.down()
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 10, { steps: 5 })
  await window.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await window.mouse.up()
  // dnd-kit przez 50 ms po upuszczeniu blokuje kliknięcia (żeby upuszczenie nie było kliknięciem).
  await window.waitForTimeout(100)
}

const pageItem = (text: string) => window.locator('.preview .cv-page li', { hasText: text })

test('clicking the third bullet of a position opens its card with the focus in that bullet; Enter splits it and Backspace joins it back, like in the form', async () => {
  await openFirstCv()
  const third = 'Preparing and analysing requests for quotation and bid comparisons.'
  await clickOnPage(pageItem(third))
  const positionCard = card('Position “Senior Procurement Specialist”')
  await expect(positionCard).toBeVisible()
  const bullet = (number: number) => positionCard.getByLabel(`Bullet ${number}`, { exact: true })
  await expect(bullet(3)).toBeFocused()
  await expect(bullet(3)).toHaveValue(third)
  await expect(fragment('Position “Senior Procurement Specialist”').first()).toHaveAttribute('aria-expanded', 'true')

  // Enter w środku punktu dzieli go: nowy punkt pod spodem, fokus na jego początku – w karcie, nie w formularzu.
  await bullet(3).evaluate((field) => (field as unknown as { setSelectionRange: (start: number, end: number) => void }).setSelectionRange(26, 26))
  await window.keyboard.press('Enter')
  await expect(bullet(3)).toHaveValue('Preparing and analysing re')
  await expect(bullet(4)).toHaveValue('quests for quotation and bid comparisons.')
  await expect(bullet(4)).toBeFocused()
  await expect(pageItem('quests for quotation and bid comparisons.')).toHaveCount(1)
  await expect(window.locator('.editor-form').getByLabel('Bullet 4', { exact: true }).first()).toHaveValue(
    'quests for quotation and bid comparisons.'
  )
  await window.keyboard.press('Meta+z')
  await expect(bullet(3)).toHaveValue(third)

  // Enter na końcu – pusty punkt; Backspace w nim usuwa go i wraca na koniec poprzedniego.
  await bullet(3).focus()
  await bullet(3).evaluate((field) => (field as unknown as { setSelectionRange: (start: number, end: number) => void }).setSelectionRange(9999, 9999))
  await window.keyboard.press('Enter')
  await expect(bullet(4)).toHaveValue('')
  await expect(bullet(4)).toBeFocused()
  await window.keyboard.press('Backspace')
  await expect(bullet(4)).toHaveValue('Introducing quarterly supplier reviews that cut delivery times by 15%.')
  await expect(bullet(3)).toBeFocused()

  // Kliknięcie innego pola tego samego wpisu: ta sama karta, fokus na klikniętym polu.
  await clickOnPage(window.locator('.preview .cv-page .cv-company', { hasText: 'Fictional Manufacturing Ltd' }))
  await expect(positionCard.getByLabel('Company')).toBeFocused()
  await clickOnPage(window.locator('.preview .cv-page .cv-role', { hasText: 'Senior Procurement Specialist' }))
  await expect(positionCard.getByLabel('Job title')).toBeFocused()
})

test('the education card focuses the clicked field; the list card focuses the clicked item and reorders items by dragging', async () => {
  await openFirstCv()
  // Classic: poziom i kierunek w jednym tekście bez klasy kontraktu – fokus na pierwszym polu karty (poziom).
  const education = window.locator('.preview .cv-page [data-block-id="ed2"]')
  await clickOnPage(education.getByText('Master’s degree'))
  const educationCard = card('Education “Master’s degree, Logistics”')
  await expect(educationCard.getByLabel('Level')).toBeFocused()
  await window.keyboard.type(' (honours)')
  await expect(education).toContainText('Master’s degree (honours), Logistics')
  await expect(card('Education “Master’s degree (honours), Logistics”')).toBeVisible()
  await window.keyboard.press('Escape')

  await clickOnPage(pageItem('ERP systems (SAP, Oracle)'))
  const skills = card('List “Skills”')
  await expect(skills).toBeVisible()
  const item = (number: number) => skills.getByLabel(`Item ${number}`, { exact: true })
  await expect(item(3)).toBeFocused()

  // Przeciągnięcie trzeciego elementu na pierwszy – kolejność na stronie i w formularzu.
  await dragOnto(skills.getByRole('button', { name: 'Actions for item 3' }), item(1))
  await expect(item(1)).toHaveValue('ERP systems (SAP, Oracle)')
  const skillItems = window.locator('.preview .cv-page [data-block-id^="skills:"] li')
  await expect(skillItems).toHaveText([
    'ERP systems (SAP, Oracle)',
    'Commercial negotiation',
    'Bid and purchase cost analysis',
    'MS Excel – pivot tables, formulas',
    'Driving licence (category B)'
  ])
  await expect(skills).toBeVisible()

  // Klauzula zgody (włączona w formularzu) – karta z fokusem na treści.
  await window.keyboard.press('Escape')
  await enableConsent('I agree to the processing of my personal data.')
  await clickOnPage(window.locator('.preview .cv-page .cv-consent'))
  const consent = card('Consent clause')
  await expect(consent.getByLabel('Text in this CV')).toBeFocused()
  await window.keyboard.type(' Thank you.')
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveText('I agree to the processing of my personal data. Thank you.')
})

test('removing a bullet, an item or a whole position in a card says “Removed.” over the pages; Undo brings it back and the focus returns to it', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  const second = 'Sourcing and qualifying new suppliers in Europe and Asia.'
  await clickOnPage(pageItem(second))
  const positionCard = card('Position “Procurement Specialist”')
  await expect(positionCard.getByLabel('Bullet 2', { exact: true })).toBeFocused()

  // Punkt: „Remove” w menu wiersza.
  await positionCard.getByRole('button', { name: 'Actions for bullet 2' }).click()
  await window.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(pageItem(second)).toHaveCount(0)
  await expect(removed).toBeVisible()
  // Komunikat pływa w lewym dolnym rogu panelu stron, nie w kolumnie formularza.
  await expect(window.locator('.editor-form').getByRole('status').filter({ hasText: 'Removed.' })).toHaveCount(0)
  const message = (await removed.locator('.removal-message-content').boundingBox())!
  const pages = (await preview.boundingBox())!
  expect(message.x).toBeGreaterThanOrEqual(pages.x)
  expect(message.x).toBeLessThan(pages.x + 40)
  expect(message.y + message.height).toBeGreaterThan(pages.y + pages.height - 40)

  // „Undo” (klik nie zamyka karty) przywraca punkt, a fokus wraca na niego w karcie.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(pageItem(second)).toHaveCount(1)
  await expect(positionCard.getByLabel('Bullet 2', { exact: true })).toBeFocused()
  await expect(positionCard.getByLabel('Bullet 2', { exact: true })).toHaveValue(second)

  // Cały wpis: „Remove position” w karcie zamyka ją (wpisu już nie ma), fokus nie ginie.
  await positionCard.getByRole('button', { name: 'Remove position' }).click()
  await expect(window.locator('.preview .cv-page .cv-role', { hasText: /^Procurement Specialist$/ })).toHaveCount(0)
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(removed).toBeVisible()
  await expect.poll(() => window.evaluate('document.activeElement !== document.body')).toBe(true)
  // „Undo” przywraca wpis i otwiera jego kartę z fokusem na pierwszym polu.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(window.locator('.preview .cv-page .cv-role', { hasText: /^Procurement Specialist$/ })).toHaveCount(1)
  await expect(card('Position “Procurement Specialist”').getByLabel('Job title')).toBeFocused()

  // Element listy: to samo w karcie sekcji listowej.
  await clickOnPage(pageItem('German – B2'))
  const languages = card('List “Languages”')
  await languages.getByRole('button', { name: 'Actions for item 2' }).click()
  await window.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(pageItem('German – B2')).toHaveCount(0)
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(pageItem('German – B2')).toHaveCount(1)
  await expect(languages.getByLabel('Item 2', { exact: true })).toBeFocused()
})

test('Cmd+Z with the card of a newly added position open undoes the adding, closes the card and keeps the focus', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  await form.getByRole('button', { name: 'Add position' }).click()
  await form.getByLabel('Job title').last().fill('Buyer')
  const role = window.locator('.preview .cv-page .cv-role', { hasText: /^Buyer$/ })
  await expect(role).toHaveCount(1)

  await clickOnPage(role)
  const buyer = card('Position “Buyer”')
  await expect(buyer.getByLabel('Job title')).toBeFocused()
  // Cofnięcie wpisanej nazwy: wpis bez treści znika ze strony, ale karta zostaje (wpis istnieje).
  await window.keyboard.press('Meta+z')
  await expect(role).toHaveCount(0)
  await expect(card('Position “New position”')).toBeVisible()
  await expect(card('Position “New position”').getByLabel('Job title')).toBeFocused()
  // Cofnięcie dodania: wpisu nie ma, karta się zamyka, fokus przechodzi w bezpieczne miejsce.
  await window.keyboard.press('Meta+z')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(form.getByLabel('Job title')).toHaveCount(4)
  await expect(editButton()).toBeFocused()
})

// ---------- Karty zdjęcia i kontaktów ----------

// Systemowe okno wyboru pliku podmienione w procesie głównym, jak w export.spec.ts.
async function stubOpenDialog(filePath: string | null) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = (async () =>
      filePath ? { canceled: false, filePaths: [filePath] } : { canceled: true, filePaths: [] }) as typeof dialog.showOpenDialog
  }, filePath)
}

// Zdjęcie 1200×800: lewa połowa czerwona, prawa niebieska (jak w export.spec.ts).
async function writeRedBluePhoto() {
  const photoPath = join(outputDir, 'photo.png')
  const png = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [1200, 800]
    const bitmap = Buffer.alloc(width * height * 4)
    // Piksele w kolejności BGRA.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) bitmap.set(x < width / 2 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4)
    return nativeImage.createFromBitmap(bitmap, { width, height }).toPNG().toString('base64')
  })
  await writeFile(photoPath, Buffer.from(png, 'base64'))
  return photoPath
}

// Kolory dwóch przeciwległych rogów zdjęcia na stronie (RGB), jak `storedPhoto` w export.spec.ts.
function photoCorners(photo: Locator) {
  return photo.evaluate(async (element) => {
    const image = element as typeof element & { naturalWidth: number; naturalHeight: number; decode: () => Promise<void> }
    await image.decode()
    const canvas = element.ownerDocument.createElement('canvas') as unknown as {
      width: number
      height: number
      getContext: (type: '2d') => {
        drawImage: (image: unknown, x: number, y: number) => void
        getImageData: (x: number, y: number, width: number, height: number) => { data: Uint8ClampedArray }
      }
    }
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
    return [pixel(2, 2), pixel(canvas.width - 3, canvas.height - 3)]
  })
}

async function pdfImagesPerPage(path: string): Promise<number[]> {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise
  const counts: number[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const operators = await (await document.getPage(number)).getOperatorList()
    counts.push(operators.fnArray.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject).length)
  }
  return counts
}

test('clicking the photo opens its card: changing and cropping the photo there changes the page and the PDF; removing it says “Removed.” and Undo brings it back', async () => {
  const photoPath = await writeRedBluePhoto()
  await openFirstCv()
  const photo = window.locator('.preview .cv-page .cv-photo')
  const before = await photo.getAttribute('src')
  await clickOnPage(photo)
  const photoCard = card('Photo')
  await expect(photoCard.getByRole('img', { name: 'Photo in the CV' })).toBeVisible()
  await expect(photoCard.getByRole('button', { name: 'Change photo' })).toBeFocused()

  // Escape w oknie kadrowania zamyka tylko to okno – karta zostaje, zdjęcie bez zmian.
  await stubOpenDialog(photoPath)
  await photoCard.getByRole('button', { name: 'Change photo' }).click()
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })
  await expect(cropper).toBeVisible()
  await window.keyboard.press('Escape')
  await expect(cropper).toHaveCount(0)
  await expect(photoCard).toBeVisible()
  await expect(photo).toHaveAttribute('src', before!)

  // Kadr przesunięty maksymalnie w prawo – na zdjęciu zostaje sam niebieski.
  await photoCard.getByRole('button', { name: 'Change photo' }).click()
  const frame = cropper.getByRole('img', { name: 'Frame preview' })
  const box = (await frame.boundingBox())!
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await window.mouse.down()
  await window.mouse.move(box.x - box.width * 3, box.y + box.height / 2, { steps: 10 })
  await window.mouse.up()
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(cropper).toHaveCount(0)
  await expect(photoCard).toBeVisible()
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  for (const [r = 0, , b = 0] of await photoCorners(photo)) {
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(40)
  }
  await expect(photoCard.getByRole('img', { name: 'Photo in the CV' })).toHaveAttribute('src', (await photo.getAttribute('src'))!)

  const pdfPath = join(outputDir, 'with-photo.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: with-photo.pdf')).toBeVisible()
  expect((await pdfImagesPerPage(pdfPath))[0]).toBe(1)

  // Usunięcie z karty (klik w pasek narzędzi zamknął kartę – otwieramy ją znowu): zdjęcia nie ma na stronie ani
  // w PDF, karta zostaje z „Choose photo”.
  await clickOnPage(photo)
  await expect(photoCard.getByRole('button', { name: 'Change photo' })).toBeFocused()
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  await photoCard.getByRole('button', { name: 'Remove photo' }).click()
  await expect(photo).toHaveCount(0)
  await expect(removed).toBeVisible()
  await expect(photoCard.getByRole('button', { name: 'Choose photo' })).toBeVisible()

  // „Undo” przywraca wykadrowane zdjęcie, a fokus wraca do karty.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect(photoCard.getByRole('button', { name: 'Change photo' })).toBeFocused()

  await photoCard.getByRole('button', { name: 'Remove photo' }).click()
  await expect(photo).toHaveCount(0)
  const withoutPhoto = join(outputDir, 'without-photo.pdf')
  await stubSaveDialog(withoutPhoto)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: without-photo.pdf')).toBeVisible()
  expect((await pdfImagesPerPage(withoutPhoto)).every((count) => count === 0)).toBe(true)
})

test('the contacts card edits, adds and removes contacts like the form; removing says “Removed.” and Undo brings the contact back', async () => {
  await openFirstCv()
  const contacts = window.locator('.preview .cv-page .cv-contact > *')
  await clickOnPage(contacts.nth(1))
  const contactsCard = card('Contact')
  const value2 = contactsCard.getByRole('textbox', { name: 'Contact value 2' })
  await expect(value2).toBeFocused()
  await expect(value2).toHaveValue('jane.example@example.com')

  // Pisanie w karcie zmienia stronę i formularz (te same pola).
  await window.keyboard.type('.uk')
  await expect(contacts.nth(1)).toContainText('jane.example@example.com.uk')
  await expect(window.locator('.editor-form').getByLabel('Contact value 2')).toHaveValue('jane.example@example.com.uk')

  // Dodanie: nowy wiersz w karcie (etykieta z podpowiedziami), kontakt na stronie po wpisaniu wartości.
  await contactsCard.getByRole('button', { name: 'Add contact' }).click()
  const label5 = contactsCard.getByRole('combobox', { name: 'Contact label 5' })
  await expect(label5).toBeVisible()
  await label5.fill('GitHub')
  await contactsCard.getByRole('textbox', { name: 'Contact value 5' }).fill('github.com/jane-example')
  await expect(contacts).toHaveCount(5)
  await expect(contacts.nth(4)).toContainText('github.com/jane-example')

  // Usunięcie drugiego kontaktu: „Removed.”, a „Undo” przywraca go z fokusem na jego pierwszym polu w karcie.
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  await contactsCard.getByRole('button', { name: 'Remove contact 2' }).click()
  await expect(contacts).toHaveCount(4)
  await expect(window.locator('.preview .cv-page .cv-contact')).not.toContainText('jane.example@example.com.uk')
  await expect(removed).toBeVisible()
  await expect(contactsCard).toBeVisible()
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(contacts).toHaveCount(5)
  await expect(contactsCard.getByRole('combobox', { name: 'Contact label 2' })).toBeFocused()
  await expect(contactsCard.getByRole('textbox', { name: 'Contact value 2' })).toHaveValue('jane.example@example.com.uk')
})

// ---------- „Projekt CV” w pasku narzędzi ----------

const designButton = () => window.locator('.toolbar').getByRole('button', { name: 'CV design', exact: true })
const designPanel = () => window.getByRole('dialog', { name: 'CV design', exact: true })

async function pdfFillColors(path: string): Promise<string[]> {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise
  const colors = new Set<string>()
  for (let number = 1; number <= document.numPages; number++) {
    const operators = await (await document.getPage(number)).getOperatorList()
    operators.fnArray.forEach((fn, index) => {
      if (fn === OPS.setFillRGBColor) colors.add(String(operators.argsArray[index]?.[0]).toLowerCase())
    })
  }
  return [...colors]
}

test('CV design in the toolbar opens a panel with the colour, font, Template and CV language in both modes; Escape and a click outside close it and return the focus to the button', async () => {
  await openFirstCv()
  await expect(designButton()).toHaveAttribute('aria-expanded', 'false')

  // Otwarcie panelu zamyka otwartą Edit card; fokus na pierwszym polu panelu.
  await clickOnPage(pageName())
  await expect(card('Full name')).toBeVisible()
  await designButton().click()
  await expect(card('Full name')).toHaveCount(0)
  const panel = designPanel()
  await expect(panel).toBeVisible()
  await expect(designButton()).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByLabel('Accent color')).toBeFocused()
  await expect(panel.getByLabel('Accent color')).toHaveValue('#1a6e72')
  await expect(panel.getByLabel('Font')).toHaveValue('lato')
  await expect(panel.getByRole('radiogroup', { name: 'Template' }).getByRole('radio', { name: 'Classic' })).toBeChecked()
  await expect(panel.getByLabel('CV language')).toHaveValue('en')
  // Panel leży pod przyciskiem, cały w oknie.
  const buttonBox = (await designButton().boundingBox())!
  const panelBox = (await panel.boundingBox())!
  expect(panelBox.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(await window.locator('html').evaluate((html) => html.clientWidth))

  await window.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(designButton()).toBeFocused()
  await expect(designButton()).toHaveAttribute('aria-expanded', 'false')

  // Ponowny klik przycisku przy otwartym panelu zamyka go.
  await designButton().click()
  await expect(panel).toBeVisible()
  await designButton().click()
  await expect(panel).toHaveCount(0)

  // Preview mode: ten sam panel; klik w kartkę go zamyka, fokus wraca na przycisk.
  await previewButton().click()
  await expectPreviewMode()
  await designButton().click()
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('radiogroup', { name: 'Template' })).toBeVisible()
  await window.locator('.preview .cv-page').first().click({ position: { x: 20, y: 20 } })
  await expect(panel).toHaveCount(0)
  await expect(designButton()).toBeFocused()

  // Klawiatura: Enter otwiera, Tab przechodzi po polach panelu.
  await window.keyboard.press('Enter')
  await expect(panel).toBeVisible()
  await expect(panel.getByLabel('Accent color')).toBeFocused()
  await window.keyboard.press('Tab')
  await expect(panel.getByLabel('Font')).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(designButton()).toBeFocused()
})

test('changing the Template and the accent colour in the CV design panel changes the pages and the PDF, and Cmd+Z undoes each change', async () => {
  await openFirstCv()
  await previewButton().click()
  await expectPreviewMode()
  const preview = window.locator('.preview')
  await designButton().click()
  const panel = designPanel()

  await panel.getByLabel('Accent color').fill('#8a2be2')
  await expect(pageName()).toHaveCSS('color', 'rgb(138, 43, 226)')
  const picker = panel.getByRole('radiogroup', { name: 'Template' })
  await picker.locator('label', { has: window.getByRole('radio', { name: 'Modern' }) }).click()
  await expect(picker.getByRole('radio', { name: 'Modern' })).toBeChecked()
  await expect(preview.locator('.cv.cv-template-modern')).toHaveCount(1)
  // Panel zostaje otwarty przy zmianach – strony przerysowane pod nim.
  await expect(panel).toBeVisible()
  const pageCount = await preview.locator('.cv-page').count()

  // Eksport z panelem otwartym: klik w „Export to PDF” zamyka panel, PDF w nowym szablonie i kolorze.
  const pdfPath = join(outputDir, 'modern.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(panel).toHaveCount(0)
  await expect(window.getByText('Saved PDF: modern.pdf')).toBeVisible()
  const text = await pdfText(pdfPath)
  expect(text).toContain(`1 / ${pageCount}`)
  expect(await pdfFillColors(pdfPath)).toContain('#8a2be2')

  // Każda zmiana to jeden krok cofania, jak w formularzu.
  await window.keyboard.press('Meta+z')
  await expect(preview.locator('.cv.cv-template-classic')).toHaveCount(1)
  await expect(pageName()).toHaveCSS('color', 'rgb(138, 43, 226)')
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveCSS('color', 'rgb(26, 110, 114)')
  await designButton().click()
  await expect(panel.getByLabel('Accent color')).toHaveValue('#1a6e72')
  await expect(picker.getByRole('radio', { name: 'Classic' })).toBeChecked()
  await window.keyboard.press('Meta+Shift+z')
  await expect(panel.getByLabel('Accent color')).toHaveValue('#8a2be2')

  // W Edit mode CV form pokazuje te same ustawienia.
  await window.keyboard.press('Escape')
  await editButton().click()
  await expect(window.locator('.editor-form').getByLabel('Accent color')).toHaveValue('#8a2be2')
  await expect(window.locator('.editor-form').getByRole('radio', { name: 'Classic' })).toBeChecked()
})

// ---------- Menu fragmentu na stronie ----------

const handle = (name: string) => window.locator('.edit-layer').getByRole('button', { name: `Actions for ${name}`, exact: true })
const blockMenu = (name: string) => window.getByRole('menu', { name: `Actions for ${name}`, exact: true })
const announcement = () => window.locator('.edit-layer [aria-live]')
const sectionTitles = async () =>
  dedupe(await fragmentNames()).flatMap((name) => name.match(/^Section title “(.*)”$/)?.slice(1) ?? [])
const positionNames = async () =>
  dedupe(await fragmentNames()).flatMap((name) => name.match(/^Position “(.*)”$/)?.slice(1) ?? [])
// Uchwyt jest zawsze w DOM, a widać go (nieprzezroczysty) tylko przy najechaniu, fokusie i otwartym menu.
const handleBox = (name: string) =>
  window.locator('.edit-layer .edit-handle', { has: window.getByRole('button', { name: `Actions for ${name}`, exact: true }) })

test('the handle of a section title shows on hover and moves the section from its menu and with Alt+Shift+arrows; each move is one undo step and the focus stays on the handle', async () => {
  await openFirstCv()
  const education = handle('section “Education”')
  await expect(education).toHaveCount(1)
  // Uchwyt jest w marginesie kartki, przed lewą krawędzią fragmentu, i pokazuje się dopiero przy najechaniu.
  const titleBox = (await fragment('Section title “Education”').boundingBox())!
  expect((await education.boundingBox())!.x + 24).toBeLessThanOrEqual(titleBox.x)
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '0')
  await fragment('Section title “Education”').hover()
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '1')

  await education.click()
  const menu = blockMenu('section “Education”')
  await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeFocused()
  await expect(menu.getByRole('menuitemcheckbox', { name: 'New page before this section' })).toHaveAttribute('aria-checked', 'false')
  await expect(menu.getByRole('menuitem')).toHaveText(['Move up', 'Move down', 'Hide section', 'Add education'])
  await menu.getByRole('menuitem', { name: 'Move up' }).click()
  await expect.poll(sectionTitles).toEqual(['Education', 'Work experience', 'Skills', 'Languages'])
  await expect(education).toBeFocused()
  await expect(announcement()).toHaveText('Moved section “Education” to position 1 of 4.')
  // Ten sam porządek w CV form.
  await expect(window.locator('.editor-form .form-section[aria-label]').first()).toHaveAttribute('aria-label', 'Education')

  await window.keyboard.press('Meta+z')
  await expect.poll(sectionTitles).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])

  await education.focus()
  await window.keyboard.press('Alt+Shift+ArrowDown')
  await expect.poll(sectionTitles).toEqual(['Work experience', 'Skills', 'Education', 'Languages'])
  await expect(education).toBeFocused()
  await expect(announcement()).toHaveText('Moved section “Education” to position 3 of 4.')
  await window.keyboard.press('Alt+Shift+ArrowDown')
  await expect.poll(sectionTitles).toEqual(['Work experience', 'Skills', 'Languages', 'Education'])
  await expect(education).toBeFocused()
  // Na końcu nic się nie dzieje, a „Move down” w menu jest wyłączone.
  await window.keyboard.press('Alt+Shift+ArrowDown')
  await window.keyboard.press('Enter')
  await expect(menu.getByRole('menuitem', { name: 'Move down' })).toBeDisabled()
  await window.keyboard.press('Escape')
  await expect(education).toBeFocused()

  await window.keyboard.press('Meta+z')
  await expect.poll(sectionTitles).toEqual(['Work experience', 'Skills', 'Education', 'Languages'])
  await window.keyboard.press('Meta+z')
  await expect.poll(sectionTitles).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
})

test('the handle of a position moves it within its section, also to another page, with the focus on its handle in the new place', async () => {
  await openFirstCv()
  const first = handle(`position “${positions[0]}”`)
  await first.click()
  await expect(blockMenu(`position “${positions[0]}”`).getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
  await expect(blockMenu(`position “${positions[0]}”`).getByRole('menuitem')).toHaveText(['Move up', 'Move down'])
  await window.keyboard.press('Escape')
  await expect(first).toBeFocused()

  // Z menu: drugie stanowisko na pierwsze miejsce, jeden krok cofania.
  const second = handle(`position “${positions[1]}”`)
  await second.click()
  await blockMenu(`position “${positions[1]}”`).getByRole('menuitem', { name: 'Move up' }).click()
  await expect.poll(positionNames).toEqual([positions[1], positions[0], ...positions.slice(2)])
  await expect(second).toBeFocused()
  await expect(announcement()).toHaveText(`Moved position “${positions[1]}” to position 1 of 4.`)
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)

  // Nowa strona przed drugim stanowiskiem: trzecie jest na drugiej stronie, ⌥⇧↑ przenosi je na pierwszą – fokus na
  // jego uchwycie, już na innej stronie.
  await second.click()
  await blockMenu(`position “${positions[1]}”`).getByRole('menuitemcheckbox', { name: 'New page before this entry' }).click()
  const third = fragment(`Position “${positions[2]}”`).first()
  await expect(third).toHaveAttribute('data-page', '1')
  await handle(`position “${positions[2]}”`).focus()
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(positionNames).toEqual([positions[0], positions[2], positions[1], positions[3]])
  await expect(third).toHaveAttribute('data-page', '0')
  await expect(handle(`position “${positions[2]}”`)).toBeFocused()
  await expect(announcement()).toHaveText(`Moved position “${positions[2]}” to position 2 of 4.`)
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)
  await expect(third).toHaveAttribute('data-page', '1')
})

test('“New page before” and “Hide section” in the menu on the page work like the form checkboxes', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  const skills = handle('section “Skills”')
  const skillsTitle = fragment('Section title “Skills”')
  const page = Number(await skillsTitle.getAttribute('data-page'))

  await skills.click()
  await blockMenu('section “Skills”').getByRole('menuitemcheckbox', { name: 'New page before this section' }).click()
  await expect(skillsTitle).toHaveAttribute('data-page', String(page + 1))
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('New page before this section')).toBeChecked()
  await expect(skills).toBeFocused()
  await window.keyboard.press('Enter')
  await expect(blockMenu('section “Skills”').getByRole('menuitemcheckbox', { name: 'New page before this section' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await window.keyboard.press('Escape')
  await window.keyboard.press('Meta+z')
  await expect(skillsTitle).toHaveAttribute('data-page', String(page))
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('New page before this section')).not.toBeChecked()

  // Wpis: nowa strona przed stanowiskiem, jak pole w jego karcie.
  const second = fragment(`Position “${positions[1]}”`)
  await expect(second).toHaveAttribute('data-page', '0')
  await handle(`position “${positions[1]}”`).click()
  await blockMenu(`position “${positions[1]}”`).getByRole('menuitemcheckbox', { name: 'New page before this entry' }).click()
  await expect(second).toHaveAttribute('data-page', '1')
  await expect(handle(`position “${positions[1]}”`)).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(second).toHaveAttribute('data-page', '0')

  // Ukrycie: sekcja znika ze stron, fokus na kolejnym fragmencie, w formularzu zaznaczone „Hide section”.
  await skills.click()
  await blockMenu('section “Skills”').getByRole('menuitem', { name: 'Hide section' }).click()
  await expect(skillsTitle).toHaveCount(0)
  await expect(fragment('List “Skills”')).toHaveCount(0)
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: 'Skills' })).toHaveCount(0)
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('Hide section')).toBeChecked()
  await expect(handle('section “Languages”')).toHaveCount(1)
  await expect(fragment('Section title “Languages”')).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(skillsTitle).toHaveCount(1)
})

test('“Add …” in the menu of a section title adds an element and opens its card with the focus on the first field', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1000 })
  const form = window.locator('.editor-form')
  await handle('section “Work experience”').click()
  await blockMenu('section “Work experience”').getByRole('menuitem', { name: 'Add position' }).click()
  // Nowy wpis jest pusty (nie ma go na stronie) – karta stoi przy uchwycie, z którego go dodano.
  const added = card('Position “New position”')
  await expect(added.getByLabel('Job title')).toBeFocused()
  await expect(form.getByLabel('Job title')).toHaveCount(5)
  await expectCardNextTo(added, handle('section “Work experience”'))
  await window.keyboard.type('Buyer')
  await expect(window.locator('.preview .cv-page .cv-role', { hasText: /^Buyer$/ })).toHaveCount(1)
  await expect(card('Position “Buyer”')).toBeVisible()
  await expectCardNextTo(card('Position “Buyer”'), fragment('Position “Buyer”').first())
  await window.keyboard.press('Escape')
  await expect(fragment('Position “Buyer”').first()).toBeFocused()

  // Lista: nowy element w karcie listy, z fokusem w nim.
  await handle('section “Skills”').click()
  await blockMenu('section “Skills”').getByRole('menuitem', { name: 'Add item' }).click()
  const list = card('List “Skills”')
  const items = list.getByRole('textbox')
  await expect(items.last()).toBeFocused()
  await expect(items.last()).toHaveValue('')
})

test('the menu works from the keyboard alone, and there are no handles below 50% zoom', async () => {
  await openFirstCv()
  await fragment('Section title “Education”').focus()
  await window.keyboard.press('Shift+Tab')
  const education = handle('section “Education”')
  await expect(education).toBeFocused()
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '1')
  await window.keyboard.press('Space')
  const menu = blockMenu('section “Education”')
  await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeFocused()
  await window.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Move down' })).toBeFocused()
  await window.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitemcheckbox', { name: 'New page before this section' })).toBeFocused()
  await window.keyboard.press('End')
  await expect(menu.getByRole('menuitem', { name: 'Add education' })).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(education).toBeFocused()
  await window.keyboard.press('Enter')
  await window.keyboard.press('ArrowUp')
  await window.keyboard.press('Enter')
  await expect(card('Education “New education”').getByLabel('Level')).toBeFocused()

  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('50%')
  await expect(window.locator('.edit-layer .edit-handle').first()).toBeAttached()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(window.locator('.edit-layer')).toHaveAttribute('data-compact', 'true')
  await expect(window.locator('.edit-layer .edit-handle')).toHaveCount(0)
  // Edycja dalej działa przez klik we fragment.
  await expect(fragment('Section title “Education”')).toHaveCount(1)
})
