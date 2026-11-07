import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import { useDictionary } from './i18n'

// Błąd renderowania Reacta zamiast pustego okna pokazuje ekran „Coś poszło nie tak”, który zastępuje całą powłokę
// (także Sponsor bar). Ekran jest stanem, nie trasą: po przeładowaniu aplikacja startuje od biblioteki CV.
// Oczekującą zmianę w edytorze zapisuje jego sprzątanie przy odmontowaniu (`editor.flush()`), a przy przeładowaniu
// `beforeunload`. Musi leżeć wewnątrz `InterfaceLanguageProvider`, bo tekst pochodzi ze słownika.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Rendering error', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

function CrashScreen() {
  const t = useDictionary().crash
  const reload = useRef<HTMLButtonElement>(null)
  useEffect(() => reload.current?.focus(), [])

  return (
    <main className="crash-screen">
      <h1 role="alert">{t.title}</h1>
      <p>{t.message}</p>
      <button ref={reload} type="button" className="button-primary" onClick={() => void window.api.app.reload()}>
        {t.reload}
      </button>
    </main>
  )
}
