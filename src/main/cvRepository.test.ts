import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { sampleCvs } from '../renderer/src/domain/sampleCv'
import { cvMigrations, type CvMigrations } from '../renderer/src/domain/migrations'
import { CV_SCHEMA_VERSION, type CvDocument } from '../renderer/src/domain/schema'
import type { InvalidCvFileReason } from '../shared/api'
import { InvalidTagError } from '../renderer/src/domain/tags'
import { createCvRepository, InvalidCvFileError, type CvRepository } from './cvRepository'

const sampleCv = sampleCvs.pl

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
      { status: 'ok', id: 'newer', name: 'CV – Talent Partners', updatedAt: '2026-05-01T10:00:00.000Z', tags: [] },
      { status: 'ok', id: 'older', name: 'CV – Bank', updatedAt: '2026-03-01T10:00:00.000Z', tags: [] }
    ])
  })
})

describe('first run', () => {
  test('an empty data directory gets the sample CV', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })

    await repository.addSampleOnFirstRun(sampleCv)

    const [entry, ...rest] = await repository.list()
    expect(rest).toEqual([])
    expect(entry).toMatchObject({ status: 'ok', name: 'Przykładowe CV', updatedAt: '2026-10-21T08:30:00.000Z', tags: [] })
    const stored = await repository.get(entry!.id)
    expect(stored.header).toEqual(sampleCv.header)
    expect(stored.sections).toEqual(sampleCv.sections)
    expect(stored.settings.template).toBe('classic')
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
      { status: 'ok', id: 'mine', name: 'Moje', updatedAt: sampleCv.updatedAt, tags: [] }
    ])
  })
})

describe('add sample', () => {
  test('adds the Sample CV as a new CV dated now, with the given content', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-11-04T09:15:00.000Z') })

    const added = await repository.addSample(sampleCv)

    expect(added.id).not.toBe(sampleCv.id)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: added.id, name: 'Przykładowe CV', updatedAt: '2026-11-04T09:15:00.000Z', tags: [] }
    ])
    const stored = await repository.get(added.id)
    expect(stored.createdAt).toBe('2026-11-04T09:15:00.000Z')
    expect({ ...stored, id: sampleCv.id, createdAt: sampleCv.createdAt, updatedAt: sampleCv.updatedAt }).toEqual(sampleCv)
  })

  test('works in an empty library left after the user deleted every CV', async () => {
    await repository.addSampleOnFirstRun(sampleCv)
    const [first] = await repository.list()
    await repository.delete(first!.id)

    await repository.addSample(sampleCv)

    expect((await repository.list()).map((entry) => entry.status === 'ok' && entry.name)).toEqual(['Przykładowe CV'])
  })

  test('adding twice gives two separate CVs with the same name', async () => {
    const first = await repository.addSample(sampleCv)
    const second = await repository.addSample(sampleCv)

    expect(first.id).not.toBe(second.id)
    const entries = await repository.list()
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.status === 'ok' && entry.name)).toEqual(['Przykładowe CV', 'Przykładowe CV'])
  })

  test.each(['en', 'pl'] as const)('the Sample CV written in %s has that CV language', async (language) => {
    const added = await repository.addSample(sampleCvs[language])

    expect((await repository.get(added.id)).settings.language).toBe(language)
  })

  test('other CVs in the library are not touched', async () => {
    const mine = cv({ id: 'mine', name: 'Moje', tags: ['frontend'] })
    await repository.save(mine)

    await repository.addSample(sampleCvs.en)

    expect(await repository.get('mine')).toEqual(mine)
    const names = (await repository.list()).map((entry) => entry.status === 'ok' && entry.name)
    expect(names.sort()).toEqual(['Moje', 'Sample CV'])
  })
})

describe('create', () => {
  test('adds an empty CV with default section titles to the library', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })

    const created = await repository.create('pl')

    expect(await repository.list()).toEqual([
      { status: 'ok', id: created.id, name: 'Nowe CV', updatedAt: '2026-10-21T08:30:00.000Z', tags: [] }
    ])
    const stored = await repository.get(created.id)
    expect(stored.header.fullName).toBe('')
    expect(stored.sections.map((section) => [section.title, section.items.length])).toEqual([
      ['Doświadczenie zawodowe', 0],
      ['Wykształcenie', 0],
      ['Umiejętności', 0],
      ['Języki', 0]
    ])
    expect(stored.header.contacts.map((contact) => contact.label)).toEqual(['Tel', 'E-mail', 'LinkedIn', 'Miasto'])
  })

  test('takes its name, contact labels and section titles from the Default content of the given language', async () => {
    const created = await repository.create('en')

    const stored = await repository.get(created.id)
    expect(stored.name).toBe('New CV')
    expect(stored.header.contacts.map((contact) => contact.label)).toEqual(['Phone', 'Email', 'LinkedIn', 'City'])
    expect(stored.sections.map((section) => section.title)).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
  })

  test('starts with the default clause from the library switched on', async () => {
    const created = await repository.create('pl', { id: 'general', name: 'Ogólna', text: 'Wyrażam zgodę…' })

    expect((await repository.get(created.id)).consent).toEqual({ enabled: true, clauseId: 'general', text: 'Wyrażam zgodę…' })
  })

  test('has the clause switched off when the library has no default', async () => {
    const created = await repository.create('pl', null)

    expect((await repository.get(created.id)).consent).toEqual({ enabled: false, clauseId: null, text: '' })
  })

  test.each(['en', 'pl'] as const)('starts in the given Interface language as its CV language (%s)', async (language) => {
    const created = await repository.create(language)

    expect((await repository.get(created.id)).settings.language).toBe(language)
  })

  test('is rendered with the Classic template', async () => {
    const created = await repository.create('pl')

    expect((await repository.get(created.id)).settings.template).toBe('classic')
  })

  test('every new CV gets its own id', async () => {
    const first = await repository.create('pl')
    const second = await repository.create('pl')

    expect(first.id).not.toBe(second.id)
    expect(await repository.list()).toHaveLength(2)
  })
})

describe('duplicate', () => {
  test('stores a copy under a new id and leaves the original as it was', async () => {
    await repository.save(sampleCv)

    const copy = await repository.duplicate(sampleCv.id, 'pl')

    expect(copy.id).not.toBe(sampleCv.id)
    expect(copy.name).toBe('Przykładowe CV (kopia)')
    expect(copy.header).toEqual(sampleCv.header)
    expect(copy.sections).toEqual(sampleCv.sections)
    expect(await repository.get(copy.id)).toEqual(copy)
    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
    expect((await repository.list()).map((entry) => entry.id).sort()).toEqual([copy.id, sampleCv.id].sort())
  })

  test('names the copy with the suffix from the Default content of the given language', async () => {
    await repository.save(sampleCv)

    expect((await repository.duplicate(sampleCv.id, 'en')).name).toBe('Przykładowe CV (copy)')
  })

  test('every copy gets its own id', async () => {
    await repository.save(sampleCv)

    const first = await repository.duplicate(sampleCv.id, 'pl')
    const second = await repository.duplicate(sampleCv.id, 'pl')

    expect(first.id).not.toBe(second.id)
    expect(await repository.list()).toHaveLength(3)
  })

  test('the copy has the tags of the original', async () => {
    await repository.save(sampleCv)
    await repository.setTags(sampleCv.id, ['Allegro', 'frontend'])

    const copy = await repository.duplicate(sampleCv.id, 'pl')

    expect(copy.tags).toEqual(['Allegro', 'frontend'])
    expect(await repository.get(copy.id)).toEqual(copy)
  })

  test('the copy keeps the CV language of the original, whatever the Interface language', async () => {
    const original = cv({ settings: { ...sampleCv.settings, language: 'en' } })
    await repository.save(original)

    const copy = await repository.duplicate(original.id, 'pl')

    expect(copy.settings.language).toBe('en')
    expect((await repository.get(copy.id)).settings.language).toBe('en')
  })

  test.each(['modern', 'bold'] as const)('the copy has the template of the original (%s)', async (template) => {
    const original = cv({ settings: { ...sampleCv.settings, template } })
    await repository.save(original)

    const copy = await repository.duplicate(original.id, 'pl')

    expect(copy.settings).toEqual(original.settings)
    expect(await repository.get(copy.id)).toEqual(copy)
  })
})

describe('rename', () => {
  test('changes the name shown on the list and marks the CV as just changed', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })
    await repository.save(sampleCv)

    await repository.rename(sampleCv.id, 'CV – Talent Partners')

    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: 'CV – Talent Partners', updatedAt: '2026-10-21T08:30:00.000Z', tags: [] }
    ])
    expect((await repository.get(sampleCv.id)).sections).toEqual(sampleCv.sections)
  })

  test('an empty name is rejected', async () => {
    await repository.save(sampleCv)

    await expect(repository.rename(sampleCv.id, '   ')).rejects.toThrow()
    expect((await repository.get(sampleCv.id)).name).toBe('Przykładowe CV')
  })
})

describe('set tags', () => {
  test('the tags are stored with the CV and shown on the list, without changing its last change or position', async () => {
    repository = createCvRepository(cvDir, { now: () => new Date('2026-10-21T08:30:00.000Z') })
    await repository.save(cv({ id: 'older', updatedAt: '2026-03-01T10:00:00.000Z' }))
    await repository.save(cv({ id: 'newer', updatedAt: '2026-05-01T10:00:00.000Z' }))

    const tagged = await repository.setTags('older', ['frontend', 'EN'])

    expect(tagged.tags).toEqual(['frontend', 'EN'])
    expect(await repository.get('older')).toEqual(tagged)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: 'newer', name: sampleCv.name, updatedAt: '2026-05-01T10:00:00.000Z', tags: [] },
      { status: 'ok', id: 'older', name: sampleCv.name, updatedAt: '2026-03-01T10:00:00.000Z', tags: ['frontend', 'EN'] }
    ])
  })

  test('replaces the previous tags, so a tag can be removed', async () => {
    await repository.save(sampleCv)
    await repository.setTags(sampleCv.id, ['frontend', 'EN'])

    await repository.setTags(sampleCv.id, ['EN'])

    expect((await repository.get(sampleCv.id)).tags).toEqual(['EN'])
  })

  test('" Allegro " and "Allegro" are the same tag, and repeated spaces inside a tag are collapsed', async () => {
    await repository.save(sampleCv)

    const tagged = await repository.setTags(sampleCv.id, [' Allegro ', 'Allegro', 'Senior   Frontend\tDev'])

    expect(tagged.tags).toEqual(['Allegro', 'Senior Frontend Dev'])
  })

  test('two tags differing only in letter case end up as one, keeping the first spelling', async () => {
    await repository.save(sampleCv)

    expect((await repository.setTags(sampleCv.id, ['Frontend', 'frontend', 'FRONTEND'])).tags).toEqual(['Frontend'])
  })

  test('a tag differing from one on another CV only in letter case takes the existing spelling', async () => {
    await repository.save(cv({ id: 'tagged' }))
    await repository.save(cv({ id: 'other' }))
    await repository.setTags('tagged', ['Frontend', 'EN'])

    expect((await repository.setTags('other', ['frontend', 'en', 'Allegro'])).tags).toEqual(['Frontend', 'EN', 'Allegro'])
    expect((await repository.get('other')).tags).toEqual(['Frontend', 'EN', 'Allegro'])
  })

  test('the spelling on the CV being tagged is not taken over: its own tag can change letter case', async () => {
    await repository.save(sampleCv)
    await repository.setTags(sampleCv.id, ['frontend'])

    expect((await repository.setTags(sampleCv.id, ['Frontend'])).tags).toEqual(['Frontend'])
  })

  test('a spelling no CV has any more is not taken over', async () => {
    await repository.save(cv({ id: 'tagged' }))
    await repository.save(cv({ id: 'other' }))
    await repository.setTags('tagged', ['Frontend'])
    await repository.setTags('tagged', [])

    expect((await repository.setTags('other', ['frontend'])).tags).toEqual(['frontend'])
  })

  test('damaged files next to the CV do not get in the way of taking an existing spelling', async () => {
    await repository.save(cv({ id: 'tagged' }))
    await repository.save(cv({ id: 'other' }))
    await repository.setTags('tagged', ['Frontend'])
    await writeFile(join(cvDir, 'broken.json'), '{ not json')

    expect((await repository.setTags('other', ['frontend'])).tags).toEqual(['Frontend'])
  })

  test('empty tags are dropped', async () => {
    await repository.save(sampleCv)

    expect((await repository.setTags(sampleCv.id, ['', '   ', 'EN'])).tags).toEqual(['EN'])
  })

  test('a tag longer than 30 characters is rejected with the reason "too-long" and the tags stay as they were', async () => {
    await repository.save(sampleCv)
    await repository.setTags(sampleCv.id, ['EN'])

    const error = await repository.setTags(sampleCv.id, ['EN', 'x'.repeat(31)]).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(InvalidTagError)
    expect((error as InvalidTagError).reason).toBe('too-long')
    expect((await repository.get(sampleCv.id)).tags).toEqual(['EN'])
    expect((await repository.setTags(sampleCv.id, ['x'.repeat(30)])).tags).toEqual(['x'.repeat(30)])
  })

  test('two CVs tagged at the same time with spellings differing only in letter case end up with one spelling', async () => {
    await repository.save(cv({ id: 'first' }))
    await repository.save(cv({ id: 'second' }))

    await Promise.all([repository.setTags('first', ['Frontend']), repository.setTags('second', ['frontend'])])

    expect([(await repository.get('first')).tags, (await repository.get('second')).tags]).toEqual([['Frontend'], ['Frontend']])
  })

  test('a CV imported while another is tagged takes the same spelling of a tag', async () => {
    await repository.save(cv({ id: 'tagged' }))

    const [, imported] = await Promise.all([
      repository.setTags('tagged', ['Frontend']),
      repository.importJson(JSON.stringify(cv({ tags: ['frontend'] })))
    ])

    expect(imported.tags).toEqual(['Frontend'])
  })

  test('a deleted CV cannot be tagged', async () => {
    await repository.save(sampleCv)
    await repository.delete(sampleCv.id)

    await expect(repository.setTags(sampleCv.id, ['EN'])).rejects.toThrow()
    expect(await repository.list()).toEqual([])
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
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: '2026-10-21T08:30:00.000Z', tags: [] }
    ])
  })

  test('a late save from the editor with other or no tags keeps the tags just set on the list', async () => {
    await repository.save(sampleCv)
    const openedInEditor = await repository.get(sampleCv.id)
    await repository.setTags(sampleCv.id, ['frontend', 'EN'])

    await repository.update({ ...openedInEditor, header: { ...sampleCv.header, fullName: 'Ewa Nowak' } })
    await repository.update({ ...openedInEditor, tags: ['Inny'] })

    const stored = await repository.get(sampleCv.id)
    expect(stored.tags).toEqual(['frontend', 'EN'])
    expect((await repository.list())[0]).toMatchObject({ tags: ['frontend', 'EN'] })
  })

  test('a save from the editor at the same time as setting tags keeps both the edited content and the new tags', async () => {
    await repository.save(sampleCv)
    const edited = cv({ header: { ...sampleCv.header, fullName: 'Ewa Nowak' } })

    await Promise.all([repository.setTags(sampleCv.id, ['frontend']), repository.update(edited)])
    await Promise.all([repository.update(cv({ header: { ...sampleCv.header, fullName: 'Jan Kowalski' } })), repository.setTags(sampleCv.id, ['EN'])])

    const stored = await repository.get(sampleCv.id)
    expect(stored.header.fullName).toBe('Jan Kowalski')
    expect(stored.tags).toEqual(['EN'])
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
    'JSON not matching the schema': JSON.stringify({ ...sampleCv, id: 'broken', settings: { font: 'comic-sans' } }),
    // Bieżąca wersja schematu, ale szablon nieznany tej wersji aplikacji – bez cichego zastępowania (ADR 0002).
    'a Template this version does not know': JSON.stringify({
      ...sampleCv,
      schemaVersion: CV_SCHEMA_VERSION,
      id: 'broken',
      settings: { ...sampleCv.settings, template: 'futuristic' }
    })
  }

  for (const [kind, content] of Object.entries(damagedFiles)) {
    test(`a file with ${kind} is listed as damaged next to healthy CVs`, async () => {
      await repository.save(sampleCv)
      await writeFile(join(cvDir, 'broken.json'), content)

      expect(await repository.list()).toEqual([
        { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt, tags: [] },
        { status: 'damaged', id: 'broken', reason: 'damaged' }
      ])
    })

    test(`a file with ${kind} cannot be opened and is left untouched`, async () => {
      await mkdir(cvDir, { recursive: true })
      await writeFile(join(cvDir, 'broken.json'), content)

      await expect(repository.get('broken')).rejects.toThrow()
      await expect(repository.duplicate('broken', 'pl')).rejects.toThrow()
      await expect(repository.rename('broken', 'Nowa nazwa')).rejects.toThrow()
      await expect(repository.setTags('broken', ['EN'])).rejects.toThrow()
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

describe('files from a newer version of the app', () => {
  const content = JSON.stringify({ ...sampleCv, id: 'future', schemaVersion: CV_SCHEMA_VERSION + 1, name: 'Z nowszej wersji' })
  const writeNewer = async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'future.json'), content)
  }

  test('a file with a newer schema version is listed as needing a newer version, after healthy CVs', async () => {
    await repository.save(sampleCv)
    await writeNewer()

    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt, tags: [] },
      { status: 'damaged', id: 'future', reason: 'newer-version' }
    ])
  })

  test('a file from a newer version cannot be opened or overwritten and is left byte for byte', async () => {
    await writeNewer()

    await expect(repository.get('future')).rejects.toThrow()
    await expect(repository.duplicate('future', 'pl')).rejects.toThrow()
    await expect(repository.rename('future', 'Nowa nazwa')).rejects.toThrow()
    await expect(repository.setTags('future', ['EN'])).rejects.toThrow()
    await expect(repository.save(cv({ id: 'future' }))).rejects.toThrow()
    await expect(repository.update(cv({ id: 'future' }))).rejects.toThrow()

    expect(await readFile(join(cvDir, 'future.json'), 'utf8')).toBe(content)
  })

  test('a file from a newer version can be deleted', async () => {
    await writeNewer()

    await repository.delete('future')

    expect(await repository.list()).toEqual([])
  })

  test('tags of a file from a newer version do not set the spelling of library tags', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'future.json'), JSON.stringify({ ...sampleCv, id: 'future', schemaVersion: CV_SCHEMA_VERSION + 1, tags: ['Frontend'] }))
    await repository.save(cv({ id: 'other' }))

    expect((await repository.setTags('other', ['frontend'])).tags).toEqual(['frontend'])
  })
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

  test('the tags travel with the CV: they are in the file and come back on import', async () => {
    await repository.save(sampleCv)
    await repository.setTags(sampleCv.id, ['Allegro', 'frontend'])

    const { content } = await repository.exportJson(sampleCv.id)
    await repository.delete(sampleCv.id)
    const imported = await repository.importJson(content)

    expect(JSON.parse(content).tags).toEqual(['Allegro', 'frontend'])
    expect(imported.tags).toEqual(['Allegro', 'frontend'])
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  test.each(['modern', 'bold'] as const)('the template travels with the CV: it is in the file and comes back on import (%s)', async (template) => {
    await repository.save(cv({ settings: { ...sampleCv.settings, template } }))

    const { content } = await repository.exportJson(sampleCv.id)
    const imported = await repository.importJson(content)

    expect(JSON.parse(content).settings.template).toBe(template)
    expect(imported.settings.template).toBe(template)
    expect(await repository.get(imported.id)).toEqual(imported)
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
      { status: 'ok', id: imported.id, name: sampleCv.name, updatedAt: '2026-10-21T08:30:00.000Z', tags: [] }
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

  test('tags from the file are normalized like set tags: spaces trimmed and collapsed, empty and repeated ones dropped', async () => {
    const imported = await repository.importJson(JSON.stringify(cv({ tags: [' Allegro ', 'front   end', '', '   ', 'ALLEGRO'] })))

    expect(imported.tags).toEqual(['Allegro', 'front end'])
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  test('a tag from the file differing from one in the library only in letter case takes the existing spelling', async () => {
    await repository.save(cv({ tags: ['Allegro'] }))

    const imported = await repository.importJson(JSON.stringify(cv({ name: 'Inne', tags: ['allegro', 'backend'] })))

    expect(imported.tags).toEqual(['Allegro', 'backend'])
  })

  test.each(['en', 'pl'] as const)('a file in the current version keeps its CV language (%s)', async (language) => {
    const imported = await repository.importJson(JSON.stringify(cv({ settings: { ...sampleCv.settings, language } })))

    expect(imported.settings.language).toBe(language)
    expect((await repository.get(imported.id)).settings.language).toBe(language)
  })

  test('a file saved before tags existed (version 1) imports as a CV with no tags', async () => {
    const { tags: _tags, ...version1 } = { ...sampleCv, schemaVersion: 1 }

    const imported = await repository.importJson(JSON.stringify(version1))

    expect(imported.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect(imported.tags).toEqual([])
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  const invalidFiles: Record<string, [string, InvalidCvFileReason]> = {
    'is not JSON': ['{ "schemaVersion": 1, "name": ', 'not-json'],
    'is JSON but not a CV': ['{ "hello": "world" }', 'not-a-cv'],
    'is a CV with invalid content': [JSON.stringify({ ...sampleCv, settings: { ...sampleCv.settings, font: 'comic-sans' } }), 'not-a-cv'],
    'names a Template this version does not know': [
      JSON.stringify({ ...sampleCv, settings: { ...sampleCv.settings, template: 'futuristic' } }),
      'not-a-cv'
    ],
    'comes from a newer version of the app': [JSON.stringify({ ...sampleCv, schemaVersion: CV_SCHEMA_VERSION + 1 }), 'newer-version'],
    'has a tag longer than 30 characters': [JSON.stringify(cv({ tags: ['Allegro', `  ${'x'.repeat(31)}  `] })), 'tag-too-long']
  }

  for (const [kind, [content, reason]] of Object.entries(invalidFiles)) {
    test(`a file that ${kind} is rejected with the reason "${reason}" and the library stays as it was`, async () => {
      await repository.save(sampleCv)

      const error = await repository.importJson(content).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(InvalidCvFileError)
      expect((error as InvalidCvFileError).reason).toBe(reason)
      expect(await repository.list()).toEqual([
        { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt, tags: [] }
      ])
    })
  }
})

describe('schema migrations', () => {
  // Testowa historia schematu: w wersji -1 imię i nazwisko było polem `owner` dokumentu,
  // w wersji 0 trafiło do nagłówka jako `name`, a w wersji 1 nazywa się `fullName`. Dalej – prawdziwe migracje.
  const migrations: CvMigrations = {
    ...cvMigrations,
    [-1]: ({ owner, header, ...rest }) => ({ ...rest, header: { ...(header as object), name: owner } }),
    0: ({ header, ...rest }) => {
      const { name, ...headerRest } = header as { name: string }
      return { ...rest, header: { ...headerRest, fullName: name } }
    }
  }
  const { fullName, ...headerWithoutName } = sampleCv.header
  const { language: _language, ...settingsWithoutLanguage } = sampleCv.settings
  const { template: _template, ...settingsWithoutTemplate } = settingsWithoutLanguage
  const version5 = { ...sampleCv, schemaVersion: 5, settings: settingsWithoutLanguage }
  const version3 = { ...version5, schemaVersion: 3 }
  const version2 = { ...version3, schemaVersion: 2, settings: settingsWithoutTemplate }
  const { tags: _tags, ...version1 } = { ...version2, schemaVersion: 1 }
  const version0 = { ...version1, schemaVersion: 0, header: { ...headerWithoutName, name: fullName } }
  const versionMinus1 = { ...version1, schemaVersion: -1, owner: fullName, header: headerWithoutName }

  beforeEach(() => {
    repository = createCvRepository(cvDir, { migrations })
  })

  test('a library file with an older schema version is read as the current version', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version0))

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt, tags: [] }
    ])
  })

  test('a CV saved before tags existed (version 1) opens normally, with no tags', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version1))

    expect(await repository.get(sampleCv.id)).toEqual({ ...sampleCv, tags: [] })
    expect(await repository.list()).toEqual([
      { status: 'ok', id: sampleCv.id, name: sampleCv.name, updatedAt: sampleCv.updatedAt, tags: [] }
    ])
  })

  test('a CV saved before templates existed (version 2) opens as before, with the Classic template', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version2))

    const stored = await repository.get(sampleCv.id)

    expect(stored.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect(stored.settings).toEqual({ ...settingsWithoutTemplate, template: 'classic', language: 'pl' })
    expect({ ...stored, schemaVersion: 2, settings: settingsWithoutTemplate }).toEqual(version2)
  })

  test('a CV saved before the Modern template existed (version 3) opens unchanged, with its template', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version3))

    const stored = await repository.get(sampleCv.id)

    expect(stored.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect({ ...stored, schemaVersion: 3, settings: settingsWithoutLanguage }).toEqual(version3)
  })

  test('a CV saved before the Bold template existed (version 4) opens unchanged, with its template', async () => {
    const settings4 = { ...settingsWithoutLanguage, template: 'modern' }
    const version4 = { ...sampleCv, schemaVersion: 4, settings: settings4 }
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version4))

    const stored = await repository.get(sampleCv.id)

    expect(stored.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect({ ...stored, schemaVersion: 4, settings: settings4 }).toEqual(version4)
    expect(stored.settings.template).toBe('modern')
  })

  test('a CV saved before CV language existed (version 5) opens in Polish, otherwise unchanged', async () => {
    const englishVersion5 = { ...version5, name: 'My CV', settings: { ...settingsWithoutLanguage, template: 'bold' } }
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(englishVersion5))

    const stored = await repository.get(sampleCv.id)

    expect(stored.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect(stored.settings.language).toBe('pl')
    const { language: _storedLanguage, ...storedSettings } = stored.settings
    expect({ ...stored, schemaVersion: 5, settings: storedSettings }).toEqual(englishVersion5)
  })

  test('an imported file from before CV language existed (version 5) is in Polish', async () => {
    const imported = await repository.importJson(JSON.stringify(version5))

    expect(imported.settings.language).toBe('pl')
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  test('a file from the version after CV language (version 7) comes from a newer version of the app', async () => {
    const error = await repository.importJson(JSON.stringify({ ...sampleCv, schemaVersion: 7 })).catch((error: unknown) => error)

    expect((error as InvalidCvFileError).reason).toBe('newer-version')
  })

  test('migrations are applied one after another, from the file version up to the current one', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(versionMinus1))

    expect(await repository.get(sampleCv.id)).toEqual(sampleCv)
  })

  test('an imported file with an older schema version is migrated', async () => {
    const imported = await repository.importJson(JSON.stringify(versionMinus1))

    expect(imported.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect(imported.header).toEqual(sampleCv.header)
    expect(await repository.get(imported.id)).toEqual(imported)
  })

  test('an edited CV from an older file is saved in the current version', async () => {
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, `${sampleCv.id}.json`), JSON.stringify(version0))

    await repository.rename(sampleCv.id, 'Nowa nazwa')

    const stored = JSON.parse(await readFile(join(cvDir, `${sampleCv.id}.json`), 'utf8'))
    expect(stored.schemaVersion).toBe(CV_SCHEMA_VERSION)
    expect(stored.header.fullName).toBe(fullName)
    expect(stored.tags).toEqual([])
  })

  test('a file with a version that has no migration is damaged and left untouched', async () => {
    const content = JSON.stringify({ ...version0, schemaVersion: -2 })
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'old.json'), content)

    expect(await repository.list()).toEqual([{ status: 'damaged', id: 'old', reason: 'damaged' }])
    await expect(repository.importJson(content)).rejects.toMatchObject({ reason: 'not-a-cv' })
    expect(await readFile(join(cvDir, 'old.json'), 'utf8')).toBe(content)
  })

  test('a file a migration cannot handle is damaged', async () => {
    const content = JSON.stringify({ ...version0, header: null })
    await mkdir(cvDir, { recursive: true })
    await writeFile(join(cvDir, 'broken.json'), content)

    expect(await repository.list()).toEqual([{ status: 'damaged', id: 'broken', reason: 'damaged' }])
    await expect(repository.importJson(content)).rejects.toMatchObject({ reason: 'not-a-cv' })
  })
})
