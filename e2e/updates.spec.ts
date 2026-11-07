import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InterfaceLanguage } from '../src/shared/i18n/languages'
import { releaseUrl, RELEASES_URL } from '../src/shared/links'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// Powiadomienie o nowej wersji (ADR-0006). Zamiast GitHuba aplikacja pyta lokalny serwer testu
// (`MOJE_CV_UPDATE_URL=http://127.0.0.1:<port>/…`, sprawdzenie od razu po starcie), więc nie ma prawdziwego ruchu
// sieciowego. Natywne dialogi są podmieniane w procesie głównym.

let app: ElectronApplication
let window: Page
let outputDir: string
let server: Server
let feedUrl: string

// Odpowiedź serwera ustawiana w teście, zapytania zapisane do sprawdzenia. `gate` wstrzymuje odpowiedź.
let reply: { status: number; body: unknown }
let gate: Promise<void> | null
let requests: { url: string | undefined; headers: IncomingHttpHeaders }[]

const packagedExecutable = process.env['MOJE_CV_APP']

// Jak w export.spec.ts: tymczasowy katalog danych, wymuszony język interfejsu (`language: null` zostawia wybór menu)
// i jasny wygląd, bez emulacji `prefers-color-scheme` przez Playwrighta.
async function launch({ language = 'en' }: { language?: InterfaceLanguage | null } = {}) {
  const userDataDir = `--user-data-dir=${join(outputDir, 'user-data')}`
  const env = { MOJE_CV_APPEARANCE: 'light', ...process.env } as Record<string, string>
  // Okno w tle (bez fokusu i niewidoczne); `MOJE_CV_E2E_HEADED=1` pokazuje je normalnie do debugowania.
  if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
  env['MOJE_CV_UPDATE_URL'] = feedUrl
  if (language) env['MOJE_CV_LANGUAGE'] = language
  else delete env['MOJE_CV_LANGUAGE']
  app = await electron.launch(
    packagedExecutable
      ? { executablePath: packagedExecutable, args: [userDataDir], env, colorScheme: null }
      : { args: ['.', userDataDir], env, colorScheme: null }
  )
  window = await app.firstWindow()
}

async function restart() {
  await app.close()
  await launch()
}

test.beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  reply = { status: 200, body: { tag_name: 'v99.0.0', html_url: 'https://example.com/not-this-one' } }
  gate = null
  requests = []
  server = createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers })
    void (gate ?? Promise.resolve()).then(() => {
      response.writeHead(reply.status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(reply.body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  feedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/releases/latest`
})

test.afterEach(async () => {
  await app.close()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await rm(outputDir, { recursive: true, force: true })
})

// Podmienia otwieranie adresów w przeglądarce systemowej i zapamiętuje, z czym je wywołano.
async function stubOpenExternal() {
  await app.evaluate(({ shell }) => {
    const calls: string[] = []
    ;(globalThis as { openExternalCalls?: typeof calls }).openExternalCalls = calls
    shell.openExternal = async (url: string) => {
      calls.push(url)
    }
  })
}

const openExternalCalls = () => app.evaluate(() => (globalThis as { openExternalCalls?: string[] }).openExternalCalls)

// Podmienia natywny dialog (`dialog.showMessageBox`): zapamiętuje opcje i „klika” przycisk o indeksie `response`.
async function stubMessageBox(response: number) {
  await app.evaluate(({ dialog }, response) => {
    const calls: Electron.MessageBoxOptions[] = []
    ;(globalThis as { messageBoxCalls?: typeof calls }).messageBoxCalls = calls
    const stub = async (...args: unknown[]) => {
      calls.push(args.at(-1) as Electron.MessageBoxOptions)
      return { response, checkboxChecked: false }
    }
    dialog.showMessageBox = stub as typeof dialog.showMessageBox
  }, response)
}

const messageBoxCalls = () =>
  app.evaluate(() =>
    ((globalThis as { messageBoxCalls?: Electron.MessageBoxOptions[] }).messageBoxCalls ?? []).map(
      ({ message, detail, buttons }) => ({ message, detail, buttons })
    )
  )

// Klika pozycję menu aplikacji w procesie głównym (jak w export.spec.ts).
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

const helpItems = (menuLabel: string) =>
  app.evaluate(({ Menu }, menuLabel) => {
    const submenu = Menu.getApplicationMenu()?.items.find((item) => item.label === menuLabel)?.submenu?.items ?? []
    return submenu.filter((item) => item.type !== 'separator').map((item) => item.label)
  }, menuLabel)

// Wybiera język w menu Language (menu szukane po pozycji English, bo jego etykieta zależy od języka).
async function chooseLanguage(itemLabel: string) {
  await app.evaluate(
    ({ BrowserWindow, Menu }, { itemLabel }) => {
      const menu = Menu.getApplicationMenu()?.items.find((item) => item.submenu?.items.some((entry) => entry.label === 'English'))
      const item = menu?.submenu?.items.find((item) => item.label === itemLabel)
      if (!item) throw new Error(`Brak pozycji menu Language → ${itemLabel}`)
      const window = BrowserWindow.getAllWindows().find((window) => window.isVisible())
      item.click(undefined, window, window?.webContents)
    },
    { itemLabel }
  )
}

const appVersion = () => app.evaluate(({ app }) => app.getVersion())

const notice = (name = 'New version') => window.getByRole('region', { name })

// Biblioteka CV jest już wczytana (przykładowe CV na liście).
async function libraryLoaded() {
  await expect(window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' })).toBeVisible()
}

async function savedUpdateCheck(): Promise<{ latestVersion?: string } | undefined> {
  try {
    return JSON.parse(await readFile(join(outputDir, 'user-data', 'settings.json'), 'utf8')).updateCheck
  } catch {
    return undefined
  }
}

test('a newer release shows the Update notice; Download opens its release page, and a closed notice stays closed after a restart without asking again within 24 h', async () => {
  await launch()
  await expect(notice()).toBeVisible()
  await expect(notice().getByRole('status')).toHaveText('A new version of CV Press is available: 99.0.0.')
  await expect(window.getByRole('button', { name: 'New CV' })).not.toBeFocused()

  await stubOpenExternal()
  await notice().getByRole('button', { name: 'Download' }).click()
  await expect.poll(openExternalCalls).toEqual([releaseUrl('99.0.0')])

  await notice().getByRole('button', { name: 'Close' }).click()
  await expect(notice()).toBeHidden()
  await expect.poll(async () => (await readFile(join(outputDir, 'user-data', 'settings.json'), 'utf8')).includes('dismissedVersion')).toBe(true)

  await restart()
  await libraryLoaded()
  // Sprawdzenie przy starcie idzie bez opóźnienia; po chwili nadal nie ma paska ani drugiego zapytania.
  await window.waitForTimeout(1500)
  await expect(notice()).toBeHidden()
  expect(requests).toHaveLength(1)

  // Ręczne sprawdzenie pyta od razu i proponuje pobranie; „Download” otwiera stronę wydania, nie adres z odpowiedzi.
  await stubMessageBox(0)
  await stubOpenExternal()
  await clickMenuItem('Help', 'Check for Updates…')
  await expect.poll(messageBoxCalls).toEqual([
    {
      message: 'A new version of CV Press is available: 99.0.0.',
      detail: `You have version ${await appVersion()}. Download the new version and replace the app in your Applications folder.`,
      buttons: ['Download', 'Later']
    }
  ])
  await expect.poll(openExternalCalls).toEqual([releaseUrl('99.0.0')])
  expect(requests).toHaveLength(2)
  await expect(notice()).toBeHidden()
})

test('the request carries only the app version: no cookies and no query string', async () => {
  await launch()
  await expect(notice()).toBeVisible()

  expect(requests).toHaveLength(1)
  const [{ url, headers }] = requests as [(typeof requests)[number]]
  expect(url).toBe('/releases/latest')
  expect(headers['user-agent']).toBe(`CV-Press/${await appVersion()}`)
  expect(headers['accept']).toBe('application/vnd.github+json')
  expect(headers['cookie']).toBeUndefined()
  expect(headers['authorization']).toBeUndefined()
})

test('with the latest version there is no notice, and Help → Check for Updates… says so', async () => {
  const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
  reply = { status: 200, body: { tag_name: `v${version}` } }
  await launch()
  expect(await appVersion()).toBe(version)

  await expect.poll(() => requests.length).toBe(1)
  await expect.poll(savedUpdateCheck).toMatchObject({ latestVersion: version })
  await libraryLoaded()
  await expect(notice()).toBeHidden()

  await stubMessageBox(0)
  await clickMenuItem('Help', 'Check for Updates…')
  await expect.poll(messageBoxCalls).toEqual([
    { message: `You have the latest version of CV Press (${version}).`, detail: undefined, buttons: ['OK'] }
  ])
})

test('a server error is silent at startup; Help → Check for Updates… reports it and can open the releases page', async () => {
  reply = { status: 500, body: { message: 'Server Error' } }
  await launch()

  await expect.poll(() => requests.length).toBe(1)
  await libraryLoaded()
  await expect(notice()).toBeHidden()
  await expect(window.getByRole('alert')).toHaveCount(0)

  await stubMessageBox(0)
  await stubOpenExternal()
  await clickMenuItem('Help', 'Check for Updates…')
  await expect.poll(messageBoxCalls).toEqual([
    {
      message: 'Couldn’t check for updates.',
      detail: 'Check your internet connection or see the latest version on the releases page.',
      buttons: ['Open Releases Page', 'OK']
    }
  ])
  await expect.poll(openExternalCalls).toEqual([RELEASES_URL])
})

test('the Update notice and the menu item follow the interface language', async () => {
  // Bez wymuszonego języka, bo wtedy menu Language nic nie przełącza; najpierw angielski niezależnie od systemu.
  await launch({ language: null })
  await chooseLanguage('English')
  await expect(notice()).toBeVisible()
  await expect.poll(() => helpItems('Help')).toContain('Check for Updates…')

  await chooseLanguage('Polski')

  await expect(notice('Nowa wersja').getByRole('status')).toHaveText('Dostępna jest nowa wersja CV Press 99.0.0.')
  await expect(notice('Nowa wersja').getByRole('button', { name: 'Pobierz' })).toBeVisible()
  await expect(notice('Nowa wersja').getByRole('button', { name: 'Zamknij' })).toBeVisible()
  await expect.poll(() => helpItems('Pomoc')).toContain('Sprawdź aktualizacje…')
})

test('a notice that arrives while the editor is open is shown after going back to the library', async () => {
  let release = () => {}
  gate = new Promise((resolve) => (release = resolve))
  await launch()

  await window.getByRole('list', { name: 'CV list' }).getByRole('button', { name: 'Open' }).click()
  await expect(window.getByLabel('Full name')).toBeVisible()
  await expect.poll(() => requests.length).toBe(1)
  release()
  await expect.poll(savedUpdateCheck).toMatchObject({ latestVersion: '99.0.0' })
  await expect(notice()).toHaveCount(0)

  await window.getByRole('button', { name: '← CV Press' }).click()

  await expect(notice().getByRole('status')).toHaveText('A new version of CV Press is available: 99.0.0.')
})
