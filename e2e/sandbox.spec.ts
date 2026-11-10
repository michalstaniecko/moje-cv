import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

// App Sandbox w spakowanej aplikacji (ADR-0003), tylko w `pnpm test:e2e:packaged`:
// - `MOJE_CV_APP`: build testowy (electron-builder.e2e.yml) z tym samym sandboksem co `.dmg`, na którym idą wszystkie testy e2e;
// - `MOJE_CV_DIST_APP`: pakiet `.app`, który trafia do `.dmg`: w `pnpm test:e2e:packaged` z buildu lokalnego
//   (`pnpm dist:mac:local`, podpis ad-hoc), przed wydaniem z `pnpm dist:mac` (docs/release-checklist.md).
const packagedExecutable = process.env['MOJE_CV_APP']
const distributedApp = process.env['MOJE_CV_DIST_APP']

// Plist jako obiekt, przez `plutil` (tylko macOS).
function plist(xml: string): Record<string, unknown> {
  return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: xml, encoding: 'utf8' }))
}

// Entitlementy, z którymi podpisano dany pakiet albo plik wykonywalny.
function signedEntitlements(path: string): Record<string, unknown> {
  const xml = execFileSync('codesign', ['-d', '--entitlements', '-', '--xml', path], { encoding: 'utf8', stdio: 'pipe' })
  return plist(xml)
}

test.describe('the distributed .dmg app', () => {
  test.skip(!distributedApp, 'tylko z pakietem z `pnpm dist:mac` albo `pnpm dist:mac:local` (MOJE_CV_DIST_APP)')

  test('is signed with the sandbox, user-selected file access and the network client for the update check', () => {
    expect(signedEntitlements(distributedApp!)).toMatchObject({
      'com.apple.security.app-sandbox': true,
      'com.apple.security.files.user-selected.read-write': true,
      'com.apple.security.network.client': true
    })
  })

  test('has no entitlements of the test build', () => {
    const entitlements = Object.keys(signedEntitlements(distributedApp!))
    expect(entitlements.filter((key) => key.includes('temporary-exception') || key.includes('network.server'))).toEqual([])
  })

  test('keeps the shared bundle ID of both channels', () => {
    const info = plist(readFileSync(join(distributedApp!, 'Contents/Info.plist'), 'utf8'))
    expect(info['CFBundleIdentifier']).toBe('com.michalstaniecko.mojecv')
  })

  test('lets Electron helpers inherit the sandbox of the app', () => {
    const helper = join(distributedApp!, 'Contents/Frameworks/CV Drawer Helper (Renderer).app')
    expect(signedEntitlements(helper)).toMatchObject({ 'com.apple.security.app-sandbox': true, 'com.apple.security.inherit': true })
  })

  test('carries the migration of the earlier data folder into the container', () => {
    const migration = readFileSync(join(distributedApp!, 'Contents/Resources/container-migration.plist'), 'utf8')
    expect(plist(migration)).toEqual({ Move: ['${ApplicationSupport}/Moje CV'] })
  })
})

test.describe('the packaged app under test', () => {
  test.skip(!packagedExecutable, 'tylko na spakowanej aplikacji (MOJE_CV_APP)')

  let outputDir: string
  test.beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'moje-cv-e2e-'))
  })
  test.afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true })
  })

  const launch = () => {
    const env = { ...process.env, MOJE_CV_LANGUAGE: 'en', MOJE_CV_APPEARANCE: 'light', MOJE_CV_UPDATE_URL: 'off' } as Record<string, string>
    if (!process.env['MOJE_CV_E2E_HEADED']) env['MOJE_CV_E2E_HIDDEN'] = '1'
    return electron.launch({ executablePath: packagedExecutable!, args: [`--user-data-dir=${join(outputDir, 'user-data')}`], env })
  }

  test('runs inside App Sandbox and opens the CV library', async () => {
    const app = await launch()
    try {
      const window = await app.firstWindow()
      await expect(window.getByRole('button', { name: 'New CV' })).toBeVisible()
      // System ustawia tę zmienną tylko procesom w App Sandbox.
      expect(await app.evaluate(() => process.env['APP_SANDBOX_CONTAINER_ID'])).toBeTruthy()
    } finally {
      await app.close()
    }
  })

  // W App Sandbox Electron trzyma gniazdo blokady jednej instancji w stałym folderze kontenera (`tmp/S`); po awarii
  // albo wymuszonym zakończeniu zostają tam pliki, przez które kolejne uruchomienie od razu się kończyło.
  test('starts again after it was killed', async () => {
    const killed = await launch()
    await (await killed.firstWindow()).getByRole('button', { name: 'New CV' }).waitFor()
    const exited = new Promise((resolve) => killed.process().once('exit', resolve))
    killed.process().kill('SIGKILL')
    await exited

    const app = await launch()
    try {
      await expect((await app.firstWindow()).getByRole('button', { name: 'New CV' })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
