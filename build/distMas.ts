import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Build Mac App Store (#44, docs/wydanie-mac-app-store.md): `pnpm dist:mas` (paczka `.pkg` do wysyłki) i `pnpm dist:mas-dev`
// (aplikacja do lokalnego testu z sandboksem). Konfiguracja celu jest w sekcjach `mas`/`masDev` electron-builder.yml;
// tu tylko to, czego nie ma w repo:
// - MOJE_CV_BUILD_NUMBER: numer buildu (`CFBundleVersion`), osobny od wersji z package.json (`CFBundleShortVersionString`).
//   Dodatnia liczba całkowita, większa od każdego numeru wysłanego wcześniej do App Store Connect – w buildzie `mas`
//   obowiązkowa, bo bez niej electron-builder wpisałby wersję z package.json i kolejny build tej samej wersji
//   zostałby odrzucony.
// - MOJE_CV_MAS_PROVISIONING_PROFILE / MOJE_CV_MAS_DEV_PROVISIONING_PROFILE: ścieżka do profilu provisioningowego
//   (App Store / Development) pobranego z developer.apple.com, trzymanego poza repo.
// Podpis jest wymuszony (`forceCodeSigning`): niepodpisany build dla sklepu jest bezużyteczny.

export type MasBuildKind = 'mas' | 'mas-dev'
type Environment = Record<string, string | undefined>

const profileVariable: Record<MasBuildKind, string> = {
  mas: 'MOJE_CV_MAS_PROVISIONING_PROFILE',
  'mas-dev': 'MOJE_CV_MAS_DEV_PROVISIONING_PROFILE'
}
const profileOption: Record<MasBuildKind, string> = { mas: 'mas', 'mas-dev': 'masDev' }

export function masBuildArguments(kind: MasBuildKind, env: Environment): string[] {
  const buildNumber = env['MOJE_CV_BUILD_NUMBER']
  if (buildNumber !== undefined || kind === 'mas') {
    if (!/^[1-9]\d*$/.test(buildNumber ?? '')) {
      throw new Error(
        `MOJE_CV_BUILD_NUMBER must be a positive integer, greater than every build number already uploaded to App Store Connect (got ${JSON.stringify(buildNumber ?? '')}).`
      )
    }
  }
  const profile = env[profileVariable[kind]]?.trim()
  if (!profile) throw new Error(`${profileVariable[kind]} must be the path to the provisioning profile (kept outside the repository).`)

  return [
    '--mac',
    kind,
    '--universal',
    ...(buildNumber !== undefined ? [`-c.buildVersion=${buildNumber}`] : []),
    `-c.${profileOption[kind]}.provisioningProfile=${profile}`,
    '-c.forceCodeSigning=true'
  ]
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function main(kind: string | undefined): void {
  if (kind !== 'mas' && kind !== 'mas-dev') throw new Error('Usage: distMas.ts mas|mas-dev')
  const args = masBuildArguments(kind, process.env)
  const profile = process.env[profileVariable[kind]]!.trim()
  if (!existsSync(profile)) throw new Error(`${profileVariable[kind]}: no such file ${profile}`)
  run('electron-vite', ['build'])
  run('electron-builder', args)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv[2])
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}
