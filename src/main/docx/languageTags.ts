import type { CvLanguage } from '../../renderer/src/domain/schema'

// Język dokumentu DOCX (`w:lang`) dla CV language: pełny tag BCP 47 z regionem, bo sprawdzanie pisowni w edytorach
// zależy od regionu. Region odpowiada wariantowi słownika (`pt` brazylijski, `es` europejski – zob. languages.ts).
// `Record` wymusza wpis przy nowym języku (krok w checkliście w shared/i18n/languages.ts).
const DOCX_LANGUAGE_TAGS: Record<CvLanguage, string> = {
  id: 'id-ID',
  cs: 'cs-CZ',
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  pt: 'pt-BR',
  ro: 'ro-RO',
  sv: 'sv-SE',
  vi: 'vi-VN',
  tr: 'tr-TR',
  ru: 'ru-RU',
  uk: 'uk-UA'
}

export function docxLanguageTag(language: CvLanguage): string {
  return DOCX_LANGUAGE_TAGS[language]
}
