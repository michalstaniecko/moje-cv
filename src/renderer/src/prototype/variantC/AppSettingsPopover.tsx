// PROTOTYP – wariant C: „Ustawienia aplikacji” pod ⚙ w pasku narzędzi. Dotyczą całej aplikacji, nie tego CV, więc są
// celowo poza kolumną Projekt. Wszystko tu to atrapa (dziś: menu natywne i osobny ekran biblioteki klauzul).
import { useId, useState } from 'react'
import { interfaceLanguageCodes, interfaceLanguages, type InterfaceLanguage } from '../../../../shared/i18n/languages'
import type { Clause } from '../../domain/schema'
import { StubBadge } from '../StubBadge'

type Appearance = 'system' | 'light' | 'dark'

export function AppSettingsPopover({ clauses }: { clauses: Clause[] }) {
  const id = useId().replace(/:/g, '')
  const popoverId = `pc-app-settings-${id}`
  const [language, setLanguage] = useState<InterfaceLanguage>('pl')
  const [appearance, setAppearance] = useState<Appearance>('system')

  return (
    <>
      <button
        type="button"
        className="pc-gear"
        popoverTarget={popoverId}
        aria-label="Ustawienia aplikacji"
        title="Ustawienia aplikacji"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M11.3 1.5l.4 2.1a6.6 6.6 0 0 1 1.6.9l2-.7 1.3 2.3-1.6 1.4a6.7 6.7 0 0 1 0 1.9l1.6 1.4-1.3 2.3-2-.7a6.6 6.6 0 0 1-1.6.9l-.4 2.1H8.7l-.4-2.1a6.6 6.6 0 0 1-1.6-.9l-2 .7-1.3-2.3 1.6-1.4a6.7 6.7 0 0 1 0-1.9L3.4 6.1l1.3-2.3 2 .7a6.6 6.6 0 0 1 1.6-.9l.4-2.1h2.6zM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
          />
        </svg>
      </button>
      <div id={popoverId} popover="auto" className="pc-app-settings" aria-label="Ustawienia aplikacji">
        <h2 className="pc-sheet-title">Ustawienia aplikacji</h2>
        <p className="pc-muted">Dotyczą całej aplikacji i wszystkich CV – nie zmieniają tego dokumentu.</p>

        <label className="pc-field">
          <span className="pc-field-label">
            Język interfejsu <StubBadge />
          </span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as InterfaceLanguage)}>
            {interfaceLanguageCodes.map((code) => (
              <option key={code} value={code}>
                {interfaceLanguages[code].name}
              </option>
            ))}
          </select>
        </label>

        <div className="pc-field">
          <span className="pc-field-label">
            Wygląd <StubBadge />
          </span>
          <div role="radiogroup" aria-label="Wygląd" className="pc-segmented pc-segmented--full">
            {(
              [
                ['system', 'Systemowy'],
                ['light', 'Jasny'],
                ['dark', 'Ciemny']
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="pc-segment">
                <input
                  type="radio"
                  name={`${popoverId}-appearance`}
                  checked={appearance === value}
                  onChange={() => setAppearance(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pc-field">
          <span className="pc-field-label">
            Biblioteka klauzul zgody <StubBadge />
          </span>
          <button type="button" className="pc-link-row" onClick={() => undefined}>
            <span>Zarządzaj klauzulami…</span>
            <span className="pc-muted">{clauses.length} zapisane</span>
          </button>
        </div>
      </div>
    </>
  )
}
