import type { CvFontId } from '../cvFonts'
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

// Obsługiwane języki interfejsu – zarazem CV language (domain/schema.ts).
// Nowy język (jedyne miejsce z tą listą kroków):
// 1. słownik w shared/i18n,
// 2. jego Sample CV w domain/samples,
// 3. pozycja tutaj (nazwa, słownik, font startowy CV),
// 4. tag języka dla DOCX export (pełny tag BCP 47 z regionem) w main/docx/languageTags.ts – wymuszony kompilacją,
// 5. podbicie CV_SCHEMA_VERSION z pustą migracją w migrations.ts – CV language jest ścisłym `z.enum`, więc starsza
//    aplikacja musi zgłosić „plik z nowszej wersji”, a nie „niepoprawny plik” (ADR 0002).
// Nazwa języka jest zapisana w nim samym, żeby dało się go znaleźć bez znajomości bieżącego języka.
// Kolejność to kolejność w menu Language i na liście CV language: alfabetycznie według tych nazw (alfabet łaciński
// przed cyrylicą). Jeden słownik na język: `pt` jest brazylijski, `es` europejski w neutralnej wersji.
// `defaultCvFont` – font, z którym startuje nowe CV (także Sample CV) w tym CV language: Lato, chyba że nie ma
// pełnego alfabetu języka (cyrylica, wietnamski) – wtedy Source Sans 3.
export const interfaceLanguages = {
  id: { name: 'Bahasa Indonesia', dictionary: id, defaultCvFont: 'lato' },
  cs: { name: 'Čeština', dictionary: cs, defaultCvFont: 'lato' },
  de: { name: 'Deutsch', dictionary: de, defaultCvFont: 'lato' },
  en: { name: 'English', dictionary: en, defaultCvFont: 'lato' },
  es: { name: 'Español', dictionary: es, defaultCvFont: 'lato' },
  fr: { name: 'Français', dictionary: fr, defaultCvFont: 'lato' },
  it: { name: 'Italiano', dictionary: it, defaultCvFont: 'lato' },
  nl: { name: 'Nederlands', dictionary: nl, defaultCvFont: 'lato' },
  pl: { name: 'Polski', dictionary: pl, defaultCvFont: 'lato' },
  pt: { name: 'Português', dictionary: pt, defaultCvFont: 'lato' },
  ro: { name: 'Română', dictionary: ro, defaultCvFont: 'lato' },
  sv: { name: 'Svenska', dictionary: sv, defaultCvFont: 'lato' },
  vi: { name: 'Tiếng Việt', dictionary: vi, defaultCvFont: 'source-sans-3' },
  tr: { name: 'Türkçe', dictionary: tr, defaultCvFont: 'lato' },
  ru: { name: 'Русский', dictionary: ru, defaultCvFont: 'source-sans-3' },
  uk: { name: 'Українська', dictionary: uk, defaultCvFont: 'source-sans-3' }
} satisfies Record<string, { name: string; dictionary: Dictionary; defaultCvFont: CvFontId }>

export type InterfaceLanguage = keyof typeof interfaceLanguages

export const interfaceLanguageCodes = Object.keys(interfaceLanguages) as InterfaceLanguage[]

const fallbackLanguage: InterfaceLanguage = 'en'

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return typeof value === 'string' && Object.hasOwn(interfaceLanguages, value)
}

export function defaultCvFontFor(language: InterfaceLanguage): CvFontId {
  return interfaceLanguages[language].defaultCvFont
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
