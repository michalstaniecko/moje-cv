import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, test } from 'vitest'
import { HELP_URL, PRIVACY_URL } from './links'

// Strony pomocy i polityki prywatności publikuje GitHub Pages z katalogu `docs/` (#45). Adresy w aplikacji
// (`./links`) i ścieżki stron muszą się zgadzać, bo inaczej menu Pomoc otwiera 404.
const DOCS = join(__dirname, '../../docs')
const PAGES_BASE = 'https://michalstaniecko.github.io/moje-cv/'

// Ścieżka na stronach Pages (np. `/privacy/`) dla adresu z aplikacji.
function sitePath(url: string): string {
  expect(url.startsWith(PAGES_BASE)).toBe(true)
  return `/${url.slice(PAGES_BASE.length)}`
}

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
  test('the English help page is published at the help URL', () => {
    const path = sitePath(HELP_URL)
    expect(path).toBe('/')
    expect(existsSync(pageFile(path))).toBe(true)
    expect(frontMatter(pageFile(path))).toMatchObject({ permalink: path, lang: 'en' })
  })

  test('the English privacy policy is published at the privacy URL', () => {
    const path = sitePath(PRIVACY_URL)
    expect(path).toBe('/privacy/')
    expect(existsSync(pageFile(path))).toBe(true)
    expect(frontMatter(pageFile(path))).toMatchObject({ permalink: path, lang: 'en' })
  })

  test.each([
    ['help', HELP_URL, '/pl/'],
    ['privacy policy', PRIVACY_URL, '/pl/privacy/']
  ])('the Polish %s is published under /pl/', (_name, url, polishPath) => {
    expect(`/pl${sitePath(url)}`).toBe(polishPath)
    expect(existsSync(pageFile(polishPath))).toBe(true)
    expect(frontMatter(pageFile(polishPath))).toMatchObject({ permalink: polishPath, lang: 'pl' })
  })

  test.each([
    [sitePath(HELP_URL), '/pl/'],
    [sitePath(PRIVACY_URL), '/pl/privacy/']
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
