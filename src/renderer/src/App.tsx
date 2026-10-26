import { useState } from 'react'
import { ClauseLibrary } from './ClauseLibrary'
import { CvScreen } from './CvScreen'
import type { CvDocument } from './domain/schema'
import { Library } from './Library'
import './app.css'

type Screen = { kind: 'library' } | { kind: 'clauses' } | { kind: 'cv'; document: CvDocument }

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'library' })
  // Filtr listy CV po tagach – trzymany tutaj, bo ekran listy jest odmontowywany przy przejściu do edytora / klauzul.
  // Żyje tylko w pamięci, więc po ponownym uruchomieniu aplikacji jest pusty.
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const showLibrary = () => setScreen({ kind: 'library' })

  switch (screen.kind) {
    case 'cv':
      return <CvScreen document={screen.document} onBack={showLibrary} />
    case 'clauses':
      return <ClauseLibrary onBack={showLibrary} />
    case 'library':
      return (
        <Library
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          onOpen={(document) => setScreen({ kind: 'cv', document })}
          onOpenClauses={() => setScreen({ kind: 'clauses' })}
        />
      )
  }
}
