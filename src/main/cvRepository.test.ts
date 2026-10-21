import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { sampleCv } from '../renderer/src/domain/sampleCv'
import type { CvMigrations } from '../renderer/src/domain/migrations'
import type { CvDocument } from '../renderer/src/domain/schema'
import { createCvRepository, InvalidCvFileError, type CvRepository } from './cvRepository'

let dataDir: string
let cvDir: string
let repository: CvRepository

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'moje-cv-repo-'))
  cvDir = join(dataDir, 'cvs')
  repository = createCvRepository(cvDir)
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('save and get', () => {
  test('a saved CV reads back unchanged', async () => {
    await repository.save(sampleCv)

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
  })
})

describe('atomic save', () => {
  test('a reader never sees a half-written file while the CV is being overwritten', async () => {
    const large = (index: number) =>
      cv({ name: `Wersja ${index}`, header: { ...sampleCv.header, photo: { dataUrl: 'x'.repeat(4_000_000 + index) } } })
    await repository.save(large(0))

    let saving = true
    const saves = (async () => {
      for (let index = 1; index <= 10; index++) await repository.save(large(index))
      saving = false
    })()
    const seenNames = new Set<string>()
    while (saving) {
      const content = await readFile(join(cvDir, `${sampleCv.id}.json`), 'utf8')
      seenNames.add(JSON.parse(content).name)
    }
    await saves

    expect(seenNames.size).toBeGreaterThan(0)
    expect((await repository.get(sampleCv.id)).name).toBe('Wersja 10')
    expect(await repository.list()).toHaveLength(1)
  })
})

describe('list', () => {
  test('is empty when nothing has been saved yet', async () => {
    expect(await repository.list()).toEqual([])
  })

  test('shows the name and last change of every CV, most recently changed first', async () => {
    await repository.save(cv({ id: 'older', name: 'CV – Bank', updatedAt: '2026-03-01T10:00:00.000Z' }))
    await repository.save(cv({ id: 'newer', name: 'CV – Talent Partners', updatedAt: '2026-05-01T10:00:00.000Z' }))

    expect(await repository.list()).toEqual([
      { status: 'ok', id: 'newer', name: 'CV – Talent Partners', updatedAt: '2026-05-01T10:00:00.000Z' },
      { status: 'ok', id: 'older', name: 'CV – Bank', updatedAt: '2026-03-01T10:00:00.000Z' }
    ])
  })
})

describe('first run', () => {
  test('an empty data directory gets the sample CV', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })

    await repository.addSampleOnFirstRun(sampleCv)

    const [entry, ...rest] = await repository.list()
    expect(rest).toEqual([])
    expect(entry).toMatchObject({ status: 'ok', name: 'Przykładowe CV', updatedAt: '2026-10-21T08:30:00.000Z' })
    const stored = await repository.get(entry!.id)
    expect(stored.header).toEqual(sampleCv.header)
    expect(stored.sections).toEqual(sampleCv.sections)
  })

  test('later runs leave the library alone, even after the user deleted every CV', async () => {
    await repository.addSampleOnFirstRun(sampleCv)
    const [sample] = await repository.list()
    await repository.delete(sample!.id)

    await repository.addSampleOnFirstRun(sampleCv)

    expect(await repository.list()).toEqual([])
  })

  test('existing CVs are not touched', async () => {
    await repository.save(cv({ id: 'mine', name: 'Moje' }))

    await repository.addSampleOnFirstRun(sampleCv)

    expect(await repository.list()).toEqual([
      { status: 'ok', id: 'mine', name: 'Moje', updatedAt: sampleCv.updatedAt }
    ])
  })
})

describe('create', () => {
  test('adds an empty CV with default section titles to the library', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })

    const created = await repository.create()

    expect(await repository.list()).toEqual([
      { status: 'ok', id: created.id, name: 'Nowe CV', updatedAt: '2026-10-21T08:30:00.000Z' }
    ])
    const stored = await repository.get(created.id)
    expect(stored.header.fullName).toBe('')
    expect(stored.sections.map((section) => [section.title, section.items.length])).toEqual([
      ['Doświadczenie zawodowe', 0],
      ['Wykształcenie', 0],
      ['Umiejętności', 0],
      ['Języki', 0]
    ])
  })

  test('starts with the default clause from the library switched on', async () => {
    const created = await repository.create({ id: 'general', name: 'Ogólna', text: 'Wyrażam zgodę…' })

    expect((await repository.get(created.id)).consent).toEqual({ enabled: true, clauseId: 'general', text: 'Wyrażam zgodę…' })
  })

  test('has the clause switched off when the library has no default', async () => {
    const created = await repository.create(null)

    expect((await repository.get(created.id)).consent).toEqual({ enabled: false, clauseId: null, text: '' })
  })

  test('every new CV gets its own id', async () => {
    const first = await repository.create()
    const second = await repository.create()

    expect(first.id).not.toBe(second.id)
    expect(await repository.list()).toHaveLength(2)
  })
})

describe('duplicate', () => {
  test('stores a copy under a new id and leaves the original as it was', async () => {
    await repository.save(sampleCv)

    const copy = await repository.duplicate(sampleCv.id)

    expect(copy.id).not.toBe(sampleCv.id)
    expect(copy.name).toBe('Przykładowe CV (kopia)')
    expect(copy.header).toEqual(sampleCv.header)
    expect(copy.sections).toEqual(sampleCv.sections)
    expect(await repository.get(copy.id)).toEqual(copy)
    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
    expect((await repository.list()).map((entry) => entry.id).sort()).toEqual([copy.id, sampleCv.id].sort())
  })

  test('every copy gets its own id', async () => {
    await repository.save(sampleCv)

    const first = await repository.duplicate(sampleCv.id)
    const second = await repository.duplicate(sampleCv.id)

    expect(first.id).not.toBe(second.id)
    expect(await repository.list()).toHaveLength(3)
  })
})

describe('rename', () => {
  test('changes the name shown on the list and marks the CV as just changed', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })
    await repository.save(sampleCv)

    await repository.rename(sampleCv.id, 'CV – Talent Partners')

    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: 'CV – Talent Partners', updatedAt: '2026-10-21T08:30:00.000Z' }
    ])
    expect((await repository.get(sampleCv.id)).sections).toEqual(sampleCv.sections)
  })

  test('an empty name is rejected', async () => {
    await repository.save(sampleCv)

    await expect(repository.rename(sampleCv.id, '   ')).rejects.toThrow()
    expect((await repository.get(sampleCv.id)).name).toBe('Przykładowe CV')
  })
})

describe('update', () => {
  test('stores the edited content and marks the CV as just changed', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })
    await repository.save(sampleCv)
    const edited = cv({ header: { ...sampleCv.header, fullName: 'Ewa Nowak' } })

    await repository.update(edited)

    const stored = await repository.get(sampleCv.id)
    expect(stored.header.fullName).toBe('Ewa Nowak')
    expect(stored.createdAt).toBe(sampleCv.createdAt)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: '2026-10-21T08:30:00.000Z' }
    ])
  })

  test('a deleted CV is not brought back by a late save', async () => {
    await repository.save(sampleCv)
    await repository.delete(sampleCv.id)

    await expect(repository.update(sampleCv)).rejects.toThrow()
    expect(await repository.list()).toEqual([])
  })
})

describe('delete', () => {
  test('removes the CV from the library', async () => {
    await repository.save(cv({ id: 'keep' }))
    await repository.save(cv({ id: 'remove' }))

    await repository.delete('remove')

    expect((await repository.list()).map((entry) => entry.id)).toEqual(['keep'])
    await expect(repository.get('remove')).rejects.toThrow()
  })
})

describe('damaged files', () => {
  const damagedFiles = {
    'invalid JSON': '{ "schemaVersion": 1, "name": ',
    'JSON not matching the schema': JSON.stringify({ ...sampleCv, id: 'broken', settings: { font: 'comic-sans' } })
  }

  for (const [kind, content] of Object.entries(damagedFiles)) {
    test(`a file with ${kind} is listed as damaged next to healthy CVs`, async () => {
      await repository.save(sampleCv)
      await writeFile(join(cvDir, 'broken.json'), content)

      expect(await repository.list()).toEqual([
        { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt },
        { status: 'damaged', id: 'broken' }
      ])
    })

    test(`a file with ${kind} cannot be opened and is left untouched`, async () => {
      await mkdir(cvDir, { recursive: true })
      await writeFile(join(cvDir, 'broken.json'), content)

      await expect(repository.get('broken')).rejects.toThrow()
      await expect(repository.duplicate('broken')).rejects.toThrow()
      await expect(repository.rename('broken', 'Nowa nazwa')).rejects.toThrow()
      await expect(repository.save(cv({ id: 'broken' }))).rejects.toThrow()
      await repository.list()

      expect(await readFile(join(cvDir, 'broken.json'), 'utf8')).toBe(content)
    })

    test(`a file with ${kind} can be deleted`, async () => {
      await mkdir(cvDir, { recursive: true })
      await writeFile(join(cvDir, 'broken.json'), content)

      await repository.delete('broken')

      expect(await repository.list()).toEqual([])
    })
  }
})

test('ids that point outside the CV directory are rejected', async () => {
  await writeFile(join(dataDir, 'settings.json'), '{}')

  for (const id of ['../settings', '..', '.hidden', 'a/b']) {
    await expect(repository.get(id)).rejects.toThrow('Niepoprawny identyfikator CV')
    await expect(repository.delete(id)).rejects.toThrow('Niepoprawny identyfikator CV')
  }
  await expect(repository.save(cv({ id: '../settings' }))).rejects.toThrow('Niepoprawny identyfikator CV')
  expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe('{}')
})

const cv = (overrides: Partial<CvDocument>): CvDocument => ({ ...sampleCv, ...overrides })

describe('export', () => {
  test('writes the whole CV as JSON that imports back as a copy with the same content', async () => {
    await repository.save(sampleCv)

    const { name, content } = await repository.exportJson(sampleCv.id)
    const imported = await repository.importJson(content)

    expect(name).toBe(sampleCv.name)
    expect(JSON.parse(content)).toEqual(sampleCv)
    expect({ ...imported, id: sampleCv.id, createdAt: sampleCv.createdAt, updatedAt: sampleCv.updatedAt }).toEqual(sampleCv)
  })
})

describe('import', () => {
  test('adds the CV from the file to the library under a new id', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })

    const imported = await repository.importJson(JSON.stringify(sampleCv))

    expect(imported.id).not.toBe(sampleCv.id)
    expect(imported.name).toBe(sampleCv.name)
    expect(imported.header).toEqual(sampleCv.header)
    expect(imported.sections).toEqual(sampleCv.sections)
    expect(await repository.get(imported.id)).toEqual(imported)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: imported.id, name: sampleCv.name, updatedAt: '2026-10-21T08:30:00.000Z' }
    ])
  })

  test('never overwrites a CV already in the library, even one with the same id', async () => {
    await repository.save(sampleCv)
    const edited = cv({ name: 'Z innego komputera', header: { ...sampleCv.header, fullName: 'Ewa Nowak' } })

    const first = await repository.importJson(JSON.stringify(edited))
    const second = await repository.importJson(JSON.stringify(edited))

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
    expect(new Set([sampleCv.id, first.id, second.id]).size).toBe(3)
    expect(await repository.list()).toHaveLength(3)
  })

  const invalidFiles = {
    'is not JSON': ['{ "schemaVersion": 1, "name": ', 'Plik nie jest poprawnym plikiem CV (niepoprawny format JSON).'],
    'is JSON but not a CV': ['{ "hello": "world" }', 'Plik nie zawiera poprawnego CV.'],
    'is a CV with invalid content': [
      JSON.stringify({ ...sampleCv, settings: { ...sampleCv.settings, font: 'comic-sans' } }),
      'Plik nie zawiera poprawnego CV.'
    ],
    'comes from a newer version of the app': [
      JSON.stringify({ ...sampleCv, schemaVersion: 2 }),
      'Plik pochodzi z nowszej wersji aplikacji Moje CV. Zaktualizuj aplikację, żeby go zaimportować.'
    ]
  }

  for (const [kind, [content, message]] of Object.entries(invalidFiles)) {
    test(`a file that ${kind} is rejected with a readable message and the library stays as it was`, async () => {
      await repository.save(sampleCv)

      const error = await repository.importJson(content).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(InvalidCvFileError)
      expect((error as Error).message).toBe(message)
      expect(await repository.list()).toEqual([
        { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt }
      ])
    })
  }
})

describe('schema migrations', () => {
  // Testowa historia schematu: w wersji -1 imię i nazwisko było polem `owner` dokumentu,
  // w wersji 0 trafiło do nagłówka jako `name`, a w bieżącej (1) nazywa się `fullName`.
  const migrations: CvMigrations = {
    [-1]: ({ owner, header, ...rest }) => ({ ...rest, header: { ...(header as object), name: owner } }),
    0: ({ header, ...rest }) => {
      const { name, ...headerRest } = header as { name: string }
      return { ...rest, header: { ...headerRest, fullName: name } }
    }
  }
  const { fullName, ...headerWithoutName } = sampleCv.header
  const version0 = { ...sampleCv, schemaVersion: 0, header: { ...headerWithoutName, name: fullName } }
  const versionMinus1 = { ...sampleCv, schemaVersion: -1, owner: fullName, header: headerWithoutName }

  beforeEach(() => {
    repository = createCvRepository(cvDir, { migrations })
  })

  test('a library file with an older schema version is read as the current version', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version0))

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt }
    ])
  })

  test('migrations are applied one after another, from the file version up to the current one', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(versionMinus1))

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
  })

  test('an imported file with an older schema version is migrated', async () => {
    const imported = await repository.importJson(JSON.stringify(versionMinus1))

    expect(imported.schemaVersion).toBe(1)
    expect(imported.header).toEqual(sampleCv.header)
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  test('an edited CV from an older file is saved in the current version', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version0))

    await repository.rename(sampleCv.id, 'Nowa nazwa')

    const stored = JSON.parse(await readFile(join(cvDir, `${sampleCv.id}.json`), 'utf8'))
    expect(stored.schemaVersion).toBe(1)
    expect(stored.header.fullName).toBe(fullName)
  })

  test('a file with a version that has no migration is damaged and left untouched', async () => {
    const content = JSON.stringify({ ...version0, schemaVersion: -2 })
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'old.json'), content)

    expect(await repository.list()).toEqual([{ status: 'damaged', id: 'old' }])
    await expect(repository.importJson(content)).rejects.toThrow('Plik nie zawiera poprawnego CV.')
    expect(await readFile(join(cvDir, 'old.json'), 'utf8')).toBe(content)
  })

  test('a file a migration cannot handle is damaged', async () => {
    const content = JSON.stringify({ ...version0, header: null })
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'broken.json'), content)

    expect(await repository.list()).toEqual([{ status: 'damaged', id: 'broken' }])
    await expect(repository.importJson(content)).rejects.toThrow('Plik nie zawiera poprawnego CV.')
  })
})
