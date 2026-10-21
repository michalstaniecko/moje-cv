import { randomUUID } from 'node:crypto'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

// Zapis atomowy: plik tymczasowy + rename, więc na dysku jest zawsze cała stara albo cała nowa wersja.
export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const tempPath = join(dir, `.${basename(path, '.json')}.${randomUUID()}.tmp`)
  try {
    await writeFile(tempPath, JSON.stringify(value, null, 2))
    await rename(tempPath, path)
  } finally {
    await rm(tempPath, { force: true })
  }
}

export const exists = (path: string) => access(path).then(() => true, () => false)
