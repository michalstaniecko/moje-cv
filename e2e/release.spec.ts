import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { expect, test } from '@playwright/test'

// Wydanie `.dmg` z `pnpm dist:mac` (#43): podpis Developer ID, hardened runtime, notaryzacja i stempel. Tylko z gotowym
// plikiem wydania, bo bez certyfikatu i danych do notaryzacji nie da się go zbudować:
// `MOJE_CV_RELEASE_DMG=dist/CV-Drawer-X.Y.Z.dmg pnpm exec playwright test e2e/release.spec.ts`.
// Sprawdza pliki (`spctl`, `stapler`, `codesign`) i nigdy nie uruchamia aplikacji: pierwsze uruchomienie z prawdziwym
// bundle ID przeniosłoby dane do kontenera (docs/instalacja.md).
const releaseDmg = process.env['MOJE_CV_RELEASE_DMG']
const TEAM = '8A9ZJPAGY8'

// Wynik polecenia (stdout + stderr, bo `spctl` i `codesign -dv` piszą na stderr) i kod wyjścia.
function run(command: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

test.describe('the release .dmg', () => {
  test.skip(!releaseDmg, 'tylko z plikiem wydania z `pnpm dist:mac` (MOJE_CV_RELEASE_DMG)')

  let mountPoint: string
  let app: string
  test.beforeAll(async () => {
    mountPoint = await mkdtemp(join(tmpdir(), 'cv-drawer-release-'))
    execFileSync('hdiutil', ['attach', releaseDmg!, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountPoint])
    app = join(mountPoint, 'CV Drawer.app')
  })
  test.afterAll(async () => {
    if (!mountPoint) return
    execFileSync('hdiutil', ['detach', mountPoint, '-force'])
    await rm(mountPoint, { recursive: true, force: true })
  })

  test('is named after the version in package.json', async () => {
    const { version } = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf8'))
    expect(basename(releaseDmg!)).toBe(`CV-Drawer-${version}.dmg`)
  })

  test('is notarized and stapled, so Gatekeeper lets it open', () => {
    const stapler = run('xcrun', ['stapler', 'validate', releaseDmg!])
    expect(stapler.output).toContain('The validate action worked!')
    const spctl = run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', releaseDmg!])
    expect(spctl.status, spctl.output).toBe(0)
    expect(spctl.output).toContain('source=Notarized Developer ID')
  })

  test('holds the app notarized and stapled on its own, so it opens after copying to Applications offline', () => {
    expect(run('xcrun', ['stapler', 'validate', app]).output).toContain('The validate action worked!')
    const spctl = run('spctl', ['--assess', '--type', 'execute', '-vv', app])
    expect(spctl.status, spctl.output).toBe(0)
    expect(spctl.output).toContain('source=Notarized Developer ID')
  })

  test('the app is signed by Developer ID of the team with the hardened runtime', () => {
    const verify = run('codesign', ['--verify', '--deep', '--strict', app])
    expect(verify.status, verify.output).toBe(0)
    const details = run('codesign', ['-dv', '--verbose=2', app]).output
    expect(details).toMatch(new RegExp(`Authority=Developer ID Application: .* \\(${TEAM}\\)`))
    expect(details).toContain(`TeamIdentifier=${TEAM}`)
    expect(details).toMatch(/flags=0x10000\(runtime\)/)
  })

  test('the app is universal: Apple Silicon and Intel', () => {
    const archs = execFileSync('lipo', ['-archs', join(app, 'Contents/MacOS/CV Drawer')], { encoding: 'utf8' })
    expect(archs.trim().split(' ').sort()).toEqual(['arm64', 'x86_64'])
  })
})
