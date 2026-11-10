// Typy hooków z notarize.mjs (plik .mjs, bo electron-builder ładuje hooki przez Node bez kompilacji TypeScriptu).
export function notarytoolCredentials(env: Record<string, string | undefined>): string[]
export function developerIdIdentity(findIdentityOutput: string, team: string): string
type MacOptions = { notarize?: boolean | null; extendInfo?: unknown }
export function releaseTeam(mac: MacOptions): string
export function beforePack(context: {
  electronPlatformName: string
  packager: { platformSpecificBuildOptions: MacOptions }
}): Promise<void>
export function afterAllArtifactBuild(buildResult: {
  artifactPaths: string[]
  configuration: { mac?: MacOptions | null }
}): Promise<string[]>
