// @ts-check
// Notaryzacja wydania `.dmg` podpisanego Developer ID (#43), hooki electron-buildera z `electron-builder.yml`.
//
// Aplikację (`CV Drawer.app`) notaryzuje i stempluje sam electron-builder (`mac.notarize`), ale tylko gdy znajdzie dane
// uwierzytelniające; bez nich pomija notaryzację z ostrzeżeniem. Tu:
// - `beforePack`: build wydania bez danych do notaryzacji kończy się od razu, z listą zmiennych, zamiast dać plik,
//   którego Gatekeeper nie przepuści;
// - `afterAllArtifactBuild`: notaryzacja i stempel samego `.dmg` (electron-builder go tylko podpisuje), żeby przeszedł
//   `spctl` i `xcrun stapler validate` także bez sieci.
// Build lokalny i testowy (`mac.notarize: false`, electron-builder.local.yml) oraz build Mac App Store (`mas`) pomijają
// oba kroki.
//
// Dane uwierzytelniające wyłącznie ze zmiennych środowiskowych (te same, które czyta electron-builder), nigdy z repo.
import { execFileSync } from 'node:child_process'

/** @param {string | undefined} value */
const isSet = (value) => value != null && value.trim() !== ''

// Trzy sposoby, w kolejności, w jakiej sprawdza je electron-builder.
const METHODS = [
  {
    name: 'Apple ID',
    vars: ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
    flags: ['--apple-id', '--password', '--team-id']
  },
  {
    name: 'App Store Connect API key',
    vars: ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
    flags: ['--key', '--key-id', '--issuer']
  },
  {
    name: 'notarytool keychain profile',
    vars: ['APPLE_KEYCHAIN_PROFILE'],
    flags: ['--keychain-profile']
  }
]

/**
 * Argumenty `xcrun notarytool` z danymi uwierzytelniającymi ze zmiennych środowiskowych. Rzuca błąd, gdy nie ma żadnego
 * kompletnego zestawu albo zestaw jest niepełny.
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function notarytoolCredentials(env) {
  for (const method of METHODS) {
    // Niepełny zestaw kluczy profilu (sam APPLE_KEYCHAIN) nie wybiera metody; liczy się tylko jej główna zmienna.
    if (!method.vars.some((name) => isSet(env[name]))) continue
    const missing = method.vars.filter((name) => !isSet(env[name]))
    if (missing.length > 0) {
      throw new Error(`Notarization (${method.name}): set ${missing.join(', ')} as well.`)
    }
    const args = method.vars.flatMap((name, i) => [method.flags[i], /** @type {string} */ (env[name])])
    if (method.vars[0] === 'APPLE_KEYCHAIN_PROFILE' && isSet(env['APPLE_KEYCHAIN'])) {
      args.push('--keychain', /** @type {string} */ (env['APPLE_KEYCHAIN']))
    }
    return args
  }
  throw new Error(
    [
      'A release .dmg must be notarized, but no notarization credentials are set. Set one of:',
      ...METHODS.map((method) => `  - ${method.name}: ${method.vars.join(', ')}`),
      'For a local build without Developer ID and notarization use `pnpm dist:mac:local`. See docs/instalacja.md.'
    ].join('\n')
  )
}

/**
 * Nazwa certyfikatu „Developer ID Application” zespołu `team` w wyniku `security find-identity -v -p codesigning`.
 * Rzuca błąd, gdy go nie ma: certyfikat deweloperski (Apple Development) ani Developer ID innego zespołu nie wystarczy,
 * bo grupa aplikacji z entitlements i `ElectronTeamID` mają identyfikator tego zespołu.
 * @param {string} findIdentityOutput
 * @param {string} team
 * @returns {string}
 */
export function developerIdIdentity(findIdentityOutput, team) {
  const wanted = new RegExp(`"(Developer ID Application: .* \\(${team}\\))"`)
  for (const line of findIdentityOutput.split('\n')) {
    const match = wanted.exec(line)
    if (match) return /** @type {string} */ (match[1])
  }
  throw new Error(
    `A release .dmg must be signed with "Developer ID Application: … (${team})", but the keychain has no such valid identity ` +
      '(`security find-identity -v -p codesigning`). Install the certificate with its private key, ' +
      'or use `pnpm dist:mac:local` for a local build signed ad-hoc. See docs/instalacja.md.'
  )
}

/** @typedef {{ notarize?: boolean | null, extendInfo?: unknown }} MacOptions */

/**
 * Identyfikator zespołu Apple Developer wydania: `mac.extendInfo.ElectronTeamID` z electron-builder.yml. Jedno źródło dla
 * hooków; `mac.identity` i grupa aplikacji w entitlements muszą się z nim zgadzać (pilnuje tego build/packaging.test.ts).
 * @param {MacOptions} mac
 * @returns {string}
 */
export function releaseTeam(mac) {
  const extendInfo = /** @type {{ ElectronTeamID?: unknown } | null | undefined} */ (typeof mac.extendInfo === 'object' ? mac.extendInfo : null)
  const team = extendInfo?.ElectronTeamID
  if (typeof team !== 'string' || team.trim() === '') {
    throw new Error('electron-builder.yml: `mac.extendInfo.ElectronTeamID` must be the Apple Developer team ID of the release.')
  }
  return team
}

/**
 * Konfiguracja `mac` buduje wydanie do notaryzacji (nie build lokalny ani testowy z `notarize: false`).
 * @param {MacOptions | null | undefined} mac
 */
const isNotarizedRelease = (mac) => mac?.notarize !== false

/**
 * Hook `beforePack`: build wydania bez certyfikatu Developer ID albo bez danych do notaryzacji kończy się przed
 * pakowaniem, z listą tego, czego brakuje.
 *
 * Build Mac App Store (#44) ma osobny podpis i nie jest notaryzowany, więc jest pomijany wprost po platformie: electron-builder
 * pakuje go jako `mas` (także `mas-dev`), a `.dmg` jako `darwin`. Samo `notarize` tu nie wystarczy, bo `packager` podaje
 * opcje sekcji `mac` (z `notarize: true`), a nie złożone `mac` + `mas` z `mas.notarize: false`.
 * @param {{ electronPlatformName: string, packager: { platformSpecificBuildOptions: MacOptions } }} context
 */
export async function beforePack(context) {
  const mac = context.packager.platformSpecificBuildOptions
  const isDmgRelease = context.electronPlatformName === 'darwin' && isNotarizedRelease(mac)
  if (!isDmgRelease) return
  developerIdIdentity(execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' }), releaseTeam(mac))
  notarytoolCredentials(process.env)
}

/**
 * Hook `afterAllArtifactBuild`: notaryzacja (`notarytool submit --wait`) i stempel każdego `.dmg` wydania. Tylko `.dmg`:
 * paczka `.pkg` Mac App Store (#44) idzie do App Review bez notaryzacji.
 * @param {{ artifactPaths: string[], configuration: { mac?: MacOptions | null } }} buildResult
 * @returns {Promise<string[]>} brak dodatkowych plików wydania
 */
export async function afterAllArtifactBuild(buildResult) {
  const dmgs = buildResult.artifactPaths.filter((path) => path.endsWith('.dmg'))
  if (!isNotarizedRelease(buildResult.configuration.mac) || dmgs.length === 0) return []
  const credentials = notarytoolCredentials(process.env)
  for (const dmg of dmgs) {
    console.log(`  • notarizing ${dmg} (a few minutes)`)
    const output = execFileSync('xcrun', ['notarytool', 'submit', dmg, '--wait', '--output-format', 'json', ...credentials], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit']
    })
    const { id, status } = JSON.parse(output)
    if (status !== 'Accepted') {
      throw new Error(`Notarization of ${dmg} ended with status "${status}". Details: xcrun notarytool log ${id} <credentials>`)
    }
    execFileSync('xcrun', ['stapler', 'staple', dmg], { stdio: 'inherit' })
  }
  return []
}
