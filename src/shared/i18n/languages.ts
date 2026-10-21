import { en, type Dictionary } from './en'
import { pl } from './pl'

// Obsługiwane języki interfejsu. Nowy język to nowy słownik i jedna pozycja tutaj.
// Nazwa języka jest zapisana w nim samym, żeby dało się go znaleźć bez znajomości bieżącego języka.
export const interfaceLanguages = {
  en: { name: 'English', dictionary: en },
  pl: { name: 'Polski', dictionary: pl }
} satisfies Record<string, { name: string; dictionary: Dictionary }>

export type InterfaceLanguage = keyof typeof interfaceLanguages

export const interfaceLanguageCodes = Object.keys(interfaceLanguages) as InterfaceLanguage[]

const fallbackLanguage: InterfaceLanguage = 'en'

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return typeof value === 'string' && Object.hasOwn(interfaceLanguages, value)
}

export function dictionaryFor(language: InterfaceLanguage): Dictionary {
  return interfaceLanguages[language].dictionary
}

// Język interfejsu: wybór użytkownika, a bez niego pierwszy obsługiwany język systemu (np. `pl-PL` → `pl`),
// a w ostateczności angielski.
export function resolveInterfaceLanguage(
  preference: InterfaceLanguage | undefined,
  systemLanguages: readonly string[]
): InterfaceLanguage {
  if (preference) return preference
  const supported = systemLanguages.map((tag) => tag.toLowerCase().split(/[-_]/)[0]).find(isInterfaceLanguage)
  return supported ?? fallbackLanguage
}
