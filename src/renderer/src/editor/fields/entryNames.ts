import type { Dictionary } from '../../../../shared/i18n/en'
import type { EducationItem } from '../../domain/schema'

// Nazwy wpisów w interfejsie (legenda w CV form, uchwyt i komunikaty kolejności, nazwy Page fields): pusta nazwa –
// „Nowe stanowisko” / „Nowe wykształcenie”.
export const entryName = (text: string, fallback: string) => text.trim() || fallback

export const educationName = (item: EducationItem, t: Dictionary['editor']) =>
  entryName([item.level, item.field].filter((part) => part.trim()).join(', '), t.newEducation)
