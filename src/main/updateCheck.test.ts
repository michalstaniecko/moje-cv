import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createSettingsRepository } from './settingsRepository'
import { createUpdateCheck, updateCheckConfig } from './updateCheck'

const feedUrl = 'https://api.github.com/repos/michalstaniecko/moje-cv/releases/latest'
const day = 24 * 60 * 60 * 1000

let dataDir: string
let settingsPath: string
let clock: Date
let fetchCalls: { url: string; init: RequestInit | undefined }[]
let respond: () => Promise<Response>

function release(tag: string): () => Promise<Response> {
  return async () => Response.json({ tag_name: tag, html_url: 'https://example.com/evil', name: 'Release' })
}

const fakeFetch = (url: string, init?: RequestInit) => {
  fetchCalls.push({ url, init })
  return respond()
}

function service({ currentVersion = '1.0.0', timeoutMs = 10_000 } = {}) {
  return createUpdateCheck({
    currentVersion,
    feedUrl,
    fetch: fakeFetch,
    now: () => clock,
    settings: createSettingsRepository(settingsPath),
    timeoutMs
  })
}

async function savedUpdateCheck(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(settingsPath, 'utf8')).updateCheck
  } catch {
    return undefined
  }
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'moje-cv-updates-'))
  settingsPath = join(dataDir, 'settings.json')
  clock = new Date('2026-11-07T10:00:00.000Z')
  fetchCalls = []
  respond = release('v1.1.0')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dataDir, { recursive: true, force: true })
})

describe('checking for a new version', () => {
  test('a newer release is reported, remembered and shown as the notice', async () => {
    const updates = service()

    expect(await updates.check()).toEqual({ status: 'newer', version: '1.1.0' })
    expect(await savedUpdateCheck()).toEqual({ checkedAt: '2026-11-07T10:00:00.000Z', latestVersion: '1.1.0' })
    expect(await updates.notice()).toBe('1.1.0')
  })

  test('the same release means the app is up to date and there is no notice', async () => {
    respond = release('v1.0.0')
    const updates = service()

    expect(await updates.check()).toEqual({ status: 'up-to-date', version: '1.0.0' })
    expect(await savedUpdateCheck()).toEqual({ checkedAt: '2026-11-07T10:00:00.000Z', latestVersion: '1.0.0' })
    expect(await updates.notice()).toBeNull()
  })

  test('a repository without releases (404) means up to date', async () => {
    respond = async () => new Response('Not Found', { status: 404 })

    expect(await service().check()).toEqual({ status: 'up-to-date', version: '1.0.0' })
    expect(await savedUpdateCheck()).toMatchObject({ checkedAt: '2026-11-07T10:00:00.000Z' })
  })

  const failures: Record<string, () => Promise<Response>> = {
    'rate limit (403)': async () => new Response('rate limited', { status: 403 }),
    'server error (500)': async () => new Response('oops', { status: 500 }),
    'network error': async () => {
      throw new TypeError('net::ERR_INTERNET_DISCONNECTED')
    },
    'invalid JSON': async () => new Response('{ "tag_name": ', { status: 200 }),
    'JSON without a tag': async () => Response.json({ name: 'v2.0.0' }),
    'pre-release tag': release('v2.0.0-rc.1')
  }

  test.each(Object.entries(failures))('%s fails without saving anything', async (_name, failure) => {
    respond = failure
    const updates = service()

    expect(await updates.check()).toEqual({ status: 'failed' })
    expect(await savedUpdateCheck()).toBeUndefined()
    expect(await updates.notice()).toBeNull()
  })

  test('a server slower than the timeout fails', async () => {
    respond = () => new Promise(() => {})
    const slowFetch = (url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        fetchCalls.push({ url, init })
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    const updates = createUpdateCheck({
      currentVersion: '1.0.0',
      feedUrl,
      fetch: slowFetch,
      now: () => clock,
      settings: createSettingsRepository(settingsPath),
      timeoutMs: 20
    })

    expect(await updates.check()).toEqual({ status: 'failed' })
    expect(await savedUpdateCheck()).toBeUndefined()
  })

  test('the request carries only the app version, without query string or credentials', async () => {
    await service({ currentVersion: '1.0.3' }).check()

    expect(fetchCalls).toHaveLength(1)
    const [{ url, init }] = fetchCalls as [(typeof fetchCalls)[number]]
    expect(url).toBe(feedUrl)
    expect(new URL(url).search).toBe('')
    expect(new Headers(init?.headers).get('User-Agent')).toBe('CV-Drawer/1.0.3')
    expect(new Headers(init?.headers).get('Accept')).toBe('application/vnd.github+json')
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit' })
  })

  test('two checks at the same time share one request', async () => {
    const updates = service()

    const results = await Promise.all([updates.check(), updates.check()])

    expect(results).toEqual([
      { status: 'newer', version: '1.1.0' },
      { status: 'newer', version: '1.1.0' }
    ])
    expect(fetchCalls).toHaveLength(1)
  })

  test('a damaged settings file does not change the result', async () => {
    await writeFile(settingsPath, '{ "schemaVersion": ')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await service().check()).toEqual({ status: 'newer', version: '1.1.0' })
  })
})

test('without a feed address the check fails without asking the network', async () => {
  const updates = createUpdateCheck({
    currentVersion: '1.0.0',
    feedUrl: null,
    fetch: fakeFetch,
    now: () => clock,
    settings: createSettingsRepository(settingsPath)
  })

  expect(await updates.check()).toEqual({ status: 'failed' })
  expect(fetchCalls).toHaveLength(0)
  expect(await savedUpdateCheck()).toBeUndefined()
})

describe('checking at startup', () => {
  test('asks the network when nothing was checked before', async () => {
    expect(await service().checkIfDue()).toEqual({ status: 'newer', version: '1.1.0' })
    expect(fetchCalls).toHaveLength(1)
  })

  test('does not ask again within 24 hours of the last check', async () => {
    await service().check()
    clock = new Date(clock.getTime() + day - 1)

    expect(await service().checkIfDue()).toEqual({ status: 'skipped' })
    expect(fetchCalls).toHaveLength(1)
  })

  test('asks again after 24 hours', async () => {
    await service().check()
    clock = new Date(clock.getTime() + day)

    expect(await service().checkIfDue()).toEqual({ status: 'newer', version: '1.1.0' })
    expect(fetchCalls).toHaveLength(2)
  })

  test('asks again when the last check is in the future (clock turned back)', async () => {
    await service().check()
    clock = new Date(clock.getTime() - 60_000)

    await service().checkIfDue()
    expect(fetchCalls).toHaveLength(2)
  })

  test('a failed check is retried at the next start', async () => {
    respond = async () => new Response('oops', { status: 500 })
    await service().checkIfDue()
    respond = release('v1.1.0')

    expect(await service().checkIfDue()).toEqual({ status: 'newer', version: '1.1.0' })
    expect(fetchCalls).toHaveLength(2)
  })
})

describe('update notice', () => {
  test('comes back after a restart without asking the network', async () => {
    await service().check()

    expect(await service().notice()).toBe('1.1.0')
    expect(fetchCalls).toHaveLength(1)
  })

  test('dismissing hides this version, but a later version is shown again', async () => {
    await service().check()
    await service().dismiss()

    expect(await service().notice()).toBeNull()

    respond = release('v1.2.0')
    await service().check()
    expect(await service().notice()).toBe('1.2.0')
  })

  test('disappears once the app has been updated to that version', async () => {
    await service().check()

    expect(await service({ currentVersion: '1.1.0' }).notice()).toBeNull()
  })

  test('there is nothing to show or dismiss before the first check', async () => {
    const updates = service()

    await updates.dismiss()
    expect(await updates.notice()).toBeNull()
    expect(await savedUpdateCheck()).toBeUndefined()
  })
})

describe('update check configuration', () => {
  test('the Mac App Store build has no update check at all', () => {
    expect(updateCheckConfig({ macAppStore: true, override: undefined })).toBeNull()
    expect(updateCheckConfig({ macAppStore: true, override: 'http://127.0.0.1:8000/latest.json' })).toBeNull()
  })

  test('the .dmg build asks GitHub about 10 s after start', () => {
    expect(updateCheckConfig({ macAppStore: false, override: undefined })).toEqual({
      feedUrl,
      checkAtStartup: true,
      startupDelayMs: 10_000
    })
  })

  test('"off" turns off the startup check and the network; the menu check stays and fails', () => {
    expect(updateCheckConfig({ macAppStore: false, override: 'off' })).toEqual({
      feedUrl: null,
      checkAtStartup: false,
      startupDelayMs: 10_000
    })
  })

  test.each(['http://127.0.0.1:8123/releases/latest', 'http://localhost:9000/latest.json'])(
    'a loopback address %s replaces GitHub and checks right away',
    (override) => {
      expect(updateCheckConfig({ macAppStore: false, override })).toEqual({
        feedUrl: override,
        checkAtStartup: true,
        startupDelayMs: 0
      })
    }
  )

  test.each([
    'https://evil.example.com/latest',
    'http://127.0.0.1.evil.com/latest',
    'http://user@evil.com/latest',
    'https://127.0.0.1:8000/latest',
    'http://10.0.0.1:80/',
    'not a url',
    ''
  ])('any other value %j is ignored', (override) => {
    expect(updateCheckConfig({ macAppStore: false, override })).toEqual({
      feedUrl,
      checkAtStartup: true,
      startupDelayMs: 10_000
    })
  })
})
