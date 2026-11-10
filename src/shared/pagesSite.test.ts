import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, test } from 'vitest'

// Źródła stron pomocy i polityki prywatności dla GitHub Pages w katalogu `docs/` (#45). Aplikacja otwiera dziś
// strony z `ihumbak.website` (`./links`), więc ten test sprawdza tylko spójność samych źródeł w `docs/`.
const DOCS = join(__dirname, '../../docs')
const HELP_PATH = '/'
const PRIVACY_PATH = '/privacy/'

// Plik źródłowy Jekylla, z którego powstaje strona pod daną ścieżką (`/pl/privacy/` → `docs/pl/privacy/index.md`).
function pageFile(path: string): string {
  return join(DOCS, path, 'index.md')
}

function frontMatter(file: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(file, 'utf8'))
  const [, yaml = ''] = match ?? []
  return Object.fromEntries(
    yaml
      .split('\n')
      .map((line) => /^(\w+):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(([, key = '', value = '']) => [key, value.replace(/^['"]|['"]$/g, '')])
  )
}

describe('GitHub Pages site', () => {
  test('the English help page is published at /', () => {
    const path = HELP_PATH
    expect(existsSync(pageFile(path))).toBe(true)
    expect(frontMatter(pageFile(path))).toMatchObject({ permalink: path, lang: 'en' })
  })

  test('the English privacy policy is published at /privacy/', () => {
    const path = PRIVACY_PATH
    expect(existsSync(pageFile(path))).toBe(true)
    expect(frontMatter(pageFile(path))).toMatchObject({ permalink: path, lang: 'en' })
  })

  test.each([
    ['help', HELP_PATH, '/pl/'],
    ['privacy policy', PRIVACY_PATH, '/pl/privacy/']
  ])('the Polish %s is published under /pl/', (_name, path, polishPath) => {
    expect(`/pl${path}`).toBe(polishPath)
    expect(existsSync(pageFile(polishPath))).toBe(true)
    expect(frontMatter(pageFile(polishPath))).toMatchObject({ permalink: polishPath, lang: 'pl' })
  })

  test.each([
    [HELP_PATH, '/pl/'],
    [PRIVACY_PATH, '/pl/privacy/']
  ])('the language switcher links %s and %s to each other', (english, polish) => {
    expect(frontMatter(pageFile(english)).translation).toBe(polish)
    expect(frontMatter(pageFile(polish)).translation).toBe(english)
  })

  test('developer docs in docs/ are excluded, so only the help and privacy pages are published', () => {
    // GitHub Pages publikuje też pliki Markdown bez front matter, więc każdy dokument deweloperski musi być
    // na liście `exclude` w `docs/_config.yml`. Katalogi zaczynające się od `_` (np. `_layouts`) Jekyll pomija sam.
    const config = readFileSync(join(DOCS, '_config.yml'), 'utf8')
    const excludeList = config.slice(config.indexOf('\nexclude:'))
    const excluded = [...excludeList.matchAll(/^\s+-\s+(\S+)\s*$/gm)].map(([, entry = '']) => entry.replace(/\/$/, ''))

    const published = readdirSync(DOCS, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(md|markdown|html)$/.test(file))
      .filter((file) => !file.split(sep).some((part) => part.startsWith('_')))
      .filter((file) => !excluded.some((entry) => file === entry || file.startsWith(`${entry}${sep}`)))
      .sort()

    expect(published).toEqual(
      ['index.md', join('pl', 'index.md'), join('pl', 'privacy', 'index.md'), join('privacy', 'index.md')].sort()
    )
  })
})
