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
    await page.screenshot({ path: join(out, `${theme}-A.png`) })
    await page.locator('.preview .cv-page [contenteditable]').nth(3).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${theme}-A-selected.png`) })
    await page.setViewportSize({ width: 960, height: 700 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${theme}-A-960.png`) })
    expect(errors).toEqual([])
    await app.close()
    await rm(tempDir, { recursive: true, force: true })
  })
}
