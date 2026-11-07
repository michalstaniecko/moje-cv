import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sampleCvs } from '../src/renderer/src/domain/sampleCv'
import type { CvDocument, ExperienceItem } from '../src/renderer/src/domain/schema'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// Pomiar wydajności dużego CV (ticket #72, próg 100 ms – zob. .docs/spec.md, sekcja „Pomiar”).
// Opcjonalny: pomijany bez `MOJE_CV_PERF=1`, bo czasy zależą od sprzętu i w CI byłyby niestabilne. Asercje sprawdzają
// tylko poprawność fixture'a; progi ocenia człowiek na M1. Uruchamiać na zbudowanej aplikacji, nigdy na serwerze
// deweloperskim:
//   MOJE_CV_PERF=1 pnpm test:e2e:packaged e2e/performance.spec.ts   (aplikacja z electron-builder, `MOJE_CV_APP`)
//   pnpm build && MOJE_CV_PERF=1 pnpm exec playwright test e2e/performance.spec.ts   (kod z `out/`)
// Okno jest widoczne (bez `MOJE_CV_E2E_HIDDEN`): niewidoczne okno macOS może dławić klatki i zafałszować pomiar.
const enabled = process.env['MOJE_CV_PERF'] === '1'
const packagedExecutable = process.env['MOJE_CV_APP']

let app: ElectronApplication
let window: Page
let outputDir: string

test.skip(!enabled, 'Pomiar wydajności: uruchom z MOJE_CV_PERF=1')

test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-perf-'))
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { ...process.env, MOJE_CV_LANGUAGE: 'en', MOJE_CV_APPEARANCE: 'light', MOJE_CV_PERF: '1' } as Record<string, string>
  // Bez sprawdzania nowej wersji przy starcie: żaden test nie łączy się z GitHubem (ADR-0006).
  env['MOJE_CV_UPDATE_URL'] = 'off'
  delete env['MOJE_CV_E2E_HIDDEN']
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env }
      : { args: ['.', userDataDir], env }
  )
  window = await app.firstWindow()
  // `MOJE_CV_PERF_CPU_SLOWDOWN=4` spowalnia procesor renderera (DevTools) – przybliżenie starszego Maca.
  const slowdown = Number(process.env['MOJE_CV_PERF_CPU_SLOWDOWN'] ?? 1)
  if (slowdown > 1) {
    const session = await window.context().newCDPSession(window)
    await session.send('Emulation.setCPUThrottlingRate', { rate: slowdown })
  }
})

test.afterEach(async () => {
  await app.close()
  await rm(outputDir, { recursive: true, force: true })
})

const LONG_CV_NAME = 'Long CV (performance)'
const LAST_ROLE = 'Last position (performance)'
const POSITIONS = 18

// Duży CV z Sample CV (en): 18 stanowisk po 5 punktów, pięć razy dłuższe podsumowanie i zdjęcie w zapisywanym
// rozmiarze (JPEG 496 × 661, jak po kadrowaniu).
function longCv(photoDataUrl: string): CvDocument {
  const sample = sampleCvs.en
  const sections = sample.sections.map((section) => {
    if (section.type !== 'experience') return section
    const items: ExperienceItem[] = Array.from({ length: POSITIONS }, (_, index) => {
      const source = section.items[index % section.items.length]!
      const id = `perf-e${index + 1}`
      const bullets = Array.from({ length: 5 }, (_, bullet) => ({
        id: `${id}-b${bullet + 1}`,
        text: source.bullets[bullet % source.bullets.length]!.text
      }))
      return { ...source, id, bullets, role: index === POSITIONS - 1 ? LAST_ROLE : source.role }
    })
    return { ...section, items }
  })
  return {
    ...sample,
    name: LONG_CV_NAME,
    header: { ...sample.header, photo: { dataUrl: photoDataUrl }, summary: Array(5).fill(sample.header.summary).join(' ') },
    sections
  }
}

// Zdjęcie przypominające fotografię (gradient z lekkim szumem), żeby JPEG miał realistyczny rozmiar.
async function photoDataUrl(): Promise<string> {
  const base64 = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [496, 661]
    const bitmap = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const noise = Math.random() * 24
        // Piksele w kolejności BGRA.
        bitmap.set([(x / width) * 200 + noise, (y / height) * 180 + noise, 120 + noise, 255], (y * width + x) * 4)
      }
    return nativeImage.createFromBitmap(bitmap, { width, height }).toJPEG(90).toString('base64')
  })
  return `data:image/jpeg;base64,${base64}`
}

// Import przez systemowe okno wyboru pliku (podmienione), czyli normalną ścieżką.
async function importCv(document: CvDocument) {
  const path = join(outputDir, 'long-cv.json')
  await writeFile(path, JSON.stringify(document))
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
  }, path)
  await window.getByRole('button', { name: 'Import from file' }).click()
  await expect(window.getByRole('status').filter({ hasText: `Imported “${LONG_CV_NAME}”.` })).toBeVisible()
}

type Stats = { count: number; median: number; p95: number; max: number }

function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (quantile: number) => sorted[Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1)] ?? NaN
  const round = (value: number) => Math.round(value * 10) / 10
  return { count: sorted.length, median: round(at(0.5)), p95: round(at(0.95)), max: round(sorted.at(-1) ?? NaN) }
}

test('a 4+ page CV with a photo: keystroke-to-preview time, autosave time in the main process and long tasks', async () => {
  test.setTimeout(180_000)
  const photo = await photoDataUrl()
  await importCv(longCv(photo))
  await window.getByRole('list', { name: 'CV list' }).getByRole('listitem').filter({ hasText: LONG_CV_NAME }).getByRole('button', { name: 'Open' }).click()

  // Fixture: co najmniej 4 strony i zdjęcie w podglądzie.
  const preview = window.locator('.preview')
  await expect(preview.locator('.cv-page .cv-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect.poll(() => preview.locator('.cv-page').count()).toBeGreaterThanOrEqual(4)
  const pageCount = await preview.locator('.cv-page').count()
  await expect(window.getByText('Changes saved')).toHaveCount(0)

  // Pomiar od czystego stanu: bez wpisów z otwarcia CV i importu.
  await app.evaluate(() => {
    const entries = (globalThis as { cvPerfEntries?: unknown[] }).cvPerfEntries
    if (!entries) throw new Error('Brak pomiaru w procesie głównym – czy aplikacja ma MOJE_CV_PERF=1?')
    entries.length = 0
  })
  await window.evaluate(() => {
    performance.clearMeasures()
    const recorded: { longTasks: number[]; events: { name: string; duration: number }[] } = { longTasks: [], events: [] }
    ;(globalThis as { perfRecorded?: typeof recorded }).perfRecorded = recorded
    // Typy `e2e` są bez biblioteki DOM: typy wpisów przeglądarki (`longtask`, `event`) nie są w typach Node.
    const options = (options: object) => options as Parameters<PerformanceObserver['observe']>[0]
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) recorded.longTasks.push(entry.duration)
    }).observe(options({ type: 'longtask' }))
    // Event Timing (pomocniczo): opóźnienie samego pola, od klawisza do następnej klatki.
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) recorded.events.push({ name: entry.name, duration: entry.duration })
    }).observe(options({ type: 'event', durationThreshold: 16 }))
  })

  // 30 znaków w podsumowaniu i 30 w punkcie ostatniego stanowiska, co ok. 150 ms (jak szybkie pisanie).
  const typed = 'Faster preview for long CVs ok'
  const summary = window.getByLabel('Summary')
  await summary.click()
  await summary.pressSequentially(typed, { delay: 150 })
  const lastBullet = window
    .locator('.form fieldset', { hasText: LAST_ROLE })
    .getByRole('textbox', { name: 'Bullet 1', exact: true })
  await lastBullet.scrollIntoViewIfNeeded()
  await lastBullet.click()
  await lastBullet.pressSequentially(typed, { delay: 150 })
  // Przy pisaniu co 150 ms debounce autozapisu (500 ms) zapisuje dopiero po ostatnim znaku. Dla próbki autozapisów
  // jeszcze 10 znaków co 800 ms – każdy trafia na dysk osobno (długie zadania są zbierane dalej).
  const paused = '..........'
  await lastBullet.pressSequentially(paused, { delay: 800 })
  await expect(preview.locator('.cv-page').filter({ hasText: typed })).toHaveCount(2)
  await expect(preview.locator('.cv-page').filter({ hasText: typed + paused })).toHaveCount(1)
  await expect(window.getByText('Changes saved')).toBeVisible()

  const renderer = await window.evaluate(() => ({
    keystrokes: performance.getEntriesByName('cv:keystroke-to-preview', 'measure').map((entry) => entry.duration),
    ...(globalThis as { perfRecorded?: { longTasks: number[]; events: { name: string; duration: number }[] } }).perfRecorded!
  }))
  const main = await app.evaluate(
    () => (globalThis as { cvPerfEntries?: { name: string; duration: number }[] }).cvPerfEntries ?? []
  )
  const byName = (name: string) => main.filter((entry) => entry.name === name).map((entry) => entry.duration)
  const photoKb = Math.round(photo.length / 1024)
  const fileKb = Math.round(JSON.stringify(longCv(photo), null, 2).length / 1024)

  const table = {
    'keystroke → preview painted (renderer)': stats(renderer.keystrokes),
    'input event duration (Event Timing ≥ 16 ms)': stats(
      renderer.events.filter((event) => ['keydown', 'keypress', 'input', 'keyup', 'beforeinput'].includes(event.name)).map((event) => event.duration)
    ),
    'long tasks while typing (renderer)': stats(renderer.longTasks),
    'cv:update total (main)': stats(byName('cv:update')),
    '  validate (Zod)': stats(byName('cv:update/validate')),
    '  read + parse (update)': stats(byName('cv:update/read')),
    '  read + parse (save → listEntry)': stats(byName('cv:update/check')),
    '  writeJsonAtomic': stats(byName('cv:update/write'))
  }
  console.log(
    `Performance (${pageCount} pages, photo ${photoKb} kB, file ~${fileKb} kB, ${packagedExecutable ? 'packaged app' : 'out/ build'}, ` +
      `renderer CPU slowdown ×${process.env['MOJE_CV_PERF_CPU_SLOWDOWN'] ?? 1}), ms:`
  )
  console.table(table)

  // Pomiar się odbył (bez progów czasowych).
  expect(renderer.keystrokes.length).toBeGreaterThan(0)
  expect(byName('cv:update').length).toBeGreaterThanOrEqual(10)
})
