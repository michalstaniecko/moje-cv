// PROTOTYP – zrzuty wariantu A na Sample CV (tymczasowy katalog danych, nigdy prawdziwa biblioteka).
// VITE_PROTOTYPE=1 pnpm build && pnpm playwright test -c src/renderer/src/prototype/shots → dist/prototype-shots/.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { dictionaryFor } from '../../../../shared/i18n/languages'

const out = resolve(__dirname, '../../../../../dist/prototype-shots')
const t = dictionaryFor('pl')

async function setVariant(page: Page, variant: string) {
  await page.evaluate((v) => {
    const url = new URL(globalThis.location.href)
    url.searchParams.set('variant', v)
    globalThis.history.replaceState(null, '', url)
    globalThis.dispatchEvent(new Event('prototype-variant-change'))
  }, variant)
  await page.waitForTimeout(600)
}

for (const theme of ['light', 'dark'] as const) {
  test(`variant A ${theme}`, async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'moje-cv-proto-'))
    const env = { ...process.env, MOJE_CV_LANGUAGE: 'pl', MOJE_CV_APPEARANCE: theme, MOJE_CV_UPDATE_URL: 'off', MOJE_CV_E2E_HIDDEN: '1' } as Record<string, string>
    const app = await electron.launch({ args: ['.', `--user-data-dir=${join(tempDir, 'ud')}`, '--lang=pl'], env, colorScheme: null })
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.setViewportSize({ width: 1280, height: 820 })
    const list = page.getByRole('list', { name: t.library.list })
    await list.locator(':scope > li').first().getByRole('button', { name: t.library.open }).click()
    await expect(page.locator('.preview .cv-page').first()).toBeVisible()
    await setVariant(page, 'A')
    const shot = (name: string) => page.screenshot({ path: join(out, `${theme}-A${name}.png`) })
    const inspector = page.locator('.pa-inspector')
    const row = (name: string) => inspector.locator('.pa-element-name', { hasText: name })
    const toDocument = async () => {
      if (await inspector.locator('.pa-crumb').isVisible()) await inspector.locator('.pa-crumb').click()
      await page.waitForTimeout(200)
    }
    const focusedOnPage = page.locator('.preview [contenteditable]:focus')
    await shot('')

    // Dokument → „Elementy CV” (konspekt w Inspektorze).
    await inspector.locator('summary', { hasText: 'Elementy CV' }).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(200)
    await shot('-elements')

    // Klik w pole na stronie → opcje jego części.
    await page.locator('.preview .cv-page [contenteditable]').nth(3).click()
    await page.waitForTimeout(400)
    await shot('-selected')

    // Ukryta sekcja „Zainteresowania”: wiersz otwiera jej panel, „+ Dodaj element” ją pokazuje i dodaje element z kursorem.
    await toDocument()
    await row('Zainteresowania').click()
    await expect(inspector.locator('.pa-inspector-title')).toHaveText('Zainteresowania')
    await page.waitForTimeout(200)
    await shot('-section-hidden')
    await inspector.getByRole('button', { name: t.editor.addListItem }).click()
    await expect(focusedOnPage).toHaveCount(1)
    await page.waitForTimeout(400)
    await shot('-section-hidden-added')

    // Ta sama sekcja opróżniona na stronie (nowy pusty element usunięty, tekst starego skasowany) → „Sekcja jest pusta”.
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(150)
    await page.keyboard.press('Meta+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(300)
    await toDocument()
    await row('Zainteresowania').click()
    await expect(inspector.getByText('Sekcja jest pusta')).toBeVisible()
    await shot('-section-empty')
    await inspector.getByRole('button', { name: t.editor.addListItem }).click()
    await expect(focusedOnPage).toHaveCount(1)
    await page.keyboard.type('Wspinaczka, fotografia')
    await page.waitForTimeout(400)
    await shot('-section-empty-added')

    // Nagłówek, zdjęcie, klauzula zgody.
    await toDocument()
    await row('Nagłówek').click()
    await page.waitForTimeout(400)
    await shot('-header')
    await toDocument()
    await row('Zdjęcie').click()
    await page.waitForTimeout(400)
    await shot('-photo')
    await toDocument()
    await row('Klauzula zgody').click()
    await page.waitForTimeout(400)
    await shot('-consent')
    await inspector.getByLabel('Nazwa').fill('RODO – ogólna')
    await inspector.getByRole('button', { name: 'Zapisz bieżący tekst' }).click()
    await expect(inspector.getByRole('radio', { name: /RODO – ogólna/ })).toBeChecked()
    await page.waitForTimeout(200)
    await shot('-consent-saved')

    // Atrapy w zwiniętej grupie „Układ i format (wkrótce)” – rozwinięte.
    await toDocument()
    await inspector.locator('summary', { hasText: 'Układ i format' }).click()
    await inspector.locator('summary', { hasText: 'Układ i format' }).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(200)
    await shot('-stubs')
    await inspector.locator('summary', { hasText: 'Układ i format' }).click()

    // Preview mode: sam „Dokument”, wiersze elementów bez nawigacji.
    await page.locator('.mode-toggle button').nth(1).click()
    await page.waitForTimeout(400)
    await inspector.locator('summary', { hasText: 'Elementy CV' }).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await shot('-preview')
    await page.locator('.mode-toggle button').nth(0).click()
    await page.waitForTimeout(300)

    // Okno 960 px: Dokument i panel sekcji.
    await page.setViewportSize({ width: 960, height: 700 })
    await toDocument()
    await page.waitForTimeout(400)
    await shot('-960')
    await row('Wykształcenie').click()
    await page.waitForTimeout(400)
    await shot('-960-section')
    expect(errors).toEqual([])
    await app.close()
    await rm(tempDir, { recursive: true, force: true })
  })
}
