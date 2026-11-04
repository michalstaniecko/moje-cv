import { cs } from './cs'
import { de } from './de'
import { en, type Dictionary } from './en'
import { es } from './es'
import { fr } from './fr'
import { id } from './id'
import { it } from './it'
import { nl } from './nl'
import { pl } from './pl'
import { pt } from './pt'
import { ro } from './ro'
import { ru } from './ru'
import { sv } from './sv'
import { tr } from './tr'
import { uk } from './uk'
import { vi } from './vi'

// Obsługiwane języki interfejsu. Nowy język to nowy słownik, jego Sample CV i jedna pozycja tutaj.
// Nazwa języka jest zapisana w nim samym, żeby dało się go znaleźć bez znajomości bieżącego języka.
// Kolejność to kolejność w menu Language i na liście CV language: alfabetycznie według tych nazw (alfabet łaciński
// przed cyrylicą). Jeden słownik na język: `pt` jest brazylijski, `es` europejski w neutralnej wersji.
export const interfaceLanguages = {
  id: { name: 'Bahasa Indonesia', dictionary: id },
  cs: { name: 'Čeština', dictionary: cs },
  de: { name: 'Deutsch', dictionary: de },
  en: { name: 'English', dictionary: en },
  es: { name: 'Español', dictionary: es },
  fr: { name: 'Français', dictionary: fr },
  it: { name: 'Italiano', dictionary: it },
  nl: { name: 'Nederlands', dictionary: nl },
  pl: { name: 'Polski', dictionary: pl },
  pt: { name: 'Português', dictionary: pt },
  ro: { name: 'Română', dictionary: ro },
  sv: { name: 'Svenska', dictionary: sv },
  vi: { name: 'Tiếng Việt', dictionary: vi },
  tr: { name: 'Türkçe', dictionary: tr },
  ru: { name: 'Русский', dictionary: ru },
  uk: { name: 'Українська', dictionary: uk }
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

// Język interfejsu: wybór użytkownika, a bez niego pierwszy obsługiwany język systemu (np. `pl-PL` → `pl`,
// `pt-PT` → `pt`), a w ostateczności angielski.
export function resolveInterfaceLanguage(
  preference: InterfaceLanguage | undefined,
  systemLanguages: readonly string[]
): InterfaceLanguage {
  if (preference) return preference
  const supported = systemLanguages.map((tag) => tag.toLowerCase().split(/[-_]/)[0]).find(isInterfaceLanguage)
  return supported ?? fallbackLanguage
}
