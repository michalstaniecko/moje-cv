import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

// Edycja na stronach CV (docs/specs/inline-editing-redesign.md, docs/specs/wysiwyg-editing.md): tryby Edit mode /
// Preview mode, Page fields, Field popovers i warstwa edycji.

let app: ElectronApplication
let window: Page
let outputDir: string

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych, angielski i jasny wygląd, okno w tle.
async function launch({ appearance }: { appearance?: 'light' | 'dark' } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
  if (appearance) env['MOJE_CV_APPEARANCE'] = appearance
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

// Otwiera pierwsze CV z biblioteki i rozwija pasek boczny do CV form: testy warstwy edycji sprawdzają w nim, że strony
// i formularz zmieniają to samo. Bez formularza (domyślnie zwinięty do szyny) – `openFirstCvWithPages`.
async function openFirstCv() {
  await openFirstCvWithPages()
  await showCvForm()
}

async function openFirstCvWithPages() {
  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.locator('.preview .cv-page').first()).toBeVisible()
}

// CV form w pasku bocznym: „Form” na szynie, jeśli pasek jest zwinięty (wybór zostaje na całą sesję aplikacji).
async function showCvForm() {
  const form = window.locator('.editor-form')
  await expect(form.or(window.locator('.editor-rail'))).toBeVisible()
  if (!(await form.isVisible())) await window.locator('.editor-rail').getByRole('button', { name: 'Form', exact: true }).click()
  await expect(form).toBeVisible()
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
  // Bez paska bocznego: strony zajmują panel edytora poza Inspektorem.
  const inspectorWidth = (await window.getByRole('complementary', { name: 'Inspector', exact: true }).boundingBox())!.width
  await expect
    .poll(async () => (await preview.boundingBox())!.width)
    .toBeCloseTo((await panes.boundingBox())!.width - inspectorWidth, 0)
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

const historyGroup = () => window.locator('.toolbar').getByRole('group', { name: 'Change history' })
const undoButton = () => historyGroup().getByRole('button', { name: 'Undo', exact: true })
const redoButton = () => historyGroup().getByRole('button', { name: 'Redo', exact: true })

test('Undo and Redo in the toolbar undo and redo a change made on the page in both modes, are disabled when there is nothing to undo or redo and show their shortcuts', async () => {
  await openFirstCvWithPages()
  // Na świeżo otwartym CV nie ma czego cofnąć ani ponowić: oba przyciski wyłączone (także dla czytnika ekranu).
  await expect(undoButton()).toBeDisabled()
  await expect(redoButton()).toBeDisabled()
  await expect(undoButton()).toHaveAttribute('title', 'Undo (⌘Z)')
  await expect(redoButton()).toHaveAttribute('title', 'Redo (⇧⌘Z)')
  await expect(undoButton()).toHaveAttribute('aria-keyshortcuts', 'Meta+Z')
  await expect(redoButton()).toHaveAttribute('aria-keyshortcuts', 'Meta+Shift+Z')

  // Zmiana na stronie: Cofnij ją cofa, Ponów przywraca.
  const name = pageField('Full name')
  await clickAtCharacter(name, 4)
  await window.keyboard.type(' X')
  await expect(pageName()).toHaveText('Jane X Example')
  await expect(undoButton()).toBeEnabled()
  await expect(redoButton()).toBeDisabled()
  await undoButton().click()
  await expect(pageName()).toHaveText('Jane Example')
  await expect(undoButton()).toBeDisabled()
  await expect(redoButton()).toBeEnabled()
  await redoButton().click()
  await expect(pageName()).toHaveText('Jane X Example')
  await expect(undoButton()).toBeEnabled()
  await expect(redoButton()).toBeDisabled()

  // To samo w Preview mode.
  await previewButton().click()
  await undoButton().click()
  await expect(pageName()).toHaveText('Jane Example')
  await expect(redoButton()).toBeEnabled()
  await redoButton().click()
  await expect(pageName()).toHaveText('Jane X Example')
  await expect(redoButton()).toBeDisabled()

  // Przy minimalnej szerokości okna (960 px) pasek narzędzi zostaje w jednym wierszu, w obu trybach.
  await app.evaluate(({ BrowserWindow }) => {
    const [browserWindow] = BrowserWindow.getAllWindows()
    browserWindow!.setSize(960, browserWindow!.getSize()[1]!)
  })
  // Jeden wiersz: każdy element zaczyna się wyżej, niż kończy się którykolwiek inny.
  const inOneRow = () =>
    window.locator('.editor-toolbar > *').evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect())
      return Math.max(...boxes.map((box) => box.top)) < Math.min(...boxes.map((box) => box.bottom))
    })
  await expect.poll(inOneRow).toBe(true)
  await editButton().click()
  await expect.poll(inOneRow).toBe(true)
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

// ---------- Warstwa edycji ----------

// Klik w miejsce na stronie, jak użytkownik: współrzędnymi, a nie w element strony (nad stronami leży warstwa edycji).
async function clickOnPage(element: Locator) {
  await element.scrollIntoViewIfNeeded()
  const box = (await element.boundingBox())!
  await window.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

// Przycisk zdjęcia w warstwie edycji (otwiera Field popover zdjęcia, S4).
// Region `aria-live` warstwy edycji: komunikaty o zmianach struktury z menu uchwytu i z klawiatury w polach (W22).
const announcement = () => window.locator('.edit-layer [aria-live]')
const photoButton = () => window.locator('.edit-layer .edit-photo').and(window.getByRole('button', { name: 'Photo', exact: true }))
const photoPopover = () => window.getByRole('dialog', { name: 'Photo', exact: true })
// Tekst klauzuli zgody na stronie (Page field) i pasek klauzuli nad nią (S4).
const consentField = () => window.locator('.preview .cv-pages').getByRole('textbox', { name: 'Consent clause', exact: true })
const consentToolbar = () => window.getByRole('toolbar', { name: 'Consent clause', exact: true })
const positions = ['Senior Procurement Specialist', 'Procurement Specialist', 'Procurement Assistant', 'Junior Customer Service Specialist']
const educations = ['Postgraduate diploma, Procurement Management', 'Master’s degree, Logistics']
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
    // W pierwszej ćwierci znaku (a nie 1 px od lewej): przy stronach pomniejszonych do szerokości panelu wąski znak
    // (spacja) ma mniej niż 2 px i klik za jego połową stawiałby kursor za nim.
    const at = () => {
      const rect = range.getBoundingClientRect()
      return { x: rect.left + rect.width / 4, y: rect.top + rect.height / 2 }
    }
    // Znak przykryty paskiem podglądu (pole tuż pod górną krawędzią panelu stron): pole na środek panelu.
    const { x, y } = at()
    if (!element.contains(element.ownerDocument.elementFromPoint(x, y))) element.scrollIntoView({ block: 'center' })
    return at()
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
  const picker = window.locator('.editor-form').getByRole('radiogroup', { name: 'Template' })
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

test('the pages work from the keyboard alone: Tab goes through every page field and date in document order, also into the joined lines of entries and contacts, then to the photo and the “Add to CV” bar, past the handles and pills; Enter opens the photo popover, Tab leaves it', async () => {
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

  // Warstwa edycji: w kolejności Tab tylko przycisk zdjęcia i pasek „Add to CV”. Uchwyty i pigułki „+” są poza nią
  // (W22) – ich akcje daje z klawiatury Shift+F10 w polu.
  await expect(photoButton()).toBeVisible()
  const outOfTabOrder = window.locator('.edit-layer .edit-handle .row-handle, .edit-layer .edit-pill')
  expect(await outOfTabOrder.count()).toBeGreaterThan(10)
  expect(new Set(await outOfTabOrder.evaluateAll((elements) => elements.map((element) => element.getAttribute('tabindex'))))).toEqual(
    new Set(['-1'])
  )
  const stops = window.locator('.edit-layer .edit-photo, .edit-layer .add-to-cv button')
  const stopNames = await stops.evaluateAll((elements) => elements.map((element) => element.textContent || element.getAttribute('aria-label')))
  expect(stopNames).toEqual(['Photo', 'Consent clause'])
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
  await expect(window.locator('.edit-layer')).toHaveCount(0)
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
  test(`page fields: every field of the Sample CV in the ${template} template is edited on the page (Page fields, date and photo popovers), and the contacts, section titles and entries have their handles`, async () => {
    await openFirstCv()
    const preview = window.locator('.preview')
    const picker = window.locator('.editor-form').getByRole('radiogroup', { name: 'Template' })
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

    // Zdjęcie ma przycisk nad sobą w warstwie edycji.
    const photoBox = (await page('.cv-photo').boundingBox())!
    const buttonBox = (await photoButton().boundingBox())!
    const [x, y] = [photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2]
    expect(x >= buttonBox.x && x <= buttonBox.x + buttonBox.width && y >= buttonBox.y && y <= buttonBox.y + buttonBox.height).toBe(true)
    await expect(page('.cv-consent').getByRole('textbox', { name: 'Consent clause', exact: true })).toHaveText('I agree to the processing of my personal data.')
    // Uchwyty menu: kontakty, tytuły sekcji i wpisy (z klasami kontraktu znaczników edycji), w marginesie przed nimi.
    const handleNames = await window
      .locator('.edit-layer .edit-handle .row-handle')
      .evaluateAll((handles) => handles.map((handle) => handle.getAttribute('aria-label')))
    expect(new Set(handleNames)).toEqual(
      new Set([
        'Actions for contacts',
        ...titles.map((title) => `Actions for section “${title}”`),
        ...positions.map((role) => `Actions for position “${role}”`),
        ...educations.map((name) => `Actions for entry “${name}”`)
      ])
    )
    const contactsBox = (await preview.locator('.cv-page .cv-contact').boundingBox())!
    expect((await handle('contacts').boundingBox())!.x + 24).toBeLessThanOrEqual(contactsBox.x)

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

// ---------- Pomocniki: przeciąganie ----------

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
  // Czytnik ekranu słyszy każdą zmianę struktury (W22).
  await expect(announcement()).toHaveText('New bullet 4.')

  // Backspace na początku łączy z poprzednim; kursor w miejscu złączenia.
  await window.keyboard.press('Backspace')
  await expect(bulletField(3)).toHaveText(third)
  await expect(bulletField(4)).toHaveText(fourth)
  await expect(announcement()).toHaveText('Joined with bullet 3.')
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
  await expect(announcement()).toHaveText('Removed bullet 4.')

  // Cofnięcie podziału, gdy kursor jest w nowym punkcie: punktu już nie ma, kursor na końcu poprzedniego (W19).
  await window.keyboard.press('Enter')
  await expect(bulletField(4)).toHaveText('')
  await window.keyboard.press('Meta+z')
  await expect(bulletField(4)).toHaveText(fourth)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: third.length, collapsed: true })

  // Delete na końcu łączy z następnym.
  await window.keyboard.press('Delete')
  await expect(bulletField(3)).toHaveText(third + fourth)
  await expect(announcement()).toHaveText('Joined with bullet 4.')
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b3', offset: third.length, collapsed: true })
  await window.keyboard.press('Meta+z')
  await expect(bulletField(4)).toHaveText(fourth)

  // ⌥⇧↑ przenosi punkt; kursor zostaje w nim.
  await clickAtCharacter(bulletField(3), 2)
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect(bulletField(2)).toHaveText(third)
  await expect(bulletField(2)).toBeFocused()
  await expect(announcement()).toHaveText('Moved bullet 3 to position 2 of 8.')
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
  await expect(announcement()).toHaveText(`Moved position “${positions[1]}” to position 1 of 4.`)
  await window.keyboard.press('Meta+z')
  await expect.poll(positionNames).toEqual(positions)

  // Shift+F10 – menu uchwytu wpisu.
  await clickAtCharacter(roleField(positions[1]), 3)
  await window.keyboard.press('Shift+F10')
  await expect(blockMenu(`position “${positions[1]}”`).getByRole('menuitem', { name: 'Move up' })).toBeFocused()
  // Escape wraca do pola, z którego otwarto menu, w to samo miejsce.
  await window.keyboard.press('Escape')
  await expect(roleField(positions[1])).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'experience:e2:role', offset: 3, collapsed: true })
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

test('Escape leaves a page field, a date or a joined line for the pages panel: a cleared field leaves the page with it, and the arrow keys then scroll the pages', async () => {
  await openFirstCv()
  const pages = window.getByRole('main', { name: 'CV pages', exact: true })
  const roleOnPage = window.locator('.preview .cv-pages [data-block-id="e2"] .cv-role')

  // Wyczyszczone stanowisko ma placeholder, dopóki wpis ma fokus; Escape – fokus na panelu stron, pole znika ze strony.
  await clickAtCharacter(roleField(positions[1]), 2)
  await window.keyboard.press('Meta+a')
  await window.keyboard.press('Backspace')
  await expect(roleField('New position')).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(pages).toBeFocused()
  await expect(roleOnPage).toHaveCount(0)
  await expect(window.locator('.preview [contenteditable]:focus')).toHaveCount(0)
  // Strzałki przewijają panel stron.
  const scrollTop = () => pages.evaluate((element) => element.scrollTop)
  const before = await scrollTop()
  await window.keyboard.press('ArrowDown')
  await window.keyboard.press('PageDown')
  await expect.poll(scrollTop).toBeGreaterThan(before)
  await window.keyboard.press('Meta+z')
  await expect(roleOnPage).toHaveText(positions[1])

  // Żeton daty (bez otwartego popovera) i linia złączona (kontakt w Classic) – tak samo.
  await clickAtCharacter(roleField(positions[0]), 2)
  await window.keyboard.press('Shift+Tab')
  await expect.poll(focusedKey).toBe('experience:e1:end')
  await window.keyboard.press('Escape')
  await expect(pages).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await pages.evaluate((element) => element.scrollTo({ top: 0 }))
  const email = window.locator('.preview .cv-pages [data-joined*="contact:c2:value"]')
  await email.focus()
  await expect.poll(focusedKey).toBe('contact:c2:label')
  await window.keyboard.press('Escape')
  await expect(pages).toBeFocused()
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
  // Cofnięcie dodania: wpisu nie ma, fokus przechodzi w bezpieczne miejsce – w Inspektorze, który dalej pokazuje panel
  // sekcji, na „‹ Document”.
  await window.keyboard.press('Meta+z')
  await expect(roleField('New position')).toHaveCount(0)
  await expect(form.getByLabel('Job title')).toHaveCount(4)
  await expect(panelTitle()).toHaveText('Work experience')
  await expect(backToDocument()).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

// ---------- Zdjęcie, kontakty i klauzula na stronie (docs/specs/wysiwyg-editing.md, S4) ----------

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
  await expect(popover.getByRole('button')).toHaveText(['Change photo', 'Crop photo', 'Hide photo', 'Remove photo'])
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
  await expect(announcement()).toHaveText('New contact 3.')
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
  await expect(announcement()).toHaveText('Removed contact 3.')
  await window.keyboard.press('Meta+z')
  await expect(formValues).toHaveCount(5)

  // Po wyjściu z kontaktów pusty kontakt znika ze strony (zostaje w danych), a linie są znowu jednym napisem.
  await clickAtCharacter(pageField('Full name'), 1)
  await expect(contacts).toHaveCount(4)
  await expect(email.locator('[data-joined]')).toHaveCount(1)
  await expect(formValues).toHaveCount(5)
})

test('the contacts handle menu removes a contact, named by its label or else its value: “Removed.” with Undo, the caret goes to the next contact or else the previous one; each removal is one undo step', async () => {
  await openFirstCv()
  const contacts = window.locator('.preview .cv-page .cv-contact > *')
  const formValues = window.locator('.editor-form').getByLabel(/^Contact value \d$/)
  const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
  const menu = blockMenu('contacts')

  // Pod „Add contact”, za kreską, po jednej pozycji usuwania na kontakt.
  await handle('contacts').click()
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Add contact',
    'Remove contact: Phone',
    'Remove contact: Email',
    'Remove contact: LinkedIn',
    'Remove contact: City'
  ])
  await expect(menu.getByRole('separator')).toHaveCount(1)

  // Środkowy kontakt znika ze strony i z formularza, kursor w następnym kontakcie.
  await menu.getByRole('menuitem', { name: 'Remove contact: Email' }).click()
  await expect(contacts).toHaveText(['Phone: +44 7700 900000', 'LinkedIn: linkedin.com/in/jane-example', 'City: Manchester'])
  await expect(formValues).toHaveCount(3)
  await expect(removed).toBeVisible()
  await expect.poll(async () => (await caret())?.key).toBe('contact:c3:value')

  // „Undo” przywraca kontakt na jego miejscu z kursorem w nim.
  await removed.getByRole('button', { name: 'Undo' }).click()
  await expect(formValues).toHaveCount(4)
  await expect(contacts.nth(1)).toHaveText('Email: jane.example@example.com')
  await expect.poll(async () => (await caret())?.key).toBe('contact:c2:value')
  await expect(removed).toHaveCount(0)

  // Kontakt bez etykiety ma w menu swoją wartość; usunięcie ostatniego – kursor w poprzednim; Cmd+Z cofa jednym krokiem.
  await formField('Contact label 4').fill('')
  await handle('contacts').click()
  await expect(menu.getByRole('menuitem').last()).toHaveText('Remove contact: Manchester')
  await menu.getByRole('menuitem', { name: 'Remove contact: Manchester' }).click()
  await expect(formValues).toHaveCount(3)
  await expect.poll(async () => (await caret())?.key).toBe('contact:c3:value')
  await window.keyboard.press('Meta+z')
  await expect(formValues).toHaveCount(4)
  await expect(formField('Contact value 4')).toHaveValue('Manchester')
})

test('Alt+Shift+arrows in a contact label or value move the contact; the caret stays in the field, at the end the keys do nothing; each move is one undo step', async () => {
  await openFirstCv()
  const contacts = window.locator('.preview .cv-page .cv-contact > *')
  const email = contacts.nth(1)
  await clickAtCharacter(email.locator('[data-joined]'), 'Email: jane'.length)
  await expect.poll(caret).toEqual({ key: 'contact:c2:value', offset: 'jane'.length, collapsed: true })
  await window.keyboard.type('x')

  // ⌥⇧↓ w wartości: kontakt o jedną pozycję niżej, kursor zostaje w tym samym miejscu tego samego pola.
  await window.keyboard.press('Alt+Shift+ArrowDown')
  await expect(pageField('Contact value 3')).toHaveText('janex.example@example.com')
  await expect(pageField('Contact value 3')).toBeFocused()
  await expect(labelField(2)).toHaveText('LinkedIn')
  await expect(announcement()).toHaveText('Moved contact 2 to position 3 of 4.')
  await expect.poll(caret).toEqual({ key: 'contact:c2:value', offset: 'janex'.length, collapsed: true })
  await expect(formField('Contact value 3')).toHaveValue('janex.example@example.com')

  // ⌥⇧↑ w etykiecie – wyżej; na górze listy – nic.
  await window.keyboard.press('Meta+ArrowLeft')
  await window.keyboard.press('ArrowLeft')
  await expect.poll(caret).toEqual({ key: 'contact:c2:label', offset: 'Email'.length, collapsed: true })
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect(labelField(1)).toHaveText('Email')
  await expect(announcement()).toHaveText('Moved contact 2 to position 1 of 4.')
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect(labelField(1)).toHaveText('Email')
  await expect.poll(caret).toEqual({ key: 'contact:c2:label', offset: 'Email'.length, collapsed: true })

  // Cofanie: każde przeniesienie osobno, potem wpisany znak (nie łączy się z przeniesieniem).
  await window.keyboard.press('Meta+z')
  await expect(labelField(2)).toHaveText('Email')
  await window.keyboard.press('Meta+z')
  await expect(labelField(3)).toHaveText('Email')
  await window.keyboard.press('Meta+z')
  await expect(labelField(2)).toHaveText('Email')
  await expect(pageField('Contact value 2')).toHaveText('janex.example@example.com')
  await window.keyboard.press('Meta+z')
  await expect(pageField('Contact value 2')).toHaveText('jane.example@example.com')
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

  // Escape przy otwartej liście chowa tylko listę; drugi Escape wychodzi z pola na panel stron.
  await label5.focus()
  await window.keyboard.press('Meta+ArrowRight')
  await window.keyboard.press('Backspace')
  await expect(list.getByRole('option')).not.toHaveCount(0)
  await window.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  await expect(label5).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(window.getByRole('main', { name: 'CV pages', exact: true })).toBeFocused()
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

// ---------- Inspector: panel „Dokument” z CV design ----------

const inspector = () => window.getByRole('complementary', { name: 'Inspector', exact: true })
const inspectorGroup = (name: string) => inspector().getByRole('button', { name, exact: true })
const accentSwatches = () => inspector().getByRole('radiogroup', { name: 'Accent color', exact: true })
const customColor = () => inspector().getByLabel('Custom color', { exact: true })
const fontCards = () => inspector().getByRole('radiogroup', { name: 'Font', exact: true })
const inspectorTemplates = () => inspector().getByRole('radiogroup', { name: 'Template', exact: true })
const inspectorLanguage = () => inspector().getByRole('combobox', { name: 'CV language', exact: true })

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

test('the Inspector beside the pages shows the Document panel with the Template, Style and Language groups in both modes, and the toolbar has no CV design button', async () => {
  await openFirstCvWithPages()
  await expect(window.locator('.toolbar').getByRole('button', { name: 'CV design' })).toHaveCount(0)
  await expect(window.getByRole('dialog', { name: 'CV design' })).toHaveCount(0)

  const panel = inspector()
  await expect(panel.getByRole('heading', { name: 'Document', exact: true })).toBeVisible()
  for (const group of ['Template', 'Style', 'Language']) await expect(inspectorGroup(group)).toHaveAttribute('aria-expanded', 'true')
  await expect(inspectorTemplates().getByRole('radio', { name: 'Classic' })).toBeChecked()
  await expect(accentSwatches().getByRole('radio', { name: 'Teal', exact: true })).toBeChecked()
  await expect(accentSwatches().getByRole('radio')).toHaveCount(8)
  await expect(customColor()).toHaveValue('#1a6e72')
  await expect(fontCards().getByRole('radio', { name: 'Lato' })).toBeChecked()
  // Karta fontu jest pisana swoim krojem.
  await expect(panel.locator('label', { has: window.getByRole('radio', { name: 'Arimo' }) })).toHaveCSS('font-family', /Arimo/)
  await expect(inspectorLanguage()).toHaveValue('en')
  await expect(inspectorLanguage()).toHaveAccessibleDescription(/such as “present”.*isn’t translated/)

  // Kolumna po prawej stronie stron, na całą wysokość panelu edytora.
  const pagesBox = (await window.locator('.preview').boundingBox())!
  const inspectorBox = (await panel.boundingBox())!
  expect(inspectorBox.x).toBeGreaterThanOrEqual(pagesBox.x + pagesBox.width - 1)
  expect(Math.round(inspectorBox.height)).toBe(Math.round(pagesBox.height))

  // Preview mode: Inspector zostaje, z tymi samymi grupami.
  await previewButton().click()
  await expectPreviewMode()
  await expect(panel.getByRole('heading', { name: 'Document', exact: true })).toBeVisible()
  await expect(inspectorTemplates()).toBeVisible()
  await expect(fontCards()).toBeVisible()
  await expect(inspectorLanguage()).toBeVisible()
})

test('Inspector groups collapse and stay collapsed when switching modes and reopening a CV', async () => {
  await openFirstCvWithPages()
  await inspectorGroup('Style').click()
  await expect(inspectorGroup('Style')).toHaveAttribute('aria-expanded', 'false')
  await expect(fontCards()).toBeHidden()
  await expect(accentSwatches()).toBeHidden()
  await expect(inspectorTemplates()).toBeVisible()
  // Klawiatura: Enter na nagłówku grupy zwija ją i rozwija.
  await inspectorGroup('Language').focus()
  await window.keyboard.press('Enter')
  await expect(inspectorGroup('Language')).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectorLanguage()).toBeHidden()

  await previewButton().click()
  await expectPreviewMode()
  await expect(inspectorGroup('Style')).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectorGroup('Language')).toHaveAttribute('aria-expanded', 'false')

  await window.getByRole('button', { name: '← CV library' }).click()
  await openFirstCvWithPages()
  await expect(inspectorGroup('Style')).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectorGroup('Language')).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectorGroup('Template')).toHaveAttribute('aria-expanded', 'true')
  await inspectorGroup('Style').click()
  await expect(fontCards()).toBeVisible()
})

test('changing the Template, the accent colour (swatch and custom), the font and the CV language in the Inspector changes the pages and the PDF at once, and Cmd+Z undoes each in one step', async () => {
  await openFirstCvWithPages()
  const preview = window.locator('.preview')

  // Kolor akcentu (w Classic imię jest w kolorze akcentu): próbka, potem własny kolor.
  await accentSwatches().getByRole('radio', { name: 'Crimson', exact: true }).click()
  await expect(pageName()).toHaveCSS('color', 'rgb(163, 36, 59)')
  await expect(accentSwatches().getByRole('radio', { name: 'Crimson', exact: true })).toBeChecked()
  // Własny kolor: przeciąganie w wyborze koloru to jeden krok cofania (ten sam klucz łączenia co dotąd).
  await customColor().fill('#8a2be1')
  await customColor().fill('#8a2be2')
  await expect(pageName()).toHaveCSS('color', 'rgb(138, 43, 226)')
  await expect(accentSwatches().getByRole('radio', { checked: true })).toHaveCount(0)

  await fontCards().locator('label', { has: window.getByRole('radio', { name: 'Arimo' }) }).click()
  await expect(fontCards().getByRole('radio', { name: 'Arimo' })).toBeChecked()
  await expect(pageName()).toHaveCSS('font-family', /^"?Arimo/)

  await inspectorLanguage().selectOption('pl')
  await expect(preview.locator('.cv')).toHaveAttribute('lang', 'pl')
  await expect(preview.locator('.cv-page .cv-date').first()).toHaveText('03.2023 – obecnie')

  await inspectorTemplates().locator('label', { has: window.getByRole('radio', { name: 'Modern' }) }).click()
  await expect(inspectorTemplates().getByRole('radio', { name: 'Modern' })).toBeChecked()
  await expect(preview.locator('.cv.cv-template-modern')).toHaveCount(1)
  await expect(window.getByText('Changes saved')).toBeVisible()

  // Wszystko od razu w PDF.
  const pdfPath = join(outputDir, 'inspector.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: inspector.pdf')).toBeVisible()
  expect(await pdfText(pdfPath)).toContain('03.2023 – obecnie')
  expect(await pdfFillColors(pdfPath)).toContain('#8a2be2')

  // Każda zmiana to jeden krok cofania – także z fokusem w Inspektorze.
  await inspectorLanguage().focus()
  await window.keyboard.press('Meta+z')
  await expect(preview.locator('.cv.cv-template-classic')).toHaveCount(1)
  await expect(inspectorTemplates().getByRole('radio', { name: 'Classic' })).toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(preview.locator('.cv')).toHaveAttribute('lang', 'en')
  await expect(inspectorLanguage()).toHaveValue('en')
  await window.keyboard.press('Meta+z')
  await expect(pageName()).not.toHaveCSS('font-family', /^"?Arimo/)
  await expect(fontCards().getByRole('radio', { name: 'Lato' })).toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveCSS('color', 'rgb(163, 36, 59)')
  await expect(customColor()).toHaveValue('#a3243b')
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveCSS('color', 'rgb(26, 110, 114)')
  await expect(accentSwatches().getByRole('radio', { name: 'Teal', exact: true })).toBeChecked()
  await window.keyboard.press('Meta+Shift+z')
  await expect(pageName()).toHaveCSS('color', 'rgb(163, 36, 59)')

  // Preview mode: te same zmiany działają na czystych stronach.
  await previewButton().click()
  await expectPreviewMode()
  await accentSwatches().getByRole('radio', { name: 'Green', exact: true }).click()
  await expect(pageName()).toHaveCSS('color', 'rgb(46, 107, 52)')
  await window.keyboard.press('Meta+z')
  await expect(pageName()).toHaveCSS('color', 'rgb(163, 36, 59)')
})

test('the Inspector follows the light and the dark appearance, while its Template thumbnails stay white paper', async () => {
  for (const [appearance, panelBackground, text] of [
    ['light', 'rgb(255, 255, 255)', 'rgb(28, 39, 51)'],
    ['dark', 'rgb(24, 34, 46)', 'rgb(230, 237, 245)']
  ] as const) {
    await app.close()
    await launch({ appearance })
    await openFirstCvWithPages()
    const panel = inspector()
    await expect(panel).toHaveCSS('background-color', panelBackground)
    await expect(panel).toHaveCSS('color', text)
    await expect(panel).toHaveCSS('color-scheme', 'light dark')
    await expect(panel.locator('.template-thumbnail').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  }
})

// ---------- Menu fragmentu na stronie ----------

const handle = (name: string) => window.locator('.edit-layer').getByRole('button', { name: `Actions for ${name}`, exact: true })
const blockMenu = (name: string) => window.getByRole('menu', { name: `Actions for ${name}`, exact: true })
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

  // Wpis: nowa strona przed stanowiskiem, jak pole wyboru w CV form.
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

  // Wykształcenie dodane i zostawione puste: odsłonięte tylko, dopóki ma kursor – po wyjściu znika ze strony
  // (zostaje w danych, jak w CV form), a strony dzielą się jak w Preview mode.
  const split = await pageSplit()
  await handle('section “Education”').click()
  await blockMenu('section “Education”').getByRole('menuitem', { name: 'Add education' }).click()
  const level = pageField('Level – Education “New education”')
  await expect(level).toBeFocused()
  expect(await placeholderOf(level)).toBe('"Level"')
  await expect(form.getByLabel('Level')).toHaveCount(3)
  await clickAtCharacter(pageField('Full name'), 0)
  await expect(level).toHaveCount(0)
  await expect(form.getByLabel('Level')).toHaveCount(3)
  await expect.poll(pageSplit).toEqual(split)
})

test('the menu works from the keyboard alone: Shift+F10 in a field opens the menu of its handle, Escape and every change come back to the field; the contacts have “Add contact”; there are no handles below 50% zoom', async () => {
  await openFirstCv()
  const title = titleField('Education')
  await clickAtCharacter(title, 3)
  await expect(handleBox('section “Education”')).toHaveCSS('opacity', '1')
  await window.keyboard.press('Shift+F10')
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
  await expect(title).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:education:title', offset: 3, collapsed: true })

  // Przeniesienie z menu otwartego z pola: kursor zostaje w polu, w tym samym miejscu; komunikat jak z uchwytu.
  await window.keyboard.press('Shift+F10')
  await window.keyboard.press('Enter')
  await expect.poll(sectionTitles).toEqual(['Education', 'Work experience', 'Skills', 'Languages'])
  await expect(title).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:education:title', offset: 3, collapsed: true })
  await expect(announcement()).toHaveText('Moved section “Education” to position 1 of 4.')
  await window.keyboard.press('Meta+z')

  // „Add education” – kursor w nowym wpisie. Fokus z klawiatury: przy stronach pomniejszonych obok Inspektora pigułka
  // „+ Position” poprzedniej sekcji zachodzi na początek tytułu.
  await title.focus()
  await window.keyboard.press('ContextMenu')
  await window.keyboard.press('End')
  await window.keyboard.press('Enter')
  await expect(pageField('Level – Education “New education”')).toBeFocused()

  // Kontakty w nagłówku: Shift+F10 w kontakcie – menu pola kontaktu: „Move contact … up/down”, za kreską pozycje menu
  // uchwytu kontaktów od „Add contact”; nowy kontakt z kursorem w jego etykiecie.
  await clickAtCharacter(window.locator('.preview .cv-pages [data-joined*="contact:c2:value"]'), 'Email: jane'.length)
  await window.keyboard.press('Shift+F10')
  const contactMenu = window.getByRole('menu', { name: 'Actions for contact 2', exact: true })
  await expect(contactMenu.getByRole('menuitem').nth(2)).toHaveText('Add contact')
  await window.keyboard.press('ArrowDown')
  await window.keyboard.press('ArrowDown')
  await expect(contactMenu.getByRole('menuitem', { name: 'Add contact' })).toBeFocused()
  await window.keyboard.press('Enter')
  await expect(labelField(5)).toBeFocused()
  await expect(window.locator('.editor-form').getByLabel(/^Contact value \d$/)).toHaveCount(5)
  await window.keyboard.press('Meta+z')
  await expect(window.locator('.editor-form').getByLabel(/^Contact value \d$/)).toHaveCount(4)

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

// Menu pola punktu, elementu listy i kontaktu (docs/specs/outline-instead-of-cv-form.md, D6).
const fieldMenu = (name: string) => window.getByRole('menu', { name: `Actions for ${name}`, exact: true })

test('a right-click or Shift+F10 in a bullet, a list item or a contact opens its menu: “Move … up/down” with the shortcut moves it like Alt+Shift+arrows, disabled at the end of the list; the caret stays in the field and each move is one undo step', async () => {
  await openFirstCvWithPages()
  const bullets = window.locator('.preview .cv-pages [data-field-key^="experience:e1:bullet:"]')
  const before = await bullets.allTextContents()
  const third = before[2]!

  // Prawy przycisk myszy w środkowym punkcie: jego przeniesienia ze skrótem, za kreską menu uchwytu wpisu.
  await bulletField(3).click({ button: 'right' })
  const menu = fieldMenu('bullet 3')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Move bullet 3 up', exact: true })).toBeFocused()
  await expect(menu.getByRole('menuitem', { name: 'Move bullet 3 down', exact: true })).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Move bullet 3 down', exact: true })).toContainText('⌥⇧↓')
  await expect(menu.getByRole('menuitem', { name: 'Move up', exact: true })).toBeVisible()
  await expect(menu.getByRole('menuitemcheckbox', { name: 'New page before this entry' })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Move bullet 3 down', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(bullets).toHaveText([...before.slice(0, 2), before[3]!, third, ...before.slice(4)])
  await expect(bulletField(4)).toBeFocused()
  await expect.poll(async () => (await caret())?.key).toBe('experience:e1:bullet:e1-b3')
  await expect(announcement()).toHaveText('Moved bullet 3 to position 4 of 8.')
  await window.keyboard.press('Meta+z')
  await expect(bullets).toHaveText(before)

  // Shift+F10 w pierwszym punkcie: „Move … up” wyłączone, fokus na „Move … down”; Escape wraca do pola w to samo miejsce.
  await clickAtCharacter(bulletField(1), 4)
  await window.keyboard.press('Shift+F10')
  const first = fieldMenu('bullet 1')
  await expect(first.getByRole('menuitem', { name: 'Move bullet 1 up', exact: true })).toBeDisabled()
  await expect(first.getByRole('menuitem', { name: 'Move bullet 1 down', exact: true })).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(first).toHaveCount(0)
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b1', offset: 4, collapsed: true })
  // Enter na „Move … down”: punkt niżej, kursor w nim w tym samym miejscu.
  await window.keyboard.press('Shift+F10')
  await window.keyboard.press('Enter')
  await expect(bullets).toHaveText([before[1]!, before[0]!, ...before.slice(2)])
  await expect.poll(caret).toEqual({ key: 'experience:e1:bullet:e1-b1', offset: 4, collapsed: true })
  await expect(announcement()).toHaveText('Moved bullet 1 to position 2 of 8.')
  await window.keyboard.press('Meta+z')
  await expect(bullets).toHaveText(before)

  // Element listy: ostatni ma wyłączone „Move … down”; lista nie ma uchwytu, więc w menu są tylko przeniesienia.
  await clickAtCharacter(itemField(2), 2)
  await window.keyboard.press('Shift+F10')
  const item = fieldMenu('item 2')
  await expect(item.getByRole('menuitem')).toHaveCount(2)
  await expect(item.getByRole('menuitem', { name: 'Move item 2 down', exact: true })).toBeDisabled()
  await window.keyboard.press('Enter')
  await expect(itemField(1)).toHaveText('German – B2')
  await expect(itemField(1)).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'list:l2:text', offset: 2, collapsed: true })
  await expect(announcement()).toHaveText('Moved item 2 to position 1 of 2.')

  // Kontakt: za przeniesieniami menu uchwytu kontaktów; przeniesienie z menu otwartego prawym przyciskiem.
  await clickAtCharacter(window.locator('.preview .cv-pages [data-joined*="contact:c2:value"]'), 'Email: jane'.length)
  await expect.poll(caret).toEqual({ key: 'contact:c2:value', offset: 'jane'.length, collapsed: true })
  await pageField('Contact value 2').click({ button: 'right' })
  const contact = fieldMenu('contact 2')
  await expect(contact.getByRole('menuitem', { name: 'Add contact' })).toBeVisible()
  await contact.getByRole('menuitem', { name: 'Move contact 2 down', exact: true }).click()
  await expect(labelField(3)).toHaveText('Email')
  await expect(pageField('Contact value 3')).toBeFocused()
  await expect(announcement()).toHaveText('Moved contact 2 to position 3 of 4.')
  await window.keyboard.press('Meta+z')
  await expect(labelField(2)).toHaveText('Email')

  // W polu bez menu pola (stanowisko) prawy przycisk otwiera menu uchwytu wpisu, jak Shift+F10.
  await roleField(positions[0]).click({ button: 'right' })
  await expect(blockMenu(`position “${positions[0]}”`)).toBeVisible()
  await window.keyboard.press('Escape')
  await expect(roleField(positions[0])).toBeFocused()

  // Kontakt poza aktywnym fragmentem (w Classic jedna linia „etykieta: wartość”): prawy przycisk – menu tego kontaktu.
  await window.locator('.preview .cv-pages [data-joined*="contact:c3:value"]').click({ button: 'right' })
  const linkedIn = fieldMenu('contact 3')
  await linkedIn.getByRole('menuitem', { name: 'Move contact 3 up', exact: true }).click()
  await expect(labelField(2)).toHaveText('LinkedIn')
  await expect.poll(async () => (await caret())?.key).toMatch(/^contact:c3:/)
  await expect(announcement()).toHaveText('Moved contact 3 to position 2 of 4.')
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

test('“Photo” in the “Add to CV” bar opens the file picker at once: a file that cannot be loaded is reported in a popover at the button, a cancelled crop returns the focus to the button, and an applied one focuses the photo', async () => {
  await openNewCv()
  const barPhoto = addBar().getByRole('button', { name: 'Photo', exact: true })
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })

  // Wybór pliku anulowany – nic się nie dzieje.
  await stubOpenDialog(null)
  await barPhoto.click()
  await expect(barPhoto).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)

  // Plik, którego nie da się wczytać: Field popover przy przycisku paska z komunikatem; Escape wraca na przycisk.
  const brokenPath = join(outputDir, 'broken.jpg')
  await writeFile(brokenPath, 'not an image')
  await stubOpenDialog(brokenPath)
  await barPhoto.click()
  const popover = window.getByRole('dialog', { name: 'Photo', exact: true })
  await expect(popover.getByRole('alert')).toHaveText('Couldn’t load the photo – the file is damaged, unavailable or in an unsupported format.')
  await expect(popover.getByRole('button', { name: 'Choose photo' })).toBeFocused()
  const [popoverBox, buttonBox] = [(await popover.boundingBox())!, (await barPhoto.boundingBox())!]
  expect(popoverBox.y >= buttonBox.y + buttonBox.height || popoverBox.y + popoverBox.height <= buttonBox.y).toBe(true)
  await window.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)
  await expect(barPhoto).toBeFocused()

  // Ponowny wybór z popovera; anulowane kadrowanie – fokus wraca na przycisk paska, zdjęcia nie ma.
  await barPhoto.click()
  await expect(popover.getByRole('alert')).toBeVisible()
  await stubOpenDialog(await writeRedBluePhoto())
  await popover.getByRole('button', { name: 'Choose photo' }).click()
  await expect(popover).toHaveCount(0)
  await cropper.getByRole('button', { name: 'Cancel' }).click()
  await expect(cropper).toHaveCount(0)
  await expect(barPhoto).toBeFocused()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(0)

  // Zatwierdzony kadr: zdjęcie na stronie, przycisk paska znika, fokus na przycisku zdjęcia; jeden krok cofania.
  await barPhoto.click()
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(1)
  await expect(barPhoto).toHaveCount(0)
  await expect(photoButton()).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(0)
  await expect(barPhoto).toHaveCount(1)
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

  // Pigułki listy i wykształcenia – poza kolejnością Tab (W22; z klawiatury „Add item” w menu tytułu sekcji).
  const item = pill('Item').first()
  await expect(item).toHaveAttribute('tabindex', '-1')
  await itemField(1, 'Skills').hover()
  await expect(item).toHaveCSS('opacity', '1')
  await item.click()
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

// Tab (albo Shift+Tab) do elementu – najwyżej `max` naciśnięć.
async function tabTo(target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab', max = 40) {
  for (let presses = 0; presses < max && !(await target.evaluate((element) => element === element.ownerDocument.activeElement)); presses++) {
    await window.keyboard.press(key)
  }
  await expect(target).toBeFocused()
}

test('a CV is edited with the keyboard alone: the start hint, page fields with Enter and Tab, the “Add to CV” bar, a date popover, Shift+F10 menus, Escape and Cmd+Z', async () => {
  await openNewCv()
  const bar = (name: string) => addBar().getByRole('button', { name, exact: true })
  const pages = window.getByRole('main', { name: 'CV pages', exact: true })

  // Podpowiedź w pustym CV: Enter – kursor w imieniu i nazwisku.
  await startHint().focus()
  await window.keyboard.press('Enter')
  await expect(pageField('Full name')).toBeFocused()
  await window.keyboard.type('Jane Doe')

  // Tab z ostatniego pola stron – do paska „Add to CV” (uchwyty i pigułki są poza kolejnością Tab).
  await tabTo(bar('Contact'))
  await window.keyboard.press('Enter')
  await expect(pageField('Contact value 1')).toBeFocused()
  await window.keyboard.type('+48 600 000 000')
  await window.keyboard.press('Enter')
  await expect(labelField(2)).toBeFocused()
  await window.keyboard.type('GitHub')
  await window.keyboard.press('Enter')
  await window.keyboard.type('github.com/jane')
  await expect(announcement()).toHaveText('New contact 2.')

  // Escape – panel stron; dalej Tab przez strony do paska i nowe stanowisko z kursorem w nim.
  await window.keyboard.press('Escape')
  await expect(pages).toBeFocused()
  await tabTo(bar('Work experience'))
  await window.keyboard.press('Enter')
  await expect(roleField('New position')).toBeFocused()
  await window.keyboard.type('Buyer')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Acme')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Leeds')
  await window.keyboard.press('Tab')
  await expect(bulletField(1, 'Buyer')).toBeFocused()
  await window.keyboard.type('Negotiated contracts.')
  await window.keyboard.press('Enter')
  await window.keyboard.type('Cut costs.')
  await expect(bulletField(2, 'Buyer')).toHaveText('Cut costs.')

  // Data końca: popover z żetonu, „I currently work here” spacją, Escape wraca na żeton.
  const end = dateToken('To – Position “Buyer”')
  await tabTo(end, 'Shift+Tab')
  await window.keyboard.press('Enter')
  // (Tab przechodzi najpierw przez części pola miesiąca.)
  await tabTo(datePopover('To – Position “Buyer”').getByLabel('I currently work here'), 'Tab', 4)
  await window.keyboard.press('Space')
  await window.keyboard.press('Escape')
  await expect(end).toBeFocused()
  await expect(end).toHaveText('present')

  // Shift+F10 na żetonie – menu uchwytu wpisu; Escape wraca na żeton. ⌘Z cofa „present”.
  await window.keyboard.press('Shift+F10')
  await expect(blockMenu('position “Buyer”').getByRole('menuitemcheckbox', { name: 'New page before this entry' })).toBeFocused()
  await window.keyboard.press('Escape')
  await expect(end).toBeFocused()
  await window.keyboard.press('Meta+z')
  await expect(end).not.toHaveText('present')

  // Na stronie: wszystko, co wpisano; bez CV form przez cały czas.
  await window.keyboard.press('Escape')
  await expect(pages).toBeFocused()
  await expect(pageName()).toHaveText('Jane Doe')
  await expect(window.locator('.preview .cv-page .cv-role')).toHaveText(['Buyer'])
  await expect(window.locator('.preview .cv-page .cv-company')).toHaveText('Acme – Leeds')
  await expect(window.locator('.preview .cv-page li')).toHaveText(['Negotiated contracts.', 'Cut costs.'])
  await expect(window.locator('.editor-form')).toHaveCount(0)
})

test('a full CV is built from a new CV with the pages and the CV elements list, without any card and without the CV form: every field of the Sample CV is on the page or in a Field popover, and Edit mode then splits the pages like Preview mode', async () => {
  const photoPath = await writeRedBluePhoto()
  await openNewCv()
  await expect(cvElements()).toBeVisible()
  const bar = (name: string) => addBar().getByRole('button', { name, exact: true })
  // Bez CV form – przez cały czas (Edit card nie ma w ogóle).
  const expectNoForms = async () => {
    await expect(window.locator('.editor-form')).toHaveCount(0)
  }

  // Imię i nazwisko z podpowiedzi w pustym CV.
  await startHint().click()
  await expect(pageField('Full name')).toBeFocused()
  await window.keyboard.type('Jane Doe')
  await expect(pageName()).toHaveText('Jane Doe')

  // Zdjęcie: „Photo” w pasku od razu otwiera wybór pliku i kadrowanie; potem fokus na przycisku zdjęcia na stronie.
  await stubOpenDialog(photoPath)
  await bar('Photo').click()
  await window.getByRole('dialog', { name: 'Crop photo' }).getByRole('button', { name: 'Apply' }).click()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(1)
  await expect(bar('Photo')).toHaveCount(0)
  await expect(photoButton()).toBeFocused()

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

  // Pusta sekcja na liście „CV elements”: jej pierwszy wpis odsłonięty na stronie z kursorem w stanowisku; Enter – kolejne pola.
  await showDocumentPanel()
  await elementButton('Work experience').click()
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
  await expect(panelTitle()).toHaveText('Experience')
  await showDocumentPanel()
  await expect(elementRow('Experience')).toHaveText(/^Experience1$/)
  // Drugie stanowisko pigułką.
  await pageRole('Senior Buyer').hover()
  await pill('Position').click()
  await expect(roleField('New position')).toBeFocused()
  await window.keyboard.type('Buyer')
  await expectNoForms()

  await showDocumentPanel()
  await elementButton('Education').click()
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

  // Sekcje listowe: z listy „CV elements” i z paska.
  await showDocumentPanel()
  await elementButton('Skills').click()
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

// ---------- „CV elements” w Inspektorze (zamiast Outline, #138) ----------

const cvElements = () => inspector().locator('.cv-elements')
const elementRow = (name: string) =>
  cvElements().locator('.cv-element').filter({ has: window.locator('.cv-element-label', { hasText: new RegExp(`^${name}$`) }) })
const elementButton = (name: string) => elementRow(name).locator('button.cv-element-name')
const elementHandle = (name: string) => elementRow(name).getByRole('button', { name: `Actions for section “${name}”` })
const elementSwitch = (name: string) => elementRow(name).getByRole('switch')
// Panel „Dokument” z listą „CV elements”: zaznaczona część CV (np. pole z kursorem na stronie) ma w Inspektorze swój panel.
async function showDocumentPanel() {
  if (await backToDocument().isVisible()) await backToDocument().click()
  await expect(cvElements()).toBeVisible()
}
const sectionNames = () => cvElements().locator('.cv-element[data-element="section"] .cv-element-label').allTextContents()
const pageSectionTitles = () => window.locator('.preview .cv-page .cv-section-title').allTextContents()
const sampleElements = [/^Header$/, /^Photo$/, /^Work experience4$/, /^Education2$/, /^Skills5$/, /^Languages2$/, /^Interestshidden1$/, /^Consent clausehidden$/]
const savedSidebar = async () =>
  (JSON.parse(await readFile(join(outputDir, 'user-data', 'settings.json'), 'utf8').catch(() => '{}')) as { editorSidebar?: string })
    .editorSidebar

test('there is no Outline: the Inspector’s “CV elements” list shows the header, the photo, every section in CV order with its marks and entry count, and the consent clause; a click on a section opens its panel, scrolls to it and puts the caret at the end of its title', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()
  await expect(window.getByRole('navigation', { name: 'Outline' })).toHaveCount(0)
  await expect(window.locator('.editor-form')).toHaveCount(0)
  await expect(inspectorGroup('CV elements')).toHaveAttribute('aria-expanded', 'true')
  await expect(cvElements().locator('.cv-element')).toHaveText(sampleElements)

  // Przełącznik „Show on CV” przy każdej części, którą da się ukryć – nazwany jej nazwą; nagłówka nie da się ukryć.
  await expect(elementRow('Header').getByRole('switch')).toHaveCount(0)
  await expect(elementSwitch('Photo')).toHaveAccessibleName('Show photo on CV')
  await expect(elementSwitch('Photo')).toBeChecked()
  await expect(elementSwitch('Work experience')).toHaveAccessibleName('Show “Work experience” on CV')
  await expect(elementSwitch('Work experience')).toBeChecked()
  await expect(elementSwitch('Interests')).not.toBeChecked()
  await expect(elementSwitch('Consent clause')).toHaveAccessibleName('Show consent clause on CV')
  await expect(elementSwitch('Consent clause')).not.toBeChecked()
  // Dla czytnika ekranu: oznaczenie „hidden” w nazwie wiersza, liczba wpisów w jego opisie.
  await expect(elementButton('Work experience')).toHaveAccessibleName('Work experience')
  await expect(elementButton('Work experience')).toHaveAccessibleDescription('4 items')
  await expect(elementButton('Interests')).toHaveAccessibleName('Interests hidden')
  await expect(elementButton('Interests')).toHaveAccessibleDescription('1 item')

  // Klik w sekcję na drugiej stronie: strony przewijają się do jej tytułu, a kursor staje na końcu tytułu (bez karty).
  const preview = window.locator('.preview')
  expect(await preview.evaluate((element) => element.scrollTop)).toBe(0)
  await elementButton('Languages').click()
  const title = titleField('Languages')
  await expect(title).toBeFocused()
  await expect.poll(caret).toEqual({ key: 'section:languages:title', offset: 9, collapsed: true })
  expect(await preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(title).toBeInViewport()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.press('Meta+a')
  await window.keyboard.type('Language skills')
  await expect(panelTitle()).toHaveText('Language skills')
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: 'Language skills' })).toHaveCount(1)
  await showDocumentPanel()
  await expect(elementRow('Language skills')).toHaveText(/^Language skills2$/)

  // „Header” – panel nagłówka i kursor w imieniu i nazwisku na stronie.
  await elementButton('Header').click()
  await expect(pageField('Full name')).toBeFocused()
  await expect(panelTitle()).toHaveText('Header')
  await expect(pageField('Full name')).toBeInViewport()
  await expect(window.getByRole('dialog')).toHaveCount(0)
})

test('the “Show on CV” switch hides and shows a section, which stays in the list marked hidden; a click on a hidden section opens its panel without the caret on the pages; each change is one undo step', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()
  const onPage = (name: string) => window.locator('.preview .cv-page .cv-section-title', { hasText: new RegExp(`^${name}$`) })

  await elementSwitch('Skills').click()
  await expect(onPage('Skills')).toHaveCount(0)
  await expect(elementSwitch('Skills')).toBeFocused()
  await expect(elementSwitch('Skills')).not.toBeChecked()
  await expect(elementRow('Skills')).toHaveText(/^Skillshidden5$/)
  await expect(elementButton('Skills')).toHaveAccessibleName('Skills hidden')

  // Ukrytej sekcji nie ma na stronach: klik w jej wiersz otwiera jej panel z fokusem na jego tytule (bez karty i bez
  // kursora na stronie).
  await elementButton('Skills').click()
  await expect(panelTitle()).toHaveText('Skills')
  await expect(panelTitle()).toBeFocused()
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await showDocumentPanel()

  // Klawiatura: spacja na przełączniku pokazuje sekcję; fokus zostaje na przełączniku.
  await elementSwitch('Skills').focus()
  await window.keyboard.press('Space')
  await expect(onPage('Skills')).toHaveCount(1)
  await expect(elementSwitch('Skills')).toBeChecked()
  await expect(elementSwitch('Skills')).toBeFocused()
  await expect(elementRow('Skills')).toHaveText(/^Skills5$/)

  // Ukryta w przykładowym CV sekcja wraca na strony.
  await elementSwitch('Interests').check()
  await expect(onPage('Interests')).toHaveCount(1)
  await expect(elementRow('Interests')).toHaveText(/^Interests1$/)

  // Cofanie: pokazanie Interests, pokazanie i ukrycie Skills – po jednym kroku.
  await window.keyboard.press('Meta+z')
  await expect(elementRow('Interests')).toHaveText(/^Interestshidden1$/)
  await expect(onPage('Interests')).toHaveCount(0)
  await window.keyboard.press('Meta+z')
  await expect(elementRow('Skills')).toHaveText(/^Skillshidden5$/)
  await window.keyboard.press('Meta+z')
  await expect(elementRow('Skills')).toHaveText(/^Skills5$/)
  await expect(onPage('Skills')).toHaveCount(1)
})

test('“Hide photo” in the photo popover takes the photo off the pages, the PDF and “Add to CV” but keeps it: the CV elements list marks it hidden and its “Show photo on CV” switch brings back the same image; each change is one undo step', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()
  const photo = window.locator('.preview .cv-page .cv-photo')
  const image = await photo.getAttribute('src')

  // Wiersz „Photo” pod „Header”: widoczne zdjęcie – przełącznik włączony, klik w wiersz przenosi fokus na zdjęcie.
  await expect(cvElements().locator('.cv-element').nth(1)).toHaveText(/^Photo$/)
  await expect(elementSwitch('Photo')).toBeChecked()
  await elementButton('Photo').click()
  await expect(photoButton()).toBeFocused()
  await expect(panelTitle()).toHaveText('Photo')

  // „Hide photo” w popoverze: zdjęcia nie ma na stronie (bez „Removed. Undo”), fokus na przełączniku „Show on CV”
  // w panelu zdjęcia, a na liście zdjęcie jest oznaczone jako ukryte.
  const panelSwitch = inspector().getByRole('switch', { name: 'Show on CV', exact: true })
  await photoButton().press('Enter')
  await photoPopover().getByRole('button', { name: 'Hide photo' }).click()
  await expect(photo).toHaveCount(0)
  await expect(photoPopover()).toHaveCount(0)
  await expect(photoButton()).toHaveCount(0)
  await expect(window.getByRole('status').filter({ hasText: 'Removed.' })).toHaveCount(0)
  await expect(panelSwitch).toBeFocused()
  await expect(panelSwitch).not.toBeChecked()
  await expect(panelTitle()).toHaveText('Photo')
  await showDocumentPanel()
  await expect(elementSwitch('Photo')).not.toBeChecked()
  await expect(elementRow('Photo')).toHaveText(/^Photohidden$/)
  await expect(elementButton('Photo')).toHaveAccessibleName('Photo hidden')
  // Ukryte zdjęcie jest tylko na liście – nie w pasku „Add to CV” ani w PDF.
  await expect(addBar().getByRole('button', { name: 'Photo', exact: true })).toHaveCount(0)
  const pdfPath = join(outputDir, 'hidden-photo.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Export to PDF' }).click()
  await expect(window.getByText('Saved PDF: hidden-photo.pdf')).toBeVisible()
  expect((await pdfImagesPerPage(pdfPath)).every((count) => count === 0)).toBe(true)

  // Klik w wiersz ukrytego zdjęcia otwiera panel zdjęcia z fokusem na jego tytule; przełącznik na liście pokazuje to samo
  // zdjęcie.
  await elementButton('Photo').click()
  await expect(panelTitle()).toHaveText('Photo')
  await expect(panelTitle()).toBeFocused()
  await showDocumentPanel()
  await elementSwitch('Photo').focus()
  await window.keyboard.press('Space')
  await expect(photo).toHaveAttribute('src', image!)
  await expect(elementSwitch('Photo')).toBeChecked()
  await expect(elementRow('Photo')).toHaveText(/^Photo$/)

  // Wyłączenie przełącznikiem też ukrywa.
  await elementSwitch('Photo').uncheck()
  await expect(photo).toHaveCount(0)

  // Cofanie: wyłączenie, pokazanie, ukrycie – po jednym kroku.
  for (const shown of [true, false, true]) {
    await window.keyboard.press('Meta+z')
    await expect(photo).toHaveCount(shown ? 1 : 0)
  }
  await expect(photo).toHaveAttribute('src', image!)
})

test('without a photo the “Photo” row has no switch and picks a photo like “Add to CV” in the photo panel: a cancelled crop leaves the focus on its “Add photo”, an applied one focuses the photo on the page', async () => {
  await openNewCv()
  const cropper = window.getByRole('dialog', { name: 'Crop photo' })
  const addPhoto = inspector().getByRole('button', { name: 'Add photo', exact: true })
  await expect(elementRow('Photo')).toHaveText(/^Photo$/)
  await expect(elementSwitch('Photo')).toHaveCount(0)

  await stubOpenDialog(await writeRedBluePhoto())
  await elementButton('Photo').click()
  await cropper.getByRole('button', { name: 'Cancel' }).click()
  await expect(cropper).toHaveCount(0)
  await expect(panelTitle()).toHaveText('Photo')
  await expect(addPhoto).toBeFocused()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(0)

  await addPhoto.click()
  await cropper.getByRole('button', { name: 'Apply' }).click()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(1)
  await expect(photoButton()).toBeFocused()
  // Zdjęcie z fokusem na stronie – w Inspektorze jego panel.
  await expect(panelTitle()).toHaveText('Photo')
  await expect(inspector().getByRole('switch', { name: 'Show on CV', exact: true })).toBeChecked()
})

test('sections are reordered in the CV elements list by dragging and from the handle menu (also with Shift+F10), also the hidden ones, and “New page before this section” is set there; the pages follow and each change is one undo step', async () => {
  await openFirstCvWithPages()
  const original = ['Work experience', 'Education', 'Skills', 'Languages', 'Interests']
  await expect.poll(sectionNames).toEqual(original)

  await dragOnto(elementHandle('Languages'), elementRow('Work experience'))
  await expect.poll(sectionNames).toEqual(['Languages', 'Work experience', 'Education', 'Skills', 'Interests'])
  await expect.poll(pageSectionTitles).toEqual(['Languages', 'Work experience', 'Education', 'Skills'])

  // Menu uchwytu: tylko kolejność i „Nowa strona przed” (ukrywa przełącznik wiersza). Ukryta sekcja też ma swoje miejsce.
  await elementHandle('Interests').click()
  await expect(window.getByRole('menu').getByRole('menuitem').or(window.getByRole('menu').getByRole('menuitemcheckbox'))).toHaveText([
    /^Move up/,
    /^Move down/,
    /^New page before this section/
  ])
  await window.getByRole('menuitem', { name: 'Move up' }).click()
  await expect.poll(sectionNames).toEqual(['Languages', 'Work experience', 'Education', 'Interests', 'Skills'])
  await expect(elementHandle('Interests')).toBeFocused()
  await window.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(sectionNames).toEqual(['Languages', 'Work experience', 'Interests', 'Education', 'Skills'])

  // Shift+F10 na uchwycie otwiera to samo menu; „New page before this section” – sekcja przechodzi na nową stronę
  // (krótkie Languages zostaje samo na pierwszej).
  const pageOf = (title: string) =>
    window
      .locator('.preview .cv-page')
      .evaluateAll((pages, title) => pages.findIndex((page) => [...page.querySelectorAll('.cv-section-title')].some((element) => element.textContent === title)), title)
  await expect.poll(() => pageOf('Work experience')).toBe(0)
  // Z wiersza sekcji: Escape zamyka menu i wraca do wiersza.
  await elementButton('Work experience').focus()
  await window.keyboard.press('Shift+F10')
  await expect(window.getByRole('menu', { name: 'Actions for section “Work experience”' })).toBeVisible()
  await window.keyboard.press('Escape')
  await expect(window.getByRole('menu')).toHaveCount(0)
  await expect(elementButton('Work experience')).toBeFocused()
  await elementHandle('Work experience').focus()
  await window.keyboard.press('Shift+F10')
  const pageBreak = window.getByRole('menuitemcheckbox', { name: 'New page before this section' })
  await expect(pageBreak).toHaveAttribute('aria-checked', 'false')
  await pageBreak.click()
  await expect(elementHandle('Work experience')).toBeFocused()
  await expect.poll(() => pageOf('Work experience')).toBe(1)

  await window.keyboard.press('Meta+z')
  await expect.poll(() => pageOf('Work experience')).toBe(0)
  await window.keyboard.press('Meta+z')
  await expect.poll(sectionNames).toEqual(['Languages', 'Work experience', 'Education', 'Interests', 'Skills'])
  await window.keyboard.press('Meta+z')
  await expect.poll(sectionNames).toEqual(['Languages', 'Work experience', 'Education', 'Skills', 'Interests'])
  await window.keyboard.press('Meta+z')
  await expect.poll(sectionNames).toEqual(original)
  await expect.poll(pageSectionTitles).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
})

test('in a new CV the CV elements list marks the empty sections; a click on one reveals its entry with the caret on the page, and the consent clause is switched on from the list and edited on the page', async () => {
  await openNewCv()
  await expect(cvElements().locator('.cv-element[data-element="section"]')).toHaveText([
    /^Work experienceempty$/,
    /^Educationempty$/,
    /^Skillsempty$/,
    /^Languagesempty$/
  ])
  await expect(elementButton('Skills')).toHaveAccessibleName('Skills empty')

  await elementButton('Work experience').click()
  // Pierwszy wpis odsłonięty na stronie razem z tytułem sekcji, kursor w stanowisku – bez karty.
  await expect(roleField('New position')).toBeFocused()
  await expect(window.locator('.preview .cv-page .cv-section-title')).toHaveText(['Work experience'])
  await expect(window.getByRole('dialog')).toHaveCount(0)
  await window.keyboard.type('Buyer')
  await expect(window.locator('.preview .cv-page .cv-role')).toHaveText(['Buyer'])
  await expect(panelTitle()).toHaveText('Work experience')
  await showDocumentPanel()
  await expect(elementRow('Work experience')).toHaveText(/^Work experience1$/)

  // Wyłączona klauzula: klik w jej wiersz otwiera jej panel z fokusem na jego tytule; włączona – także kursor w jej
  // tekście na stronie.
  await elementButton('Consent clause').click()
  await expect(panelTitle()).toHaveText('Consent clause')
  await expect(panelTitle()).toBeFocused()
  await showDocumentPanel()
  await elementSwitch('Consent clause').check()
  await expect(elementRow('Consent clause')).toHaveText(/^Consent clause$/)
  await elementButton('Consent clause').click()
  await expect(consentField()).toBeFocused()
  await window.keyboard.type('I agree to the processing of my data.')
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveText('I agree to the processing of my data.')
  await expect(window.getByRole('dialog')).toHaveCount(0)
  // „Show on CV” w panelu klauzuli ją wyłącza.
  await expect(panelTitle()).toHaveText('Consent clause')
  await inspector().getByRole('switch', { name: 'Show on CV', exact: true }).uncheck()
  await expect(window.locator('.preview .cv-page .cv-consent')).toHaveCount(0)
  await showDocumentPanel()
  await expect(elementSwitch('Consent clause')).not.toBeChecked()
})

test('in Preview mode the CV elements rows do not go into editing and have no handles, but the switches work and are one undo step each', async () => {
  await openFirstCvWithPages()
  await previewButton().click()
  await expectPreviewMode()
  await expect(cvElements().locator('.cv-element')).toHaveText(sampleElements)
  await expect(cvElements().getByRole('button')).toHaveCount(0)
  await expect(cvElements().getByRole('switch')).toHaveCount(7)

  await elementSwitch('Skills').uncheck()
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: /^Skills$/ })).toHaveCount(0)
  await elementSwitch('Photo').uncheck()
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(0)
  // Klauzula Sample CV jest bez tekstu, więc włączona nie ma nic na stronach – zmienia się tylko jej wiersz.
  await elementSwitch('Consent clause').check()
  await expect(elementRow('Consent clause')).toHaveText(/^Consent clause$/)
  await expectPreviewMode()

  await window.keyboard.press('Meta+z')
  await expect(elementSwitch('Consent clause')).not.toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(window.locator('.preview .cv-page .cv-photo')).toHaveCount(1)
  await window.keyboard.press('Meta+z')
  await expect(window.locator('.preview .cv-page .cv-section-title', { hasText: /^Skills$/ })).toHaveCount(1)
})

// ---------- Zaznaczenie Inspektora i panel sekcji (#139) ----------

const panelTitle = () => inspector().getByRole('heading', { level: 2 })
const backToDocument = () => inspector().getByRole('button', { name: 'Document', exact: true })
const pageTitle = (title: string) => window.locator('.preview .cv-page .cv-section-title', { hasText: new RegExp(`^${title}$`) })

// Klik w tło stron: w lewym marginesie panelu stron, obok kartek.
async function clickPagesBackground() {
  const box = (await window.locator('.preview').boundingBox())!
  await window.mouse.click(box.x + 6, box.y + box.height / 2)
}

test('a click on a part of the CV on the page opens its panel with the path “‹ Document / name”: a section title or an entry – its section, the name – the header, the photo – the photo; a click in the Inspector keeps it, and a click on the page background or “‹ Document” returns to the Document panel', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()
  await expect(panelTitle()).toHaveText('Document')
  await expect(backToDocument()).toHaveCount(0)

  await titleField('Education').click()
  await expect(titleField('Education')).toBeFocused()
  await expect(panelTitle()).toHaveText('Education')
  await expect(backToDocument()).toBeVisible()
  await expect(inspectorGroup('CV elements')).toHaveCount(0)

  // Wpis na stronie – panel jego sekcji.
  await roleField(positions[1]).click()
  await expect(roleField(positions[1])).toBeFocused()
  await expect(panelTitle()).toHaveText('Work experience')

  // Klik w Inspektorze (pole nazwy, nagłówek panelu) nie zmienia zaznaczenia.
  await inspector().getByRole('textbox', { name: 'Name', exact: true }).click()
  await expect(panelTitle()).toHaveText('Work experience')
  await panelTitle().click()
  await expect(panelTitle()).toHaveText('Work experience')

  // Imię i nazwisko – nagłówek; zdjęcie – zdjęcie, a klik w jego Field popover zaznaczenia nie zmienia.
  await pageField('Full name').click()
  await expect(pageField('Full name')).toBeFocused()
  await expect(panelTitle()).toHaveText('Header')
  await photoButton().click()
  await expect(panelTitle()).toHaveText('Photo')
  await photoPopover().click()
  await expect(panelTitle()).toHaveText('Photo')

  // Tło stron – panel „Dokument”.
  await clickPagesBackground()
  await expect(panelTitle()).toHaveText('Document')
  await expect(inspectorGroup('CV elements')).toBeVisible()

  // „‹ Document” wraca do panelu „Dokument” z fokusem na wierszu tej części na liście.
  await titleField('Education').click()
  await expect(panelTitle()).toHaveText('Education')
  await backToDocument().click()
  await expect(panelTitle()).toHaveText('Document')
  await expect(elementButton('Education')).toBeFocused()
})

const sectionItems = () => inspector().getByRole('list', { name: 'Items', exact: true })
const sectionOrder = () => inspector().getByRole('group', { name: 'Order', exact: true })
const pageOfSection = (title: string) =>
  window
    .locator('.preview .cv-page')
    .evaluateAll((pages, title) => pages.findIndex((page) => [...page.querySelectorAll('.cv-section-title')].some((element) => element.textContent === title)), title)

test('a click on a section in the CV elements list opens its panel, also for a hidden or an empty section that is not on the pages: the focus goes to the panel, or into the section on the page when it is there', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()

  // Ukryta sekcja: panel z wyłączonym „Show on CV”; pozycji nie ma na stronach, więc są nieaktywne.
  await elementButton('Interests').click()
  await expect(panelTitle()).toHaveText('Interests')
  await expect(panelTitle()).toBeFocused()
  await expect(inspector().getByRole('switch', { name: 'Show on CV', exact: true })).not.toBeChecked()
  await expect(sectionItems().getByRole('button')).toHaveCount(1)
  await expect(sectionItems().getByRole('button')).toBeDisabled()
  await backToDocument().click()
  await expect(elementButton('Interests')).toBeFocused()

  // Sekcja na stronach: panel i kursor na końcu jej tytułu na stronie.
  await elementButton('Languages').click()
  await expect(titleField('Languages')).toBeFocused()
  await expect(panelTitle()).toHaveText('Languages')
  await expect(sectionOrder()).toContainText('4 of 5')
})

test('in a new CV a click on an empty section in the CV elements list opens its panel with “This section is empty” and reveals its entry with the caret on the page', async () => {
  await openNewCv()
  await elementButton('Education').click()
  await expect(panelTitle()).toHaveText('Education')
  await expect(inspector().getByText('This section is empty', { exact: true })).toBeVisible()
  await expect(sectionItems()).toHaveCount(0)
  await expect.poll(focusedKey).toMatch(/^education:/)
})

test('the section panel renames the section, shows and hides it, starts it on a new page and moves it up and down with its position; each change is one undo step, and its items list shows the entry titles and puts the caret in an entry on the page', async () => {
  await window.setViewportSize({ width: 1600, height: 1000 })
  await openFirstCvWithPages()
  await titleField('Education').click()
  await expect(panelTitle()).toHaveText('Education')

  // Nazwa: wpisywanie zmienia tytuł na stronie i w ścieżce panelu – jeden krok cofania.
  const name = inspector().getByRole('textbox', { name: 'Name', exact: true })
  await expect(name).toHaveValue('Education')
  await name.press('End')
  await name.pressSequentially(' and courses')
  await expect(pageTitle('Education and courses')).toHaveCount(1)
  await expect(panelTitle()).toHaveText('Education and courses')

  // Nowa strona przed sekcją.
  expect(await pageOfSection('Education and courses')).toBe(1)
  const newPage = inspector().getByRole('switch', { name: 'Start on a new page', exact: true })
  await expect(newPage).not.toBeChecked()
  await newPage.check()
  await expect.poll(() => pageOfSection('Education and courses')).toBe(2)

  // „Show on CV”: ukryta sekcja znika ze stron, a jej panel zostaje.
  const shown = inspector().getByRole('switch', { name: 'Show on CV', exact: true })
  await expect(shown).toBeChecked()
  await shown.uncheck()
  await expect(pageTitle('Education and courses')).toHaveCount(0)
  await expect(panelTitle()).toHaveText('Education and courses')
  await shown.check()
  await expect(pageTitle('Education and courses')).toHaveCount(1)

  // Kolejność ↑/↓ z pozycją; na skraju fokus przechodzi na drugi przycisk.
  await expect(sectionOrder()).toContainText('2 of 5')
  await sectionOrder().getByRole('button', { name: 'Move up', exact: true }).click()
  await expect(sectionOrder()).toContainText('1 of 5')
  await expect(sectionOrder().getByRole('button', { name: 'Move up', exact: true })).toBeDisabled()
  await expect(sectionOrder().getByRole('button', { name: 'Move down', exact: true })).toBeFocused()
  await expect.poll(pageSectionTitles).toEqual(['Education and courses', 'Work experience', 'Skills', 'Languages'])
  await sectionOrder().getByRole('button', { name: 'Move down', exact: true }).click()
  await expect(sectionOrder()).toContainText('2 of 5')

  // Cofanie: każda zmiana z panelu to jeden krok, a panel zostaje otwarty.
  await window.keyboard.press('Meta+z')
  await expect(sectionOrder()).toContainText('1 of 5')
  await window.keyboard.press('Meta+z')
  await expect(sectionOrder()).toContainText('2 of 5')
  await window.keyboard.press('Meta+z')
  await expect(shown).not.toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(shown).toBeChecked()
  await window.keyboard.press('Meta+z')
  await expect(newPage).not.toBeChecked()
  await expect.poll(() => pageOfSection('Education and courses')).toBe(1)
  await window.keyboard.press('Meta+z')
  await expect(name).toHaveValue('Education')
  await expect(pageTitle('Education')).toHaveCount(1)
  await expect(panelTitle()).toHaveText('Education')

  // Pozycje: tytuły wpisów; klik stawia kursor we wpisie na stronie.
  await expect(sectionItems().getByRole('button')).toHaveText(educations)
  await sectionItems().getByRole('button', { name: educations[1], exact: true }).click()
  await expect.poll(focusedKey).toMatch(/^education:ed2:/)
  await expect(panelTitle()).toHaveText('Education')
})

test('in Preview mode the Inspector shows only the Document panel, and back in Edit mode it starts from the Document panel', async () => {
  await openFirstCvWithPages()
  await titleField('Education').click()
  await expect(panelTitle()).toHaveText('Education')
  await previewButton().click()
  await expectPreviewMode()
  await expect(panelTitle()).toHaveText('Document')
  await expect(backToDocument()).toHaveCount(0)
  // Klik w stronę w Preview mode niczego nie zaznacza.
  await clickOnPage(window.locator('.preview .cv-page .cv-section-title', { hasText: /^Education$/ }))
  await expect(panelTitle()).toHaveText('Document')
  await editButton().click()
  await expect(editButton()).toHaveAttribute('aria-pressed', 'true')
  await expect(panelTitle()).toHaveText('Document')
})

// ---------- Panele nagłówka, zdjęcia i klauzuli zgody (#141) ----------

test.describe('Inspector panels of the header, the photo and the consent clause', () => {
  const panelButton = (name: string) => inspector().locator('.inspector-panel').getByRole('button', { name, exact: true })
  const panelSwitch = (name: string) => inspector().locator('.inspector-panel').getByRole('switch', { name, exact: true })
  const pageContacts = () => window.locator('.preview .cv-page .cv-contact > *')

  test('the header panel goes to the full name, the contacts (with their count) and the summary on the page, adds a contact with the caret in it and shows and hides the photo; each change is one undo step', async () => {
    await window.setViewportSize({ width: 1600, height: 1000 })
    await openFirstCvWithPages()
    await elementButton('Header').click()
    await expect(panelTitle()).toHaveText('Header')

    // Skróty do części nagłówka na stronie; kontakty z liczbą (dla czytnika ekranu – opis przycisku).
    const goTo = inspector().getByRole('list', { name: 'Go to', exact: true })
    await expect(goTo.getByRole('button')).toHaveText(['Full name', 'Contacts4', 'Summary'])
    await expect(goTo.getByRole('button', { name: 'Contacts' })).toHaveAccessibleDescription('4 contacts')
    await goTo.getByRole('button', { name: 'Contacts' }).click()
    await expect.poll(focusedKey).toBe('contact:c1:value')
    await expect(panelTitle()).toHaveText('Header')
    await goTo.getByRole('button', { name: 'Summary', exact: true }).click()
    await expect.poll(focusedKey).toBe('header:summary')
    await goTo.getByRole('button', { name: 'Full name', exact: true }).click()
    await expect.poll(focusedKey).toBe('header:fullName')
    await expect(panelTitle()).toHaveText('Header')

    // „+ Add contact”: nowy kontakt na stronie z kursorem w jego etykiecie; panel nagłówka zostaje.
    await panelButton('+ Add contact').click()
    await expect.poll(focusedKey).toMatch(/^contact:.+:label$/)
    await expect(window.locator('.preview .cv-pages').getByRole('combobox', { name: 'Contact label 5', exact: true })).toBeFocused()
    await expect(panelTitle()).toHaveText('Header')
    await window.keyboard.type('Web')
    await window.keyboard.press('Tab')
    await window.keyboard.type('example.com')
    await expect(pageContacts()).toHaveCount(5)
    await expect(goTo.getByRole('button', { name: 'Contacts' })).toHaveAccessibleDescription('5 contacts')

    // Przełącznik zdjęcia: ukryte zdjęcie znika ze strony, a jego obraz zostaje; przycisk otwiera panel zdjęcia.
    const photo = window.locator('.preview .cv-page .cv-photo')
    const image = await photo.getAttribute('src')
    const showPhoto = panelSwitch('Show photo on CV')
    await expect(showPhoto).toBeChecked()
    await showPhoto.uncheck()
    await expect(photo).toHaveCount(0)
    await expect(panelTitle()).toHaveText('Header')
    await showPhoto.check()
    await expect(photo).toHaveAttribute('src', image!)

    // Cofanie: pokazanie, ukrycie zdjęcia, potem wpisany kontakt i jego dodanie.
    await undoButton().click()
    await expect(photo).toHaveCount(0)
    await undoButton().click()
    await expect(photo).toHaveCount(1)
    await expect(pageContacts()).toHaveCount(5)

    await panelButton('Change, crop or remove photo').click()
    await expect(panelTitle()).toHaveText('Photo')
  })

  test('in a new CV the header panel counts no contacts, and “+ Add contact” puts the caret in a contact without a value instead of adding another one', async () => {
    await openNewCv()
    await elementButton('Header').click()
    const contacts = inspector().getByRole('list', { name: 'Go to', exact: true }).getByRole('button', { name: 'Contacts' })
    await expect(contacts).toHaveAccessibleDescription('0 contacts')
    // Nowe CV ma kontakty z etykietą bez wartości – „+ Add contact” stawia kursor w wartości pierwszego z nich zamiast
    // dodawać kolejny pusty, także za drugim razem.
    await panelButton('+ Add contact').click()
    await expect.poll(focusedKey).toMatch(/^contact:.+:value$/)
    const reused = await focusedKey()
    await panelButton('+ Add contact').click()
    await expect.poll(focusedKey).toBe(reused)
    await expect(panelTitle()).toHaveText('Header')
    await expect(contacts).toHaveAccessibleDescription('0 contacts')
  })

  test('the photo panel changes and crops the photo in the same dialog as the page, hides and shows it keeping the image, and removes it with “Removed. Undo”; without a photo it adds one', async () => {
    await window.setViewportSize({ width: 1600, height: 1000 })
    const photoPath = await writeRedBluePhoto()
    await openFirstCvWithPages()
    const photo = window.locator('.preview .cv-page .cv-photo')
    const cropper = window.getByRole('dialog', { name: 'Crop photo' })
    const removed = window.getByRole('status').filter({ hasText: 'Removed.' })
    await elementButton('Photo').click()
    await expect(panelTitle()).toHaveText('Photo')
    await expect(inspector().getByRole('img', { name: 'Photo in the CV' })).toHaveAttribute('src', (await photo.getAttribute('src'))!)
    await expect(inspector().locator('.inspector-panel').getByRole('button')).toHaveText(['Change photo', 'Crop photo', 'Remove photo'])

    // „Change photo”: wybór pliku i to samo okno kadrowania co na stronie; po nim fokus wraca na przycisk.
    await stubOpenDialog(photoPath)
    await panelButton('Change photo').click()
    await expect(cropper).toBeVisible()
    await cropper.getByRole('button', { name: 'Apply' }).click()
    await expect(cropper).toHaveCount(0)
    await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await expect(panelButton('Change photo')).toBeFocused()
    await expect(panelTitle()).toHaveText('Photo')

    // „Crop photo” kadruje zdjęcie z CV jeszcze raz.
    const changed = await photo.getAttribute('src')
    await panelButton('Crop photo').click()
    await cropper.getByRole('slider', { name: 'Zoom' }).fill('2')
    await cropper.getByRole('button', { name: 'Apply' }).click()
    await expect(photo).not.toHaveAttribute('src', changed!)
    await expect(panelButton('Crop photo')).toBeFocused()
    const cropped = await photo.getAttribute('src')

    // „Show on CV”: ukryte zdjęcie znika ze stron, a obraz zostaje (miniatura w panelu i ten sam obraz po pokazaniu).
    await panelSwitch('Show on CV').uncheck()
    await expect(photo).toHaveCount(0)
    await expect(inspector().getByRole('img', { name: 'Photo in the CV' })).toHaveAttribute('src', cropped!)
    await panelSwitch('Show on CV').check()
    await expect(photo).toHaveAttribute('src', cropped!)

    // „Remove photo”: „Removed.” jak na stronie, fokus na „Add photo”; „Undo” przywraca zdjęcie i fokus na „Remove photo”.
    await panelButton('Remove photo').click()
    await expect(photo).toHaveCount(0)
    await expect(removed).toBeVisible()
    await expect(panelTitle()).toHaveText('Photo')
    await expect(panelButton('Add photo')).toBeFocused()
    await expect(panelSwitch('Show on CV')).toHaveCount(0)
    await removed.getByRole('button', { name: 'Undo' }).click()
    await expect(photo).toHaveAttribute('src', cropped!)
    await expect(panelButton('Remove photo')).toBeFocused()

    // Bez zdjęcia „Add photo” wybiera i kadruje zdjęcie: anulowanie wraca na przycisk, zatwierdzenie – fokus na zdjęciu.
    await panelButton('Remove photo').click()
    await panelButton('Add photo').click()
    await cropper.getByRole('button', { name: 'Cancel' }).click()
    await expect(panelButton('Add photo')).toBeFocused()
    await expect(photo).toHaveCount(0)
    await panelButton('Add photo').click()
    await cropper.getByRole('button', { name: 'Apply' }).click()
    await expect(photo).toHaveCount(1)
    await expect(photoButton()).toBeFocused()
    await expect(panelTitle()).toHaveText('Photo')

    // Cofnięcie dodania zostawia panel zdjęcia – z „Add photo”.
    await window.keyboard.press('Meta+z')
    await expect(photo).toHaveCount(0)
    await expect(panelTitle()).toHaveText('Photo')
    await expect(panelButton('Add photo')).toBeVisible()
  })

})

test('the sidebar holds only the CV form, collapsed to a rail by default; the rail and the form are an app preference kept across restarts, a saved Outline opens as the rail, and Preview mode has no sidebar', async () => {
  // Plik ustawień z wcześniejszej wersji: wybrany Outline, którego już nie ma.
  await app.close()
  await mkdir(join(outputDir, 'user-data'), { recursive: true })
  await writeFile(
    join(outputDir, 'user-data', 'settings.json'),
    JSON.stringify({ schemaVersion: 1, clauses: [], defaultClauseId: null, editorSidebar: 'outline' })
  )
  await launch()
  await openFirstCvWithPages()
  // Lokatory od bieżącego okna – po ponownym uruchomieniu aplikacji to inne okno.
  const panes = () => window.locator('.editor-panes')
  const rail = () => window.getByRole('complementary', { name: 'Sidebar' })
  const form = () => window.locator('.editor-form')
  await expect(rail()).toBeVisible()
  expect((await rail().boundingBox())!.width).toBeCloseTo(44, 0)
  await expect(form()).toHaveCount(0)
  await expect(panes().getByRole('button', { name: 'Outline' })).toHaveCount(0)

  await rail().getByRole('button', { name: 'Form', exact: true }).click()
  await expect(form()).toBeVisible()
  await expect(rail()).toHaveCount(0)
  await expect(panes().getByRole('button', { name: 'Collapse' })).toBeFocused()
  await expect.poll(savedSidebar).toBe('form')
  await app.close()
  await launch()
  await openFirstCvWithPages()
  await expect(form()).toBeVisible()

  await panes().getByRole('button', { name: 'Collapse' }).click()
  await expect(rail()).toBeVisible()
  await expect(rail().getByRole('button', { name: 'Form', exact: true })).toBeFocused()
  await expect.poll(savedSidebar).toBe('collapsed')

  await window.keyboard.press('Meta+Shift+P')
  await expectPreviewMode()
  await expect(form()).toHaveCount(0)
  await expect(rail()).toHaveCount(0)
})
