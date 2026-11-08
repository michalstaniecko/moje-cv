import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { clearStaleSingletonSocket } from './staleSingleton'

let root: string
let userData: string
let socketDir: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'moje-cv-singleton-'))
  userData = join(root, 'Moje CV')
  socketDir = join(root, 'tmp', 'S')
  await mkdir(userData, { recursive: true })
  await mkdir(socketDir, { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

// Pliki blokady jednej instancji tak, jak zostawia je Chromium w App Sandbox: dowiązania w folderze danych
// (`SingletonLock` → `host-pid`, `SingletonSocket` i `SingletonCookie` → stały folder gniazda) i gniazdo z ciasteczkiem tam.
async function leaveSingletonFiles(lockTarget: string) {
  await symlink(lockTarget, join(userData, 'SingletonLock'))
  await symlink(join(socketDir, 'SingletonSocket'), join(userData, 'SingletonSocket'))
  await symlink(join(socketDir, 'SingletonCookie'), join(userData, 'SingletonCookie'))
  await writeFile(join(socketDir, 'SingletonSocket'), '')
  await symlink('8022420170144897800', join(socketDir, 'SingletonCookie'))
}

const host = 'MacBook-Air.local'

describe('stale single-instance lock in App Sandbox', () => {
  test('after the owning process died, the socket folder is cleared so the app can take the lock again', async () => {
    await leaveSingletonFiles(`${host}-4242`)
    clearStaleSingletonSocket(userData, { hostname: host, isRunning: () => false })
    expect(await readdir(socketDir)).toEqual([])
  })

  test('a running owner keeps its socket, so starting again still brings its window forward', async () => {
    await leaveSingletonFiles(`${host}-4242`)
    clearStaleSingletonSocket(userData, { hostname: host, isRunning: (pid) => pid === 4242 })
    expect((await readdir(socketDir)).sort()).toEqual(['SingletonCookie', 'SingletonSocket'])
  })

  test('a lock taken on another computer (shared folder) is left alone', async () => {
    await leaveSingletonFiles('other-mac.local-4242')
    clearStaleSingletonSocket(userData, { hostname: host, isRunning: () => false })
    expect((await readdir(socketDir)).sort()).toEqual(['SingletonCookie', 'SingletonSocket'])
  })

  test('without a lock (first run, or after a clean quit) nothing happens', async () => {
    expect(() => clearStaleSingletonSocket(userData, { hostname: host, isRunning: () => false })).not.toThrow()
  })
})
