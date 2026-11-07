import { useEffect, useState } from 'react'
import { useDictionary } from './i18n'

// Wersja aplikacji z procesu głównego, pobierana raz na okno i trzymana w pamięci modułu.
let cachedVersion: string | null = null
let pendingVersion: Promise<string> | null = null

// Do czasu odpowiedzi zwraca `null`, żeby nie migać tekstem zastępczym.
export function useAppVersion(): string | null {
  const [version, setVersion] = useState(cachedVersion)

  useEffect(() => {
    if (cachedVersion) return
    let active = true
    pendingVersion ??= window.api.app.version().then((value) => (cachedVersion = value))
    void pendingVersion.then((value) => {
      if (active) setVersion(value)
    })
    return () => {
      active = false
    }
  }, [])

  return version
}

// Dyskretny tekst „CV Press 1.0.0”. Nazwa i numer są takie same we wszystkich językach, więc bez nowego klucza
// w słownikach. Zwykły akapit, nie <footer>: landmarkiem `contentinfo` jest już Sponsor bar.
export function AppVersion({ className }: { className: string }) {
  const version = useAppVersion()
  const { appName } = useDictionary()
  if (!version) return null
  return <p className={className}>{`${appName} ${version}`}</p>
}
