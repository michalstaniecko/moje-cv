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

// Otwiera pierwsze CV z biblioteki i przełącza pasek boczny na CV form: testy warstwy edycji sprawdzają w nim, że karta
// i formularz zmieniają to samo. Outline (domyślny pasek) ma własne testy z `openFirstCvWithOutline`.
async function openFirstCv() {
  await openFirstCvWithOutline()
  await showCvForm()
}

async function openFirstCvWithOutline() {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page').first()).toBeVisible()
}

// „Form” w przełączniku paska bocznego (w Outline, przy CV form i na szynie).
async function showCvForm() {
  await window.locator('.editor-panes').getByRole('button', { name: 'Form', exact: true }).click()
  await expect(window.locator('.editor-form')).toBeVisible()
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
  await expect(window.locator('.editor-form').getByLabel('Full name')).toHaveCount(0)
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
  await expect(window.locator('.editor-form').getByLabel('Full name')).toBeVisible()

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
  await window.locator('.editor-form').getByLabel('Full name').focus()
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
  const fullName = window.locator('.editor-form').getByLabel('Full name')
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

  await window.locator('.editor-form').getByLabel('Summary').fill(Array.from({ length: 200 }, (_, i) => `A very long summary, line ${i + 1}.`).join('\n'))
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
// Przycisk zdjęcia w warstwie edycji (otwiera Field popover zdjęcia, S4).
const photoButton = () => window.locator('.edit-layer .edit-photo').and(window.getByRole('button', { name: 'Photo', exact: true }))
const photoPopover = () => window.getByRole('dialog', { name: 'Photo', exact: true })
// Tekst klauzuli zgody na stronie (Page field) i pasek klauzuli nad nią (S4).
const consentField = () => window.locator('.preview .cv-pages').getByRole('textbox', { name: 'Consent clause', exact: true })
const consentToolbar = () => window.getByRole('toolbar', { name: 'Consent clause', exact: true })
const fragmentNames = () =>
  window
    .locator('.edit-layer .edit-fragment')
    .evaluateAll((buttons) => buttons.map((button) => button.textContent!.replace(/^Edit: /, '')))
// Kolejne powtórzenia nazwy (fragmenty jednego wpisu na dwóch stronach) jako jedna nazwa.
const dedupe = (names: string[]) => names.filter((name, index) => name !== names[index - 1])
const positions = ['Senior Procurement Specialist', 'Procurement Specialist', 'Procurement Assistant', 'Junior Customer Service Specialist']
const educations = ['Postgraduate diploma, Procurement Management', 'Master’s degree, Logistics']
const card = (name: string) => window.getByRole('dialog', { name, exact: true })
// Daty wpisu na stronie (żetony dat – docs/specs/wysiwyg-editing.md, S3).
const entryDate = (blockId: string) => window.locator(`.preview .cv-pages [data-block-id="${blockId}"] .cv-date`)
// Stanowisko wpisu na stronie (Page field) – najechanie pokazuje uchwyt i pigułkę „+” sekcji.
const pageRole = (role: string) => window.locator('.preview .cv-page .cv-role', { hasText: new RegExp(`^${role}$`) })
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

// ---------- Page fields: imię i nazwisko, podsumowanie, tytuły sekcji (docs/specs/wysiwyg-editing.md, S1) ----------

// Page field na stronach (Edit mode): pole tekstowe z nazwą pola CV (`.cv-measure` jest ukryty przed czytnikiem).
const pageField = (name: string) => window.locator('.preview .cv-pages').getByRole('textbox', { name, exact: true })
const titleField = (title: string) => pageField(`Section title “${title}”`)
// Etykieta kontaktu na stronie – combobox z podpowiedziami etykiet (S4).
const labelField = (number: number) => window.locator('.preview .cv-pages').getByRole('combobox', { name: `Contact label ${number}`, exact: true })
// Pole CV form (etykieta pola tekstowego zawiera też jego tekst – bez `exact`).
const formField = (label: string) => window.locator('.editor-form').getByLabel(label)
// Numer strony (od 0), na której leży element.
const pageIndexOf = (locator: Locator) =>
  locator.evaluate((element) => [...element.ownerDocument.querySelectorAll('.preview .cv-pages > .cv-page')].findIndex((page) => page.contains(element)))
// Klucz pola z fokusem i kursor (przesunięcie znaków od początku pola; null – fokus poza Page field). Wyrażenie w
// tekście: testy e2e nie mają typów DOM.
const caret = () =>
  window.evaluate<{ key: string; offset: number; collapsed: boolean } | null>(`(() => {
    const field = document.activeElement
    const selection = window.getSelection()
    if (!field?.dataset.fieldKey || !selection?.focusNode || !field.contains(selection.focusNode)) return null
    const range = document.createRange()
    range.selectNodeContents(field)
    range.setEnd(selection.focusNode, selection.focusOffset)
    return { key: field.dataset.fieldKey, offset: range.toString().length, collapsed: selection.isCollapsed }
  })()`)
// Klucz Page field albo żetonu daty z fokusem (null – fokus poza nimi).
const focusedKey = () => window.evaluate<string | null>(`document.activeElement?.dataset.fieldKey ?? null`)
// Klik myszą w lewą część znaku `index` pola – kursor staje przed tym znakiem.
async function clickAtCharacter(field: Locator, index: number) {
  await field.scrollIntoViewIfNeeded()
  const point = await field.evaluate((element, index) => {
    const range = element.ownerDocument.createRange()
    range.setStart(element.firstChild!, index)
    range.setEnd(element.firstChild!, index + 1)
    const rect = range.getBoundingClientRect()
    return { x: rect.left + 1, y: rect.top + rect.height / 2 }
  }, index)
  await window.mouse.click(point.x, point.y)
}
// Placeholder pustego pola (treść `::before`).
type ComputedStyleOf = (element: unknown, pseudo: string) => { content: string }
const placeholderOf = (field: Locator) =>
  field.evaluate((element) => (globalThis as unknown as { getComputedStyle: ComputedStyleOf }).getComputedStyle(element, '::before').content)

test('the name is edited on the page: a click puts the caret at the clicked character, typing changes the page, the form and the PDF, and Cmd+Z undoes it in the same steps as the form', async () => {
  await openFirstCv()
  const name = pageField('Full name')
  await expect(name).toHaveText('Jane Example')
  await expect(name).toHaveAttribute('contenteditable', 'true')

  // Kursor w klikniętym miejscu, bez żadnej karty.
  await clickAtCharacter(name, 5)
  await expect(name).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'header:fullName', offset: 5, collapsed: true })
  await window.keyboard.type('X ')
  await expect(pageName()).toHaveText('Jane X Example')
  await expect(formField('Full name')).toHaveValue('Jane X Example')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(fragment('Full name')).toHaveCount(0)

  // Seria znaków to jeden krok cofania; po cofnięciu kursor stoi na końcu zmienionego miejsca, pole ma dalej fokus.
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveText('Jane Example')
  await expect(name).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'header:fullName', offset: 5, collapsed: true })
  await window.keyboard.press('Meta+Shift+z')
  await expect(pageName()).toHaveText('Jane X Example')
  await expect.poll(caret).toEqual({ key: 'header:fullName', offset: 7, collapsed: true })

  // Ten sam klucz łączenia kroków co pole formularza: pisanie na stronie i zaraz potem w formularzu to jeden krok.
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.type(' A')
  await formField('Full name').focus()
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.type('B')
  await expect(pageName()).toHaveText('Jane X Example AB')
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveText('Jane X Example')
  // Zmiana z formularza trafia do pola na stronie, które nie ma fokusu.
  await formField('Full name').fill('Jane Example Jr')
  await expect(name).toHaveText('Jane Example Jr')

  const pdfPath = join(outputDir, 'cv.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: cv.pdf')).toBeVisible()
  expect(await pdfText(pdfPath)).toContain('Jane Example Jr')
})

test('the summary and the section titles are edited on the page in every place a Template draws them, also the title beside a list; Enter goes from a one-line field to the next one', async () => {
  await openFirstCv()
  const summary = pageField('Summary')
  await clickAtCharacter(summary, 0)
  await window.keyboard.type('Hello. ')
  await expect(formField('Summary')).toHaveValue(/^Hello\. Procurement specialist/)

  // Enter w polu jednowierszowym przechodzi do następnego pola (z imienia – do etykiety pierwszego kontaktu).
  await clickAtCharacter(pageField('Full name'), 0)
  await window.keyboard.press('Enter')
  await expect.poll(caret).toEqual({ key: 'contact:c1:label', offset: 0, collapsed: true })
  // Classic nie pokazuje nowych linii w podsumowaniu (w PDF byłyby spacją), więc Enter go nie łamie – przechodzi dalej.
  await clickAtCharacter(summary, 0)
  await expect(summary).toBeFocused()
  await window.keyboard.press('Enter')
  await expect(titleField('Work experience')).toBeFocused()
  await expect(formField('Summary')).toHaveValue(/^Hello\. Procurement specialist/)

  // Tytuł obok listy (Classic) i tytuł nad listą (Modern) – to samo pole sekcji.
  await clickAtCharacter(titleField('Skills'), 5)
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.type(' & tools')
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: /^Skills & tools$/ })).toHaveCount(1)
  await expect(window.locator('.editor-form').getByLabel('Section title “Skills & tools”')).toHaveValue('Skills & tools')
  const picker = window.getByRole('radiogroup', { name: 'Template' })
  await picker.locator('label', { has: window.getByRole('radio', { name: 'Modern' }) }).click()
  await expect(window.locator('.preview .cv.cv-template-modern')).toHaveCount(1)
  await clickAtCharacter(titleField('Skills & tools'), 0)
  await window.keyboard.type('My ')
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: /^My Skills & tools$/ })).toHaveCount(1)

  // Modern pokazuje nowe linie w podsumowaniu: Enter wstawia nową linię.
  await clickAtCharacter(pageField('Summary'), 6)
  await window.keyboard.press('Enter')
  await expect(formField('Summary')).toHaveValue(/^Hello\.\n Procurement specialist/)
  // Enter na końcu pola: kursor w nowej, pustej linii – pisanie trafia za nową linię.
  await window.keyboard.press('Meta+ArrowDown')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Next.')
  await expect(formField('Summary')).toHaveValue(/supply running smoothly\.\nNext\.$/)
})

test('a cleared section title keeps its field with a placeholder while it has the focus and leaves the page after it; the pages then split as in Preview mode', async () => {
  await openFirstCv()
  const title = titleField('Education')
  await clickAtCharacter(title, 3)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Backspace')
  // Pole zostaje (pusty tytuł w aktywnym fragmencie), z nazwą typu sekcji jako placeholderem, i dalej ma fokus.
  const empty = pageField('Section title “Education”')
  await expect(empty).toBeFocused()
  await expect(empty).toHaveText('')
  expect(await placeholderOf(empty)).toBe('"Education"')
  await expect(window.locator('.editor-form .form-section-title-input[placeholder="Education"]')).toHaveValue('')
  await window.keyboard.type('Studies')
  await expect(titleField('Studies')).toBeFocused()
  await expect(window.locator('.editor-form').getByLabel('Section title “Studies”')).toHaveValue('Studies')

  // Pusty tytuł bez fokusu znika ze strony (zostaje w danych), a strony dzielą się jak w Preview mode.
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Backspace')
  await expect(window.locator('.preview .cv-page .cv-section-title')).toHaveCount(4)
  await formField('Full name').focus()
  await expect(window.locator('.preview .cv-page .cv-section-title')).toHaveCount(3)
  const edit = await pageSplit()
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect.poll(pageSplit).toEqual(edit)
})

test('page fields keep the white space and wrapping of the document: a Classic summary with line breaks and double spaces has the same lines in Edit mode as in Preview mode', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await formField('Summary').fill('First line.\nSecond  line with  double spaces and a sentence long enough to wrap onto the next line of the page.')
  const summary = preview.locator('.cv-page .cv-summary')
  await expect(pageField('Summary')).toHaveCount(1)
  const inEditMode = (await summary.boundingBox())!
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  const inPreviewMode = (await summary.boundingBox())!
  expect(inEditMode.height).toBeCloseTo(inPreviewMode.height, 1)
  expect(inEditMode.width).toBeCloseTo(inPreviewMode.width, 1)
})

test('the caret in a section title survives the title moving to another page, and the field follows the zoom', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1500 })
  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('50%')

  // Długie podsumowanie przenosi pierwszą sekcję na drugą stronę.
  await formField('Summary').fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(70))
  const title = titleField('Work experience')
  await expect.poll(() => pageIndexOf(title)).toBe(1)
  await clickAtCharacter(title, 4)
  await expect.poll(caret).toEqual({ key: 'section:experience:title', offset: 4, collapsed: true })

  // Cofnięcie (z kursorem w tytule) zmienia podział stron: tytuł jest nowym węzłem na pierwszej stronie, a kursor
  // zostaje w tym samym miejscu tytułu.
  await window.keyboard.press('Meta+z')
  await expect(formField('Summary')).not.toHaveValue(/Lorem/)
  await expect.poll(() => pageIndexOf(title)).toBe(0)
  await expect(title).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:experience:title', offset: 4, collapsed: true })
  await window.keyboard.press('Meta+Shift+z')
  await expect.poll(() => pageIndexOf(title)).toBe(1)
  await expect(title).toBeFocused()
  await window.keyboard.type('X')
  await expect(titleField('WorkX experience')).toBeFocused()

  // Zmiana skali: pole rośnie razem ze stroną i dalej ma fokus.
  const small = (await titleField('WorkX experience').boundingBox())!
  await preview.getByRole('button', { name: 'Zoom in' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('75%')
  await expect.poll(async () => (await titleField('WorkX experience').boundingBox())!.width).toBeGreaterThan(small.width * 1.4)
  await expect(titleField('WorkX experience')).toBeFocused()
})

test('a page field takes only plain text: pasting rich text pastes its text, one line in a one-line field; formatting never applies and undo is the editor’s', async () => {
  await openFirstCv()
  await app.evaluate(({ clipboard, ClipboardItem }) =>
    clipboard.write([new ClipboardItem({ 'text/plain': 'Anna\r\nMaria\tNowak', 'text/html': '<b>Anna</b><br>Maria Nowak' })])
  )
  const name = pageField('Full name')
  await clickAtCharacter(name, 0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Meta+v')
  await expect(name).toHaveText('Anna Maria Nowak')
  await expect(name.locator('*')).toHaveCount(0)
  await expect(formField('Full name')).toHaveValue('Anna Maria Nowak')
  await expect.poll(caret).toEqual({ key: 'header:fullName', offset: 16, collapsed: true })

  // ⌘B nie formatuje; Edit → Undo z menu cofa w historii edytora (jeden krok wklejenia).
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Meta+b')
  await expect(name.locator('*')).toHaveCount(0)
  await clickMenuItem('Edit', 'Undo')
  await expect(name).toHaveText('Jane Example')
  await expect(formField('Full name')).toHaveValue('Jane Example')
})

test('composing text with an input method changes the document only when the composition ends', async () => {
  await openFirstCv()
  const name = pageField('Full name')
  await clickAtCharacter(name, 4)
  const cdp = await window.context().newCDPSession(window)
  await cdp.send('Input.imeSetComposition', { text: 'é', selectionStart: 1, selectionEnd: 1 })
  await expect(name).toHaveText('Janeé Example')
  await cdp.send('Input.imeSetComposition', { text: 'éè', selectionStart: 2, selectionEnd: 2 })
  await expect(name).toHaveText('Janeéè Example')
  await expect(formField('Full name')).toHaveValue('Jane Example')
  await cdp.send('Input.insertText', { text: 'éè' })
  await expect(formField('Full name')).toHaveValue('Janeéè Example')
  await expect(name).toHaveText('Janeéè Example')
  await expect.poll(caret).toEqual({ key: 'header:fullName', offset: 6, collapsed: true })
})

test('the pages work from the keyboard alone: Tab goes through every page field and date in document order, also into the joined lines of entries and contacts, then through the editing layer; Enter opens the photo popover, Tab leaves it', async () => {
  await openFirstCv()
  // Pola i żetony dat stron w kolejności czytania (Classic: daty przed stanowiskiem, tytuł listy obok niej); linia
  // złączona z kilku pól wpisu bez fokusu (np. „firma – miejscowość”, daty) to jeden napis, którego pola Tab odwiedza po
  // kolei.
  const expected = await window.locator('.preview .cv-pages').evaluate((root) =>
    [...root.querySelectorAll('[data-field-key], [data-joined]')].flatMap((element) => {
      const joined = element.getAttribute('data-joined')
      return joined ? (JSON.parse(joined) as [string, number][]).map(([key]) => key) : [element.getAttribute('data-field-key')!]
    })
  )
  const contactKeys = ['c1', 'c2', 'c3', 'c4'].flatMap((id) => [`contact:${id}:label`, `contact:${id}:value`])
  expect(expected.slice(0, 16)).toEqual([
    'header:fullName',
    ...contactKeys,
    'header:summary',
    'section:experience:title',
    'experience:e1:start',
    'experience:e1:end',
    'experience:e1:role',
    'experience:e1:company',
    'experience:e1:location'
  ])
  expect(expected).toContain('education:ed1:end')
  expect(expected).toContain('education:ed2:institution')
  expect(expected.slice(-3)).toEqual(['section:languages:title', 'list:l1:text', 'list:l2:text'])
  await pageField('Full name').focus()
  for (const key of expected.slice(1)) {
    await window.keyboard.press('Tab')
    await expect.poll(focusedKey).toBe(key)
  }

  // Warstwa edycji: przycisk zdjęcia (żadna część strony nie ma już Edit card), uchwyty, pigułki „+” i pasek.
  await expect(photoButton()).toBeVisible()
  expect(await fragmentNames()).toEqual([])
  const stops = window.locator('.edit-layer .edit-photo, .edit-layer .edit-handle .row-handle, .edit-layer .edit-pill, .edit-layer .add-to-cv button')
  const stopNames = await stops.evaluateAll((elements) => elements.map((element) => element.textContent || element.getAttribute('aria-label')))
  expect(stopNames.slice(1, 3)).toEqual(['Actions for section “Work experience”', 'Actions for position “Senior Procurement Specialist”'])
  expect(stopNames.slice(-3)).toEqual(['Actions for section “Languages”', '+ Item', 'Consent clause'])
  const educationHandle = stopNames.indexOf('Actions for section “Education”')
  expect(stopNames.slice(educationHandle - 2, educationHandle)).toEqual([`Actions for position “${positions[3]}”`, '+ Position'])
  const count = await stops.count()
  await window.keyboard.press('Tab')
  await expect(stops.first()).toBeFocused()
  for (let index = 1; index < count; index++) {
    await window.keyboard.press('Tab')
    await expect(stops.nth(index)).toBeFocused()
  }

  // Enter i spacja otwierają Field popover zdjęcia z fokusem na pierwszym przycisku; Escape zamyka i wraca na zdjęcie.
  const photo = photoButton()
  for (const key of ['Enter', 'Space']) {
    await photo.focus()
    await window.keyboard.press(key)
    await expect(photoPopover().getByRole('button', { name: 'Change photo' })).toBeFocused()
    await expect(photo).toHaveAttribute('aria-expanded', 'true')
    await window.keyboard.press('Escape')
    await expect(window.getByRole('dialog')).toHaveCount(0)
    await expect(photo).toBeFocused()
  }
  // Tab z ostatniego przycisku popovera – dalej za zdjęciem.
  await window.keyboard.press('Enter')
  await window.keyboard.press('Shift+Tab')
  await expect(photo).toBeFocused()
  await expect(photoPopover()).toHaveCount(0)
  await window.keyboard.press('Enter')
  await photoPopover().getByRole('button', { name: 'Remove photo' }).focus()
  await window.keyboard.press('Tab')
  await expect(photoPopover()).toHaveCount(0)
  await expect(stops.nth(1)).toBeFocused()
})

test('the consent clause toolbar stands above the clause while the clause has the focus, at 100% at any zoom, and follows the clause to another page', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1500 })
  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('50%')
  await enableConsent('I agree to the processing of my personal data.')
  const clause = consentField()
  const toolbar = consentToolbar()
  await expect(toolbar).toHaveCount(0)
  await clickAtCharacter(clause, 3)
  await expect(toolbar).toBeVisible()
  const expectAbove = () =>
    expect
      .poll(async () => {
        const bar = (await toolbar.boundingBox())!
        const text = (await clause.boundingBox())!
        return Math.abs(bar.y + bar.height - (text.y - 6)) < 1.5 && bar.x >= text.x - 1
      })
      .toBe(true)
  await expectAbove()
  const width = (await toolbar.boundingBox())!.width

  // Długi tekst klauzuli przenosi ją na kolejną stronę: pasek jedzie za nią, kursor zostaje w niej.
  const pageBefore = await pageIndexOf(clause)
  await window.keyboard.press('Meta+ArrowDown')
  await window.keyboard.insertText(' Lorem ipsum dolor sit amet, consectetur adipiscing elit.'.repeat(150))
  await expect.poll(() => pageIndexOf(clause)).toBeGreaterThan(pageBefore)
  await expect(clause).toBeFocused()
  await clause.scrollIntoViewIfNeeded()
  await expectAbove()
  await window.keyboard.press('Meta+z')
  await expect.poll(() => pageIndexOf(clause)).toBe(pageBefore)
  await expectAbove()

  // Zmiana skali: klauzula rośnie, pasek zostaje w skali 1:1 i dalej stoi nad nią.
  const small = (await clause.boundingBox())!
  await preview.getByRole('button', { name: 'Zoom in' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('75%')
  await expect.poll(async () => (await clause.boundingBox())!.width).toBeGreaterThan(small.width * 1.4)
  await clause.scrollIntoViewIfNeeded()
  await expectAbove()
  expect((await toolbar.boundingBox())!.width).toBeCloseTo(width, 0)

  // Klik obok klauzuli i paska chowa pasek.
  await clickAtCharacter(pageField('Full name'), 1)
  await expect(toolbar).toHaveCount(0)
})

test('Preview mode has no editing layer and no page fields: switching closes the open Field popover and focuses the toggle; Edit mode does not reopen it', async () => {
  await openFirstCv()
  await expect(window.locator('.edit-layer')).toHaveCount(1)
  await clickOnPage(window.locator('.preview .cv-page .cv-photo'))
  await expect(photoPopover()).toBeVisible()

  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(previewButton()).toBeFocused()
  await expect(window.locator('.edit-layer, .edit-fragment, .edit-card')).toHaveCount(0)
  await expect(window.locator('.preview .cv-editing, .preview [contenteditable]')).toHaveCount(0)
  await expect(window.getByRole('dialog')).toHaveCount(0)

  await editButton().click()
  await expectEditMode()
  await expect(window.locator('.edit-layer')).toHaveCount(1)
  await expect(photoButton()).toBeVisible()
  await expect(pageField('Full name')).toBeVisible()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

// Kontrakt znaczników edycji (ADR-0009) i Page fields (ADR-0010): w każdym szablonie każde pole tekstowe Sample CV
// (z włączoną klauzulą zgody) jest Page field w swoim elemencie strony – imię i nazwisko, kontakty, podsumowanie, tytuły
// sekcji, stanowiska, punkty, elementy list, klauzula; linie złączone z kilku pól (firma – miejscowość, poziom, kierunek,
// uczelnia, w Classic „etykieta: wartość”) są polami po wejściu we wpis albo kontakty; daty każdego wpisu to przycisk
// w jego `.cv-date` (żetony dat po wejściu we wpis), a zdjęcie ma przycisk w warstwie edycji. Tytuły list w Classic stoją obok listy (wewnątrz wiersza listy), w Modern i Bold nad nią.
for (const template of ['Classic', 'Modern', 'Bold'] as const) {
  test(`markup contract: every text field of the Sample CV in the ${template} template is a page field, and the photo has its button in the editing layer`, async () => {
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

    // Page fields: każde pole leży w swoim elemencie szablonu, z jego tekstem.
    const fields: [string, Locator, string | RegExp][] = [
      ['Full name', page('.cv-name'), 'Jane Example'],
      ['Summary', page('.cv-summary'), /^Procurement specialist/],
      ...titles.map((title): [string, Locator, string] => [`Section title “${title}”`, page('.cv-section-title', title), title]),
      ...positions.map((role): [string, Locator, string] => [`Job title – Position “${role}”`, page('.cv-role', role), role]),
      [
        'Bullet 3 – Position “Senior Procurement Specialist”',
        page('li', 'Preparing and analysing requests for quotation and bid comparisons.'),
        'Preparing and analysing requests for quotation and bid comparisons.'
      ],
      ['Item 2 – List “Languages”', page('li', 'German – B2'), 'German – B2']
    ]
    for (const [name, element, text] of fields) {
      const field = element.getByRole('textbox', { name, exact: true })
      await expect(field, name).toHaveCount(1)
      await expect(field, name).toHaveText(text)
    }
    // Każdy `li` na stronach (punkty i elementy list) to dokładnie jedno pole.
    // (Bold rysuje kontakty jako `li` – bez nagłówka.)
    const items = preview.locator('.cv-pages [data-block-id]:not([data-block="header"]) li')
    expect(await items.count()).toBeGreaterThan(20)
    expect(await preview.locator('.cv-pages [data-block-id]:not([data-block="header"]) li > [data-field-key]').count()).toBe(await items.count())
    // Daty: w `.cv-date` każdego wpisu przycisk otwierający popover daty, z napisem dat.
    const dates = preview.locator('.cv-pages .cv-date [role="button"][aria-haspopup="dialog"]')
    await expect(dates).toHaveCount(positions.length + educations.length)
    await expect(dates.first()).toHaveText('03.2023 – present')

    // Żadna część strony nie ma już przycisku fragmentu (Edit card); zdjęcie ma przycisk nad sobą.
    expect(await fragmentNames()).toEqual([])
    const photoBox = (await page('.cv-photo').boundingBox())!
    const buttonBox = (await photoButton().boundingBox())!
    const [x, y] = [photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2]
    expect(x >= buttonBox.x && x <= buttonBox.x + buttonBox.width && y >= buttonBox.y && y <= buttonBox.y + buttonBox.height).toBe(true)
    await expect(page('.cv-consent').getByRole('textbox', { name: 'Consent clause', exact: true })).toHaveText('I agree to the processing of my personal data.')

    // Klik w tekst stawia kursor w klikniętym polu w każdym szablonie – także w linii złączonej z kilku pól.
    const company = page('[data-block-id="e2"] .cv-company')
    await expect(company).toHaveText('Example Trading plc – Leeds')
    await clickAtCharacter(company.locator('[data-joined]'), 23)
    await expect(pageField('City – Position “Procurement Specialist”')).toBeFocused()
    await expect.poll(caret).toEqual({ key: 'experience:e2:location', offset: 1, collapsed: true })
    const education = page('[data-block-id="ed2"] .cv-page-joined')
    await expect(education).toContainText('Logistics, Fictional Academy')
    const institutionAt = ((await education.textContent()) ?? '').indexOf('Fictional') + 2
    await clickAtCharacter(education, institutionAt)
    await expect.poll(caret).toEqual({ key: 'education:ed2:institution', offset: 2, collapsed: true })
    await clickAtCharacter(pageField('Item 2 – List “Languages”'), 3)
    await expect.poll(caret).toEqual({ key: 'list:l2:text', offset: 3, collapsed: true })

    // Klik w daty: popover daty przy żetonie; Escape wraca na żeton.
    await clickOnPage(entryDate('e3'))
    await expect(window.getByRole('dialog', { name: /^(From|To) – Position “Procurement Assistant”$/ })).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(window.getByRole('dialog')).toHaveCount(0)
    await expect.poll(focusedKey).toMatch(/^experience:e3:(start|end)$/)
    // Klauzula zgody: kursor w klikniętym znaku, nad nią pasek klauzuli.
    await clickAtCharacter(consentField(), 2)
    await expect.poll(caret).toEqual({ key: 'consent:text', offset: 2, collapsed: true })
    await expect(consentToolbar()).toBeVisible()
    // N-te dziecko `.cv-contact` to n-ty kontakt: etykieta i wartość to Page fields (w Classic – jedna linia
    // „etykieta: wartość” do wejścia w kontakty); klik stawia kursor w klikniętym znaku.
    for (const index of [1, 3]) {
      const contact = sampleContacts[index]!
      const text = contacts.nth(index).locator('[data-joined], [data-field-key$=":value"]').first()
      await clickAtCharacter(text, ((await text.textContent()) ?? '').indexOf(contact.value) + 2)
      await expect(pageField(`Contact value ${index + 1}`)).toHaveText(contact.value)
      await expect.poll(caret).toEqual({ key: `contact:c${index + 1}:value`, offset: 2, collapsed: true })
      await expect(labelField(index + 1)).toHaveText(contact.label)
      await expect(contacts.nth(index)).toHaveText(new RegExp(`^${contact.label}(: )?${contact.value.replace(/[.+]/g, '\\$&')}$`))
    }
    // Zdjęcie: Field popover zdjęcia z fokusem na „Change photo”.
    await clickOnPage(page('.cv-photo'))
    await expect(photoPopover().getByRole('button', { name: 'Change photo' })).toBeFocused()
    await window.keyboard.press('Escape')
    await expect(photoButton()).toBeFocused()
  })
}

// Kontakty Sample CV po angielsku.
const sampleContacts = [
  { label: 'Phone', value: '+44 7700 900000' },
  { label: 'Email', value: 'jane.example@example.com' },
  { label: 'LinkedIn', value: 'linkedin.com/in/jane-example' },
  { label: 'City', value: 'Manchester' }
]

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

// ---------- Page fields wpisów i list (docs/specs/wysiwyg-editing.md, S2) ----------

const bulletField = (number: number, role = positions[0]) => pageField(`Bullet ${number} – Position “${role}”`)
const roleField = (role: string) => pageField(`Job title – Position “${role}”`)
const itemField = (number: number, list = 'Languages') => pageField(`Item ${number} – List “${list}”`)

test('the text of positions, education entries and lists is edited on the page: typing changes the page, the form and the PDF, and Cmd+Z undoes it in the same steps as the form', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  const e2 = window.locator('.preview .cv-pages [data-block-id="e2"]')

  // Firma w linii „firma – miejscowość”: klik stawia kursor w klikniętym znaku pola.
  await clickAtCharacter(e2.locator('.cv-company [data-joined]'), 7)
  const company = pageField('Company – Position “Procurement Specialist”')
  await expect(company).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'experience:e2:company', offset: 7, collapsed: true })
  await window.keyboard.type(' Global')
  await expect(e2.locator('.cv-company')).toHaveText('Example Global Trading plc – Leeds')
  await expect(form.getByLabel('Company', { exact: true }).nth(1)).toHaveValue('Example Global Trading plc')
  // Ten sam klucz łączenia kroków co pole formularza: pisanie na stronie i zaraz potem w formularzu to jeden krok.
  await form.getByLabel('Company', { exact: true }).nth(1).focus()
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.type('!')
  await expect(e2.locator('.cv-company')).toHaveText('Example Global Trading plc! – Leeds')
  await window.keyboard.press('Meta+z')
  await expect(e2.locator('.cv-company')).toHaveText('Example Trading plc – Leeds')

  // Stanowisko i punkt.
  await clickAtCharacter(roleField(positions[2]), 0)
  await window.keyboard.type('Senior ')
  await expect(roleField(`Senior ${positions[2]}`)).toBeFocused()
  await expect(form.getByLabel('Job title', { exact: true }).nth(2)).toHaveValue(`Senior ${positions[2]}`)
  await clickAtCharacter(bulletField(1, `Senior ${positions[2]}`), 0)
  await window.keyboard.type('Daily: ')
  await expect(pageItem('Daily: Issuing purchase orders')).toHaveCount(1)
  await expect(form.getByLabel('Bullet 1', { exact: true }).nth(2)).toHaveValue(/^Daily: Issuing purchase orders/)

  // Wykształcenie: kierunek w linii „poziom, kierunek, uczelnia” (Classic – jeden napis).
  const education = window.locator('.preview .cv-pages [data-block-id="ed2"] .cv-page-joined')
  await clickAtCharacter(education, ((await education.textContent()) ?? '').indexOf('Logistics') + 3)
  await expect.poll(caret).toEqual({ key: 'education:ed2:field', offset: 3, collapsed: true })
  await window.keyboard.type('X')
  await expect(pageField('Field of study – Education “Master’s degree, LogXistics”')).toHaveText('LogXistics')
  await expect(form.getByLabel('Field of study', { exact: true }).nth(1)).toHaveValue('LogXistics')
  await window.keyboard.press('Meta+z')
  await expect(form.getByLabel('Field of study', { exact: true }).nth(1)).toHaveValue('Logistics')

  // Element listy.
  await clickAtCharacter(itemField(2), 0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.type('French – A1')
  await expect(pageItem('French – A1')).toHaveCount(1)
  await expect(form.getByLabel('Item 2', { exact: true }).nth(1)).toHaveValue('French – A1')

  const pdfPath = join(outputDir, 'cv.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: cv.pdf')).toBeVisible()
  const text = await pdfText(pdfPath)
  for (const expected of ['Senior Procurement Assistant', 'Daily: Issuing purchase orders', 'French – A1', 'Example Trading plc – Leeds']) {
    expect(text).toContain(expected)
  }
})

test('Enter splits a bullet at the caret, Backspace at its start joins it back and removes an empty one, Delete at its end joins the next one, Alt+Shift+arrows move it; each is one undo step', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  const third = 'Preparing and analysing requests for quotation and bid comparisons.'
  const fourth = 'Introducing quarterly supplier reviews that cut delivery times by 15%.'
  await clickAtCharacter(bulletField(3), 26)
  await window.keyboard.press('Enter')
  await expect(bulletField(3)).toHaveText('Preparing and analysing re')
  await expect(bulletField(4)).toHaveText('quests for quotation and bid comparisons.')
  await expect(bulletField(4)).toBeFocused()
  await expect.poll(caret).toEqual(expect.objectContaining({ offset: 0, collapsed: true }))
  await expect(form.getByLabel('Bullet 4', { exact: true }).first()).toHaveValue('quests for quotation and bid comparisons.')

  // Backspace na początku łączy z poprzednim; kursor w miejscu złączenia.
  await window.keyboard.press('Backspace')
  await expect(bulletField(3)).toHaveText(third)
  await expect(bulletField(4)).toHaveText(fourth)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: 26, collapsed: true })
  // Złączenie i podział to osobne kroki cofania.
  await window.keyboard.press('Meta+z')
  await expect(bulletField(4)).toHaveText('quests for quotation and bid comparisons.')
  await window.keyboard.press('Meta+z')
  await expect(bulletField(3)).toHaveText(third)
  await expect(bulletField(4)).toHaveText(fourth)

  // Enter na końcu – pusty punkt z placeholderem (wpis ma fokus); Backspace w nim usuwa go i wraca na koniec poprzedniego.
  await clickAtCharacter(bulletField(3), 5)
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('Enter')
  await expect(bulletField(4)).toBeFocused()
  await expect(bulletField(4)).toHaveText('')
  expect(await placeholderOf(bulletField(4))).toBe('"Bullet 4"')
  await expect(bulletField(5)).toHaveText(fourth)
  // Shift+Enter w punkcie nic nie robi.
  await window.keyboard.press('Shift+Enter')
  await expect(bulletField(5)).toHaveText(fourth)
  await window.keyboard.press('Backspace')
  await expect(bulletField(4)).toHaveText(fourth)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: third.length, collapsed: true })

  // Cofnięcie podziału, gdy kursor jest w nowym punkcie: punktu już nie ma, kursor na końcu poprzedniego (W19).
  await window.keyboard.press('Enter')
  await expect(bulletField(4)).toHaveText('')
  await window.keyboard.press('Meta+z')
  await expect(bulletField(4)).toHaveText(fourth)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: third.length, collapsed: true })

  // Delete na końcu łączy z następnym.
  await window.keyboard.press('Delete')
  await expect(bulletField(3)).toHaveText(third + fourth)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: third.length, collapsed: true })
  await window.keyboard.press('Meta+z')
  await expect(bulletField(4)).toHaveText(fourth)

  // ⌥⇧↑ przenosi punkt; kursor zostaje w nim.
  await clickAtCharacter(bulletField(3), 2)
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect(bulletField(2)).toHaveText(third)
  await expect(bulletField(2)).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: 2, collapsed: true })
  await expect(form.getByLabel('Bullet 2', { exact: true }).first()).toHaveValue(third)
  await window.keyboard.press('Meta+z')
  await expect(bulletField(3)).toHaveText(third)
})

test('Enter at the end of the last bullet on a page puts the caret in the new bullet on the next page when it moves there', async () => {
  await openFirstCv()
  // Ostatnie pole pierwszej strony – punkt ostatniego stanowiska.
  const last = window.locator('.preview .cv-pages > .cv-page').first().locator('li [data-field-key]').last()
  const key = await last.getAttribute('data-field-key')
  expect(key).toMatch(/^experience:e4:bullet:/)
  await clickAtCharacter(last, 0)
  await window.keyboard.press('Meta+ArrowRight')
  const focusedPage = () =>
    window.evaluate<number>(
      `[...document.querySelectorAll('.preview .cv-pages > .cv-page')].findIndex((page) => page.contains(document.activeElement))`
    )
  let page = 0
  for (let line = 0; line < 15 && page === 0; line++) {
    await window.keyboard.press('Enter')
    await window.keyboard.type(`Line ${line}`)
    await expect.poll(caret).toEqual(expect.objectContaining({ offset: `Line ${line}`.length, collapsed: true }))
    await expect(window.locator('.preview .cv-pages [data-field-key]:focus')).toHaveText(`Line ${line}`)
    page = await focusedPage()
  }
  expect(page).toBe(1)
})

test('list items split, join and move like bullets; pasting several lines into a bullet or an item makes one element per line in one undo step', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  await clickAtCharacter(itemField(2), 3)
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('Enter')
  await expect(itemField(3)).toBeFocused()
  expect(await placeholderOf(itemField(3))).toBe('"Item 3"')
  await window.keyboard.type('French – A1')
  await expect(pageItem('French – A1')).toHaveCount(1)
  await expect(form.getByLabel('Item 3', { exact: true }).nth(1)).toHaveValue('French – A1')
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect(itemField(2)).toHaveText('French – A1')
  await expect(itemField(2)).toBeFocused()
  await window.keyboard.press('Meta+ArrowLeft')
  await window.keyboard.press('Backspace')
  await expect(itemField(1)).toHaveText('English – nativeFrench – A1')
  await expect.poll(caret).toEqual({ key: 'list:l1:text', offset: 'English – native'.length, collapsed: true })
  await window.keyboard.press('Meta+z')
  await expect(itemField(2)).toHaveText('French – A1')

  // Wklejenie wielu linii (bogatego tekstu): czysty tekst, linia na punkt, puste linie pominięte, jeden krok cofania.
  await app.evaluate(({ clipboard, ClipboardItem }) =>
    clipboard.write([
      new ClipboardItem({
        'text/plain': 'Supplier audits\r\n\r\nContract\tmanagement\n',
        'text/html': '<ul><li><b>Supplier audits</b></li><li>Contract management</li></ul>'
      })
    ])
  )
  const bullet = (number: number) => bulletField(number, positions[2])
  const fifth = 'Supporting the team during stocktaking.'
  await expect(bullet(5)).toHaveText(fifth)
  await clickAtCharacter(bullet(5), 0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Meta+v')
  await expect(bullet(5)).toHaveText('Supplier audits')
  await expect(bullet(6)).toHaveText('Contract management')
  await expect(bullet(6).locator('*')).toHaveCount(0)
  await expect.poll(caret).toEqual(expect.objectContaining({ offset: 'Contract management'.length, collapsed: true }))
  await expect(bullet(6)).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(bullet(5)).toHaveText(fifth)
  await expect(bullet(6)).toHaveCount(0)

  // W polu jednowierszowym (firma; wpis ma fokus, więc jego linia „firma – miejscowość” to osobne pola) te same linie
  // to jedna linia.
  await clickAtCharacter(pageField('Company – Position “Procurement Assistant”'), 0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Meta+v')
  await expect(pageField('Company – Position “Procurement Assistant”')).toHaveText(/^Supplier audits\s+Contract management\s*$/)
})

test('arrow keys go on to the previous or next field at the edges of a field, also through dates, into a joined line and onto another page; Alt+Shift+arrows in a field of an entry move the entry and Shift+F10 opens its menu', async () => {
  await openFirstCv()
  // ← na początku stanowiska: daty wpisu (Classic: przed stanowiskiem – żetony końca i początku), potem koniec
  // ostatniego punktu poprzedniego wpisu; → wraca tą samą drogą (w napisie dat poprzedniego wpisu – na dacie początku).
  await clickAtCharacter(roleField(positions[1]), 0)
  await window.keyboard.press('ArrowLeft')
  await expect.poll(focusedKey).toBe('experience:e2:end')
  await window.keyboard.press('ArrowLeft')
  await expect.poll(focusedKey).toBe('experience:e2:start')
  await window.keyboard.press('ArrowLeft')
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b8', offset: 'Onboarding new members of the procurement team.'.length, collapsed: true })
  await window.keyboard.press('ArrowRight')
  await expect.poll(focusedKey).toBe('experience:e2:start')
  await window.keyboard.press('ArrowRight')
  await expect.poll(focusedKey).toBe('experience:e2:end')
  await window.keyboard.press('ArrowRight')
  await expect.poll(caret).toEqual({ key: 'experience:e2:role', offset: 0, collapsed: true })
  // ↓ w (jedynej) linii stanowiska – następne pole: firma; ↑ – z powrotem w stanowisku.
  await window.keyboard.press('ArrowDown')
  await expect.poll(caret).toEqual(expect.objectContaining({ key: 'experience:e2:company' }))
  await window.keyboard.press('ArrowUp')
  await expect.poll(caret).toEqual(expect.objectContaining({ key: 'experience:e2:role' }))

  // Przez granicę stron: z ostatniego pola pierwszej strony do pierwszego na drugiej i z powrotem.
  const pages = window.locator('.preview .cv-pages > .cv-page')
  const lastOnFirst = pages.first().locator('[data-field-key][contenteditable]').last()
  const lastKey = (await lastOnFirst.getAttribute('data-field-key'))!
  // Pierwsze pole drugiej strony (w napisie złączonym – jego pierwsze pole).
  const firstKey = await pages
    .nth(1)
    .locator('[data-field-key], [data-joined]')
    .first()
    .evaluate((element) => element.getAttribute('data-field-key') ?? (JSON.parse(element.getAttribute('data-joined')!) as [string, number][])[0]![0])
  await clickAtCharacter(lastOnFirst, 0)
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('ArrowRight')
  await expect.poll(focusedKey).toBe(firstKey)
  await window.keyboard.press('ArrowLeft')
  await expect.poll(caret).toEqual(expect.objectContaining({ key: lastKey }))
  // Z tytułu sekcji w napis dat pierwszego wykształcenia (jeden napis, dopóki wpis nie ma fokusu; wejście odsłania
  // pustą datę początku), dalej w linię złączoną i z powrotem.
  await clickAtCharacter(titleField('Education'), 0)
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('ArrowRight')
  await expect.poll(focusedKey).toBe('education:ed1:end')
  await window.keyboard.press('ArrowRight')
  await expect.poll(caret).toEqual({ key: 'education:ed1:level', offset: 0, collapsed: true })
  await window.keyboard.press('ArrowLeft')
  await expect.poll(focusedKey).toBe('education:ed1:end')
  await window.keyboard.press('ArrowLeft')
  await expect.poll(focusedKey).toBe('education:ed1:start')
  await window.keyboard.press('ArrowLeft')
  await expect.poll(caret).toEqual({ key: 'section:education:title', offset: 'Education'.length, collapsed: true })

  // ⌥⇧↑ w polu wpisu przenosi cały wpis; kursor zostaje w polu.
  await clickAtCharacter(roleField(positions[1]), 3)
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(positionNames).toEqual([positions[1], positions[0], ...positions.slice(2)])
  await expect(roleField(positions[1])).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'experience:e2:role', offset: 3, collapsed: true })
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)

  // Shift+F10 – menu uchwytu wpisu.
  await clickAtCharacter(roleField(positions[1]), 3)
  await window.keyboard.press('Shift+F10')
  await expect(blockMenu(`position “${positions[1]}”`).getByRole('menuitem', { name: 'Move up' })).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(handle(`position “${positions[1]}”`)).toBeFocused()
})

test('a cleared field of an entry keeps its place with a placeholder, and the empty fields of the entry show theirs, while the entry has the focus; after it the pages split as in Preview mode', async () => {
  await openFirstCv()
  await clickAtCharacter(roleField(positions[1]), 2)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Backspace')
  const role = roleField('New position')
  await expect(role).toBeFocused()
  await expect(role).toHaveText('')
  expect(await placeholderOf(role)).toBe('"Job title"')
  await expect(window.locator('.editor-form').getByLabel('Job title', { exact: true }).nth(1)).toHaveValue('')
  // Pusta miejscowość: jej pole z placeholderem i separator „ – ” w aktywnym wpisie.
  await window.keyboard.press('ArrowDown')
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('ArrowRight')
  await expect.poll(caret).toEqual(expect.objectContaining({ key: 'experience:e2:location' }))
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Backspace')
  const company = window.locator('.preview .cv-pages [data-block-id="e2"] .cv-company')
  await expect(company).toHaveText('Example Trading plc – ')
  expect(await placeholderOf(pageField('City – Position “New position”'))).toBe('"City"')

  // Bez fokusu we wpisie: bez placeholderów, linia jak w PDF, podział stron jak w Preview mode.
  await clickAtCharacter(pageField('Full name'), 0)
  await expect(window.locator('.preview .cv-pages [data-block-id="e2"] .cv-role')).toHaveCount(0)
  await expect(company).toHaveText('Example Trading plc')
  const edit = await pageSplit()
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect.poll(pageSplit).toEqual(edit)
})

test('“Remove position” and “Remove education” in the handle menu remove the entry and say “Removed.” over the pages; Undo brings it back with the caret in it; each is one undo step', async () => {
  await openFirstCv()
  const preview = window.locator('.preview')
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })

  // Pozycja destrukcyjna na końcu menu, oddzielona kreską.
  await handle(`position “${positions[1]}”`).click()
  const menu = blockMenu(`position “${positions[1]}”`)
  await expect(menu.getByRole('menuitem')).toHaveText(['Move up', 'Move down', 'Remove position'])
  await expect(menu.getByRole('separator')).toHaveCount(1)
  await menu.getByRole('menuitem', { name: 'Remove position' }).click()
  await expect.poll(positionNames).toEqual([positions[0], ...positions.slice(2)])
  await expect(window.locator('.editor-form').getByLabel('Job title', { exact: true })).toHaveCount(3)
  await expect(removed).toBeVisible()
  // Komunikat pływa w lewym dolnym rogu panelu stron, nie w kolumnie formularza.
  await expect(window.locator('.editor-form').getByRole('status').filter({ hasText: 'Removed.' })).toHaveCount(0)
  const message = (await removed.locator('.removal-message-content').boundingBox())!
  const pages = (await preview.boundingBox())!
  expect(message.x).toBeGreaterThanOrEqual(pages.x)
  expect(message.x).toBeLessThan(pages.x + 40)
  expect(message.y + message.height).toBeGreaterThan(pages.y + pages.height - 40)
  // Fokus na następnym wpisie (jego pierwszym polu tekstu).
  await expect(roleField(positions[2])).toBeFocused()

  // „Undo” przywraca wpis i stawia kursor w jego pierwszym polu.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(positionNames).toEqual(positions)
  await expect(roleField(positions[1])).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'experience:e2:role', offset: positions[1].length, collapsed: true })
  await expect(removed).toHaveCount(0)
  // Jeden krok: ponowienie usuwa wpis, cofnięcie przywraca.
  await window.keyboard.press('Meta+Shift+z')
  await expect.poll(positionNames).toEqual([positions[0], ...positions.slice(2)])
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)

  // Wykształcenie: fokus nie ginie; Cmd+Z cofa usunięcie jednym krokiem.
  await handle(`entry “${educations[1]}”`).click()
  await blockMenu(`entry “${educations[1]}”`).getByRole('menuitem', { name: 'Remove education' }).click()
  await expect(preview.locator('.cv-pages [data-block-id="ed2"]')).toHaveCount(0)
  await expect(removed).toBeVisible()
  await expect.poll(() => window.evaluate('document.activeElement !== document.body')).toBe(true)
  await window.keyboard.press('Meta+z')
  await expect(preview.locator('.cv-pages [data-block-id="ed2"]')).toHaveCount(1)
  await expect(removed).toHaveCount(0)
})

// ---------- Żetony dat (docs/specs/wysiwyg-editing.md, S3) ----------

// Popover daty (Field popover) i żeton daty na stronie – nazwy „<data> – <część CV>”, żeton z napisem daty.
const datePopover = (name: string) => window.getByRole('dialog', { name, exact: true })
const dateToken = (name: string) => window.locator('.preview .cv-pages').getByRole('button', { name: new RegExp(`^${name}(: |$)`) })

test('the dates of entries change in a date popover at the date on the page, with the mouse and from the keyboard; reversed dates are marked; each change is one undo step', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  const warning = 'The end date is earlier than the start date.'
  const specialist = 'Position “Procurement Specialist”'
  const dates = entryDate('e2')
  await expect(dates).toHaveText('02.2019 – 02.2023')

  // Klik w datę końca: wpis się rozwija, popover daty końca przy jej żetonie, fokus na polu miesiąca.
  await clickAtCharacter(dates.locator('.cv-page-dates'), 12)
  const end = datePopover(`To – ${specialist}`)
  const to = end.getByLabel('To', { exact: true })
  await expect(to).toBeFocused()
  await expect(to).toHaveValue('2023-02')
  const endToken = dateToken(`To – ${specialist}`)
  await expect(endToken).toHaveAttribute('aria-expanded', 'true')
  const [popoverBox, tokenBox] = [(await end.boundingBox())!, (await endToken.boundingBox())!]
  expect(popoverBox.y >= tokenBox.y + tokenBox.height || popoverBox.y + popoverBox.height <= tokenBox.y).toBe(true)
  // Zmiana widać od razu – na stronie i w formularzu; Enter zamyka i wraca na żeton.
  await to.fill('2023-05')
  await expect(dates).toHaveText('02.2019 – 05.2023')
  await expect(form.getByLabel('To', { exact: true }).nth(1)).toHaveValue('2023-05')
  await to.press('Enter')
  await expect(end).toHaveCount(0)
  await expect(endToken).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(dates).toHaveText('02.2019 – 02.2023')

  // Z klawiatury: spacja na żetonie otwiera; „I currently work here” – „present”; Escape wraca na żeton.
  await window.keyboard.press('Space')
  await expect(to).toBeFocused()
  await end.getByLabel('I currently work here').check()
  await expect(dates).toHaveText('02.2019 – present')
  await expect(to).toBeDisabled()
  await window.keyboard.press('Escape')
  await expect(end).toHaveCount(0)
  await expect(endToken).toBeFocused()
  await expect(endToken).toHaveAccessibleName(`To – ${specialist}: present`)
  await window.keyboard.press('Meta+z')
  await expect(dates).toHaveText('02.2019 – 02.2023')

  // Odwrócone daty: znaczek ⚠ obok dat w warstwie edycji, ostrzeżenie w popoverze i opis żetonów dla czytnika ekranu.
  await window.keyboard.press('ArrowLeft')
  const startToken = dateToken(`From – ${specialist}`)
  await expect(startToken).toBeFocused()
  await window.keyboard.press('Enter')
  const start = datePopover(`From – ${specialist}`)
  const from = start.getByLabel('From', { exact: true })
  await from.fill('2024-01')
  await expect(start.getByText(warning)).toBeVisible()
  await expect(from).toHaveAccessibleDescription(warning)
  await expect(window.locator('.edit-layer .edit-date-warning')).toHaveCount(1)
  await window.keyboard.press('Escape')
  await expect(startToken).toBeFocused()
  await expect(startToken).toHaveAccessibleDescription(warning)
  await expect(endToken).toHaveAccessibleDescription(warning)

  // „Clear” usuwa datę (pusta data wpisu z fokusem – żeton z placeholderem); ostrzeżenia już nie ma.
  await window.keyboard.press('Enter')
  await start.getByRole('button', { name: 'Clear' }).click()
  await expect(form.getByLabel('From', { exact: true }).nth(1)).toHaveValue('')
  await expect(window.locator('.edit-layer .edit-date-warning')).toHaveCount(0)
  await expect(start.getByText(warning)).toHaveCount(0)
  await window.keyboard.press('Escape')
  await expect(startToken).toBeFocused()
  expect(await placeholderOf(startToken)).toBe('"From"')
  // Po wyjściu z wpisu daty są znowu jednym napisem, jak w PDF.
  await clickAtCharacter(pageField('Full name'), 0)
  await expect(dates).toHaveText('02.2023')
  // Każda zmiana to jeden krok cofania.
  await window.keyboard.press('Meta+z')
  await expect(dates).toHaveText('01.2024 – 02.2023')
  await window.keyboard.press('Meta+z')
  await expect(dates).toHaveText('02.2019 – 02.2023')

  // Wykształcenie bez daty początku: klik w datę ukończenia odsłania pusty żeton początku; klik obok popovera go zamyka.
  const diploma = `Education “${educations[0]}”`
  await clickAtCharacter(entryDate('ed1').locator('.cv-page-dates'), 2)
  const graduation = datePopover(`Graduation date – ${diploma}`)
  await expect(graduation.getByLabel('Graduation date')).toBeFocused()
  await expect(graduation.getByLabel('I currently work here')).toHaveCount(0)
  expect(await placeholderOf(dateToken(`From \\(optional\\) – ${diploma}`))).toBe('"From"')
  const firstPage = (await window.locator('.preview .cv-page').first().boundingBox())!
  await window.mouse.click(firstPage.x + 4, firstPage.y + 4)
  await expect(graduation).toHaveCount(0)
})

test('Cmd+Z after adding a position undoes the typing and then the adding; the focus then goes to a safe place', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  await handle('section “Work experience”').click()
  await blockMenu('section “Work experience”').getByRole('menuitem', { name: 'Add position' }).click()
  await expect(roleField('New position')).toBeFocused()
  await window.keyboard.type('Buyer')
  const role = window.locator('.preview .cv-page .cv-role', { hasText: /^Buyer$/ })
  await expect(role).toHaveCount(1)
  await expect(roleField('Buyer')).toBeFocused()
  // Cofnięcie wpisanej nazwy: pusty wpis z kursorem zostaje odsłonięty (z placeholderem), kursor w nim.
  await window.keyboard.press('Meta+z')
  await expect(role).toHaveCount(0)
  await expect(roleField('New position')).toBeFocused()
  // Cofnięcie dodania: wpisu nie ma, fokus przechodzi w bezpieczne miejsce – na pasek boczny (przy CV form – jego
  // przycisk w przełączniku Outline / Form).
  await window.keyboard.press('Meta+z')
  await expect(roleField('New position')).toHaveCount(0)
  await expect(form.getByLabel('Job title')).toHaveCount(4)
  await expect(form.getByRole('button', { name: 'Form', exact: true })).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

// ---------- Karta zdjęcia i kontakty na stronie ----------

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

test('clicking the photo opens its Field popover: changing and cropping the photo there changes the page and the PDF; removing it says “Removed.” and Undo brings it back', async () => {
  const photoPath = await writeRedBluePhoto()
  await openFirstCv()
  const photo = window.locator('.preview .cv-page .cv-photo')
  const before = await photo.getAttribute('src')
  await clickOnPage(photo)
  const popover = photoPopover()
  await expect(popover.getByRole('button')).toHaveText(['Change photo', 'Crop photo', 'Remove photo'])
  await expect(popover.getByRole('button', { name: 'Change photo' })).toBeFocused()
  await expect(photoButton()).toHaveAttribute('aria-expanded', 'true')
  // Popover stoi przy zdjęciu, w skali 1:1.
  const photoBox = (await photo.boundingBox())!
  const popoverBox = (await popover.boundingBox())!
  expect(Math.abs(popoverBox.y - (photoBox.y + photoBox.height + 6)) < 2 || Math.abs(popoverBox.y + popoverBox.height - (photoBox.y - 6)) < 2).toBe(true)

  // Escape w oknie kadrowania zamyka tylko to okno – popover zostaje, fokus wraca na „Change photo”, zdjęcie bez zmian.
  await stubOpenDialog(photoPath)
  await popover.getByRole('button', { name: 'Change photo' }).click()
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })
  await expect(cropper).toBeVisible()
  await window.keyboard.press('Escape')
  await expect(cropper).toHaveCount(0)
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('button', { name: 'Change photo' })).toBeFocused()
  await expect(photo).toHaveAttribute('src', before!)

  // Kadr przesunięty maksymalnie w prawo – na zdjęciu zostaje sam niebieski.
  await popover.getByRole('button', { name: 'Change photo' }).click()
  const frame = cropper.getByRole('img', { name: 'Frame preview' })
  const dragAcross = async (dx: number) => {
    const box = (await frame.boundingBox())!
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await window.mouse.down()
    await window.mouse.move(box.x + box.width / 2 + dx * box.width * 3, box.y + box.height / 2, { steps: 10 })
    await window.mouse.up()
  }
  await dragAcross(-1)
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(cropper).toHaveCount(0)
  await expect(popover).toBeVisible()
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  for (const [r = 0, , b = 0] of await photoCorners(photo)) {
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(40)
  }

  // „Crop photo” kadruje zdjęcie z CV jeszcze raz (powiększone – inny kadr).
  const cropped = await photo.getAttribute('src')
  await popover.getByRole('button', { name: 'Crop photo' }).click()
  await expect(cropper).toBeVisible()
  await cropper.getByRole('slider', { name: 'Zoom' }).fill('2')
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(cropper).toHaveCount(0)
  await expect(popover.getByRole('button', { name: 'Crop photo' })).toBeFocused()
  await expect(photo).not.toHaveAttribute('src', cropped!)
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)

  const pdfPath = join(outputDir, 'with-photo.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: with-photo.pdf')).toBeVisible()
  expect((await pdfImagesPerPage(pdfPath))[0]).toBe(1)
  // Klik poza popoverem (pasek narzędzi) go zamknął.
  await expect(popover).toHaveCount(0)

  // Usunięcie z popovera: zdjęcia nie ma na stronie ani w PDF, popover i przycisk zdjęcia znikają.
  await clickOnPage(photo)
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  await popover.getByRole('button', { name: 'Remove photo' }).click()
  await expect(photo).toHaveCount(0)
  await expect(removed).toBeVisible()
  await expect(popover).toHaveCount(0)
  await expect(photoButton()).toHaveCount(0)

  // „Undo” przywraca wykadrowane zdjęcie, a fokus wraca na przycisk zdjęcia.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect(photoButton()).toBeFocused()

  await photoButton().press('Enter')
  await popover.getByRole('button', { name: 'Remove photo' }).click()
  await expect(photo).toHaveCount(0)
  const withoutPhoto = join(outputDir, 'without-photo.pdf')
  await stubSaveDialog(withoutPhoto)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: without-photo.pdf')).toBeVisible()
  expect((await pdfImagesPerPage(withoutPhoto)).every((count) => count === 0)).toBe(true)
})

test('contacts are edited on the page: a Classic contact is one “label: value” line until the caret enters it; Enter in a value adds a contact after it, Backspace in an empty contact removes it; each is one undo step', async () => {
  await openFirstCv()
  const contacts = window.locator('.preview .cv-page .cv-contact > *')
  const email = contacts.nth(1)
  const formValues = window.locator('.editor-form').getByLabel(/^Contact value \d$/)
  await expect(email).toHaveText('Email: jane.example@example.com')
  await expect(email.locator('[data-joined]')).toHaveCount(1)
  await expect(window.getByRole('dialog')).toHaveCount(0)

  // Klik w wartość: kursor w klikniętym znaku; wszystkie kontakty to osobne pola, z tym samym tekstem na stronie.
  await clickAtCharacter(email.locator('[data-joined]'), 'Email: jane'.length)
  const value2 = pageField('Contact value 2')
  await expect(value2).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'contact:c2:value', offset: 'jane'.length, collapsed: true })
  await expect(labelField(1)).toHaveText('Phone')
  await expect(email).toHaveText('Email: jane.example@example.com')

  // Pisanie zmienia stronę i formularz (te same pola).
  await clickAtCharacter(value2, 'jane.example@example.com'.length - 1)
  await window.keyboard.press('ArrowRight')
  await window.keyboard.type('.uk')
  await expect(email).toHaveText('Email: jane.example@example.com.uk')
  await expect(formField('Contact value 2')).toHaveValue('jane.example@example.com.uk')

  // Enter w wartości: nowy kontakt za nim, kursor w jego pustej etykiecie (placeholdery).
  await window.keyboard.press('Enter')
  const label3 = labelField(3)
  await expect(label3).toBeFocused()
  await expect(label3).toHaveText('')
  expect(await placeholderOf(label3)).toBe('"Label"')
  expect(await placeholderOf(pageField('Contact value 3'))).toBe('"Value"')
  await expect(contacts).toHaveCount(5)
  await expect(formValues).toHaveCount(5)
  await window.keyboard.type('GitHub')
  // Enter w etykiecie – do wartości.
  await window.keyboard.press('Enter')
  await expect(pageField('Contact value 3')).toBeFocused()
  await window.keyboard.type('github.com/jane-example')
  await expect(contacts.nth(2)).toHaveText('GitHub: github.com/jane-example')
  await expect(formField('Contact value 3')).toHaveValue('github.com/jane-example')

  // Cofanie: wartość, etykieta i dodanie – każde jednym krokiem.
  await window.keyboard.press('Meta+z')
  await expect(pageField('Contact value 3')).toHaveText('')
  await window.keyboard.press('Meta+z')
  await expect(labelField(3)).toHaveText('')
  await window.keyboard.press('Meta+z')
  await expect(formValues).toHaveCount(4)
  await expect(contacts).toHaveCount(4)

  // Backspace w pustym kontakcie usuwa go, kursor na końcu poprzedniej wartości; cofnięcie przywraca go jednym krokiem.
  // (Cofnięte dodanie zabrało pole z kursorem – kontakty są znowu jedną linią.)
  const emailText = email.locator('[data-joined], [data-field-key="contact:c2:value"]')
  await clickAtCharacter(emailText, ((await emailText.textContent()) ?? '').length - 1)
  await window.keyboard.press('ArrowRight')
  await window.keyboard.press('Enter')
  await expect(labelField(3)).toBeFocused()
  await expect(formValues).toHaveCount(5)
  await window.keyboard.press('Backspace')
  await expect(formValues).toHaveCount(4)
  await expect.poll(caret).toEqual({ key: 'contact:c2:value', offset: 'jane.example@example.com.uk'.length, collapsed: true })
  await window.keyboard.press('Meta+z')
  await expect(formValues).toHaveCount(5)

  // Po wyjściu z kontaktów pusty kontakt znika ze strony (zostaje w danych), a linie są znowu jednym napisem.
  await clickAtCharacter(pageField('Full name'), 1)
  await expect(contacts).toHaveCount(4)
  await expect(email.locator('[data-joined]')).toHaveCount(1)
  await expect(formValues).toHaveCount(5)
})

test('the label of a contact on the page suggests the usual labels in a list under it: filtered by what is typed, chosen with the arrow keys and Enter or a click; Escape hides the list', async () => {
  await openFirstCv()
  const city = window.locator('.preview .cv-page .cv-contact > *').nth(3)
  await clickAtCharacter(city.locator('[data-joined]'), 'City: Manchester'.length - 1)
  await window.keyboard.press('ArrowRight')
  await window.keyboard.press('Enter')
  const label5 = labelField(5)
  await expect(label5).toBeFocused()

  // Pusta etykieta: wszystkie podpowiedzi, lista pod polem, pole wskazuje listę.
  const list = window.getByRole('listbox', { name: 'Contact label 5' })
  await expect(list.getByRole('option')).toHaveText(['Phone', 'Email', 'LinkedIn', 'City'])
  await expect(label5).toHaveAttribute('aria-expanded', 'true')
  await expect(label5).toHaveAttribute('aria-autocomplete', 'list')
  await expect(label5).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!)
  const fieldBox = (await label5.boundingBox())!
  expect((await list.boundingBox())!.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height)

  // Filtr wpisanym tekstem; ↓ wybiera, Enter wstawia (fokus zostaje w polu, lista znika).
  await window.keyboard.type('l')
  await expect(list.getByRole('option')).toHaveText(['LinkedIn'])
  await window.keyboard.press('ArrowDown')
  const linkedIn = list.getByRole('option', { name: 'LinkedIn' })
  await expect(linkedIn).toHaveAttribute('aria-selected', 'true')
  await expect(label5).toHaveAttribute('aria-activedescendant', (await linkedIn.getAttribute('id'))!)
  await window.keyboard.press('Enter')
  await expect(label5).toHaveText('LinkedIn')
  await expect(label5).toBeFocused()
  await expect(list).toHaveCount(0)
  await expect(label5).toHaveAttribute('aria-expanded', 'false')
  await expect(formField('Contact label 5')).toHaveValue('LinkedIn')

  // Wybór to osobny krok cofania.
  await window.keyboard.press('Meta+z')
  await expect(label5).toHaveText('l')
  await expect(list.getByRole('option')).toHaveText(['LinkedIn'])

  // Escape chowa listę do kolejnej zmiany tekstu; klik w podpowiedź wstawia ją bez zabierania fokusu.
  await window.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  await expect(label5).toBeFocused()
  await window.keyboard.press('Backspace')
  await expect(list.getByRole('option')).toHaveCount(4)
  await list.getByRole('option', { name: 'Email' }).click()
  await expect(label5).toHaveText('Email')
  await expect(label5).toBeFocused()

  // Enter bez wybranej podpowiedzi – do wartości kontaktu.
  await window.keyboard.press('Enter')
  await expect(pageField('Contact value 5')).toBeFocused()
  await expect(list).toHaveCount(0)
})

test('the consent clause is edited on the page; its toolbar saves the text as a new clause, applies and restores a library clause and hides the clause; each change is one undo step', async () => {
  await openFirstCv()
  await enableConsent('I agree to the processing of my personal data.')
  const form = window.locator('.editor-form')
  const formText = form.getByLabel('Text in this CV')
  const clause = consentField()
  const toolbar = consentToolbar()
  const library = toolbar.getByLabel('Clause from the library')

  // Pisanie i Enter (klauzula pokazuje nowe linie we wszystkich szablonach) zmieniają stronę, formularz i PDF.
  await clickAtCharacter(clause, 'I agree to the processing of my personal data'.length)
  await window.keyboard.press('ArrowRight')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Second line.')
  await expect(formText).toHaveValue('I agree to the processing of my personal data.\nSecond line.')
  const pdfPath = join(outputDir, 'clause.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: clause.pdf')).toBeVisible()
  expect(await pdfText(pdfPath)).toContain('Second line.')

  // Pasek: pusta biblioteka – wybór nieaktywny; Tab z tekstu wchodzi do paska, Shift+Tab wraca.
  await clickAtCharacter(clause, 2)
  await expect(toolbar).toBeVisible()
  await expect(library).toBeDisabled()
  await expect(toolbar.getByRole('button')).toHaveText(['Save as new clause', 'Hide clause'])
  await window.keyboard.press('Tab')
  await expect(toolbar.getByRole('button', { name: 'Save as new clause' })).toBeFocused()
  await window.keyboard.press('Shift+Tab')
  await expect(clause).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'consent:text', offset: 2, collapsed: true })

  // „Save as new clause” pyta tylko o nazwę; klauzula z biblioteki wybrana, kursor wraca do tekstu.
  await window.keyboard.press('Tab')
  await window.keyboard.press('Enter')
  await expect(toolbar.getByLabel('New clause name')).toBeFocused()
  await window.keyboard.type('Recruitment')
  await window.keyboard.press('Enter')
  await expect(clause).toBeFocused()
  await expect(library.locator('option:checked')).toHaveText('Recruitment')
  await expect(form.getByLabel('Clause from the library').locator('option:checked')).toHaveText('Recruitment')

  // Poprawka w tekście – „Restore from library” przywraca treść z biblioteki.
  await window.keyboard.type('Dear Sir. ')
  const restore = toolbar.getByRole('button', { name: 'Restore from library' })
  await expect(restore).toBeVisible()
  await restore.click()
  await expect(formText).toHaveValue('I agree to the processing of my personal data.\nSecond line.')
  await expect(restore).toHaveCount(0)
  await expect(clause).toBeFocused()

  // Druga klauzula i wybór z biblioteki w pasku: tekst w CV to kopia klauzuli; wybór to jeden krok cofania.
  await window.keyboard.press('Meta+a')
  await window.keyboard.type('Short clause.')
  await toolbar.getByRole('button', { name: 'Save as new clause' }).click()
  await window.keyboard.type('Short')
  await window.keyboard.press('Enter')
  await expect(library.locator('option:checked')).toHaveText('Short')
  await library.selectOption({ label: 'Recruitment' })
  await expect(formText).toHaveValue('I agree to the processing of my personal data.\nSecond line.')
  await expect(clause).toHaveText(/^I agree to the processing of my personal data\.\s*Second line\.$/)
  await clickAtCharacter(clause, 1)
  await window.keyboard.press('Meta+z')
  await expect(formText).toHaveValue('Short clause.')

  // „Hide clause”: klauzula znika ze strony (zostaje w CV), pasek też; cofnięcie ją przywraca.
  await toolbar.getByRole('button', { name: 'Hide clause' }).click()
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveCount(0)
  await expect(toolbar).toHaveCount(0)
  await expect(form.getByLabel('Show the clause at the bottom of the last page')).not.toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(clause).toHaveText('Short clause.')
  await expect(form.getByLabel('Show the clause at the bottom of the last page')).toBeChecked()
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

  // Otwarcie panelu zamyka otwarty Field popover; fokus na pierwszym polu panelu.
  await clickOnPage(window.locator('.preview .cv-page .cv-photo'))
  await expect(photoPopover()).toBeVisible()
  await designButton().click()
  await expect(photoPopover()).toHaveCount(0)
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
// Tytuły sekcji na stronach (Page fields) w kolejności dokumentu.
const sectionTitles = () => window.locator('.preview .cv-pages [data-fragment^="sectionTitle:"]').allTextContents()
const positionNames = async () => window.locator('.preview .cv-pages .cv-role').allTextContents()
// Uchwyt jest zawsze w DOM, a widać go (nieprzezroczysty) tylko przy najechaniu, fokusie i otwartym menu.
const handleBox = (name: string) =>
  window.locator('.edit-layer .edit-handle', { has: window.getByRole('button', { name: `Actions for ${name}`, exact: true }) })

test('the handle of a section title shows on hover and moves the section from its menu and with Alt+Shift+arrows; each move is one undo step and the focus stays on the handle', async () => {
  await openFirstCv()
  const education = handle('section “Education”')
  await expect(education).toHaveCount(1)
  // Uchwyt jest w marginesie kartki, przed lewą krawędzią fragmentu, i pokazuje się dopiero przy najechaniu.
  const titleBox = (await titleField('Education').boundingBox())!
  expect((await education.boundingBox())!.x + 24).toBeLessThanOrEqual(titleBox.x)
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '0')
  // Tytuł sekcji to Page field (bez przycisku karty) – uchwyt pokazuje się przy najechaniu na pole i przy jego fokusie.
  await titleField('Education').hover()
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '1')
  await window.mouse.move(1, 1)
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '0')
  await clickAtCharacter(titleField('Education'), 0)
  await window.mouse.move(1, 1)
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
  await expect(blockMenu(`position “${positions[0]}”`).getByRole('menuitem')).toHaveText(['Move up', 'Move down', 'Remove position'])
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
  const third = () => pageIndexOf(roleField(positions[2]))
  await expect.poll(third).toBe(1)
  await handle(`position “${positions[2]}”`).focus()
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(positionNames).toEqual([positions[0], positions[2], positions[1], positions[3]])
  await expect.poll(third).toBe(0)
  await expect(handle(`position “${positions[2]}”`)).toBeFocused()
  await expect(announcement()).toHaveText(`Moved position “${positions[2]}” to position 2 of 4.`)
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)
  await expect.poll(third).toBe(1)
})

test('“New page before” and “Hide section” in the menu on the page work like the form checkboxes', async () => {
  await openFirstCv()
  const form = window.locator('.editor-form')
  const skills = handle('section “Skills”')
  const skillsTitle = titleField('Skills')
  const page = await pageIndexOf(skillsTitle)

  await skills.click()
  await blockMenu('section “Skills”').getByRole('menuitemcheckbox', { name: 'New page before this section' }).click()
  await expect.poll(() => pageIndexOf(skillsTitle)).toBe(page + 1)
  // Uchwyt stoi już przy tytule na nowej stronie (warstwa mierzy strony klatkę po ich podziale).
  await expect(handleBox('section “Skills”')).toHaveAttribute('data-page', String(page + 1))
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('New page before this section')).toBeChecked()
  await expect(skills).toBeFocused()
  await window.keyboard.press('Enter')
  await expect(blockMenu('section “Skills”').getByRole('menuitemcheckbox', { name: 'New page before this section' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await window.keyboard.press('Escape')
  await window.keyboard.press('Meta+z')
  await expect.poll(() => pageIndexOf(skillsTitle)).toBe(page)
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('New page before this section')).not.toBeChecked()

  // Wpis: nowa strona przed stanowiskiem, jak pole w jego karcie.
  const second = () => pageIndexOf(roleField(positions[1]))
  await expect.poll(second).toBe(0)
  await handle(`position “${positions[1]}”`).click()
  await blockMenu(`position “${positions[1]}”`).getByRole('menuitemcheckbox', { name: 'New page before this entry' }).click()
  await expect.poll(second).toBe(1)
  await expect(handle(`position “${positions[1]}”`)).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect.poll(second).toBe(0)

  // Ukrycie: sekcja znika ze stron, fokus na kolejnym fragmencie, w formularzu zaznaczone „Hide section”.
  await skills.click()
  await blockMenu('section “Skills”').getByRole('menuitem', { name: 'Hide section' }).click()
  await expect(skillsTitle).toHaveCount(0)
  await expect(fragment('List “Skills”')).toHaveCount(0)
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: 'Skills' })).toHaveCount(0)
  await expect(form.getByRole('region', { name: 'Skills' }).getByLabel('Hide section')).toBeChecked()
  await expect(handle('section “Languages”')).toHaveCount(1)
  await expect(titleField('Languages')).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(skillsTitle).toHaveCount(1)
})

test('“Add …” in the menu of a section title adds an element with the caret in it on the page: a position in its job title, a list item in its text', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1000 })
  const form = window.locator('.editor-form')
  await handle('section “Work experience”').click()
  await blockMenu('section “Work experience”').getByRole('menuitem', { name: 'Add position' }).click()
  // Nowy, pusty wpis jest odsłonięty na stronie: kursor w stanowisku, placeholdery pól i żetony dat – bez karty.
  const newRole = roleField('New position')
  await expect(newRole).toBeFocused()
  await expect(newRole).toHaveText('')
  expect(await placeholderOf(newRole)).toBe('"Job title"')
  expect(await placeholderOf(pageField('Company – Position “New position”'))).toBe('"Company"')
  await expect(dateToken('From – Position “New position”')).toHaveCount(1)
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(form.getByLabel('Job title')).toHaveCount(5)
  await window.keyboard.type('Buyer')
  await expect(window.locator('.preview .cv-page .cv-role', { hasText: /^Buyer$/ })).toHaveCount(1)
  await expect(roleField('Buyer')).toBeFocused()
  await expect(form.getByLabel('Job title').nth(4)).toHaveValue('Buyer')

  // Lista: nowy, pusty element na stronie (z placeholderem), z kursorem w nim – bez karty.
  await handle('section “Skills”').click()
  await blockMenu('section “Skills”').getByRole('menuitem', { name: 'Add item' }).click()
  const newItem = itemField(6, 'Skills')
  await expect(newItem).toBeFocused()
  await expect(newItem).toHaveText('')
  expect(await placeholderOf(newItem)).toBe('"Item 6"')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.type('SQL')
  await expect(pageItem('SQL')).toHaveCount(1)
})

test('the menu works from the keyboard alone, and there are no handles below 50% zoom', async () => {
  await openFirstCv()
  const education = handle('section “Education”')
  await education.focus()
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
  await expect(pageField('Level – Education “New education”')).toBeFocused()

  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(preview.locator('.preview-zoom-value')).toHaveText('50%')
  await expect(window.locator('.edit-layer .edit-handle').first()).toBeAttached()
  await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(window.locator('.edit-layer')).toHaveAttribute('data-compact', 'true')
  await expect(window.locator('.edit-layer .edit-handle')).toHaveCount(0)
  // Edycja dalej działa: tytuł jest Page field, a zdjęcie ma swój przycisk.
  await expect(titleField('Education')).toHaveCount(1)
  await expect(photoButton()).toHaveCount(1)
})

// ---------- Dodawanie na stronach: pigułki „+”, pasek „Add to CV”, puste CV ----------

const addBar = () => window.locator('.edit-layer').getByRole('group', { name: 'Add to CV:' })
const addBarButtons = () => addBar().getByRole('button')
const pill = (name: string) => window.locator('.edit-layer').getByRole('button', { name: `+ ${name}`, exact: true })
const startHint = () => window.locator('.edit-layer').getByRole('button', { name: 'Start with your full name' })

// „New CV” w bibliotece i otwarcie go (nowe CV jest na liście pierwsze).
async function openNewCv() {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await window.getByRole('button', { name: 'New CV', exact: true }).click()
  const list = window.getByRole('list', { name: 'CV list' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await list.getByRole('listitem').filter({ hasText: 'New CV' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page').first()).toBeVisible()
}

// Bloki na kolejnych stronach (id bloków i klauzula zgody) – podział stron do porównania Edit mode z Preview mode.
const pageSplit = () =>
  window
    .locator('.preview .cv-pages > .cv-page')
    .evaluateAll((pages) =>
      pages.map((page) => [...page.querySelectorAll('[data-block-id], .cv-consent')].map((element) => element.getAttribute('data-block-id') ?? 'consent'))
    )

test('a new CV shows the start hint on its empty first page and an “Add to CV” bar under it; the bar lists only what is missing and updates', async () => {
  await openNewCv()
  await expect(window.locator('.preview .cv-pages > .cv-page')).toHaveCount(1)
  await expect(window.locator('.preview .cv-page [data-block-id]')).toHaveCount(0)
  await expect(startHint()).toBeVisible()
  await expect(addBarButtons()).toHaveText([
    'Full name',
    'Photo',
    'Contact',
    'Summary',
    'Work experience',
    'Education',
    'Skills',
    'Languages',
    'Consent clause'
  ])
  // Pasek stoi pod ostatnią stroną, poza kartką; podpowiedź – na środku pierwszej strony.
  const page = (await window.locator('.preview .cv-page').first().boundingBox())!
  const bar = (await addBar().boundingBox())!
  expect(bar.y).toBeGreaterThan(page.y + page.height)
  const hint = (await startHint().boundingBox())!
  expect(Math.abs(hint.x + hint.width / 2 - (page.x + page.width / 2))).toBeLessThan(2)
  expect(Math.abs(hint.y + hint.height / 2 - (page.y + page.height / 2))).toBeLessThan(2)

  // Podpowiedź stawia kursor w pustym imieniu na stronie: pole z placeholderem w nagłówku pierwszej strony.
  await startHint().click()
  const name = pageField('Full name')
  await expect(name).toBeFocused()
  await expect(name).toHaveText('')
  expect(await placeholderOf(name)).toBe('"Full name"')
  await window.keyboard.type('J')
  await expect(pageName()).toHaveText('J')
  await expect(startHint()).toHaveCount(0)
  await window.keyboard.type('ane Doe')
  await expect(addBarButtons()).toHaveText(['Photo', 'Contact', 'Summary', 'Work experience', 'Education', 'Skills', 'Languages', 'Consent clause'])
  await expect(name).toBeFocused()

  // „Summary” w pasku odsłania puste podsumowanie z kursorem; bez wpisania niczego znika po wyjściu z pola.
  await addBar().getByRole('button', { name: 'Summary' }).click()
  await expect(pageField('Summary')).toBeFocused()
  expect(await placeholderOf(pageField('Summary'))).toBe('"Summary"')
  await clickAtCharacter(name, 0)
  await expect(pageField('Summary')).toHaveCount(0)

  // Pusta sekcja listowa z paska: jej pusty element odsłonięty na stronie (z placeholderem), z kursorem w nim.
  await addBar().getByRole('button', { name: 'Languages' }).click()
  const language = itemField(1)
  await expect(language).toBeFocused()
  expect(await placeholderOf(language)).toBe('"Item 1"')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.type('English – native')
  await expect(pageItem('English – native')).toHaveCount(1)
  await expect(addBar().getByRole('button', { name: 'Languages' })).toHaveCount(0)

  // Cofnięcie przywraca przycisk w pasku.
  await window.keyboard.press('Meta+z')
  await expect(pageItem('English – native')).toHaveCount(0)
  await expect(addBar().getByRole('button', { name: 'Languages' })).toHaveCount(1)

  // Tryb Preview: ani podpowiedzi, ani paska, ani pigułek.
  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(window.locator('.add-to-cv, .edit-pill, .edit-start-hint')).toHaveCount(0)
})

test('the “+” pill under a section adds an entry with the caret in its job title on the page; a list item gets the caret in its text', async () => {
  await openFirstCv()
  await window.setViewportSize({ width: 1600, height: 1000 })
  const form = window.locator('.editor-form')
  const position = pill('Position')
  // Niewidoczna, dopóki kursor nie jest nad sekcją; najechanie na wpis sekcji ją pokazuje.
  await expect(position).toHaveCSS('opacity', '0')
  await pageRole(positions[1]).hover()
  await expect(position).toHaveCSS('opacity', '1')
  await pageName().hover()
  await expect(position).toHaveCSS('opacity', '0')

  // Pigułka stoi pod ostatnim wpisem sekcji.
  await window.locator('.preview .cv-page li', { hasText: 'Handling complaints.' }).hover()
  await expect(position).toHaveCSS('opacity', '1')
  // Ostatni punkt ostatniego wpisu sekcji.
  const last = (await window.locator('.preview .cv-pages li', { hasText: 'Working with partners abroad.' }).boundingBox())!
  const pillBox = (await position.boundingBox())!
  expect(pillBox.y).toBeGreaterThanOrEqual(last.y + last.height)
  expect(pillBox.y).toBeLessThan(last.y + last.height + 8)
  await position.click()

  // Nowy, pusty wpis odsłonięty pod ostatnim wpisem sekcji, z kursorem w stanowisku – bez karty.
  await expect(roleField('New position')).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await expect(form.getByLabel('Job title')).toHaveCount(5)
  await window.keyboard.type('Buyer')
  await expect(window.locator('.preview .cv-page .cv-role', { hasText: /^Buyer$/ })).toHaveCount(1)
  await expect(roleField('Buyer')).toBeFocused()

  // Pigułki listy i wykształcenia; z klawiatury – pigułka jest w kolejności Tab za ostatnim fragmentem sekcji.
  await handle('section “Skills”').focus()
  await window.keyboard.press('Tab')
  const item = pill('Item').first()
  await expect(item).toBeFocused()
  await expect(item).toHaveCSS('opacity', '1')
  await window.keyboard.press('Enter')
  // Nowy element listy – na stronie, z kursorem (bez karty).
  await expect(itemField(6, 'Skills')).toBeFocused()
  await expect(itemField(6, 'Skills')).toHaveText('')
  await expect(pill('Education')).toHaveCount(1)

  // Poniżej 50% pigułek nie ma.
  const preview = window.locator('.preview')
  await preview.getByRole('button', { name: '100%' }).click()
  for (let step = 0; step < 3; step++) await preview.getByRole('button', { name: 'Zoom out' }).click()
  await expect(window.locator('.edit-layer')).toHaveAttribute('data-compact', 'true')
  await expect(window.locator('.edit-layer .edit-pill')).toHaveCount(0)
})

test('a full CV is built from a new CV in the Outline without any card and without the CV form: every field of the Sample CV is on the page or in a Field popover, and Edit mode then splits the pages like Preview mode', async () => {
  const photoPath = await writeRedBluePhoto()
  await openNewCv()
  await expect(outline()).toBeVisible()
  const bar = (name: string) => addBar().getByRole('button', { name, exact: true })
  const outlineSection = (name: string) => outlineRow(name).locator('.outline-row-button')
  // Ani Edit card, ani CV form – przez cały czas.
  const expectNoForms = async () => {
    await expect(window.locator('.edit-card')).toHaveCount(0)
    await expect(window.locator('.editor-form')).toHaveCount(0)
  }

  // Imię i nazwisko z podpowiedzi w pustym CV.
  await startHint().click()
  await expect(pageField('Full name')).toBeFocused()
  await window.keyboard.type('Jane Doe')
  await expect(pageName()).toHaveText('Jane Doe')

  // Zdjęcie: karta z „Choose photo”, wybór i kadrowanie.
  await stubOpenDialog(photoPath)
  await bar('Photo').click()
  await card('Photo').getByRole('button', { name: 'Choose photo' }).click()
  await window.getByRole('dialog', { name: 'Crop photo' }).getByRole('button', { name: 'Apply' }).click()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(1)
  await expect(bar('Photo')).toHaveCount(0)
  await window.keyboard.press('Escape')

  // Kontakty: kursor w wartości pierwszego pustego kontaktu (etykiety nowego CV), z placeholderem; Enter w wartości
  // dodaje kontakt z kursorem w jego etykiecie.
  await bar('Contact').click()
  await expect(pageField('Contact value 1')).toBeFocused()
  expect(await placeholderOf(pageField('Contact value 1'))).toBe('"Value"')
  await window.keyboard.type('+48 600 000 000')
  await pageField('Contact value 2').click()
  await window.keyboard.type('jane@example.com')
  await window.keyboard.press('Enter')
  await expect(labelField(3)).toBeFocused()
  await window.keyboard.type('Website')
  await window.keyboard.press('Enter')
  await expect(pageField('Contact value 3')).toBeFocused()
  await window.keyboard.type('jane.example')
  await expectNoForms()

  await bar('Summary').click()
  await expect(pageField('Summary')).toBeFocused()
  await window.keyboard.type('Buyer with ten years in procurement.')

  // Pusta sekcja w Outline: jej pierwszy wpis odsłonięty na stronie z kursorem w stanowisku; Enter – kolejne pola.
  await outlineSection('Work experience').click()
  await expect(roleField('New position')).toBeFocused()
  expect(await placeholderOf(roleField('New position'))).toBe('"Job title"')
  await window.keyboard.type('Senior Buyer')
  await window.keyboard.press('Enter')
  await expect(pageField('Company – Position “Senior Buyer”')).toBeFocused()
  await window.keyboard.type('Acme')
  await window.keyboard.press('Enter')
  await expect(pageField('City – Position “Senior Buyer”')).toBeFocused()
  await window.keyboard.type('Warsaw')
  // Daty – żetony z placeholderami i popover daty.
  const seniorBuyer = 'Position “Senior Buyer”'
  await dateToken(`From – ${seniorBuyer}`).click()
  const from = datePopover(`From – ${seniorBuyer}`).getByLabel('From', { exact: true })
  await expect(from).toBeFocused()
  await from.fill('2020-03')
  await from.press('Enter')
  await dateToken(`To – ${seniorBuyer}`).click()
  await datePopover(`To – ${seniorBuyer}`).getByLabel('I currently work here').check()
  await window.keyboard.press('Escape')
  await expect(dateToken(`To – ${seniorBuyer}`)).toBeFocused()
  // Punkty: pusty pierwszy punkt nowego wpisu, Enter dzieli.
  await bulletField(1, 'Senior Buyer').click()
  await window.keyboard.type('Negotiated annual contracts.')
  await window.keyboard.press('Enter')
  await expect(bulletField(2, 'Senior Buyer')).toBeFocused()
  await window.keyboard.type('Cut costs by 12%.')
  await expect(pageItem('Cut costs by 12%.')).toHaveCount(1)
  // Tytuł sekcji – na stronie.
  await clickAtCharacter(titleField('Work experience'), 4)
  await window.keyboard.press('Meta+a')
  await window.keyboard.type('Experience')
  await expect(outlineRow('Experience')).toHaveText(/^Experience1$/)
  // Drugie stanowisko pigułką.
  await pageRole('Senior Buyer').hover()
  await pill('Position').click()
  await expect(roleField('New position')).toBeFocused()
  await window.keyboard.type('Buyer')
  await expectNoForms()

  await outlineSection('Education').click()
  await expect(pageField('Level – Education “New education”')).toBeFocused()
  await window.keyboard.type('Master’s degree')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Logistics')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Fictional Academy')
  const master = 'Education “Master’s degree, Logistics”'
  await dateToken(`Graduation date – ${master}`).click()
  const graduation = datePopover(`Graduation date – ${master}`).getByLabel('Graduation date')
  await graduation.fill('2015-06')
  await graduation.press('Enter')

  // Sekcje listowe: z Outline i z paska.
  await outlineSection('Skills').click()
  await expect(itemField(1, 'Skills')).toBeFocused()
  await window.keyboard.type('Negotiation')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Negotiation 2')
  await bar('Languages').click()
  await expect(itemField(1, 'Languages')).toBeFocused()
  await window.keyboard.type('English – native')
  await window.keyboard.press('Enter')
  await window.keyboard.type('English – native 2')

  // Klauzula zgody: włączona przyciskiem paska, kursor w jej pustym tekście na stronie (z placeholderem).
  await bar('Consent clause').click()
  await expect(consentField()).toBeFocused()
  expect(await placeholderOf(consentField())).toBe('"Consent clause"')
  await window.keyboard.type('I agree to the processing of my personal data.')
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveText('I agree to the processing of my personal data.')

  // Wszystko jest na stronach – pasek znika.
  await expect(addBar()).toHaveCount(0)
  await expectNoForms()

  // Podział stron w Edit mode jak w Preview mode: te same strony i te same bloki na nich – także po kilku stronach.
  for (let copy = 0; copy < 3; copy++) {
    await pageRole('Senior Buyer').hover()
    await pill('Position').click()
    await expect(roleField('New position')).toBeFocused()
    await window.keyboard.type(`Buyer ${copy}`)
    await bulletField(1, `Buyer ${copy}`).click()
    for (let line = 0; line < 8; line++) {
      await window.keyboard.type(`Achievement ${copy}.${line} with a sentence long enough to wrap onto a second line of the page.`)
      await window.keyboard.press('Enter')
    }
  }
  // Klik w margines kartki zabiera fokus z pól – strony w spoczynku (pusty ostatni punkt znika).
  await window.locator('.preview').evaluate((element) => element.scrollTo({ top: 0 }))
  const firstPage = (await window.locator('.preview .cv-page').first().boundingBox())!
  await window.mouse.click(firstPage.x + 4, firstPage.y + 4)
  await expect.poll(focusedKey).toBeNull()
  const edit = await pageSplit()
  expect(edit.length).toBeGreaterThan(1)
  await expectNoForms()
  await window.keyboard.press('Meta+Shift+P')
  await expect(previewButton()).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(pageSplit).toEqual(edit)

  const pdfPath = join(outputDir, 'cv.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: cv.pdf')).toBeVisible()
  const text = await pdfText(pdfPath)
  for (const expected of [
    'Jane Doe',
    '+48 600 000 000',
    'jane@example.com',
    'Website',
    'jane.example',
    'Buyer with ten years in procurement.',
    'Experience',
    'Senior Buyer',
    'Acme',
    'Warsaw',
    '03.2020',
    'present',
    'Cut costs by 12%.',
    'Master’s degree',
    'Logistics',
    'Fictional Academy',
    '06.2015',
    'Negotiation 2',
    'English – native 2',
    'I agree to the processing of my personal data.'
  ]) {
    expect(text).toContain(expected)
  }
  expect(await pdfImagesPerPage(pdfPath)).toEqual([1, ...Array(edit.length - 1).fill(0)])
})

// ---------- Outline ----------

const outline = () => window.getByRole('navigation', { name: 'Outline' })
const outlineRow = (name: string) => outline().locator('.outline-section').filter({ has: window.locator('.outline-row-name', { hasText: new RegExp(`^${name}$`) }) })
const outlineHandle = (name: string) => outlineRow(name).getByRole('button', { name: `Actions for section “${name}”` })
const outlineNames = () => outline().locator('.outline-section .outline-row-name').allTextContents()
const pageSectionTitles = () => window.locator('.preview .cv-page .cv-section-title').allTextContents()
const savedSidebar = async () =>
  (JSON.parse(await readFile(join(outputDir, 'user-data', 'settings.json'), 'utf8').catch(() => '{}')) as { editorSidebar?: string })
    .editorSidebar

test('by default the sidebar is the Outline, about 240 px wide: the header, every section in CV order with its marks and entry count, and the consent clause; a click on a section scrolls to it and puts the caret at the end of its title', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithOutline()
  const nav = outline()
  await expect(nav).toBeVisible()
  expect((await nav.boundingBox())!.width).toBeCloseTo(240, 0)
  await expect(window.locator('.editor-form')).toHaveCount(0)
  await expect(window.getByRole('separator')).toHaveCount(0)
  await expect(nav.locator('.outline-section')).toHaveText([
    /^Work experience4$/,
    /^Education2$/,
    /^Skills5$/,
    /^Languages2$/,
    /^Interestshidden1Show on CV$/
  ])
  // Liczba wpisów dla czytnika ekranu: opis wiersza, nie część nazwy.
  await expect(outlineRow('Work experience').locator('.outline-row-button')).toHaveAccessibleName('Work experience')
  await expect(outlineRow('Work experience').locator('.outline-row-button')).toHaveAccessibleDescription('4 items')
  await expect(outlineRow('Interests').locator('.outline-row-button')).toHaveAccessibleDescription('1 item Show the section on the CV to edit it')
  await expect(nav.getByRole('button', { name: 'Consent clause' })).toBeVisible()
  await expect(nav.getByRole('switch', { name: 'Show on CV' })).not.toBeChecked()

  // Klik w sekcję na drugiej stronie: strony przewijają się do jej tytułu, a kursor staje na końcu tytułu (bez karty).
  const preview = window.locator('.preview')
  expect(await preview.evaluate((element) => element.scrollTop)).toBe(0)
  await outlineRow('Languages').locator('.outline-row-button').click()
  const title = titleField('Languages')
  await expect(title).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:languages:title', offset: 9, collapsed: true })
  expect(await preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(title).toBeInViewport()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.type('Language skills')
  await expect(outlineRow('Language skills')).toHaveText(/^Language skills2$/)
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: 'Language skills' })).toHaveCount(1)

  // „Header” – kursor w imieniu i nazwisku na stronie.
  await nav.getByRole('button', { name: 'Header' }).click()
  await expect(pageField('Full name')).toBeFocused()
  await expect(pageField('Full name')).toBeInViewport()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

test('a section hidden from the Outline leaves the pages but stays in the Outline: a click on it goes to its “Show on CV” switch, which shows it with the caret in its title on the page; each change is one undo step', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithOutline()
  const skillsOnPage = () => window.locator('.preview .cv-page .cv-section-title', { hasText: /^Skills/ })
  const hide = window.getByRole('menuitemcheckbox', { name: 'Hide section' })
  await outlineHandle('Skills').click()
  await expect(hide).toHaveAttribute('aria-checked', 'false')
  await hide.click()
  await expect(outlineHandle('Skills')).toBeFocused()
  await expect(skillsOnPage()).toHaveCount(0)
  await expect(outlineRow('Skills')).toHaveText(/^Skillshidden5Show on CV$/)

  // Ukrytej sekcji nie ma na stronach: klik w jej wiersz przenosi fokus na jej przełącznik „Show on CV” (bez karty), a
  // wiersz mówi czytnikowi ekranu, że trzeba ją pokazać.
  const row = outlineRow('Skills').locator('.outline-row-button')
  await expect(row).toHaveAccessibleDescription('5 items Show the section on the CV to edit it')
  await row.click()
  const showSkills = outline().getByRole('switch', { name: 'Show “Skills” on CV', exact: true })
  await expect(showSkills).toBeFocused()
  await expect(showSkills).not.toBeChecked()
  await expect(window.getByRole('dialog')).toHaveCount(0)

  // Pokazanie – sekcja wraca na strony z kursorem na końcu jej tytułu; przełącznik znika.
  await showSkills.click()
  await expect(skillsOnPage()).toHaveText(['Skills'])
  await expect(titleField('Skills')).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:skills:title', offset: 6, collapsed: true })
  await expect(outlineRow('Skills')).toHaveText(/^Skills5$/)
  await window.keyboard.type(' & tools')
  await expect(skillsOnPage()).toHaveText(['Skills & tools'])

  // „Hide section” w menu – zaznaczone przy ukrytej sekcji, kolejny wybór ją pokazuje.
  await outlineHandle('Skills & tools').click()
  await hide.click()
  await expect(skillsOnPage()).toHaveCount(0)
  await outlineHandle('Skills & tools').click()
  await expect(hide).toHaveAttribute('aria-checked', 'true')
  await hide.click()
  await expect(skillsOnPage()).toHaveText(['Skills & tools'])

  // Cofanie: pokazanie, ukrycie, pisanie, pokazanie, ukrycie – po jednym kroku.
  for (const expected of [/^Skills & toolshidden5Show on CV$/, /^Skills & tools5$/, /^Skills5$/, /^Skillshidden5Show on CV$/, /^Skills5$/]) {
    await window.keyboard.press('Meta+z')
    await expect(outlineRow(expected.source.startsWith('^Skills & tools') ? 'Skills & tools' : 'Skills')).toHaveText(expected)
  }
  await expect(skillsOnPage()).toHaveText(['Skills'])
})

test('sections are reordered in the Outline by dragging and from the row menu, also the hidden ones; the pages follow and each move is one undo step', async () => {
  await openFirstCvWithOutline()
  const original = ['Work experience', 'Education', 'Skills', 'Languages', 'Interests']
  await expect.poll(outlineNames).toEqual(original)

  await dragOnto(outlineHandle('Languages'), outlineRow('Work experience'))
  await expect.poll(outlineNames).toEqual(['Languages', 'Work experience', 'Education', 'Skills', 'Interests'])
  await expect.poll(pageSectionTitles).toEqual(['Languages', 'Work experience', 'Education', 'Skills'])

  // Ukryta sekcja też ma swoje miejsce w kolejności.
  await outlineHandle('Interests').click()
  await window.getByRole('menuitem', { name: 'Move up' }).click()
  await expect.poll(outlineNames).toEqual(['Languages', 'Work experience', 'Education', 'Interests', 'Skills'])
  await expect(outlineHandle('Interests')).toBeFocused()
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(outlineNames).toEqual(['Languages', 'Work experience', 'Interests', 'Education', 'Skills'])

  await window.keyboard.press('Meta+z')
  await expect.poll(outlineNames).toEqual(['Languages', 'Work experience', 'Education', 'Interests', 'Skills'])
  await window.keyboard.press('Meta+z')
  await expect.poll(outlineNames).toEqual(['Languages', 'Work experience', 'Education', 'Skills', 'Interests'])
  await window.keyboard.press('Meta+z')
  await expect.poll(outlineNames).toEqual(original)
  await expect.poll(pageSectionTitles).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
})

test('in a new CV the Outline marks the empty sections; “Add …” in a row menu puts the caret in the new entry on the page, and the consent clause is switched on from the Outline and edited on the page', async () => {
  await openNewCv()
  const nav = outline()
  await expect(nav.locator('.outline-section')).toHaveText([/^Work experienceempty$/, /^Educationempty$/, /^Skillsempty$/, /^Languagesempty$/])

  await outlineHandle('Work experience').click()
  await window.getByRole('menuitem', { name: 'Add position' }).click()
  // Nowy wpis odsłonięty na stronie razem z tytułem sekcji, kursor w stanowisku – bez karty.
  await expect(roleField('New position')).toBeFocused()
  await expect(window.locator('.preview .cv-page .cv-section-title')).toHaveText(['Work experience'])
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.type('Buyer')
  await expect(window.locator('.preview .cv-page .cv-role')).toHaveText(['Buyer'])
  await expect(outlineRow('Work experience')).toHaveText(/^Work experience1$/)

  // Wyłączona klauzula: klik w jej wiersz przenosi fokus na przełącznik; włączona – kursor w jej tekście na stronie.
  const consentSwitch = nav.getByRole('switch', { name: 'Show on CV' })
  await nav.getByRole('button', { name: 'Consent clause' }).click()
  await expect(consentSwitch).toBeFocused()
  await consentSwitch.check()
  await nav.getByRole('button', { name: 'Consent clause' }).click()
  await expect(consentField()).toBeFocused()
  await window.keyboard.type('I agree to the processing of my data.')
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveText('I agree to the processing of my data.')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await consentSwitch.uncheck()
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveCount(0)
  await expect(consentSwitch).not.toBeChecked()
})

test('the sidebar collapses to a rail and expands back to the panel it came from; Outline, CV form and rail are an app preference kept across restarts; Preview mode has no sidebar', async () => {
  await openFirstCvWithOutline()
  // Lokatory od bieżącego okna – po ponownym uruchomieniu aplikacji to inne okno.
  const panes = () => window.locator('.editor-panes')
  const rail = () => window.locator('.editor-rail')
  const form = () => window.locator('.editor-form')
  await panes().getByRole('button', { name: 'Collapse' }).click()
  await expect(rail()).toBeVisible()
  await expect(window.getByRole('complementary', { name: 'Sidebar' })).toBeVisible()
  expect((await rail().boundingBox())!.width).toBeCloseTo(44, 0)
  await expect(outline()).toHaveCount(0)
  await expect(panes().getByRole('button', { name: 'Expand' })).toBeFocused()
  await panes().getByRole('button', { name: 'Expand' }).click()
  await expect(outline()).toBeVisible()
  await expect(panes().getByRole('button', { name: 'Collapse' })).toBeFocused()

  // Z CV form: „Expand” wraca do CV form.
  await panes().getByRole('button', { name: 'Form', exact: true }).click()
  await expect(form()).toBeVisible()
  await expect(panes().getByRole('button', { name: 'Form', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(panes().getByRole('button', { name: 'Form', exact: true })).toBeFocused()
  await panes().getByRole('button', { name: 'Collapse' }).click()
  await panes().getByRole('button', { name: 'Expand' }).click()
  await expect(form()).toBeVisible()

  // Szyna zostaje po ponownym uruchomieniu; ikona Outline na szynie rozwija Outline.
  await panes().getByRole('button', { name: 'Collapse' }).click()
  await expect.poll(savedSidebar).toBe('collapsed')
  await app.close()
  await launch()
  await openFirstCvWithOutline()
  await expect(rail()).toBeVisible()
  await panes().getByRole('button', { name: 'Outline', exact: true }).click()
  await expect(outline()).toBeVisible()
  await expect.poll(savedSidebar).toBe('outline')
  await panes().getByRole('button', { name: 'Form', exact: true }).click()
  await expect.poll(savedSidebar).toBe('form')
  await app.close()
  await launch()
  await openFirstCvWithOutline()
  await expect(form()).toBeVisible()

  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(form()).toHaveCount(0)
  await expect(outline()).toHaveCount(0)
  await expect(rail()).toHaveCount(0)
})
