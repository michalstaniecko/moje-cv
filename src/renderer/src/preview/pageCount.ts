import { dictionaryFor, type InterfaceLanguage } from '../../../shared/i18n/languages'
import { plural } from '../../../shared/i18n/plural'

// Zalecana długość CV – dłuższe dostaje w podglądzie informację, że warto je skrócić.
export const RECOMMENDED_MAX_PAGES = 2

// Liczba stron z formą liczby mnogiej języka interfejsu, np. „1 page / 2 pages”, „1 strona / 2 strony / 5 stron”.
export function pageCountLabel(count: number, language: InterfaceLanguage): string {
  return plural(language, dictionaryFor(language).preview.pages, count)
}
