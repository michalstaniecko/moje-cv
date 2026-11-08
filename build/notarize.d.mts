// Typy hooków z notarize.mjs (plik .mjs, bo electron-builder ładuje hooki przez Node bez kompilacji TypeScriptu).
export function notarytoolCredentials(env: Record<string, string | undefined>): string[]
export function developerIdIdentity(findIdentityOutput: string, team: string): string
export function beforePack(context: {
  electronPlatformName: string
  packager: { platformSpecificBuildOptions: { notarize?: boolean | null; identity?: string | null } }
}): Promise<void>
export function afterAllArtifactBuild(buildResult: {
  artifactPaths: string[]
  configuration: { mac?: { notarize?: boolean | null } | null }
}): Promise<string[]>
