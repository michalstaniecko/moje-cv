import type { Section } from '../domain/schema'
import type { MoveOffset } from '../editor/moveShortcut'
import type { Fragment } from './fragmentRects'

// Menu fragmentu na stronie (docs/specs/inline-editing-redesign.md, Q11): czysta logika – co ma uchwyt, dokąd
// przenieść i dokąd przejść z fokusem po ukryciu sekcji. Bez DOM, żeby dało się testować w Node.

// Przeniesienie o jedną pozycję wśród elementów widocznych na stronach: `toIndex` – nowe miejsce w całej liście
// (z ukrytymi i pustymi elementami), `position`/`total` – miejsce wśród widocznych (komunikat dla czytnika ekranu).
export type MovePlan = { toIndex: number; position: number; total: number }

// `ids` – kolejność wszystkich elementów (sekcji CV albo wpisów sekcji), `shown` – te, które są na stronach.
// Element przeskakuje elementy, których nie widać (ukryte, puste) – inaczej „Przenieś wyżej” niczego by na stronie
// nie zmieniło. Na krańcu widocznych albo dla elementu, którego nie widać – `null`.
export function moveAmongShown(ids: string[], shown: ReadonlySet<string>, id: string, offset: MoveOffset): MovePlan | null {
  const visible = ids.filter((candidate) => shown.has(candidate))
  const from = visible.indexOf(id)
  const to = from + offset
  if (from === -1 || to < 0 || to >= visible.length) return null
  return { toIndex: ids.indexOf(visible[to]!), position: to + 1, total: visible.length }
}

// Fragmenty z uchwytem menu: tytuły sekcji i wpisy (stanowiska, wykształcenie), każdy raz – na pierwszej stronie, na
// której jest (wpis rozdzielony podziałem stron ma uchwyt tylko przy swoim początku).
export function* handleFragments(fragments: Fragment[]): Generator<Fragment> {
  const seen = new Set<string>()
  for (const fragment of fragments) {
    const { kind } = fragment.target
    if (kind !== 'sectionTitle' && kind !== 'experienceItem' && kind !== 'educationItem') continue
    if (seen.has(fragment.key)) continue
    seen.add(fragment.key)
    yield fragment
  }
}

// Klucze fragmentów (`fragmentKey`) wszystkiego, co sekcja pokazuje na stronach.
export function sectionFragmentKeys(section: Section): Set<string> {
  return new Set([
    `sectionTitle:${section.id}`,
    `list:${section.id}`,
    ...(section.type === 'list' ? [] : section.items.map((item) => `item:${item.id}`))
  ])
}

// Fragment, na który przechodzi fokus po ukryciu sekcji (jej fragmenty `keys` znikają ze stron): pierwszy po niej,
// a gdy po niej nic nie ma – ostatni przed nią.
export function neighbourAfterHiding(fragments: Fragment[], keys: ReadonlySet<string>): string | undefined {
  const inSection = (fragment: Fragment) => keys.has(fragment.key)
  const first = fragments.findIndex(inSection)
  if (first === -1) return undefined
  const last = fragments.length - 1 - [...fragments].reverse().findIndex(inSection)
  return (
    fragments.slice(last + 1).find((fragment) => !inSection(fragment))?.key ??
    fragments.slice(0, first).reverse().find((fragment) => !inSection(fragment))?.key
  )
}
