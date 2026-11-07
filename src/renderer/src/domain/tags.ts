import type { InvalidTagReason } from '../../../shared/api'

// Najdłuższy tag – żeby chip mieścił się w wierszu listy CV.
export const MAX_TAG_LENGTH = 30

// Tag nie spełnia reguł (np. jest za długi). Użytkownik dostaje powód (`reason`), a nie treść komunikatu.
export class InvalidTagError extends Error {
  constructor(readonly reason: InvalidTagReason) {
    super(`Invalid tag: ${reason}`)
  }
}

// Tag bez skrajnych spacji, z pojedynczymi spacjami w środku (z samych spacji zostaje pusty tekst).
export const cleanTag = (tag: string) => tag.replace(/\s+/g, ' ').trim()

// Stały locale tagów. Tagi nie należą do żadnego języka (zob. GLOSSARY.md), a ich klucze i kolejność muszą być takie
// same przy każdym języku interfejsu i systemu – inaczej ten sam tag dostawałby inny klucz (po turecku „I” → „ı”)
// i dwa CV z tym samym tagiem przestałyby się zgadzać po zmianie języka. Polski stawia polskie litery na ich
// miejscach w alfabecie.
const TAG_LOCALE = 'pl'

// Tagi równe bez względu na wielkość liter mają ten sam klucz (małe litery w TAG_LOCALE).
export const tagKey = (tag: string) => tag.toLocaleLowerCase(TAG_LOCALE)

// Tagi CV: oczyszczone (cleanTag), bez pustych i bez powtórzeń różniących się tylko wielkością liter
// (zostaje pierwsza pisownia). Za długi tag kończy się InvalidTagError.
export function normalizeTags(tags: readonly string[]): string[] {
  const normalized = new Map<string, string>()
  for (const tag of tags) {
    const clean = cleanTag(tag)
    if (!clean) continue
    if (clean.length > MAX_TAG_LENGTH) throw new InvalidTagError('too-long')
    const key = tagKey(clean)
    if (!normalized.has(key)) normalized.set(key, clean)
  }
  return [...normalized.values()]
}

// Porządek tagów do wyświetlenia: alfabetycznie w TAG_LOCALE, z polskimi literami na swoich miejscach
// (ą po a, ł po l, ś po s), niezależnie od języka interfejsu.
const collator = new Intl.Collator(TAG_LOCALE)

export const sortTags = (tags: readonly string[]): string[] => [...tags].sort(collator.compare)
