import { useEffect, useState } from 'react'
import type { AppScreen, MenuCommand } from '../../shared/api'
import { ClauseLibrary } from './ClauseLibrary'
import { CvScreen } from './CvScreen'
import type { CvDocument } from './domain/schema'
import { Library } from './Library'
import { SponsorBar } from './SponsorBar'
import './app.css'

// Biblioteka CV może dostać komendę menu Plik (Nowe CV, Dodaj przykładowe CV, Importuj…) wydaną w edytorze:
// edytor najpierw z niej wychodzi, a biblioteka wykonuje ją raz po zamontowaniu.
type Screen = { kind: 'library'; command?: MenuCommand } | { kind: 'clauses' } | { kind: 'cv'; document: CvDocument }

const appScreen = { library: 'library', clauses: 'clauses', cv: 'editor' } as const satisfies Record<Screen['kind'], AppScreen>

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'library' })
  // Filtr listy CV po tagach – trzymany tutaj, bo ekran listy jest odmontowywany przy przejściu do edytora / klauzul.
  // Żyje tylko w pamięci, więc po ponownym uruchomieniu aplikacji jest pusty.
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const showLibrary = (command?: MenuCommand) => setScreen({ kind: 'library', command })

  // Proces główny wie, który ekran jest otwarty: od tego zależy aktywność menu Plik i Cofnij / Ponów.
  useEffect(() => window.api.menu.setScreen(appScreen[screen.kind]), [screen.kind])

  // Powłoka aplikacji: przełącznik ekranów nad jedną, wspólną belką Sponsor bar. Belka zajmuje stałą wysokość
  // na dole okna, a ekran kurczy się o nią – nic nie nachodzi na podgląd stron ani formularze.
  return (
    <div className="app-shell">
      <div className="app-screen">
        {screen.kind === 'cv' ? (
          <CvScreen document={screen.document} onBack={showLibrary} />
        ) : screen.kind === 'clauses' ? (
          <ClauseLibrary onBack={() => showLibrary()} />
        ) : (
          <Library
            initialCommand={screen.command}
            tagFilter={tagFilter}
            onTagFilterChange={setTagFilter}
            onOpen={(document) => setScreen({ kind: 'cv', document })}
            onOpenClauses={() => setScreen({ kind: 'clauses' })}
          />
        )}
      </div>
      <SponsorBar />
    </div>
  )
}
