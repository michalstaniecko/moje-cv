import type { InterfaceLanguage } from './languages'

// Formy liczby mnogiej według kategorii `Intl.PluralRules` (angielski: one/other, polski: one/few/many).
// `other` jest wymagana – to forma dla kategorii, których język nie podał.
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, (count: number) => string>> & {
  other: (count: number) => string
}

export function plural(language: InterfaceLanguage, forms: PluralForms, count: number): string {
  const form = forms[new Intl.PluralRules(language).select(count)] ?? forms.other
  return form(count)
}
