// PROTOTYP – zrzuty ekranu wariantów A/B/C na Sample CV (tymczasowy katalog danych). Wynik: dist/prototype-shots/.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { dictionaryFor } from '../../../../shared/i18n/languages'

const out = resolve(__dirname, '../../../../../dist/prototype-shots')
const t = dictionaryFor('pl')

async function setVariant(window: Page, variant: string) {
  await window.evaluate((v) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', v)
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new Event('prototype-variant-change'))
  }, variant)
  await window.waitForTimeout(800)
}

for (const theme of ['light', 'dark'] as const) {
  test(`variants ${theme}`, async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'moje-cv-proto-'))
    const env = { ...process.env, MOJE_CV_LANGUAGE: 'pl', MOJE_CV_APPEARANCE: theme, MOJE_CV_UPDATE_URL: 'off', MOJE_CV_E2E_HIDDEN: '1' } as Record<string, string>
    const app = await electron.launch({ args: ['.', `--user-data-dir=${join(tempDir, 'ud')}`, '--lang=pl'], env, colorScheme: null })
    const window = await app.firstWindow()
    const errors: string[] = []
    window.on('pageerror', (e) => errors.push(String(e)))
    await window.setViewportSize({ width: 1280, height: 820 })
    const list = window.getByRole('list', { name: t.library.list })
    await list.locator(':scope > li').first().getByRole('button', { name: t.library.open }).click()
    await expect(window.locator('.preview .cv-page').first()).toBeVisible()
    for (const v of ['current', 'A', 'B', 'C']) {
      await setVariant(window, v)
      await window.screenshot({ path: join(out, `${theme}-${v}.png`) })
    }
    // Interakcje: A – klik w tytuł sekcji na stronie; B – menu Sekcje i Szablon; C – tryb Projekt.
    await setVariant(window, 'A')
    await window.locator('.preview .cv-page [contenteditable]').nth(3).click()
    await window.waitForTimeout(400)
    await window.screenshot({ path: join(out, `${theme}-A-selected.png`) })
    await setVariant(window, 'B')
    for (const name of ['Szablon', 'Sekcje']) {
      const button = window.locator('.pb-format-bar button', { hasText: name }).first()
      if (await button.count()) {
        await button.click()
        await window.waitForTimeout(400)
        await window.screenshot({ path: join(out, `${theme}-B-${name}.png`) })
        await window.keyboard.press('Escape')
      }
    }
    await setVariant(window, 'C')
    const projekt = window.locator('.pc-stage-toggle').getByText('Projekt', { exact: true }).first()
    if (await projekt.count()) {
      await projekt.click()
      await window.waitForTimeout(800)
      await window.screenshot({ path: join(out, `${theme}-C-projekt.png`) })
    }
    await window.setViewportSize({ width: 960, height: 700 })
    for (const v of ['A', 'B', 'C']) {
      await setVariant(window, v)
      await window.screenshot({ path: join(out, `${theme}-${v}-960.png`) })
    }
    console.log('PAGE ERRORS', theme, errors)
    await app.close()
    await rm(tempDir, { recursive: true, force: true })
  })
}
