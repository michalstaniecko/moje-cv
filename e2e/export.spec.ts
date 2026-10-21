import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page
let outputDir: string

// Ścieżka do pliku wykonywalnego zbudowanej aplikacji (np. z `pnpm test:e2e:packaged`); bez niej testy uruchamiają kod z `out/`.
const packagedExecutable = process.env['MOJE_CV_APP']

// Uruchamia aplikację na tymczasowym katalogu danych testu, żeby nie dotykać danych użytkownika.
async function launch() {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  app = await electron.launch(
    packagedExecutable ? { executablePath: packagedExecutable, args: [userDataDir] } : { args: ['.', userDataDir] }
  )
  window = await app.firstWindow()
}

// Każdy test startuje z pustym katalogiem danych (pierwsze uruchomienie).
test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  await launch()
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

// Podmienia systemowe okno wyboru pliku: zwraca podany plik (albo anulowanie) i zapamiętuje opcje, z którymi je otwarto.
async function stubOpenDialog(filePath: string | null) {
  await app.evaluate(({ dialog }, filePath) => {
    const calls: Electron.OpenDialogOptions[] = []
    ;(globalThis as { openDialogCalls?: typeof calls }).openDialogCalls = calls
    const stub = async (...args: unknown[]) => {
      calls.push(args.at(-1) as Electron.OpenDialogOptions)
      return filePath ? { canceled: false, filePaths: [filePath] } : { canceled: true, filePaths: [] }
    }
    dialog.showOpenDialog = stub as typeof dialog.showOpenDialog
  }, filePath)
}

test('the packaged app identifies itself as „Moje CV” (which names its application data folder)', async () => {
  test.skip(!packagedExecutable, 'dotyczy tylko zbudowanej aplikacji')
  const identity = await app.evaluate(({ app }) => ({ name: app.getName(), isPackaged: app.isPackaged }))
  expect(identity).toEqual({ name: 'Moje CV', isPackaged: true })
})

test('on first run opens the sample CV, edits it and exports it to a PDF identical to the preview; the edit survives a restart', async () => {
  const pdfPath = join(outputDir, 'export.pdf')
  await stubSaveDialog(pdfPath)

  const library = window.getByRole('list', { name: 'Lista CV' })
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await expect(library.getByText('Przykładowe CV')).toBeVisible()
  await library.getByRole('button', { name: 'Otwórz' }).click()

  await expect(window.locator('.cv-page').first()).toBeVisible()

  // Edycja w formularzu od razu zmienia podgląd; Cmd+Z / Cmd+Shift+Z cofa i ponawia zmianę.
  const fullName = window.getByLabel('Imię i nazwisko')
  await fullName.fill('Ewa Nowak-Żelazna')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Ewa Nowak-Żelazna')
  await window.keyboard.press('Meta+z')
  await expect(fullName).toHaveValue('Anna Przykładowa')
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Anna Przykładowa')
  await window.keyboard.press('Meta+Shift+z')
  await expect(fullName).toHaveValue('Ewa Nowak-Żelazna')
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()

  const previewPageCount = await window.locator('.preview .cv-page').count()

  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF')).toBeVisible()

  const saveDialogOptions = await app.evaluate(
    () => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls
  )
  expect(saveDialogOptions).toHaveLength(1)
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('CV_Ewa_Nowak-Zelazna.pdf')

  const pdf = await readPdf(await readFile(pdfPath))
  expect(previewPageCount).toBe(2)
  expect(pdf.pages).toHaveLength(previewPageCount)
  for (const size of pdf.pageSizes) {
    expect(size.width).toBeCloseTo(A4_PT.width, 0)
    expect(size.height).toBeCloseTo(A4_PT.height, 0)
  }
  expect(pdf.pages[0]).toContain('Ewa Nowak-Żelazna')
  expect(pdf.pages.join('')).not.toContain('Anna Przykładowa')
  expect(pdf.pages[0]).toContain('Starsza specjalistka ds. zakupów')
  expect(pdf.pages.at(-1)).toContain('Wyrażam zgodę na przetwarzanie moich danych osobowych')
  expect(pdf.pages.slice(0, -1).join('')).not.toContain('Wyrażam zgodę')
  expect(pdf.title).toBe('CV – Ewa Nowak-Żelazna')
  expect(pdf.author).toBe('Ewa Nowak-Żelazna')
  expect(pdf.embeddedFonts.some((name) => name.includes('Lato'))).toBe(true)

  // Autozapis: po ponownym uruchomieniu zachowana jest także zmiana wpisana tuż przed zamknięciem aplikacji.
  await fullName.fill('Ewa Nowak')
  await app.close()
  await launch()
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.getByLabel('Imię i nazwisko')).toHaveValue('Ewa Nowak')
})

test('edits education and lists, reorders and hides sections, and forces page breaks in the preview and PDF', async () => {
  const pdfPath = join(outputDir, 'layout.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()

  // Wykształcenie: nowy wpis renderowany jako „poziom, kierunek, uczelnia”, tytuł sekcji edytowalny.
  const education = window.getByRole('region', { name: 'Wykształcenie', exact: true })
  await education.getByRole('button', { name: 'Dodaj wykształcenie' }).click()
  await education.getByLabel('Poziom').last().fill('Liceum ogólnokształcące')
  await education.getByLabel('Kierunek').last().fill('Matematyczno-fizyczny')
  await education.getByLabel('Uczelnia').last().fill('I LO w Poznaniu')
  await expect(preview).toContainText('Liceum ogólnokształcące, Matematyczno-fizyczny, I LO w Poznaniu')
  await education.getByLabel('Tytuł sekcji „Wykształcenie”').fill('Edukacja')
  const educationSection = window.getByRole('region', { name: 'Edukacja', exact: true })

  // Lista: dodanie i usunięcie elementu.
  const languages = window.getByRole('region', { name: 'Języki', exact: true })
  await languages.getByRole('button', { name: 'Dodaj element' }).click()
  await languages.getByRole('textbox', { name: 'Element 3', exact: true }).fill('Hiszpański – B1')
  await expect(preview).toContainText('Hiszpański – B1')
  await languages.getByRole('button', { name: 'Usuń element 2' }).click()
  await expect(preview).not.toContainText('Niemiecki – A2')

  // Kolejność sekcji, wpisów i punktów strzałkami.
  await window.getByRole('button', { name: 'Przesuń sekcję „Języki” w górę' }).click()
  await expect(preview.locator('.cv-page .cv-section-title')).toHaveText(['Doświadczenie zawodowe', 'Edukacja', 'Języki', 'Umiejętności'])
  await window.getByRole('button', { name: 'Przesuń stanowisko „Asystentka działu zakupów” w górę' }).click()
  await expect(preview.locator('.cv-page .cv-role')).toHaveText([
    'Starsza specjalistka ds. zakupów',
    'Asystentka działu zakupów',
    'Specjalistka ds. zakupów',
    'Młodsza specjalistka ds. obsługi klienta'
  ])
  await window.locator('.form fieldset', { hasText: 'Starsza specjalistka ds. zakupów' }).getByRole('button', { name: 'Przesuń punkt 2 w górę' }).click()
  await expect(preview.locator('.cv-page .cv-bullets li').first()).toHaveText(
    'Zarządzanie portfelem ponad 60 dostawców komponentów i materiałów pomocniczych.'
  )

  // Przeciąganie za uchwyt: ostatnia umiejętność na pierwsze miejsce.
  const skills = window.getByRole('region', { name: 'Umiejętności', exact: true })
  await dragOnto(
    skills.getByRole('button', { name: 'Przeciągnij element 5, aby zmienić kolejność' }),
    skills.getByRole('button', { name: 'Przeciągnij element 1, aby zmienić kolejność' })
  )
  await expect(skills.getByRole('textbox', { name: 'Element 1', exact: true })).toHaveValue('Prawo jazdy kat. B')
  await expect(preview.locator('.cv-page .cv-two-col', { hasText: 'Umiejętności' })).toContainText('Prawo jazdy kat. B')

  // Ukryta sekcja znika z podglądu, ale zostaje w formularzu.
  await languages.getByLabel('Ukryj sekcję').check()
  await expect(preview).not.toContainText('Angielski – C1')
  await expect(languages.getByRole('textbox', { name: 'Element 1', exact: true })).toHaveValue('Angielski – C1')

  // Nowa strona przed sekcją i przed wpisem.
  await educationSection.getByLabel('Nowa strona przed tą sekcją').check()
  const firstBlocks = preview.locator('.cv-page-content > .cv-block:first-child')
  await expect(firstBlocks.locator('.cv-section-title')).toHaveText(['Edukacja'])
  await window
    .locator('.form fieldset', { hasText: 'Młodsza specjalistka ds. obsługi klienta' })
    .getByLabel('Nowa strona przed tym wpisem')
    .check()
  await expect(firstBlocks.locator('.cv-role')).toHaveText(['Młodsza specjalistka ds. obsługi klienta'])
  const previewPageCount = await preview.locator('.cv-page').count()

  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(previewPageCount)
  expect(pdf.pages.some((page) => page.startsWith('Młodsza specjalistka ds. obsługi klienta'))).toBe(true)
  expect(pdf.pages.some((page) => page.startsWith('Edukacja'))).toBe(true)
  expect(pdf.pages.join('')).not.toContain('Angielski – C1')
})

test('changes the accent colour and font of one CV in the preview and PDF, with fonts embedded from the app', async () => {
  const library = window.getByRole('list', { name: 'Lista CV' })
  await library.getByRole('button', { name: 'Otwórz' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page').first()).toBeVisible()

  // Kolor akcentu: imię, tytuły sekcji i kropki przy datach.
  const accent = window.getByLabel('Kolor akcentu')
  await expect(accent).toHaveValue('#1a6e72')
  await accent.fill('#8a2be2')
  const purple = 'rgb(138, 43, 226)'
  await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('color', purple)
  await expect(preview.locator('.cv-page .cv-section-title').first()).toHaveCSS('color', purple)
  const dotColor = await preview
    .locator('.cv-page .cv-date--dot')
    .first()
    .evaluate((element) => element.ownerDocument.defaultView!.getComputedStyle(element, '::after').backgroundColor)
  expect(dotColor).toBe(purple)

  // Każdy font: podgląd przeliczony po załadowaniu fontu, PDF z tą samą liczbą stron i osadzonym tylko tym fontem.
  const font = window.getByLabel('Font')
  await expect(font).toHaveValue('lato')
  for (const { value, family, pdfName } of [
    { value: 'lato', family: 'Lato', pdfName: 'Lato' },
    { value: 'source-sans-3', family: 'Source Sans 3', pdfName: 'SourceSans3' },
    { value: 'arimo', family: 'Arimo', pdfName: 'Arimo' }
  ]) {
    await font.selectOption(value)
    await expect(preview.locator('.cv-page .cv-name')).toHaveCSS('font-family', new RegExp(`^"?${family}"?,`))
    await expect(window.getByText('Zmiany zapisane')).toBeVisible()
    const previewPageCount = await preview.locator('.cv-page').count()

    const pdfPath = join(outputDir, `${value}.pdf`)
    await stubSaveDialog(pdfPath)
    await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
    await expect(window.getByText(`Zapisano PDF: ${basename(pdfPath)}`)).toBeVisible()
    const pdf = await readPdf(await readFile(pdfPath))
    expect(pdf.pages).toHaveLength(previewPageCount)
    expect(pdf.pages[0]).toContain('Anna Przykładowa')
    expect(pdf.embeddedFonts.length).toBeGreaterThan(0)
    expect(pdf.embeddedFonts.every((name) => name.includes(pdfName))).toBe(true)
    expect(pdf.fillColors).toContain('#8a2be2')
  }

  // Ustawienia należą do CV: nowe CV ma domyślne, a zmienione zostają w swoim CV.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'Nowe CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Nowe CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.getByLabel('Kolor akcentu')).toHaveValue('#1a6e72')
  await expect(window.getByLabel('Font')).toHaveValue('lato')
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Przykładowe CV' }).getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.getByLabel('Kolor akcentu')).toHaveValue('#8a2be2')
  await expect(window.getByLabel('Font')).toHaveValue('arimo')
})

test('manages the consent clause library, uses a clause in a CV without changing the library and leaves a switched-off clause out of the PDF', async () => {
  const library = window.getByRole('list', { name: 'Lista CV' })
  await expect(library.getByRole('listitem')).toHaveCount(1)

  // Biblioteka: dodanie dwóch klauzul, edycja, domyślna i usunięcie.
  await window.getByRole('button', { name: 'Klauzule zgody' }).click()
  const clauses = window.getByRole('list', { name: 'Lista klauzul' })
  const addClause = async (name: string, text: string) => {
    await window.getByRole('button', { name: 'Dodaj klauzulę' }).click()
    await window.getByLabel('Nazwa').fill(name)
    await window.getByLabel('Treść').fill(text)
    await window.getByRole('button', { name: 'Zapisz' }).click()
  }
  await addClause('Ogólna', 'Wyrażam zgodę na przetwarzanie danych – wersja ogólna.')
  await addClause('Do usunięcia', 'Tymczasowa')
  await addClause('Talent', 'Wyrażam zgodę dla Talent Partners.')
  const row = (name: string) => clauses.getByRole('listitem').filter({ hasText: name })
  await row('Talent').getByRole('button', { name: 'Edytuj' }).click()
  await window.getByLabel('Nazwa').fill('Talent Partners')
  await window.getByRole('button', { name: 'Zapisz' }).click()
  await row('Do usunięcia').getByRole('button', { name: 'Usuń' }).click()
  await window.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click()
  await row('Ogólna').getByRole('button', { name: 'Ustaw jako domyślną' }).click()
  await expect(row('Ogólna')).toContainText('(domyślna)')
  await expect(clauses.getByRole('listitem')).toHaveCount(2)
  await expect(row('Talent Partners')).toContainText('Wyrażam zgodę dla Talent Partners.')

  // Nowe CV dostaje klauzulę domyślną, widoczną w podglądzie.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'Nowe CV' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Nowe CV' }).getByRole('button', { name: 'Otwórz' }).click()
  const preview = window.locator('.preview')
  const consent = window.getByRole('region', { name: 'Klauzula zgody' })
  await expect(consent.getByLabel('Klauzula z biblioteki')).toHaveValue(/.+/)
  await expect(preview.locator('.cv-page .cv-consent')).toHaveText('Wyrażam zgodę na przetwarzanie danych – wersja ogólna.')

  // Wybór innej klauzuli, poprawka w CV, przywrócenie z biblioteki i zapis poprawionej jako nowej.
  await consent.getByLabel('Klauzula z biblioteki').selectOption({ label: 'Talent Partners' })
  const text = consent.getByLabel('Treść w tym CV')
  await expect(text).toHaveValue('Wyrażam zgodę dla Talent Partners.')
  await text.fill('Wyrażam zgodę dla Talent Partners i Banku.')
  await expect(preview.locator('.cv-page .cv-consent')).toHaveText('Wyrażam zgodę dla Talent Partners i Banku.')
  await consent.getByRole('button', { name: 'Przywróć z biblioteki' }).click()
  await expect(text).toHaveValue('Wyrażam zgodę dla Talent Partners.')
  await text.fill('Wyrażam zgodę dla Banku.')
  await consent.getByRole('button', { name: 'Zapisz jako nową klauzulę' }).click()
  await consent.getByLabel('Nazwa nowej klauzuli').fill('Bank')
  await consent.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(consent.getByLabel('Klauzula z biblioteki').locator('option:checked')).toHaveText('Bank')
  await expect(consent.getByRole('button', { name: 'Przywróć z biblioteki' })).toHaveCount(0)

  // Wyłączona klauzula znika z podglądu i PDF.
  await consent.getByLabel('Pokaż klauzulę na dole ostatniej strony').uncheck()
  await expect(preview.locator('.cv-consent')).toHaveCount(0)
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()
  const pdfPath = join(outputDir, 'bez-klauzuli.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF')).toBeVisible()
  expect((await readPdf(await readFile(pdfPath))).pages.join('')).not.toContain('Wyrażam zgodę')

  // Poprawki w CV nie zmieniły biblioteki.
  await window.getByRole('button', { name: '← Moje CV' }).click()
  await window.getByRole('button', { name: 'Klauzule zgody' }).click()
  await expect(clauses.getByRole('listitem')).toHaveCount(3)
  await expect(row('Talent Partners')).toContainText('Wyrażam zgodę dla Talent Partners.')
  await expect(row('Bank')).toContainText('Wyrażam zgodę dla Banku.')
})

test('picks a photo from disk, crops it to 3:4 for the header and removes it, in the preview and PDF', async () => {
  // Zdjęcie poziome 1200 × 800: lewa połowa czerwona, prawa niebieska.
  const photoPath = join(outputDir, 'zdjecie.png')
  const png = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [1200, 800]
    const bitmap = Buffer.alloc(width * height * 4)
    // Piksele w kolejności BGRA.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) bitmap.set(x < width / 2 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4)
    return nativeImage.createFromBitmap(bitmap, { width, height }).toPNG().toString('base64')
  })
  await writeFile(photoPath, Buffer.from(png, 'base64'))
  const brokenPath = join(outputDir, 'uszkodzone.jpg')
  await writeFile(brokenPath, 'to nie jest obraz')
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-photo')).toHaveCount(1)
  const photoField = window.getByRole('group', { name: 'Zdjęcie' })

  // Plik, którego nie da się odczytać jako obraz, daje komunikat i nie zmienia zdjęcia.
  await stubOpenDialog(brokenPath)
  await photoField.getByRole('button', { name: 'Zmień zdjęcie' }).click()
  await expect(photoField.getByRole('alert')).toContainText('Nie udało się wczytać zdjęcia')
  await expect(window.getByRole('dialog', { name: 'Kadrowanie zdjęcia' })).toHaveCount(0)

  // Wybór pliku z dysku przez systemowe okno, kadrowanie i zapis.
  await stubOpenDialog(photoPath)
  await photoField.getByRole('button', { name: 'Zmień zdjęcie' }).click()
  const openDialogOptions = await app.evaluate(
    () => (globalThis as { openDialogCalls?: Electron.OpenDialogOptions[] }).openDialogCalls
  )
  expect(openDialogOptions![0]!.filters![0]!.extensions).toEqual(expect.arrayContaining(['jpg', 'jpeg', 'png']))
  const cropper = window.getByRole('dialog', { name: 'Kadrowanie zdjęcia' })
  await expect(cropper).toBeVisible()
  // Kadr przesunięty maksymalnie w prawo – na zdjęciu zostaje sam niebieski.
  const frame = cropper.getByRole('img', { name: 'Podgląd kadru' })
  const box = (await frame.boundingBox())!
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await window.mouse.down()
  await window.mouse.move(box.x - box.width * 3, box.y + box.height / 2, { steps: 10 })
  await window.mouse.up()
  await cropper.getByRole('button', { name: 'Zastosuj' }).click()
  await expect(cropper).toHaveCount(0)

  // W CV wykadrowany JPEG 3:4 w rozdzielczości do druku (42 mm przy 300 dpi), o szerokości 42 mm.
  const photo = preview.locator('.cv-page .cv-photo')
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  const stored = await photo.evaluate(async (element) => {
    const image = element as typeof element & { naturalWidth: number; naturalHeight: number; src: string; decode: () => Promise<void> }
    await image.decode()
    const view = element.ownerDocument.defaultView!
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
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      cssWidth: view.getComputedStyle(element).width,
      corners: [pixel(2, 2), pixel(canvas.width - 3, canvas.height - 3)],
      length: image.src.length
    }
  })
  expect(stored.width).toBe(496)
  expect(stored.height).toBe(661)
  expect(parseFloat(stored.cssWidth)).toBeCloseTo((42 * 96) / 25.4, 0)
  for (const [r = 0, , b = 0] of stored.corners) {
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(40)
  }
  expect(stored.length).toBeLessThan(300_000)
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()

  // Eksport PDF czeka na wczytanie zdjęcia – jest na pierwszej stronie.
  const withPhoto = join(outputDir, 'ze-zdjeciem.pdf')
  await stubSaveDialog(withPhoto)
  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText(`Zapisano PDF: ${basename(withPhoto)}`)).toBeVisible()
  expect((await readPdf(await readFile(withPhoto))).imagesPerPage[0]).toBe(1)

  // Bez zdjęcia nagłówek zajmuje pełną szerokość, a w PDF nie ma obrazu.
  await photoField.getByRole('button', { name: 'Usuń zdjęcie' }).click()
  await expect(preview.locator('.cv-photo')).toHaveCount(0)
  await expect(preview.locator('.cv-page .cv-header')).toHaveCSS('grid-template-columns', /^\S+$/)
  await expect(photoField.getByRole('button', { name: 'Wybierz zdjęcie' })).toBeVisible()
  await expect(window.getByText('Zmiany zapisane')).toBeVisible()
  const withoutPhoto = join(outputDir, 'bez-zdjecia.pdf')
  await stubSaveDialog(withoutPhoto)
  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText(`Zapisano PDF: ${basename(withoutPhoto)}`)).toBeVisible()
  const pdf = await readPdf(await readFile(withoutPhoto))
  expect(pdf.imagesPerPage.every((count) => count === 0)).toBe(true)
  expect(pdf.pages[0]).toContain('Anna Przykładowa')

  // Anulowane okno wyboru niczego nie zmienia.
  await stubOpenDialog(null)
  await photoField.getByRole('button', { name: 'Wybierz zdjęcie' }).click()
  await expect(window.getByRole('dialog', { name: 'Kadrowanie zdjęcia' })).toHaveCount(0)
  await expect(preview.locator('.cv-photo')).toHaveCount(0)
})

test('shows the page count, warns about long CVs and oversized fragments only in the preview, and zooms without changing the page split', async () => {
  const pdfPath = join(outputDir, 'long.pdf')
  await stubSaveDialog(pdfPath)
  await window.getByRole('list', { name: 'Lista CV' }).getByRole('button', { name: 'Otwórz' }).click()
  const preview = window.locator('.preview')
  const pageCount = preview.getByRole('status')
  await expect(pageCount).toHaveText('2 strony')
  await expect(preview).not.toContainText('więcej niż 2 strony')

  // Podsumowanie dłuższe niż strona: nagłówek dostaje własną stronę, jest wyróżniony i CV ma ponad 2 strony.
  await window.getByLabel('Podsumowanie').fill(Array.from({ length: 120 }, (_, i) => `Bardzo długie podsumowanie, wiersz ${i + 1}.`).join('\n'))
  const message = 'Ten fragment jest za długi, aby zmieścić się na stronie – skróć go'
  await expect(preview.getByText(message)).toBeVisible()
  await expect(preview.locator('.cv-page').first().locator('.cv-block--oversized .cv-header')).toHaveCount(1)
  await expect(pageCount).toHaveText('3 strony')
  await expect(preview).toContainText('CV ma więcej niż 2 strony – warto je skrócić.')

  // Eksport nie jest blokowany, a wyróżnienie nie trafia do PDF.
  await window.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  await expect(window.getByText('Zapisano PDF')).toBeVisible()
  const pdf = await readPdf(await readFile(pdfPath))
  expect(pdf.pages).toHaveLength(3)
  expect(pdf.pages.join('')).not.toContain('Ten fragment jest za długi')
  expect(pdf.fillColors).not.toContain('#b42318')

  // Domyślnie strona wypełnia szerokość panelu (z marginesami 24 px), także po zmianie rozmiaru okna.
  const page = preview.locator('.cv-page').first()
  const pageWidth = async () => (await page.boundingBox())!.width
  const panelWidth = () => preview.evaluate((element) => element.clientWidth)
  await expect.poll(async () => (await pageWidth()) - ((await panelWidth()) - 48)).toBeCloseTo(0, 0)
  const widthBefore = await pageWidth()
  await app.evaluate(({ BrowserWindow }) => {
    const [browserWindow] = BrowserWindow.getAllWindows()
    const [width, height] = browserWindow!.getSize()
    browserWindow!.setSize(width! + 300, height!)
  })
  await expect.poll(pageWidth).toBeGreaterThan(widthBefore + 200)
  await expect.poll(async () => (await pageWidth()) - ((await panelWidth()) - 48)).toBeCloseTo(0, 0)

  // 100%, +, −: strona w skali 1:1 (210 mm = 793,7 px) i o jeden poziom większa/mniejsza; podział stron bez zmian.
  const pageTexts = () => preview.locator('.cv-page').evaluateAll((pages) => pages.map((page) => page.textContent))
  const textsAtFit = await pageTexts()
  await preview.getByRole('button', { name: '100%' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7, 0)
  await preview.getByRole('button', { name: 'Powiększ' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7 * 1.25, 0)
  expect(await pageTexts()).toEqual(textsAtFit)
  await preview.getByRole('button', { name: 'Pomniejsz' }).click()
  await preview.getByRole('button', { name: 'Pomniejsz' }).click()
  await expect.poll(pageWidth).toBeCloseTo(793.7 * 0.75, 0)
  expect(await pageTexts()).toEqual(textsAtFit)
  await expect(pageCount).toHaveText('3 strony')
})

test('exports a CV to a JSON file and imports it back as a new CV; an invalid file leaves the library unchanged', async () => {
  const library = window.getByRole('list', { name: 'Lista CV' })
  const rows = library.getByRole('listitem')
  await expect(rows).toHaveCount(1)
  await library.getByRole('button', { name: 'Zmień nazwę' }).click()
  await library.getByLabel('Nazwa CV').fill('CV – Talent Partners')
  await library.getByRole('button', { name: 'Zapisz' }).click()
  await expect(rows.first()).toContainText('CV – Talent Partners')

  // Eksport przez systemowe okno zapisu, z nazwą pliku podpowiedzianą z nazwy CV.
  const jsonPath = join(outputDir, 'kopia.json')
  await stubSaveDialog(jsonPath)
  await library.getByRole('button', { name: 'Eksportuj do pliku' }).click()
  await expect(window.getByRole('status')).toHaveText('Zapisano plik: kopia.json')
  const saveDialogOptions = await app.evaluate(
    () => (globalThis as { saveDialogCalls?: Electron.SaveDialogOptions[] }).saveDialogCalls
  )
  expect(basename(saveDialogOptions![0]!.defaultPath!)).toBe('CV – Talent Partners.json')
  const exported = JSON.parse(await readFile(jsonPath, 'utf8'))
  expect(exported).toMatchObject({ schemaVersion: 1, name: 'CV – Talent Partners', header: { fullName: 'Anna Przykładowa' } })

  // Import tego samego pliku dodaje nowe CV obok istniejącego – niczego nie nadpisuje.
  await stubOpenDialog(jsonPath)
  await window.getByRole('button', { name: 'Importuj z pliku' }).click()
  await expect(window.getByRole('status')).toHaveText('Zaimportowano „CV – Talent Partners”.')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'CV – Talent Partners' })).toHaveCount(2)
  await rows.first().getByRole('button', { name: 'Otwórz' }).click()
  await expect(window.locator('.preview .cv-page .cv-name')).toHaveText('Anna Przykładowa')
  await window.getByRole('button', { name: '← Moje CV' }).click()

  // Niepoprawny plik → komunikat po polsku, biblioteka bez zmian.
  const invalidPath = join(outputDir, 'zepsute.json')
  await writeFile(invalidPath, '{ "name": "Nie CV" }')
  await stubOpenDialog(invalidPath)
  await window.getByRole('button', { name: 'Importuj z pliku' }).click()
  await expect(window.getByRole('alert')).toHaveText('Nie udało się zaimportować CV. Plik nie zawiera poprawnego CV.')
  await expect(rows).toHaveCount(2)

  // Anulowane okno wyboru niczego nie zmienia.
  await stubOpenDialog(null)
  await window.getByRole('button', { name: 'Importuj z pliku' }).click()
  await expect(window.getByRole('alert')).toHaveCount(0)
  await expect(rows).toHaveCount(2)
})

// Przeciąga element za uchwyt myszą krok po kroku, tak jak użytkownik (dnd-kit reaguje na zdarzenia wskaźnika).
async function dragOnto(handle: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await handle.scrollIntoViewIfNeeded()
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

// A4 w punktach PDF (210 × 297 mm).
const A4_PT = { width: 595.28, height: 841.89 }

type ParsedPdf = { pages: string[]; pageSizes: { width: number; height: number }[]; title: string; author: string; embeddedFonts: string[]; fillColors: string[]; imagesPerPage: number[] }

// Odczytuje PDF tak jak czytnik/ATS: zaznaczalny tekst każdej strony, metadane, osadzone fonty, kolory wypełnień i liczbę obrazów na stronach.
async function readPdf(bytes: Buffer): Promise<ParsedPdf> {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(bytes), fontExtraProperties: true }).promise
  const pages: string[] = []
  const pageSizes: ParsedPdf['pageSizes'] = []
  const embeddedFonts = new Set<string>()
  const fillColors = new Set<string>()
  const imagesPerPage: number[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const [, , width = 0, height = 0] = page.view
    pageSizes.push({ width, height })
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
    const operators = await page.getOperatorList()
    imagesPerPage.push(operators.fnArray.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject).length)
    operators.fnArray.forEach((fn, index) => {
      if (fn === OPS.setFillRGBColor) fillColors.add(String(operators.argsArray[index]?.[0]).toLowerCase())
    })
    for (const fontId of new Set(content.items.flatMap((item) => ('fontName' in item ? [item.fontName] : [])))) {
      const font = page.commonObjs.get(fontId) as { name?: string; missingFile?: boolean }
      if (font.name && !font.missingFile) embeddedFonts.add(font.name)
    }
  }
  const { info } = (await document.getMetadata()) as { info: { Title?: string; Author?: string } }
  return { pages, pageSizes, title: info.Title ?? '', author: info.Author ?? '', embeddedFonts: [...embeddedFonts], fillColors: [...fillColors], imagesPerPage }
}
