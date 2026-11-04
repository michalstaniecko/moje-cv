import type { InvalidTagReason } from '../../../shared/api'

// Najdłuższy tag – żeby chip mieścił się w wierszu listy CV.
export const MAX_TAG_LENGTH = 30

// Tag nie spełnia reguł (np. jest za długi). Użytkownik dostaje powód (`reason`), a nie treść komunikatu.
export class InvalidTagError extends Error {
  constructor(readonly reason: InvalidTagReason) {
    super(`Niepoprawny tag: ${reason}`)
  }
}

// Tag bez skrajnych spacji, z pojedynczymi spacjami w środku (z samych spacji zostaje pusty tekst).
export const cleanTag = (tag: string) => tag.replace(/\s+/g, ' ').trim()

// Tagi równe bez względu na wielkość liter mają ten sam klucz. Zawsze po polsku, niezależnie od języka systemu
// (po turecku „I” → „ı”) – tagi nie należą do żadnego języka (zob. GLOSSARY.md).
export const tagKey = (tag: string) => tag.toLocaleLowerCase('pl')

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

// Porządek tagów do wyświetlenia: alfabetycznie z polskimi literami na swoich miejscach (ą po a, ł po l, ś po s),
// niezależnie od języka interfejsu – tagi nie należą do żadnego języka (zob. GLOSSARY.md).
const collator = new Intl.Collator('pl')

export const sortTags = (tags: readonly string[]): string[] => [...tags].sort(collator.compare)
