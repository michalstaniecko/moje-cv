import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Dictionary } from '../../shared/i18n/en'
import { dictionaryFor, type InterfaceLanguage } from '../../shared/i18n/languages'

const DictionaryContext = createContext<Dictionary | null>(null)

// Język interfejsu z procesu głównego. Ekrany pojawiają się dopiero, gdy jest znany (bez mignięcia innym językiem),
// a jego zmiana od razu przerysowuje okno i ustawia `lang` oraz tytuł dokumentu.
export function InterfaceLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<InterfaceLanguage | null>(null)

  useEffect(() => {
    let active = true
    const unsubscribe = window.api.language.onChange(setLanguage)
    void window.api.language.get().then((current) => {
      if (active) setLanguage((known) => known ?? current)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!language) return
    document.documentElement.lang = language
    document.title = dictionaryFor(language).appName
  }, [language])

  if (!language) return null
  return <DictionaryContext.Provider value={dictionaryFor(language)}>{children}</DictionaryContext.Provider>
}

// Słownik bieżącego języka interfejsu.
export function useDictionary(): Dictionary {
  const dictionary = useContext(DictionaryContext)
  if (!dictionary) throw new Error('useDictionary poza InterfaceLanguageProvider')
  return dictionary
}
