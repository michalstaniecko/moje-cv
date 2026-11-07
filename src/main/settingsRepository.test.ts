import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createSettingsRepository, type SettingsRepository } from './settingsRepository'

let dataDir: string
let settingsPath: string
let repository: SettingsRepository

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'moje-cv-settings-'))
  settingsPath = join(dataDir, 'settings.json')
  repository = createSettingsRepository(settingsPath)
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('clause library', () => {
  test('is empty before anything has been saved', async () => {
    expect(await repository.get()).toEqual({ schemaVersion: 1, clauses: [], defaultClauseId: null })
  })

  test('an added clause is kept in the settings file', async () => {
    const added = await repository.addClause({ name: 'Ogólna', text: 'Wyrażam zgodę…' })

    expect(added.name).toBe('Ogólna')
    expect((await createSettingsRepository(settingsPath).get()).clauses).toEqual([added])
    expect(JSON.parse(await readFile(settingsPath, 'utf8')).clauses).toEqual([added])
  })

  test('a clause can be edited without touching the others', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'Stara treść' })
    const talent = await repository.addClause({ name: 'Talent Partners', text: 'Treść TP' })

    await repository.updateClause(general.id, { name: 'Ogólna 2026', text: 'Nowa treść' })

    expect((await repository.get()).clauses).toEqual([
      { id: general.id, name: 'Ogólna 2026', text: 'Nowa treść' },
      talent
    ])
  })

  test('clauses added at the same time are all kept', async () => {
    const added = await Promise.all(['A', 'B', 'C'].map((name) => repository.addClause({ name, text: name })))

    expect((await repository.get()).clauses).toEqual(added)
  })

  test('editing a clause that is not in the library fails', async () => {
    await expect(repository.updateClause('missing', { name: 'Ogólna', text: 'A' })).rejects.toThrow()
    expect((await repository.get()).clauses).toEqual([])
  })

  test('a deleted clause disappears from the library', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'A' })
    const talent = await repository.addClause({ name: 'Talent Partners', text: 'B' })

    await repository.deleteClause(general.id)

    expect((await repository.get()).clauses).toEqual([talent])
  })
})

describe('default clause', () => {
  test('one clause can be marked as the default and the mark can be moved or cleared', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'A' })
    const talent = await repository.addClause({ name: 'Talent Partners', text: 'B' })

    await repository.setDefaultClause(general.id)
    expect((await repository.get()).defaultClauseId).toBe(general.id)

    await repository.setDefaultClause(talent.id)
    expect((await repository.get()).defaultClauseId).toBe(talent.id)

    await repository.setDefaultClause(null)
    expect((await repository.get()).defaultClauseId).toBeNull()
  })

  test('deleting the default clause leaves no default', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'A' })
    await repository.setDefaultClause(general.id)

    await repository.deleteClause(general.id)

    expect((await repository.get()).defaultClauseId).toBeNull()
  })

  test('a clause that is not in the library cannot become the default', async () => {
    await expect(repository.setDefaultClause('missing')).rejects.toThrow()
    expect((await repository.get()).defaultClauseId).toBeNull()
  })

  test('is what a new CV starts with', async () => {
    expect(await repository.defaultClause()).toBeNull()

    const general = await repository.addClause({ name: 'Ogólna', text: 'Wyrażam zgodę…' })
    await repository.setDefaultClause(general.id)

    expect(await repository.defaultClause()).toEqual(general)
  })
})

describe('interface language preference', () => {
  test('is missing until chosen, so the app follows the system', async () => {
    expect((await repository.get()).interfaceLanguage).toBeUndefined()
  })

  test('a chosen language is kept in the settings file', async () => {
    await repository.setInterfaceLanguage('en')

    expect((await createSettingsRepository(settingsPath).get()).interfaceLanguage).toBe('en')
    expect(JSON.parse(await readFile(settingsPath, 'utf8')).interfaceLanguage).toBe('en')
  })

  test('choosing the system language removes the field and keeps the clause library', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'A' })
    await repository.setInterfaceLanguage('pl')

    await repository.setInterfaceLanguage(null)

    const saved = JSON.parse(await readFile(settingsPath, 'utf8'))
    expect(saved).not.toHaveProperty('interfaceLanguage')
    expect(saved.clauses).toEqual([general])
  })

  test('a settings file from before the language preference still loads', async () => {
    const old = { schemaVersion: 1, clauses: [{ id: 'a', name: 'Ogólna', text: 'A' }], defaultClauseId: 'a' }
    await writeFile(settingsPath, JSON.stringify(old))

    expect(await repository.get()).toEqual(old)
    await repository.setInterfaceLanguage('pl')
    expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toEqual({ ...old, interfaceLanguage: 'pl' })
  })

  test('an unsupported language in the file makes it unreadable like any other schema mismatch', async () => {
    const content = JSON.stringify({ schemaVersion: 1, clauses: [], defaultClauseId: null, interfaceLanguage: 'ja' })
    await writeFile(settingsPath, content)

    await expect(repository.get()).rejects.toThrow()
  })
})

describe('appearance preference', () => {
  test('is missing until chosen, so the app follows the system', async () => {
    expect((await repository.get()).appearance).toBeUndefined()
  })

  test('a chosen appearance is kept in the settings file', async () => {
    await repository.setAppearance('dark')

    expect((await createSettingsRepository(settingsPath).get()).appearance).toBe('dark')
    expect(JSON.parse(await readFile(settingsPath, 'utf8')).appearance).toBe('dark')
  })

  test('choosing System removes the field and keeps the clause library and the interface language', async () => {
    const general = await repository.addClause({ name: 'Ogólna', text: 'A' })
    await repository.setInterfaceLanguage('pl')
    await repository.setAppearance('light')

    await repository.setAppearance(null)

    const saved = JSON.parse(await readFile(settingsPath, 'utf8'))
    expect(saved).not.toHaveProperty('appearance')
    expect(saved.clauses).toEqual([general])
    expect(saved.interfaceLanguage).toBe('pl')
  })

  test('choosing the interface language keeps the appearance', async () => {
    await repository.setAppearance('dark')

    await repository.setInterfaceLanguage('en')

    expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toMatchObject({ appearance: 'dark', interfaceLanguage: 'en' })
  })

  test('a settings file from before the appearance preference still loads', async () => {
    const old = { schemaVersion: 1, clauses: [{ id: 'a', name: 'Ogólna', text: 'A' }], defaultClauseId: 'a', interfaceLanguage: 'pl' }
    await writeFile(settingsPath, JSON.stringify(old))

    expect(await repository.get()).toEqual(old)
    await repository.setAppearance('dark')
    expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toEqual({ ...old, appearance: 'dark' })
  })

  test('an unsupported appearance in the file makes it unreadable like any other schema mismatch', async () => {
    for (const appearance of ['system', 'blue']) {
      await writeFile(settingsPath, JSON.stringify({ schemaVersion: 1, clauses: [], defaultClauseId: null, appearance }))

      await expect(repository.get()).rejects.toThrow()
    }
  })
})

describe('damaged settings file', () => {
  const damagedFiles = {
    'invalid JSON': '{ "schemaVersion": 1, "clauses": ',
    'JSON not matching the schema': JSON.stringify({ schemaVersion: 1, clauses: [{ id: 'a' }], defaultClauseId: null })
  }

  for (const [kind, content] of Object.entries(damagedFiles)) {
    test(`a file with ${kind} cannot be read and is never overwritten`, async () => {
      await writeFile(settingsPath, content)

      await expect(repository.get()).rejects.toThrow()
      await expect(repository.addClause({ name: 'Ogólna', text: 'A' })).rejects.toThrow()
      await expect(repository.updateClause('a', { name: 'Ogólna', text: 'A' })).rejects.toThrow()
      await expect(repository.deleteClause('a')).rejects.toThrow()
      await expect(repository.setDefaultClause(null)).rejects.toThrow()
      await expect(repository.setInterfaceLanguage('pl')).rejects.toThrow()
      await expect(repository.setAppearance('dark')).rejects.toThrow()
      await expect(repository.setAppearance(null)).rejects.toThrow()

      expect(await readFile(settingsPath, 'utf8')).toBe(content)
    })

    test(`a file with ${kind} does not stop new CVs from being created – they get no clause`, async () => {
      await writeFile(settingsPath, content)

      expect(await repository.defaultClause()).toBeNull()
    })
  }
})
