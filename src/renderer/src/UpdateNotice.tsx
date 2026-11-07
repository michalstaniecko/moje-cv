import { useEffect, useState } from 'react'
import { useDictionary } from './i18n'

// Update notice (zob. GLOSSARY.md, ADR-0006): zamykany pasek w bibliotece CV, gdy w `.dmg` jest nowsza wersja.
// Tylko informuje – „Download” otwiera stronę wydania w przeglądarce (adres buduje proces główny). Nie przejmuje
// fokusu; tekst w `role="status"`, więc czytnik ogłasza pojawienie się paska. Wersję podaje proces główny przy
// montowaniu (zdarzenie mogło przyjść, gdy był otwarty edytor) i w zdarzeniu `onNotice`; w Mac App Store zawsze `null`.
export function UpdateNotice() {
  const [version, setVersion] = useState<string | null>(null)
  const { appName, updates: t } = useDictionary()

  useEffect(() => {
    let active = true
    void window.api.updates.notice().then((value) => {
      if (active && value) setVersion(value)
    })
    const unsubscribe = window.api.updates.onNotice((value) => setVersion(value))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (!version) return null

  return (
    <section className="update-notice" aria-label={t.noticeLabel}>
      <p className="update-notice-message" role="status">
        {t.available(appName, version)}
      </p>
      <button type="button" className="button-primary" onClick={() => void window.api.updates.download()}>
        {t.download}
      </button>
      <button
        type="button"
        onClick={() => {
          setVersion(null)
          void window.api.updates.dismiss()
        }}
      >
        {t.dismiss}
      </button>
    </section>
  )
}
